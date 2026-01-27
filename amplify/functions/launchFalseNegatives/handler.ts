import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/launchFalseNegatives';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  SendMessageBatchCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import pLimit from 'p-limit';
import {
  createQueue as createQueueMutation,
  updateQueue as updateQueueMutation,
  createTasksOnAnnotationSet as createTasksOnAnnotationSetMutation,
  updateProject as updateProjectMutation,
  updateProjectMemberships as updateProjectMembershipsMutation,
} from './graphql/mutations';
import {
  annotationsByAnnotationSetId,
  imagesByProjectId,
} from './graphql/queries';

// Configure Amplify so lambda can call the same AppSync API as clients.
Amplify.configure(
  {
    API: {
      GraphQL: {
        endpoint: env.AMPLIFY_DATA_GRAPHQL_ENDPOINT,
        region: env.AWS_REGION,
        defaultAuthMode: 'iam',
      },
    },
  },
  {
    Auth: {
      credentialsProvider: {
        getCredentialsAndIdentityId: async () => ({
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            sessionToken: env.AWS_SESSION_TOKEN,
          },
        }),
        clearCredentialsAndIdentityId: () => {
          /* noop */
        },
      },
    },
  }
);

// Shared AppSync data client using IAM auth.
const client = generateClient({
  authMode: 'iam',
});

// Low-level SQS client for queue management and batching.
const sqsClient = new SQSClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
  },
});

// S3 client for reading large payloads.
const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
  },
});

// Narrow payload/DTO definitions for type safety.
type LaunchQueueOptions = {
  name: string;
  hidden: boolean;
  fifo: boolean;
};

type LaunchFalseNegativesPayload = {
  projectId: string;
  annotationSetId: string;
  queueOptions: LaunchQueueOptions;
  queueTag: string;
  samplePercent: number;
  /** The global tiled location set ID from the project */
  locationSetId: string;
  /** Tiles fetched from the global tiled set by the client */
  locationTiles: MinimalTile[];
  batchSize?: number;
  /** S3 key where the full payload is stored (for large payloads). */
  payloadS3Key?: string;
};

type MinimalTile = {
  id: string;
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

// Simple timer helper to keep logging consistent.
async function withTiming<T>(label: string, action: () => Promise<T>): Promise<T> {
  const start = Date.now();
  console.log(`[Timing] ${label} start`);
  try {
    const result = await action();
    console.log(`[Timing] ${label} complete`, {
      durationMs: Date.now() - start,
    });
    return result;
  } catch (error) {
    console.error(`[Timing] ${label} failed`, {
      durationMs: Date.now() - start,
      error: (error as Error)?.message ?? 'unknown error',
    });
    throw error;
  }
}

// AppSync resolver entry; wraps orchestration in error handling.
export const handler: Handler = async (event) => {
  let payloadS3Key: string | undefined;
  try {
    let payload = parsePayload(event.arguments?.request);

    // If a payloadS3Key is provided, fetch the full payload from S3.
    if (payload.payloadS3Key) {
      payloadS3Key = payload.payloadS3Key;
      console.log('Reading payload from S3', { key: payloadS3Key });
      payload = await readPayloadFromS3(payloadS3Key);
    }

    console.log(
      'launchFalseNegatives invoked',
      JSON.stringify({
        projectId: payload.projectId,
        annotationSetId: payload.annotationSetId,
        samplePercent: payload.samplePercent,
        locationSetId: payload.locationSetId,
        tileCount: payload.locationTiles?.length ?? 0,
      })
    );

    await setProjectStatus(payload.projectId, 'launching');
    await executeGraphql<{ updateProjectMemberships?: string | null }>(
      updateProjectMembershipsMutation,
      { projectId: payload.projectId }
    );

    const result = await handleLaunch(payload);

    // Clean up the S3 payload file after successful processing.
    if (payloadS3Key) {
      await deletePayloadFromS3(payloadS3Key);
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    console.error('Error launching false negatives job', error);
    // Attempt to clean up even on error to avoid orphaned files.
    if (payloadS3Key) {
      try {
        await deletePayloadFromS3(payloadS3Key);
      } catch (cleanupError) {
        console.warn('Failed to clean up S3 payload after error', cleanupError);
      }
    }
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to launch false negatives job',
        error: error?.message ?? 'Unknown error',
      }),
    };
  }
};

