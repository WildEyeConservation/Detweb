import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/monitorTilingTasks';
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
  updateTilingTask as updateTilingTaskMutation,
} from './graphql/mutations';
import {
  tilingTasksByStatus,
  tilingBatchesByTaskId,
  locationsBySetIdAndConfidence,
  annotationsByAnnotationSetId,
  imagesByProjectId,
  observationsByAnnotationSetId,
  getLocation,
} from './graphql/queries';

// Configure Amplify for IAM-based GraphQL access.
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

const client = generateClient({
  authMode: 'iam',
});

const sqsClient = new SQSClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
  },
});

const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
  },
});

// Launch config stored in TilingTask
type LaunchConfig = {
  queueOptions: {
    name: string;
    hidden: boolean;
    fifo: boolean;
  };
  secondaryQueueOptions?: {
    name: string;
    hidden: boolean;
    fifo: boolean;
  } | null;
  allowOutside: boolean;
  skipLocationWithAnnotations: boolean;
  taskTag: string;
  batchSize: number;
  zoom?: number | null;
  // False negatives specific fields
  isFalseNegatives?: boolean;
  samplePercent?: number;
};

type MinimalTile = {
  id: string;
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type TilingTaskRecord = {
  id: string;
  projectId: string;
  locationSetId: string;
  annotationSetId: string;
  status: string;
  launchConfig: string;
  totalBatches: number;
  completedBatches: number;
  totalLocations: number;
};

type TilingBatchRecord = {
  id: string;
  tilingTaskId: string;
  batchIndex: number;
  status: string;
  outputS3Key?: string | null;
  createdCount: number;
};

type QueueRecord = {
  id: string;
  url: string;
};

// Entry point invoked by EventBridge schedule.
export const handler: Handler = async () => {
  console.log('monitorTilingTasks invoked');

  try {
    // Find all processing tiling tasks
    const processingTasks = await fetchProcessingTasks();
    console.log('Found processing tasks', { count: processingTasks.length });

    for (const task of processingTasks) {
      await processTask(task);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Tiling tasks monitored',
        tasksChecked: processingTasks.length,
      }),
    };
  } catch (error: any) {
    console.error('Error monitoring tiling tasks', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to monitor tiling tasks',
        error: error?.message ?? 'Unknown error',
      }),
    };
  }
};

