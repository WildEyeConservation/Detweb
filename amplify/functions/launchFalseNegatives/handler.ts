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
  PutObjectCommand,
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
  /** When true, this is a continuation of an unfinished launch (no pool/history changes). */
  isContinuation?: boolean;
};

type MinimalTile = {
  id: string;
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

// Candidate pool manifest – created once on first launch, never modified.
type FnPool = {
  annotationSetId: string;
  poolCreatedAt: string;
  poolSize: number;
  items: MinimalTile[];
};

// A single launch entry within the history manifest.
type FnLaunchEntry = {
  launchedAt: string;
  launchedCount: number;
  items: MinimalTile[];
};

// Launch history manifest – appended to on each new launch.
type FnHistory = {
  annotationSetId: string;
  poolSize: number;
  totalLaunched: number;
  launches: FnLaunchEntry[];
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
// Supports three modes:
//   1. First launch – compute candidates, create pool & history, sample.
//   2. Additional sample – load existing pool, exclude launched, sample remaining.
//   3. Continuation – re-enqueue remaining tiles from an unfinished session.
async function handleLaunch(payload: LaunchFalseNegativesPayload) {
  const workerBatchSize = payload.batchSize ?? 200;
  const { projectId, annotationSetId, locationSetId } = payload;

  let selectedTiles: MinimalTile[];

  if (payload.isContinuation) {
    // ── CONTINUE MODE ──
    // Re-launch remaining tiles from an unfinished session.
    // Pool and history manifests are left untouched.
    selectedTiles = payload.locationTiles;
    if (!selectedTiles || selectedTiles.length === 0) {
      await setProjectStatus(projectId, 'active');
      console.log('Continue mode: no remaining tiles to launch');
      return {
        message: 'No remaining tiles to launch',
        locationCount: 0,
        queueId: null,
      };
    }
    console.log('Continue mode: launching remaining tiles', {
      count: selectedTiles.length,
    });
  } else {
    // Check for an existing candidate pool
    const existingPool = await withTiming('loadFnPool', () =>
      loadFnPool(annotationSetId)
    );

    if (existingPool) {
      // ── ADDITIONAL SAMPLE MODE ──
      // Pool exists from a previous launch. Sample from remaining candidates.
      console.log('Additional sample mode: pool exists', {
        poolSize: existingPool.poolSize,
      });

      const existingHistory = await withTiming('loadFnHistory', () =>
        loadFnHistory(annotationSetId)
      );

      // Build set of all previously launched tile IDs
      const launchedIds = new Set<string>();
      if (existingHistory) {
        for (const launch of existingHistory.launches) {
          for (const item of launch.items) {
            launchedIds.add(item.id);
          }
        }
      }

      // Filter remaining from pool
      const remaining = existingPool.items.filter(
        (t) => !launchedIds.has(t.id)
      );
      console.log('Additional sample: remaining candidates', {
        poolSize: existingPool.poolSize,
        previouslyLaunched: launchedIds.size,
        remaining: remaining.length,
      });

      if (remaining.length === 0) {
        await setProjectStatus(projectId, 'active');
        console.log('All candidates from the original pool have been launched');
        return {
          message: 'All candidates from the original pool have been launched',
          locationCount: 0,
          queueId: null,
        };
      }

      // Sample from remaining, using original pool size as denominator
      const normalizedPercent = Math.min(
        Math.max(payload.samplePercent, 0),
        100
      );
      let sampleCount = Math.floor(
        (existingPool.poolSize * normalizedPercent) / 100
      );
      if (normalizedPercent > 0 && sampleCount === 0 && remaining.length > 0) {
        sampleCount = 1;
      }
      // Cap at available remaining tiles
      sampleCount = Math.min(sampleCount, remaining.length);

      selectedTiles =
        sampleCount <= 0
          ? []
          : sampleCount >= remaining.length
            ? remaining.slice()
            : randomSample(remaining, sampleCount);
      console.log('Additional sample: selected tiles', {
        requestedPercent: payload.samplePercent,
        normalizedPercent,
        sampleCount,
        selectedTiles: selectedTiles.length,
      });

      // Update history
      const now = new Date().toISOString();
      const newEntry: FnLaunchEntry = {
        launchedAt: now,
        launchedCount: selectedTiles.length,
        items: selectedTiles,
      };
      const updatedHistory: FnHistory = existingHistory
        ? {
            ...existingHistory,
            totalLaunched:
              existingHistory.totalLaunched + selectedTiles.length,
            launches: [...existingHistory.launches, newEntry],
          }
        : {
            annotationSetId,
            poolSize: existingPool.poolSize,
            totalLaunched: selectedTiles.length,
            launches: [newEntry],
          };
      await withTiming('saveFnHistory', () =>
        saveFnHistory(annotationSetId, updatedHistory)
      );
    } else {
      // ── FIRST LAUNCH MODE ──
      // No pool exists. Compute candidates, create pool, sample, create history.
      const tiles = payload.locationTiles;
      console.log('First launch mode: computing candidates', {
        locationSetId,
        tileCount: tiles?.length ?? 0,
      });

      if (!tiles || tiles.length === 0) {
        throw new Error(
          'No tiles provided - ensure the project has a global tiled set configured'
        );
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

      // Save pool (immutable, created once)
      const now = new Date().toISOString();
      const pool: FnPool = {
        annotationSetId,
        poolCreatedAt: now,
        poolSize: candidates.length,
        items: candidates,
      };
      await withTiming('saveFnPool', () =>
        saveFnPool(annotationSetId, pool)
      );

      // Sample
      const normalizedPercent = Math.min(
        Math.max(payload.samplePercent, 0),
        100
      );
      let sampleCount = Math.floor(
        (candidates.length * normalizedPercent) / 100
      );
      if (
        normalizedPercent > 0 &&
        sampleCount === 0 &&
        candidates.length > 0
      ) {
        sampleCount = 1;
      }

      const selectionStart = Date.now();
      selectedTiles =
        sampleCount <= 0
          ? []
          : sampleCount >= candidates.length
            ? candidates.slice()
            : randomSample(candidates, sampleCount);
      console.log('Tile sampling complete', {
        requestedPercent: payload.samplePercent,
        normalizedPercent,
        sampleCount,
        selectedTiles: selectedTiles.length,
        durationMs: Date.now() - selectionStart,
      });

      // Save history (first entry)
      const history: FnHistory = {
        annotationSetId,
        poolSize: candidates.length,
        totalLaunched: selectedTiles.length,
        launches: [
          {
            launchedAt: now,
            launchedCount: selectedTiles.length,
            items: selectedTiles,
          },
        ],
      };
      await withTiming('saveFnHistory', () =>
        saveFnHistory(annotationSetId, history)
      );
    }
  }

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
    createQueue(payload.queueOptions, payload.queueTag, projectId, workerBatchSize, {
      annotationSetId,
      locationSetId,
      launchedCount: selectedTiles.length,
      locations: selectedTiles.map((t) => ({
        locationId: t.id,
        imageId: t.imageId,
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height,
      })),
    })
  );

  await withTiming('enqueueTiles', () =>
    enqueueTiles(queue.url, queue.id, selectedTiles, annotationSetId, payload.queueTag)
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

// ── FN Pool manifest helpers ──
// The pool stores the original candidate set, created once and never modified.

async function loadFnPool(
  annotationSetId: string
): Promise<FnPool | null> {
  const bucketName = env.OUTPUTS_BUCKET_NAME;
  if (!bucketName) return null;
  const key = `false-negative-pools/${annotationSetId}.json`;
  try {
    const response = await s3Client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: key })
    );
    const bodyStr = await response.Body?.transformToString();
    if (!bodyStr) return null;
    return JSON.parse(bodyStr) as FnPool;
  } catch (error: any) {
    if (error?.name === 'NoSuchKey' || error?.Code === 'NoSuchKey') return null;
    console.warn('Failed to load FN pool', { key, error: error?.message });
    return null;
  }
}

async function saveFnPool(
  annotationSetId: string,
  pool: FnPool
): Promise<void> {
  const bucketName = env.OUTPUTS_BUCKET_NAME;
  if (!bucketName) {
    console.warn('OUTPUTS_BUCKET_NAME not set, cannot save FN pool');
    return;
  }
  const key = `false-negative-pools/${annotationSetId}.json`;
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: JSON.stringify(pool),
        ContentType: 'application/json',
      })
    );
    console.log('Saved FN pool to S3', { key, poolSize: pool.poolSize });
  } catch (error) {
    console.warn('Failed to save FN pool to S3', {
      key,
      error: error instanceof Error ? error.message : 'unknown error',
    });
  }
}