// End-to-end workflow for selecting tiles and pushing jobs to workers.
async function handleLaunch(payload: LaunchFalseNegativesPayload) {
  const workerBatchSize = payload.batchSize ?? 200;
  const { projectId, annotationSetId, locationSetId } = payload;

  // Use tiles from the global tiled set (fetched by client from project.tiledLocationSetId)
  const tiles = payload.locationTiles;
  console.log('Using tiles from global tiled set', {
    locationSetId,
    tileCount: tiles.length,
  });

  if (!tiles || tiles.length === 0) {
    throw new Error('No tiles provided - ensure the project has a global tiled set configured');
  }

  if (tiles.length === 0) {
    throw new Error('No tiles available for false negatives workflow');
  }

  const observationMap = await withTiming('fetchObservationPoints', () =>
    fetchObservationPoints(annotationSetId)
  );
  console.log('Fetched observation points', {
    annotationSetId,
    observationImageCount: observationMap.size,
  });

  const annotationMap = await withTiming('fetchAnnotationPoints', () =>
    fetchAnnotationPoints(annotationSetId)
  );
  console.log('Fetched annotations', {
    annotationSetId,
    annotationImageCount: annotationMap.size,
  });

  const imageTimestamps = await withTiming('fetchImageTimestamps', () =>
    fetchImageTimestamps(projectId)
  );
  console.log('Fetched image timestamps', {
    projectId,
    imageCount: imageTimestamps.size,
  });

  const candidateTimingStart = Date.now();
  const candidates = tiles.filter((tile) => {
    const observations = observationMap.get(tile.imageId) || [];
    const annotations = annotationMap.get(tile.imageId) || [];
    // Check if any observed location overlaps with this tile
    const hasObservation = observations.some((obs) =>
      tilesOverlap(tile, obs)
    );
    const hasAnnotation = annotations.some((point) =>
      isInsideTile(point.x, point.y, tile)
    );
    return !hasObservation && !hasAnnotation;
  });
  console.log('Candidate filtering complete', {
    totalTiles: tiles.length,
    candidateCount: candidates.length,
    durationMs: Date.now() - candidateTimingStart,
  });

  candidates.sort((a, b) => {
    const tsA = imageTimestamps.get(a.imageId) ?? 0;
    const tsB = imageTimestamps.get(b.imageId) ?? 0;
    return tsA - tsB;
  });

  const normalizedPercent = Math.min(
    Math.max(payload.samplePercent, 0),
    100
  );
  let sampleCount = Math.floor(
    (candidates.length * normalizedPercent) / 100
  );
  if (normalizedPercent > 0 && sampleCount === 0 && candidates.length > 0) {
    sampleCount = 1;
  }

  const selectionStart = Date.now();
  const selectedTiles =
    sampleCount > 0 && sampleCount < candidates.length
      ? randomSample(candidates, sampleCount)
      : candidates.slice();
  console.log('Tile sampling complete', {
    requestedPercent: payload.samplePercent,
    normalizedPercent,
    sampleCount,
    selectedTiles: selectedTiles.length,
    durationMs: Date.now() - selectionStart,
  });

  if (selectedTiles.length === 0) {
    await setProjectStatus(projectId, 'active');
    console.log('No false-negative candidate tiles were found');
    return {
      message: 'No candidate tiles discovered',
      locationCount: 0,
      queueId: null,
    };
  }

  console.log('Creating queue for false negatives', {
    queueName: payload.queueOptions.name,
    selectedTiles: selectedTiles.length,
  });

  const queue = await withTiming('createQueue', () =>
    createQueue(payload.queueOptions, payload.queueTag, projectId, workerBatchSize)
  );

  await withTiming('enqueueTiles', () =>
    enqueueTiles(queue.url, selectedTiles, annotationSetId, payload.queueTag)
  );

  await withTiming('updateQueueMetadata', () =>
    executeGraphql<{ updateQueue?: { id: string } }>(updateQueueMutation, {
      input: {
        id: queue.id,
        totalBatches: Math.ceil(selectedTiles.length / workerBatchSize),
      },
    })
  );

  await withTiming('createTasksOnAnnotationSet', () =>
    executeGraphql<{ createTasksOnAnnotationSet?: { id: string } }>(
      createTasksOnAnnotationSetMutation,
      {
        input: {
          annotationSetId,
          locationSetId,
        },
      }
    )
  );

  await setProjectStatus(projectId, 'active');
  await withTiming('refreshProjectMemberships', () =>
    executeGraphql<{ updateProjectMemberships?: string | null }>(
      updateProjectMembershipsMutation,
      { projectId }
    )
  );

  console.log('False negatives launch complete', {
    projectId,
    selectedTiles: selectedTiles.length,
  });

  return {
    message: 'False negatives launch request processed',
    locationCount: selectedTiles.length,
    queueId: queue.id,
  };
}