async function processTask(task: TilingTaskRecord) {
  console.log('Processing task', { taskId: task.id, projectId: task.projectId });

  try {
    // Fetch all batches for this task
    const batches = await fetchBatchesForTask(task.id);
    console.log('Fetched batches', {
      taskId: task.id,
      batchCount: batches.length,
      totalBatches: task.totalBatches,
    });

    // Check if all batches are complete
    const completedBatches = batches.filter((b) => b.status === 'completed');
    const failedBatches = batches.filter((b) => b.status === 'failed');

    if (failedBatches.length > 0) {
      console.error('Task has failed batches', {
        taskId: task.id,
        failedCount: failedBatches.length,
      });
      await updateTaskFailed(
        task.id,
        `${failedBatches.length} batches failed`
      );
      await setProjectStatus(task.projectId, 'active');
      return;
    }

    if (completedBatches.length < task.totalBatches) {
      console.log('Task not yet complete', {
        taskId: task.id,
        completedBatches: completedBatches.length,
        totalBatches: task.totalBatches,
      });
      // Update completedBatches count
      await executeGraphql<{ updateTilingTask?: { id: string } }>(
        updateTilingTaskMutation,
        {
          input: {
            id: task.id,
            completedBatches: completedBatches.length,
          },
        }
      );
      return;
    }

    // All batches complete - merge results and launch queue
    console.log('All batches complete, launching queue', { taskId: task.id });

    // Download and merge all location IDs from batch outputs
    const allLocationIds = await mergeLocationIds(completedBatches);
    console.log('Merged location IDs', {
      taskId: task.id,
      totalLocations: allLocationIds.length,
    });

    // Parse launch config
    const launchConfig = JSON.parse(task.launchConfig) as LaunchConfig;

    // For false negatives, apply filtering and sampling
    let finalLocationIds = allLocationIds;
    if (launchConfig.isFalseNegatives) {
      finalLocationIds = await applyFalseNegativesFiltering(
        task.projectId,
        task.annotationSetId,
        task.locationSetId,
        launchConfig
      );
      console.log('Applied false negatives filtering', {
        taskId: task.id,
        originalCount: allLocationIds.length,
        filteredCount: finalLocationIds.length,
      });

      if (finalLocationIds.length === 0) {
        // No candidates found, mark as complete and skip queue creation
        await setProjectStatus(task.projectId, 'active');
        await cleanupBatchOutputs(completedBatches);
        await updateTaskCompleted(task.id);
        console.log('No false-negative candidates found, task completed without queue', { taskId: task.id });
        return;
      }
    }

    // Create queue and enqueue locations
    const mainQueue = await createQueue(launchConfig.queueOptions, task.projectId, launchConfig);
    const secondaryQueue = launchConfig.secondaryQueueOptions
      ? await createQueue(launchConfig.secondaryQueueOptions, task.projectId, launchConfig)
      : null;

    await enqueueLocations(
      mainQueue.url,
      finalLocationIds,
      task.annotationSetId,
      launchConfig,
      secondaryQueue?.url ?? null
    );
    console.log('Enqueued locations', {
      taskId: task.id,
      queueId: mainQueue.id,
      count: finalLocationIds.length,
    });

    // Update queue total batches
    await executeGraphql<{ updateQueue?: { id: string } }>(updateQueueMutation, {
      input: {
        id: mainQueue.id,
        totalBatches: Math.ceil(finalLocationIds.length / launchConfig.batchSize),
      },
    });

    // Create tasks on annotation set
    await executeGraphql<{ createTasksOnAnnotationSet?: { id: string } }>(
      createTasksOnAnnotationSetMutation,
      {
        input: {
          annotationSetId: task.annotationSetId,
          locationSetId: task.locationSetId,
        },
      }
    );

    // Update project status
    await setProjectStatus(task.projectId, 'active');

    // Refresh project memberships
    await executeGraphql<{ updateProjectMemberships?: string | null }>(
      updateProjectMembershipsMutation,
      { projectId: task.projectId }
    );

    // Clean up S3 files
    await cleanupBatchOutputs(completedBatches);
    console.log('Cleaned up batch outputs', { taskId: task.id });

    // Mark task as completed
    await updateTaskCompleted(task.id);
    console.log('Task completed successfully', { taskId: task.id });
  } catch (error: any) {
    const errorMessage = error?.message ?? (typeof error === 'string' ? error : JSON.stringify(error));
    console.error('Error processing task', {
      taskId: task.id,
      error: errorMessage,
      stack: error?.stack,
    });
    await updateTaskFailed(task.id, errorMessage ?? 'Unknown error');
    await setProjectStatus(task.projectId, 'active');
  }
}

async function fetchProcessingTasks(): Promise<TilingTaskRecord[]> {
  const tasks: TilingTaskRecord[] = [];
  let nextToken: string | null | undefined = undefined;

  do {
    const response = (await client.graphql({
      query: tilingTasksByStatus,
      variables: {
        status: 'processing',
        limit: 100,
        nextToken,
      },
    } as any)) as GraphQLResult<{
      tilingTasksByStatus?: {
        items?: Array<TilingTaskRecord>;
        nextToken?: string | null;
      };
    }>;

    if (response.errors && response.errors.length > 0) {
      throw new Error(
        `GraphQL error: ${JSON.stringify(response.errors.map((e) => e.message))}`
      );
    }

    const page = response.data?.tilingTasksByStatus;
    for (const item of page?.items || []) {
      if (item) {
        tasks.push(item);
      }
    }
    nextToken = page?.nextToken ?? undefined;
  } while (nextToken);

  return tasks;
}