// ── FN History manifest helpers ──
// The history tracks all launches and their tiles, appended to on each new launch.

async function loadFnHistory(
  annotationSetId: string
): Promise<FnHistory | null> {
  const bucketName = env.OUTPUTS_BUCKET_NAME;
  if (!bucketName) return null;
  const key = `false-negative-history/${annotationSetId}.json`;
  try {
    const response = await s3Client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: key })
    );
    const bodyStr = await response.Body?.transformToString();
    if (!bodyStr) return null;
    return JSON.parse(bodyStr) as FnHistory;
  } catch (error: any) {
    if (error?.name === 'NoSuchKey' || error?.Code === 'NoSuchKey') return null;
    console.warn('Failed to load FN history', { key, error: error?.message });
    return null;
  }
}

async function saveFnHistory(
  annotationSetId: string,
  history: FnHistory
): Promise<void> {
  const bucketName = env.OUTPUTS_BUCKET_NAME;
  if (!bucketName) {
    console.warn('OUTPUTS_BUCKET_NAME not set, cannot save FN history');
    return;
  }
  const key = `false-negative-history/${annotationSetId}.json`;
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: JSON.stringify(history),
        ContentType: 'application/json',
      })
    );
    console.log('Saved FN history to S3', {
      key,
      totalLaunched: history.totalLaunched,
      launchCount: history.launches.length,
    });
  } catch (error) {
    console.warn('Failed to save FN history to S3', {
      key,
      error: error instanceof Error ? error.message : 'unknown error',
    });
  }
}