// Validate and hydrate the resolver-supplied string payload.
function parsePayload(request: unknown): LaunchFalseNegativesPayload {
  if (typeof request !== 'string') {
    throw new Error('Launch payload is required');
  }
  const parsed = JSON.parse(request);
  // Allow a minimal payload with just payloadS3Key for S3-based large payloads.
  if (parsed?.payloadS3Key) {
    return parsed as LaunchFalseNegativesPayload;
  }
  if (
    !parsed?.projectId ||
    !parsed?.annotationSetId ||
    !parsed?.queueOptions
  ) {
    throw new Error('Launch payload missing required fields');
  }
  return parsed as LaunchFalseNegativesPayload;
}

// Read the full payload from S3 when it exceeds inline limits.
async function readPayloadFromS3(key: string): Promise<LaunchFalseNegativesPayload> {
  const bucketName = env.OUTPUTS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('OUTPUTS_BUCKET_NAME environment variable not set');
  }
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
  );
  const bodyStr = await response.Body?.transformToString();
  if (!bodyStr) {
    throw new Error('Empty payload from S3');
  }
  const parsed = JSON.parse(bodyStr);
  if (!parsed?.projectId || !parsed?.annotationSetId || !parsed?.queueOptions) {
    throw new Error('S3 payload missing required fields');
  }
  return parsed as LaunchFalseNegativesPayload;
}

// Delete the payload file from S3 after processing.
async function deletePayloadFromS3(key: string): Promise<void> {
  const bucketName = env.OUTPUTS_BUCKET_NAME;
  if (!bucketName) {
    console.warn('OUTPUTS_BUCKET_NAME not set, cannot delete payload');
    return;
  }
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
  );
  console.log('Deleted S3 payload', { key });
}

// Custom GraphQL query to fetch observations with location data included
// This avoids N+1 queries by fetching location data in the same query
const observationsWithLocationsQuery = /* GraphQL */ `
  query ObservationsByAnnotationSetIdWithLocations(
    $annotationSetId: ID!
    $limit: Int
    $nextToken: String
  ) {
    observationsByAnnotationSetId(
      annotationSetId: $annotationSetId
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        locationId
        location {
          id
          imageId
          x
          y
          width
          height
        }
      }
      nextToken
    }
  }
`;

// Collect model detection points filtered by confidence/source.
// Fetch observation points - locations that humans have reviewed
// Returns a map of imageId -> array of tile bounds (locations that were observed)
async function fetchObservationPoints(annotationSetId: string) {
  const map = new Map<string, Array<{ x: number; y: number; width: number; height: number }>>();
  let nextToken: string | null | undefined = undefined;

  // Fetch observations with location data included in a single query
  // This eliminates the N+1 query problem
  do {
    const response = (await client.graphql({
      query: observationsWithLocationsQuery,
      variables: {
        annotationSetId,
        limit: 1000,
        nextToken,
      },
    } as any)) as GraphQLResult<{
      observationsByAnnotationSetId?: {
        items?: Array<{
          locationId?: string | null;
          location?: {
            id?: string | null;
            imageId?: string | null;
            x?: number | null;
            y?: number | null;
            width?: number | null;
            height?: number | null;
          } | null;
        }>;
        nextToken?: string | null;
      };
    }>;

    if (response.errors && response.errors.length > 0) {
      throw new Error(
        `GraphQL error fetching observations: ${JSON.stringify(
          response.errors.map((e) => e.message)
        )}`
      );
    }

    const page = response.data?.observationsByAnnotationSetId;
    for (const item of page?.items || []) {
      const location = item?.location;
      if (!location?.imageId) continue;
      
      const list = map.get(location.imageId) || [];
      list.push({
        x: Number(location.x ?? 0),
        y: Number(location.y ?? 0),
        width: Number(location.width ?? 0),
        height: Number(location.height ?? 0),
      });
      map.set(location.imageId, list);
    }
    nextToken = page?.nextToken ?? undefined;
  } while (nextToken);

  return map;
}