async function fetchBatchesForTask(taskId: string): Promise<TilingBatchRecord[]> {
  const batches: TilingBatchRecord[] = [];
  let nextToken: string | null | undefined = undefined;

  do {
    const response = (await client.graphql({
      query: tilingBatchesByTaskId,
      variables: {
        tilingTaskId: taskId,
        limit: 1000,
        nextToken,
      },
    } as any)) as GraphQLResult<{
      tilingBatchesByTaskId?: {
        items?: Array<TilingBatchRecord>;
        nextToken?: string | null;
      };
    }>;

    if (response.errors && response.errors.length > 0) {
      throw new Error(
        `GraphQL error: ${JSON.stringify(response.errors.map((e) => e.message))}`
      );
    }

    const page = response.data?.tilingBatchesByTaskId;
    for (const item of page?.items || []) {
      if (item) {
        batches.push(item);
      }
    }
    nextToken = page?.nextToken ?? undefined;
  } while (nextToken);

  return batches;
}

async function mergeLocationIds(batches: TilingBatchRecord[]): Promise<string[]> {
  const bucketName = env.OUTPUTS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('OUTPUTS_BUCKET_NAME environment variable not set');
  }

  const allIds: string[] = [];
  const limit = pLimit(10);

  const downloadTasks = batches.map((batch) =>
    limit(async () => {
      if (!batch.outputS3Key) {
        console.warn('Batch missing output S3 key', { batchId: batch.id });
        return [];
      }

      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: batch.outputS3Key,
        })
      );

      const bodyStr = await response.Body?.transformToString();
      if (!bodyStr) {
        console.warn('Empty output file', { batchId: batch.id });
        return [];
      }

      return JSON.parse(bodyStr) as string[];
    })
  );

  const results = await Promise.all(downloadTasks);
  for (const ids of results) {
    allIds.push(...ids);
  }

  return allIds;
}

async function cleanupBatchOutputs(batches: TilingBatchRecord[]): Promise<void> {
  const bucketName = env.OUTPUTS_BUCKET_NAME;
  if (!bucketName) {
    console.warn('OUTPUTS_BUCKET_NAME not set, cannot cleanup');
    return;
  }

  const limit = pLimit(10);
  const deleteTasks = batches
    .filter((b) => b.outputS3Key)
    .map((batch) =>
      limit(async () => {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: batch.outputS3Key!,
          })
        );
      })
    );

  await Promise.all(deleteTasks);
}

async function createQueue(
  queueOptions: { name: string; hidden: boolean; fifo: boolean },
  projectId: string,
  launchConfig: LaunchConfig
): Promise<QueueRecord> {
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

  const timestamp = new Date().toISOString();

  const queueData = await executeGraphql<{
    createQueue?: { id: string };
  }>(createQueueMutation, {
    input: {
      url: queueUrl,
      name: queueOptions.name,
      projectId,
      batchSize: launchConfig.batchSize,
      hidden: queueOptions.hidden,
      zoom: launchConfig.zoom ?? undefined,
      tag: launchConfig.taskTag,
      approximateSize: 1,
      updatedAt: timestamp,
      requeueAt: timestamp,
    },
  });

  const createdQueue = queueData.createQueue;
  if (!createdQueue?.id) {
    throw new Error('Failed to record queue metadata');
  }

  return {
    id: createdQueue.id,
    url: queueUrl,
  };
}