// Custom GraphQL query to fetch observations with location data included
// This avoids N+1 queries by fetching location data in the same query
const observationsWithLocationsQuery = /* GraphQL */ `
  query ObservationsByAnnotationSetIdWithLocations(
    $annotationSetId: ID!
    $filter: ModelObservationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    observationsByAnnotationSetId(
      annotationSetId: $annotationSetId
      filter: $filter
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
        filter: {
          or: [
            { source: { notContains: 'false-negative' } },
            { source: { attributeExists: false } },
          ],
        },
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

// Gather existing normal (non-FN) human annotations to avoid rework.
async function fetchAnnotationPoints(annotationSetId: string) {
  const map = new Map<string, Array<{ x: number; y: number }>>();
  let nextToken: string | null | undefined = undefined;

  do {
    const response = (await client.graphql({
      query: annotationsByAnnotationSetId,
      variables: {
        setId: annotationSetId,
        filter: {
          or: [
            { source: { notContains: 'false-negative' } },
            { source: { attributeExists: false } },
          ],
        },
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

// Create the SQS queue and persist queue metadata with tracking fields.
async function createQueue(
  queueOptions: LaunchQueueOptions,
  queueTag: string,
  projectId: string,
  batchSize: number,
  trackingParams: {
    annotationSetId: string;
    locationSetId: string;
    launchedCount: number;
    locations: Array<{
      locationId: string;
      imageId: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  }
) {
  const queueId = randomUUID();
  const queueNameSeed = `${queueOptions.name}-${queueId}`;
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

  // Write location manifest to S3 for requeue tracking
  const manifestKey = `queue-manifests/${queueId}.json`;
  const bucketName = env.OUTPUTS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('OUTPUTS_BUCKET_NAME environment variable not set');
  }
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: manifestKey,
      Body: JSON.stringify({ items: trackingParams.locations }),
      ContentType: 'application/json',
    })
  );
  console.log('Wrote location manifest to S3', { manifestKey, locationCount: trackingParams.locations.length });

  const timestamp = new Date().toISOString();
  const queueData = await executeGraphql<{
    createQueue?: { id: string };
  }>(createQueueMutation, {
    input: {
      id: queueId,
      url: queueUrl,
      name: queueOptions.name,
      projectId,
      batchSize,
      hidden: queueOptions.hidden,
      tag: queueTag,
      approximateSize: 1,
      updatedAt: timestamp,
      requeueAt: timestamp,
      // Tracking fields for requeue detection
      annotationSetId: trackingParams.annotationSetId,
      locationSetId: trackingParams.locationSetId,
      launchedCount: trackingParams.launchedCount,
      observedCount: 0,
      locationManifestS3Key: manifestKey,
      requeuesCompleted: 0,
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
  queueId: string,
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
        queueId,  // For observation counter increment
        allowOutside: false,
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