// Gather existing human annotations to avoid rework.
async function fetchAnnotationPoints(annotationSetId: string) {
  const map = new Map<string, Array<{ x: number; y: number }>>();
  let nextToken: string | null | undefined = undefined;

  do {
    const response = (await client.graphql({
      query: annotationsByAnnotationSetId,
      variables: {
        setId: annotationSetId,
        limit: 1000,
        nextToken,
      },
    } as any)) as GraphQLResult<{
      annotationsByAnnotationSetId?: {
        items?: Array<{
          imageId?: string | null;
          x?: number | null;
          y?: number | null;
        }>;
        nextToken?: string | null;
      };
    }>;

    if (response.errors && response.errors.length > 0) {
      throw new Error(
        `GraphQL error fetching annotations: ${JSON.stringify(
          response.errors.map((e) => e.message)
        )}`
      );
    }

    const page = response.data?.annotationsByAnnotationSetId;
    for (const item of page?.items || []) {
      if (!item?.imageId) continue;
      const list = map.get(item.imageId) || [];
      list.push({
        x: Number(item.x ?? 0),
        y: Number(item.y ?? 0),
      });
      map.set(item.imageId, list);
    }
    nextToken = page?.nextToken ?? undefined;
  } while (nextToken);

  return map;
}

// Capture image timestamps for deterministic sorting.
async function fetchImageTimestamps(projectId: string) {
  const map = new Map<string, number>();
  let nextToken: string | null | undefined = undefined;

  do {
    const response = (await client.graphql({
      query: imagesByProjectId,
      variables: {
        projectId,
        limit: 1000,
        nextToken,
      },
    } as any)) as GraphQLResult<{
      imagesByProjectId?: {
        items?: Array<{ id?: string | null; timestamp?: number | null }>;
        nextToken?: string | null;
      };
    }>;

    if (response.errors && response.errors.length > 0) {
      throw new Error(
        `GraphQL error fetching images: ${JSON.stringify(
          response.errors.map((e) => e.message)
        )}`
      );
    }

    const page = response.data?.imagesByProjectId;
    for (const item of page?.items || []) {
      if (!item?.id) continue;
      map.set(item.id, Number(item.timestamp ?? 0));
    }
    nextToken = page?.nextToken ?? undefined;
  } while (nextToken);

  return map;
}

// Create the SQS queue and persist queue metadata.
async function createQueue(
  queueOptions: LaunchQueueOptions,
  queueTag: string,
  projectId: string,
  batchSize: number
) {
  const queueNameSeed = `${queueOptions.name}-${randomUUID()}`;
  const safeBaseName = makeSafeQueueName(queueNameSeed);
  const finalName = queueOptions.fifo ? `${safeBaseName}.fifo` : safeBaseName;

  const createResult = await sqsClient.send(
    new CreateQueueCommand({
      QueueName: finalName,
      Attributes: {
        MessageRetentionPeriod: '1209600',
        FifoQueue: queueOptions.fifo ? 'true' : undefined,
      },
    })
  );

  const queueUrl = createResult.QueueUrl;
  if (!queueUrl) {
    throw new Error('Unable to determine created queue URL');
  }

  const queueData = await executeGraphql<{
    createQueue?: { id: string };
  }>(createQueueMutation, {
    input: {
      url: queueUrl,
      name: queueOptions.name,
      projectId,
      batchSize,
      hidden: queueOptions.hidden,
      tag: queueTag,
      approximateSize: 1,
      updatedAt: new Date().toISOString(),
    },
  });

  const createdQueue = queueData.createQueue;
  if (!createdQueue?.id) {
    throw new Error('Failed to record queue metadata');
  }

  return { id: createdQueue.id, url: queueUrl };
}