async function enqueueLocations(
  queueUrl: string,
  locationIds: string[],
  annotationSetId: string,
  launchConfig: LaunchConfig,
  secondaryQueueUrl: string | null
) {
  const queueType = await getQueueType(queueUrl);
  const groupId = randomUUID();
  const batchSize = 10;
  const limit = pLimit(10);
  const tasks: Array<Promise<void>> = [];

  console.log('Dispatching SQS batches', {
    queueUrl,
    batches: Math.ceil(locationIds.length / batchSize),
  });

  for (let i = 0; i < locationIds.length; i += batchSize) {
    const locationBatch = locationIds.slice(i, i + batchSize);
    const entries = locationBatch.map((locationId) => {
      const messageBody = JSON.stringify({
        location: {
          id: locationId,
          annotationSetId,
        },
        allowOutside: launchConfig.allowOutside,
        taskTag: launchConfig.taskTag,
        secondaryQueueUrl,
        skipLocationWithAnnotations: launchConfig.skipLocationWithAnnotations,
      });

      if (queueType === 'FIFO') {
        return {
          Id: `msg-${locationId}`,
          MessageBody: messageBody,
          MessageGroupId: groupId,
          MessageDeduplicationId: messageBody
            .replace(/[^a-zA-Z0-9\-_\.]/g, '')
            .substring(0, 128),
        };
      }

      return {
        Id: `msg-${locationId}`,
        MessageBody: messageBody,
      };
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
}

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
    console.warn('Unable to determine queue type, defaulting to Standard', error);
    return 'Standard';
  }
}

function makeSafeQueueName(input: string): string {
  let sanitized = input.replace(/[^a-zA-Z0-9-_]/g, '_');
  const maxMainLength = 75;
  if (sanitized.length > maxMainLength) {
    sanitized = sanitized.substring(0, maxMainLength);
  }
  return sanitized;
}

async function setProjectStatus(projectId: string, status: string) {
  await executeGraphql<{ updateProject?: { id: string } }>(
    updateProjectMutation,
    {
      input: {
        id: projectId,
        status,
      },
    }
  );
}

async function updateTaskCompleted(taskId: string): Promise<void> {
  await executeGraphql<{ updateTilingTask?: { id: string } }>(
    updateTilingTaskMutation,
    {
      input: {
        id: taskId,
        status: 'completed',
      },
    }
  );
}

async function updateTaskFailed(taskId: string, errorMessage: string): Promise<void> {
  await executeGraphql<{ updateTilingTask?: { id: string } }>(
    updateTilingTaskMutation,
    {
      input: {
        id: taskId,
        status: 'failed',
        errorMessage,
      },
    }
  );
}

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
      `GraphQL error: ${JSON.stringify(response.errors.map((err) => err.message))}`
    );
  }

  if (!response.data) {
    throw new Error('GraphQL response missing data');
  }

  return response.data;
}

// Apply false negatives filtering: filter out tiles with observations/annotations, then sample
async function applyFalseNegativesFiltering(
  projectId: string,
  annotationSetId: string,
  locationSetId: string,
  launchConfig: LaunchConfig
): Promise<string[]> {
  try {
    console.log('Applying false negatives filtering', {
      projectId,
      annotationSetId,
      locationSetId,
      samplePercent: launchConfig.samplePercent,
    });

    // Fetch all tiles for the location set
    console.log('Fetching tiles for location set...');
    const tiles = await fetchTilesForLocationSet(locationSetId);
    console.log('Fetched tiles for false negatives filtering', { tileCount: tiles.length });

    if (tiles.length === 0) {
      return [];
    }

    // Fetch observation points (locations that humans have reviewed)
    console.log('Fetching observation points...');
    const observationMap = await fetchObservationPoints(annotationSetId);
    console.log('Fetched observation points', { imageCount: observationMap.size });

    // Fetch annotation points
    console.log('Fetching annotation points...');
    const annotationMap = await fetchAnnotationPoints(annotationSetId);
    console.log('Fetched annotation points', { imageCount: annotationMap.size });

    // Fetch image timestamps for sorting
    console.log('Fetching image timestamps...');
    const imageTimestamps = await fetchImageTimestamps(projectId);
    console.log('Fetched image timestamps', { imageCount: imageTimestamps.size });

    // Filter tiles: keep only those without observations and without annotations
    console.log('Filtering candidates...');
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
    console.log('Filtered candidates', {
      totalTiles: tiles.length,
      candidateCount: candidates.length,
    });

    // Sort by image timestamp
    candidates.sort((a, b) => {
      const tsA = imageTimestamps.get(a.imageId) ?? 0;
      const tsB = imageTimestamps.get(b.imageId) ?? 0;
      return tsA - tsB;
    });

    // Apply sampling
    const samplePercent = launchConfig.samplePercent ?? 100;
    const normalizedPercent = Math.min(Math.max(samplePercent, 0), 100);
    let sampleCount = Math.floor((candidates.length * normalizedPercent) / 100);
    if (normalizedPercent > 0 && sampleCount === 0 && candidates.length > 0) {
      sampleCount = 1;
    }

    const selectedTiles =
      sampleCount > 0 && sampleCount < candidates.length
        ? randomSample(candidates, sampleCount)
        : candidates.slice();

    console.log('Sampled tiles', {
      samplePercent,
      sampleCount,
      selectedCount: selectedTiles.length,
    });

    return selectedTiles.map((t) => t.id);
  } catch (error: any) {
    const errorMessage = error?.message ?? (typeof error === 'string' ? error : JSON.stringify(error));
    console.error('Error in applyFalseNegativesFiltering', {
      projectId,
      annotationSetId,
      locationSetId,
      error: errorMessage,
      stack: error?.stack,
    });
    throw new Error(`False negatives filtering failed: ${errorMessage}`);
  }
}

