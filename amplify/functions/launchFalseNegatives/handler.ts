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
import { randomUUID } from 'crypto';
import pLimit from 'p-limit';
import {
  createQueue as createQueueMutation,
  updateQueue as updateQueueMutation,
  createLocationSet as createLocationSetMutation,
  createLocation as createLocationMutation,
  createTasksOnAnnotationSet as createTasksOnAnnotationSetMutation,
  updateProject as updateProjectMutation,
  updateProjectMemberships as updateProjectMembershipsMutation,
} from './graphql/mutations';
import {
  locationsBySetIdAndConfidence,
  locationsByProjectIdAndSource,
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

// Narrow payload/DTO definitions for type safety.
type LaunchQueueOptions = {
  name: string;
  hidden: boolean;
  fifo: boolean;
};

type TiledLaunchImage = {
  id: string;
  width: number;
  height: number;
};

type TiledLaunchRequest = {
  name: string;
  description: string;
  horizontalTiles: number;
  verticalTiles: number;
  width: number;
  height: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  images: TiledLaunchImage[];
  locationCount: number;
};

type LaunchFalseNegativesPayload = {
  projectId: string;
  annotationSetId: string;
  queueOptions: LaunchQueueOptions;
  queueTag: string;
  samplePercent: number;
  threshold: number;
  modelValue: string;
  locationSetId?: string;
  tiledRequest?: TiledLaunchRequest | null;
  batchSize?: number;
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
  try {
    const payload = parsePayload(event.arguments?.request);
    console.log(
      'launchFalseNegatives invoked',
      JSON.stringify({
        projectId: payload.projectId,
        annotationSetId: payload.annotationSetId,
        model: payload.modelValue,
        samplePercent: payload.samplePercent,
        hasTiledRequest: Boolean(payload.tiledRequest),
        locationSetId: payload.locationSetId ?? null,
      })
    );

    await setProjectStatus(payload.projectId, 'launching');
    await executeGraphql<{ updateProjectMemberships?: string | null }>(
      updateProjectMembershipsMutation,
      { projectId: payload.projectId }
    );

    const result = await handleLaunch(payload);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    console.error('Error launching false negatives job', error);
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
  const { projectId, annotationSetId } = payload;

  const locationSetId =
    (payload.locationSetId as string | undefined) ??
    (await withTiming('createTiledLocationSet', () =>
      createTiledLocationSet(projectId, payload.tiledRequest)
    ));

  const tiles = await withTiming('fetchTiles', () => fetchTiles(locationSetId));
  console.log('Fetched tiles', {
    locationSetId,
    tileCount: tiles.length,
  });
  if (tiles.length === 0) {
    throw new Error('No tiles available for false negatives workflow');
  }

  const detectionMap = await withTiming('fetchDetectionPoints', () =>
    fetchDetectionPoints(projectId, payload.modelValue, payload.threshold)
  );
  console.log('Fetched detection points', {
    projectId,
    modelValue: payload.modelValue,
    threshold: payload.threshold,
    detectionImageCount: detectionMap.size,
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
    const detections = detectionMap.get(tile.imageId) || [];
    const annotations = annotationMap.get(tile.imageId) || [];
    const hasDetection = detections.some((point) =>
      isInsideTile(point.x, point.y, tile)
    );
    const hasAnnotation = annotations.some((point) =>
      isInsideTile(point.x, point.y, tile)
    );
    return !hasDetection && !hasAnnotation;
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
  if (
    !parsed?.projectId ||
    !parsed?.annotationSetId ||
    !parsed?.queueOptions ||
    typeof parsed?.modelValue !== 'string'
  ) {
    throw new Error('Launch payload missing required fields');
  }
  return parsed as LaunchFalseNegativesPayload;
}

// Fetch the working set of tiles for a location set.
async function fetchTiles(locationSetId: string): Promise<MinimalTile[]> {
  const tiles: MinimalTile[] = [];
  let nextToken: string | null | undefined = undefined;

  do {
    const response = (await client.graphql({
      query: locationsBySetIdAndConfidence,
      variables: {
        setId: locationSetId,
        lowerLimit: 0,
        upperLimit: 1,
        limit: 1000,
        nextToken,
      },
    } as any)) as GraphQLResult<{
      locationsBySetIdAndConfidence?: {
        items?: Array<{
          id?: string | null;
          imageId?: string | null;
          x?: number | null;
          y?: number | null;
          width?: number | null;
          height?: number | null;
        }>;
        nextToken?: string | null;
      };
    }>;

    if (response.errors && response.errors.length > 0) {
      throw new Error(
        `GraphQL error fetching tiles: ${JSON.stringify(
          response.errors.map((e) => e.message)
        )}`
      );
    }

    const page = response.data?.locationsBySetIdAndConfidence;
    for (const item of page?.items || []) {
      if (!item?.id || !item?.imageId) continue;
      tiles.push({
        id: item.id,
        imageId: item.imageId,
        x: Number(item.x ?? 0),
        y: Number(item.y ?? 0),
        width: Number(item.width ?? 0),
        height: Number(item.height ?? 0),
      });
    }
    nextToken = page?.nextToken ?? undefined;
  } while (nextToken);

  return tiles;
}

// Collect model detection points filtered by confidence/source.
async function fetchDetectionPoints(
  projectId: string,
  modelValue: string,
  threshold: number
) {
  const map = new Map<string, Array<{ x: number; y: number }>>();
  let nextToken: string | null | undefined = undefined;

  do {
    const response = (await client.graphql({
      query: locationsByProjectIdAndSource,
      variables: {
        projectId,
        source: { beginsWith: modelValue },
        limit: 1000,
        nextToken,
        filter: {
          confidence: { ge: threshold },
        },
      },
    } as any)) as GraphQLResult<{
      locationsByProjectIdAndSource?: {
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
        `GraphQL error fetching detections: ${JSON.stringify(
          response.errors.map((e) => e.message)
        )}`
      );
    }

    const page = response.data?.locationsByProjectIdAndSource;
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

// Derive a location set from tiled launch parameters.
async function createTiledLocationSet(
  projectId: string,
  tiledRequest?: TiledLaunchRequest | null
) {
  if (!tiledRequest) {
    throw new Error('tiledRequest is required when no location set is provided');
  }
  if (!tiledRequest.images || tiledRequest.images.length === 0) {
    throw new Error('Tiled launch requires at least one image');
  }

  console.log('Creating tiled location set', {
    projectId,
    name: tiledRequest.name,
    imageCount: tiledRequest.images.length,
    locationCount: tiledRequest.locationCount,
  });

  const creationStart = Date.now();
  const locationSetData = await executeGraphql<{
    createLocationSet?: { id: string };
  }>(createLocationSetMutation, {
    input: {
      name: tiledRequest.name,
      projectId,
      description: tiledRequest.description,
      locationCount: tiledRequest.locationCount,
    },
  });

  const locationSetId = locationSetData.createLocationSet?.id;
  if (!locationSetId) {
    throw new Error('Unable to create location set');
  }

  const creationConcurrency = 100;
  const creationLimit = pLimit(creationConcurrency);
  const creationTasks: Array<Promise<void>> = [];

  const baselineWidth = Math.max(0, tiledRequest.maxX - tiledRequest.minX);
  const baselineHeight = Math.max(0, tiledRequest.maxY - tiledRequest.minY);
  const baselineIsLandscape = baselineWidth >= baselineHeight;

  for (const image of tiledRequest.images) {
    const imageIsLandscape = image.width >= image.height;
    const swapTileForImage = baselineIsLandscape !== imageIsLandscape;
    const tileWidthForImage = swapTileForImage
      ? tiledRequest.height
      : tiledRequest.width;
    const tileHeightForImage = swapTileForImage
      ? tiledRequest.width
      : tiledRequest.height;
    const horizontalTilesForImage = swapTileForImage
      ? tiledRequest.verticalTiles
      : tiledRequest.horizontalTiles;
    const verticalTilesForImage = swapTileForImage
      ? tiledRequest.horizontalTiles
      : tiledRequest.verticalTiles;
    const roiMinXForImage = swapTileForImage
      ? tiledRequest.minY
      : tiledRequest.minX;
    const roiMinYForImage = swapTileForImage
      ? tiledRequest.minX
      : tiledRequest.minY;
    const roiMaxXForImage = swapTileForImage
      ? tiledRequest.maxY
      : tiledRequest.maxX;
    const roiMaxYForImage = swapTileForImage
      ? tiledRequest.maxX
      : tiledRequest.maxY;

    const effectiveW = Math.max(0, roiMaxXForImage - roiMinXForImage);
    const effectiveH = Math.max(0, roiMaxYForImage - roiMinYForImage);
    const xStepSize =
      horizontalTilesForImage > 1
        ? (effectiveW - tileWidthForImage) / (horizontalTilesForImage - 1)
        : 0;
    const yStepSize =
      verticalTilesForImage > 1
        ? (effectiveH - tileHeightForImage) / (verticalTilesForImage - 1)
        : 0;

    for (let xStep = 0; xStep < horizontalTilesForImage; xStep++) {
      for (let yStep = 0; yStep < verticalTilesForImage; yStep++) {
        const x = Math.round(
          roiMinXForImage +
            (horizontalTilesForImage > 1 ? xStep * xStepSize : 0) +
            tileWidthForImage / 2
        );
        const y = Math.round(
          roiMinYForImage +
            (verticalTilesForImage > 1 ? yStep * yStepSize : 0) +
            tileHeightForImage / 2
        );

        creationTasks.push(
          creationLimit(async () => {
            await executeGraphql<{
              createLocation?: { id: string };
            }>(createLocationMutation, {
              input: {
                x,
                y,
                width: tileWidthForImage,
                height: tileHeightForImage,
                imageId: image.id,
                projectId,
                confidence: 1,
                source: 'manual',
                setId: locationSetId,
              },
            });
          })
        );
      }
    }
  }

  await Promise.all(creationTasks);
  console.log('Created tiled locations', {
    locationSetId,
    total: creationTasks.length,
    durationMs: Date.now() - creationStart,
    concurrency: creationConcurrency,
  });
  return locationSetId;
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