// Fan selected tiles into SQS batches respecting FIFO rules.
async function enqueueTiles(
  queueUrl: string,
  tiles: MinimalTile[],
  annotationSetId: string,
  queueTag: string
) {
  const queueType = await getQueueType(queueUrl);
  const sqsBatchSize = 10;
  const limit = pLimit(10);
  const tasks: Array<Promise<void>> = [];
  const groupId = randomUUID();
  const dispatchStart = Date.now();

  console.log('Dispatching SQS batches', {
    queueUrl,
    batches: Math.ceil(tiles.length / sqsBatchSize),
  });

  for (let i = 0; i < tiles.length; i += sqsBatchSize) {
    const batch = tiles.slice(i, i + sqsBatchSize);
    const entries = batch.map((tile) => {
      const body = JSON.stringify({
        location: { id: tile.id, annotationSetId },
        allowOutside: true,
        taskTag: queueTag,
        skipLocationWithAnnotations: false,
      });
      if (queueType === 'FIFO') {
        return {
          Id: `msg-${tile.id}`,
          MessageBody: body,
          MessageGroupId: groupId,
          MessageDeduplicationId: body
            .replace(/[^a-zA-Z0-9\-_\.]/g, '')
            .substring(0, 128),
        };
      }
      return { Id: `msg-${tile.id}`, MessageBody: body };
    });

    tasks.push(
      limit(async () => {
        await sqsClient.send(
          new SendMessageBatchCommand({
            QueueUrl: queueUrl,
            Entries: entries,
          })
        );
      })
    );
  }

  await Promise.all(tasks);
  console.log('Finished dispatching SQS batches', {
    queueUrl,
    totalTiles: tiles.length,
    durationMs: Date.now() - dispatchStart,
  });
}

// Query SQS to see if the queue expects FIFO behavior.
async function getQueueType(queueUrl: string): Promise<'FIFO' | 'Standard'> {
  try {
    const attributes = await sqsClient.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ['All'],
      })
    );
    if (attributes.Attributes?.FifoQueue === 'true') {
      return 'FIFO';
    }
    return 'Standard';
  } catch (error) {
    console.warn(
      'Unable to determine queue type, defaulting to Standard',
      error
    );
    return 'Standard';
  }
}


// GraphQL helper that raises detailed errors when AppSync fails.
async function executeGraphql<T>(
  query: string,
  variables: Record<string, any>
): Promise<T> {
  const response = (await client.graphql({
    query,
    variables,
  } as any)) as GraphQLResult<T>;
  if (response.errors && response.errors.length > 0) {
    throw new Error(
      `GraphQL error: ${JSON.stringify(
        response.errors.map((err) => err.message)
      )}`
    );
  }
  if (!response.data) {
    throw new Error('GraphQL response missing data');
  }
  return response.data;
}

// Sanitize queue names to obey AWS resource constraints.
function makeSafeQueueName(input: string): string {
  let sanitized = input.replace(/[^a-zA-Z0-9-_]/g, '_');
  const maxMainLength = 75;
  if (sanitized.length > maxMainLength) {
    sanitized = sanitized.substring(0, maxMainLength);
  }
  return sanitized;
}

// Persist project status transitions for UI feedback.
async function setProjectStatus(projectId: string, status: string) {
  await withTiming(`setProjectStatus:${status}`, () =>
    executeGraphql<{ updateProject?: { id: string } }>(updateProjectMutation, {
      input: {
        id: projectId,
        status,
      },
    })
  );
}

// Simple bounding-box containment check for tiles.
function isInsideTile(px: number, py: number, tile: MinimalTile): boolean {
  const halfW = tile.width / 2;
  const halfH = tile.height / 2;
  const minX = tile.x - halfW;
  const maxX = tile.x + halfW;
  const minY = tile.y - halfH;
  const maxY = tile.y + halfH;
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
}

// Check if two tiles overlap (both have center x,y and width,height)
function tilesOverlap(
  tile1: MinimalTile,
  tile2: { x: number; y: number; width: number; height: number }
): boolean {
  const halfW1 = tile1.width / 2;
  const halfH1 = tile1.height / 2;
  const halfW2 = tile2.width / 2;
  const halfH2 = tile2.height / 2;
  
  const minX1 = tile1.x - halfW1;
  const maxX1 = tile1.x + halfW1;
  const minY1 = tile1.y - halfH1;
  const maxY1 = tile1.y + halfH1;
  
  const minX2 = tile2.x - halfW2;
  const maxX2 = tile2.x + halfW2;
  const minY2 = tile2.y - halfH2;
  const maxY2 = tile2.y + halfH2;
  
  // Check if rectangles overlap
  return minX1 < maxX2 && maxX1 > minX2 && minY1 < maxY2 && maxY1 > minY2;
}

// Fisher–Yates sampling helper for deterministic subset sizing.
function randomSample<T>(arr: T[], count: number): T[] {
  if (count <= 0) return [];
  if (count >= arr.length) return arr.slice();
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}