// Fetch tiles for a location set
async function fetchTilesForLocationSet(locationSetId: string): Promise<MinimalTile[]> {
  const tiles: MinimalTile[] = [];
  let nextToken: string | null | undefined = undefined;
  let pageCount = 0;

  try {
    do {
      const response = (await client.graphql({
        query: locationsBySetIdAndConfidence,
        variables: {
          setId: locationSetId,
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
      pageCount++;
      
      if (pageCount % 50 === 0) {
        console.log('Fetching tiles progress', { pageCount, tilesSoFar: tiles.length });
      }
    } while (nextToken);
  } catch (error: any) {
    console.error('Error in fetchTilesForLocationSet', {
      locationSetId,
      pageCount,
      tilesSoFar: tiles.length,
      error: error?.message ?? JSON.stringify(error),
    });
    throw error;
  }

  return tiles;
}

// Fetch observation points - locations that humans have reviewed
// Returns a map of imageId -> array of tile bounds (locations that were observed)
async function fetchObservationPoints(annotationSetId: string) {
  const map = new Map<string, Array<{ x: number; y: number; width: number; height: number }>>();
  let nextToken: string | null | undefined = undefined;

  // First, fetch all observations to get location IDs
  const locationIds: string[] = [];
  do {
    const response = (await client.graphql({
      query: observationsByAnnotationSetId,
      variables: {
        annotationSetId,
        limit: 1000,
        nextToken,
      },
    } as any)) as GraphQLResult<{
      observationsByAnnotationSetId?: {
        items?: Array<{
          locationId?: string | null;
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
      if (item?.locationId) {
        locationIds.push(item.locationId);
      }
    }
    nextToken = page?.nextToken ?? undefined;
  } while (nextToken);

  // Now fetch the location details for each observed location
  // Use batching to avoid too many parallel requests
  const limit = pLimit(50);
  const locationTasks = locationIds.map((locationId) =>
    limit(async () => {
      const response = (await client.graphql({
        query: getLocation,
        variables: { id: locationId },
      } as any)) as GraphQLResult<{
        getLocation?: {
          id?: string | null;
          imageId?: string | null;
          x?: number | null;
          y?: number | null;
          width?: number | null;
          height?: number | null;
        };
      }>;

      if (response.errors && response.errors.length > 0) {
        console.warn('Error fetching location', locationId, response.errors);
        return null;
      }

      return response.data?.getLocation;
    })
  );

  const locations = await Promise.all(locationTasks);
  
  for (const loc of locations) {
    if (!loc?.imageId) continue;
    const list = map.get(loc.imageId) || [];
    list.push({
      x: Number(loc.x ?? 0),
      y: Number(loc.y ?? 0),
      width: Number(loc.width ?? 0),
      height: Number(loc.height ?? 0),
    });
    map.set(loc.imageId, list);
  }

  return map;
}

// Fetch annotation points for false negatives filtering
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

// Fetch image timestamps for sorting
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

// Simple bounding-box containment check for tiles
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

// Fisher–Yates sampling helper
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

