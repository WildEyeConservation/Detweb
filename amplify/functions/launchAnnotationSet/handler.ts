import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/launchAnnotationSet';
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
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
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
  createTilingTask as createTilingTaskMutation,
  createTilingBatch as createTilingBatchMutation,
  updateLocationSet as updateLocationSetMutation,
  deleteLocation as deleteLocationMutation,
  deleteAnnotation as deleteAnnotationMutation,
  deleteObservation as deleteObservationMutation,
} from './graphql/mutations';
import { locationsBySetIdAndConfidence } from './graphql/queries';

// Custom query to fetch observations with source field
const observationsByAnnotationSetId = /* GraphQL */ `
  query ObservationsByAnnotationSetId(
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
        id
        source
      }
      nextToken
    }
  }
`;

// Custom query to fetch annotations with source field
const annotationsByAnnotationSetId = /* GraphQL */ `
  query AnnotationsByAnnotationSetId(
    $setId: ID!
    $filter: ModelAnnotationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    annotationsByAnnotationSetId(
      setId: $setId
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        source
      }
      nextToken
    }
  }
`;

// Configure Amplify to talk to the same AppSync backend the UI uses.
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

// Reuse a single data client with IAM auth.
const client = generateClient({
  authMode: 'iam',
});

// Thin wrapper around SQS for queue creation and batching.
const sqsClient = new SQSClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
  },
});

// S3 client for reading large payloads uploaded by the frontend.
const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
  },
});

// Lambda client for invoking tiling batch lambdas.
const lambdaClient = new LambdaClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
  },
});

// Minimal type helpers for payload parsing and validation.
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
  /** Optional: Reuse this existing location set instead of creating a new one */
  existingLocationSetId?: string;
};

type LaunchLambdaPayload = {
  projectId: string;
  annotationSetId: string;
  queueOptions: LaunchQueueOptions;
  secondaryQueueOptions?: LaunchQueueOptions | null;
  allowOutside: boolean;
  skipLocationWithAnnotations: boolean;
  taskTag: string;
  batchSize: number;
  zoom?: number | null;
  locationIds?: string[];
  locationSetIds?: string[];
  tiledRequest?: TiledLaunchRequest | null;
  /** S3 key where the full payload is stored (for large payloads). */
  payloadS3Key?: string;
  locationManifestS3Key?: string | null;
  launchedCount?: number | null;
  /** If true, delete false negative annotations/observations before launching */
  hasFN?: boolean;
};

type QueueRecord = {
  id: string;
  url: string;
};

// Location data structure for in-memory tile generation
type LocationInput = {
  x: number;
  y: number;
  width: number;
  height: number;
  imageId: string;
  projectId: string;
  setId: string;
};

// Batch size for tiling - 50,000 locations per batch
const TILING_BATCH_SIZE = 50000;

// Entry point invoked by AppSync resolver.
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

    // Check if this is a tiling-only operation (no annotation set to launch)
    const isTilingOnly = payload.tiledRequest && !payload.annotationSetId;

    console.log(
      'launchAnnotationSet invoked',
      JSON.stringify({
        projectId: payload.projectId,
        annotationSetId: payload.annotationSetId,
        launchMode: payload.tiledRequest ? 'tiled' : 'model-guided',
        isTilingOnly,
        locationIdsProvided: payload.locationIds?.length ?? 0,
        locationSetIdsProvided: payload.locationSetIds?.length ?? 0,
      })
    );
    // Use 'processing' for tiling-only, 'launching' for actual annotation set launches
    await setProjectStatus(
      payload.projectId,
      isTilingOnly ? 'processing' : 'launching'
    );
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
    console.error('Error launching annotation set', error);
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
        message: 'Failed to launch annotation set',
        error: error?.message ?? 'Unknown error',
      }),
    };
  }
};

// Orchestrate queue creation, task enqueuing, and bookkeeping.
async function handleLaunch(payload: LaunchLambdaPayload) {
  // Delete false negative data if requested
  if (payload.hasFN && payload.annotationSetId) {
    console.log('Deleting false negative data', {
      annotationSetId: payload.annotationSetId,
    });
    await deleteFalseNegativeData(payload.annotationSetId);
    console.log('False negative data deletion complete');
  }

  const locationSetIds = new Set(payload.locationSetIds ?? []);
  let locationIds = payload.locationIds ?? [];

  if (payload.tiledRequest) {
    console.log(
      'Generating tiled location set',
      JSON.stringify({
        projectId: payload.projectId,
        images: payload.tiledRequest.images.length,
        expectedLocations: payload.tiledRequest.locationCount,
      })
    );

    // Use distributed tiling for large tile sets
    const result = await handleDistributedTiling(payload);
    return result;
  }

  if (!locationIds || locationIds.length === 0) {
    throw new Error('No locations provided to launch');
  }

  console.log('Creating queues', {
    primaryName: payload.queueOptions.name,
    secondary: payload.secondaryQueueOptions?.name ?? null,
    totalLocations: locationIds.length,
  });

  // Determine locationSetId from the first locationSetId provided (if any)
  const locationSetId = payload.locationSetIds?.[0];

  const mainQueue = await createQueue(
    payload.queueOptions,
    payload,
    locationIds,
    locationSetId,
    payload.locationManifestS3Key,
    payload.launchedCount
  );
  const secondaryQueue = payload.secondaryQueueOptions
    ? await createQueue(payload.secondaryQueueOptions, payload, [], locationSetId, null, 0)
    : null;

  await enqueueLocations(
    mainQueue.url,
    mainQueue.id,
    locationIds,
    payload,
    secondaryQueue?.url ?? null
  );
  console.log('Enqueued locations', {
    queueId: mainQueue.id,
    count: locationIds.length,
  });

  await executeGraphql<{ updateQueue?: { id: string } }>(updateQueueMutation, {
    input: {
      id: mainQueue.id,
      totalBatches: Math.ceil(locationIds.length / payload.batchSize),
    },
  });

  await Promise.all(
    Array.from(locationSetIds).map((locationSetId) =>
      executeGraphql<{ createTasksOnAnnotationSet?: { id: string } }>(
        createTasksOnAnnotationSetMutation,
        {
          input: {
            annotationSetId: payload.annotationSetId,
            locationSetId,
          },
        }
      )
    )
  );

  await setProjectStatus(payload.projectId, 'active');

  await executeGraphql<{ updateProjectMemberships?: string | null }>(
    updateProjectMembershipsMutation,
    { projectId: payload.projectId }
  );

  console.log('Launch complete; project status reset', {
    projectId: payload.projectId,
    locationsLaunched: locationIds.length,
  });
  return {
    message: 'Launch request processed',
    locationCount: locationIds.length,
    queueId: mainQueue.id,
  };
}

// Handle distributed tiling for large tile sets
async function handleDistributedTiling(payload: LaunchLambdaPayload) {
  const tiledRequest = payload.tiledRequest!;
  let locationSetId: string;

  // Check if we should reuse an existing location set
  if (tiledRequest.existingLocationSetId) {
    locationSetId = tiledRequest.existingLocationSetId;
    console.log('Reusing existing location set', { locationSetId });

    // Clear existing locations from the location set
    await clearLocationSetLocations(locationSetId);

    // Update the location set with new description and count
    await executeGraphql<{ updateLocationSet?: { id: string } }>(
      updateLocationSetMutation,
      {
        input: {
          id: locationSetId,
          description: tiledRequest.description,
          locationCount: tiledRequest.locationCount,
        },
      }
    );
    console.log('Updated location set', { locationSetId });
  } else {
    // Create a new location set
    const locationSetData = await executeGraphql<{
      createLocationSet?: { id: string };
    }>(createLocationSetMutation, {
      input: {
        name: tiledRequest.name,
        projectId: payload.projectId,
        description: tiledRequest.description,
        locationCount: tiledRequest.locationCount,
      },
    });

    locationSetId = locationSetData.createLocationSet?.id!;
    if (!locationSetId) {
      throw new Error('Unable to create location set');
    }

    console.log('Created location set', { locationSetId });
  }

  // Generate all tile locations in memory
  const locations = generateTiledLocations(
    payload.projectId,
    locationSetId,
    tiledRequest
  );
  console.log('Generated locations in memory', { count: locations.length });

  // Batch locations and write to S3
  const batches = batchLocations(locations, TILING_BATCH_SIZE);
  console.log('Created batches', { batchCount: batches.length });

  // Create the launch config for the control lambda to use later
  const launchConfig = JSON.stringify({
    queueOptions: payload.queueOptions,
    secondaryQueueOptions: payload.secondaryQueueOptions,
    allowOutside: payload.allowOutside,
    skipLocationWithAnnotations: payload.skipLocationWithAnnotations,
    taskTag: payload.taskTag,
    batchSize: payload.batchSize,
    zoom: payload.zoom,
  });

  // Create TilingTask record
  // For tiling-only operations, annotationSetId may not be provided
  const tilingTaskData = await executeGraphql<{
    createTilingTask?: { id: string };
  }>(createTilingTaskMutation, {
    input: {
      projectId: payload.projectId,
      locationSetId,
      annotationSetId: payload.annotationSetId || 'tiling-only',
      status: 'processing',
      launchConfig,
      totalBatches: batches.length,
      completedBatches: 0,
      totalLocations: locations.length,
    },
  });

  const tilingTaskId = tilingTaskData.createTilingTask?.id;
  if (!tilingTaskId) {
    throw new Error('Failed to create tiling task');
  }

  console.log('Created tiling task', {
    tilingTaskId,
    totalBatches: batches.length,
  });

  // Write batches to S3 and create TilingBatch records
  const batchCreationLimit = pLimit(10);
  const batchTasks = batches.map((batch, index) =>
    batchCreationLimit(async () => {
      // Write batch to S3
      const s3Key = `tiling-batches/${tilingTaskId}-batch-${index}.json`;
      await writeBatchToS3(s3Key, batch);

      // Create TilingBatch record
      const batchData = await executeGraphql<{
        createTilingBatch?: { id: string };
      }>(createTilingBatchMutation, {
        input: {
          tilingTaskId,
          batchIndex: index,
          status: 'pending',
          inputS3Key: s3Key,
          locationCount: batch.length,
          createdCount: 0,
        },
      });

      const batchId = batchData.createTilingBatch?.id;
      if (!batchId) {
        throw new Error(`Failed to create tiling batch ${index}`);
      }

      console.log('Created tiling batch', {
        batchId,
        batchIndex: index,
        locationCount: batch.length,
      });

      // Invoke the processTilingBatch lambda
      await invokeTilingBatchLambda(batchId);

      return batchId;
    })
  );

  await Promise.all(batchTasks);

  console.log('Distributed tiling initiated', {
    tilingTaskId,
    totalBatches: batches.length,
    totalLocations: locations.length,
  });

  return {
    message: 'Distributed tiling initiated',
    tilingTaskId,
    locationSetId,
    totalBatches: batches.length,
    totalLocations: locations.length,
  };
}

// Generate all tile locations in memory without writing to DB
function generateTiledLocations(
  projectId: string,
  locationSetId: string,
  tiledRequest: TiledLaunchRequest
): LocationInput[] {
  const locations: LocationInput[] = [];

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

        locations.push({
          x,
          y,
          width: tileWidthForImage,
          height: tileHeightForImage,
          imageId: image.id,
          projectId,
          setId: locationSetId,
        });
      }
    }
  }

  return locations;
}

// Batch locations into groups
function batchLocations(
  locations: LocationInput[],
  batchSize: number
): LocationInput[][] {
  const batches: LocationInput[][] = [];
  for (let i = 0; i < locations.length; i += batchSize) {
    batches.push(locations.slice(i, i + batchSize));
  }
  return batches;
}

// Write a batch of locations to S3
async function writeBatchToS3(
  key: string,
  locations: LocationInput[]
): Promise<void> {
  const bucketName = env.OUTPUTS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('OUTPUTS_BUCKET_NAME environment variable not set');
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: JSON.stringify(locations),
      ContentType: 'application/json',
    })
  );
}

// Invoke the processTilingBatch lambda
async function invokeTilingBatchLambda(batchId: string): Promise<void> {
  const functionName = env.PROCESS_TILING_BATCH_FUNCTION_NAME;
  if (!functionName) {
    throw new Error(
      'PROCESS_TILING_BATCH_FUNCTION_NAME environment variable not set'
    );
  }

  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event', // Async invocation
      Payload: JSON.stringify({ batchId }),
    })
  );
}

// Clear all existing locations from a location set
async function clearLocationSetLocations(locationSetId: string): Promise<void> {
  console.log('Clearing existing locations from location set', {
    locationSetId,
  });

  // Type for the query response
  type LocationQueryResponse = {
    locationsBySetIdAndConfidence?: {
      items: Array<{ id: string }>;
      nextToken?: string | null;
    };
  };

  // Query all locations in the set using pagination
  let nextToken: string | null | undefined = undefined;
  let totalDeleted = 0;
  const deleteLimit = pLimit(50); // Limit concurrent deletions

  do {
    const response: LocationQueryResponse =
      await executeGraphql<LocationQueryResponse>(
        locationsBySetIdAndConfidence,
        {
          setId: locationSetId,
          confidence: { between: [0, 2] }, // Get all confidence levels
          limit: 1000,
          nextToken,
        }
      );

    const items: Array<{ id: string }> =
      response.locationsBySetIdAndConfidence?.items ?? [];
    nextToken = response.locationsBySetIdAndConfidence?.nextToken ?? null;

    if (items.length === 0) {
      break;
    }

    // Delete locations in parallel with concurrency limit
    const deleteTasks = items.map((item: { id: string }) =>
      deleteLimit(async () => {
        try {
          await executeGraphql<{ deleteLocation?: { id: string } }>(
            deleteLocationMutation,
            { input: { id: item.id } }
          );
        } catch (err) {
          console.warn('Failed to delete location', {
            id: item.id,
            error: err,
          });
        }
      })
    );

    await Promise.all(deleteTasks);
    totalDeleted += items.length;
    console.log('Deleted locations batch', {
      deleted: items.length,
      totalDeleted,
    });
  } while (nextToken);

  console.log('Finished clearing location set', {
    locationSetId,
    totalDeleted,
  });

  // Update the location set count to 0
  await executeGraphql<{ updateLocationSet?: { id: string } }>(
    updateLocationSetMutation,
    {
      input: {
        id: locationSetId,
        locationCount: 0,
      },
    }
  );
}

// Ensure the resolver input is a stringified payload.
function parsePayload(request: unknown): LaunchLambdaPayload {
  if (typeof request !== 'string') {
    throw new Error('Launch payload is required');
  }
  const parsed = JSON.parse(request);
  // Allow a minimal payload with just payloadS3Key for S3-based large payloads.
  if (parsed?.payloadS3Key) {
    return parsed as LaunchLambdaPayload;
  }
  // For tiling-only operations (when tiledRequest is provided), annotationSetId is optional
  const isTilingOnly = !!parsed?.tiledRequest;
  if (!parsed?.projectId || !parsed?.queueOptions) {
    throw new Error('Launch payload missing required fields');
  }
  if (!isTilingOnly && !parsed?.annotationSetId) {
    throw new Error(
      'Launch payload missing annotationSetId (required for non-tiling operations)'
    );
  }
  return parsed as LaunchLambdaPayload;
}

// Read the full payload from S3 when it exceeds inline limits.
async function readPayloadFromS3(key: string): Promise<LaunchLambdaPayload> {
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
  // For tiling-only operations (when tiledRequest is provided), annotationSetId is optional
  const isTilingOnly = !!parsed?.tiledRequest;
  if (!parsed?.projectId || !parsed?.queueOptions) {
    throw new Error('S3 payload missing required fields');
  }
  if (!isTilingOnly && !parsed?.annotationSetId) {
    throw new Error(
      'S3 payload missing annotationSetId (required for non-tiling operations)'
    );
  }
  return parsed as LaunchLambdaPayload;
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

// Create an SQS queue plus the matching AppSync metadata row.
async function createQueue(
  queueOptions: LaunchQueueOptions,
  payload: LaunchLambdaPayload,
  locationIds: string[],
  locationSetId?: string,
  locationManifestS3Key?: string | null,
  launchedCount?: number | null
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

  // Generate a unique ID for the queue record before creating it
  const queueId = randomUUID();

  // Use manifest provided by client if available
  const manifestKey = locationManifestS3Key || null;
  const finalLaunchedCount = launchedCount ?? locationIds.length;

  if (manifestKey) {
    console.log('Using provided location manifest', { manifestKey, locationCount: finalLaunchedCount });
  }

  const timestamp = new Date().toISOString();

  const queueData = await executeGraphql<{
    createQueue?: { id: string };
  }>(createQueueMutation, {
    input: {
      id: queueId,
      url: queueUrl,
      name: queueOptions.name,
      projectId: payload.projectId,
      batchSize: payload.batchSize,
      hidden: queueOptions.hidden,
      zoom: payload.zoom ?? undefined,
      tag: payload.taskTag,
      approximateSize: 1,
      updatedAt: timestamp,
      requeueAt: timestamp,
      // New fields for requeue detection
      annotationSetId: payload.annotationSetId,
      locationSetId: locationSetId,
      launchedCount: finalLaunchedCount,
      observedCount: 0,
      locationManifestS3Key: manifestKey,
      requeuesCompleted: 0,
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

// writeLocationManifest removed - now handled by client or tiling task monitor

// Batch SQS writes so we stay within SDK limits.
async function enqueueLocations(
  queueUrl: string,
  queueId: string,
  locationIds: string[],
  payload: LaunchLambdaPayload,
  secondaryQueueUrl: string | null
) {
  const queueType = await getQueueType(queueUrl);
  const groupId = randomUUID();
  const batchSize = 10;
  const limit = pLimit(10);
  const tasks: Array<Promise<void>> = [];
  console.log('Dispatching SQS batches', {
    queueUrl,
    queueId,
    batches: Math.ceil(locationIds.length / batchSize),
  });

  for (let i = 0; i < locationIds.length; i += batchSize) {
    const locationBatch = locationIds.slice(i, i + batchSize);
    const entries = locationBatch.map((locationId) => {
      const messageBody = JSON.stringify({
        location: {
          id: locationId,
          annotationSetId: payload.annotationSetId,
        },
        queueId, // Include queueId for observation counter increment
        allowOutside: payload.allowOutside,
        taskTag: payload.taskTag,
        secondaryQueueUrl,
        skipLocationWithAnnotations: payload.skipLocationWithAnnotations,
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

// Detect whether the target queue expects FIFO semantics.
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

// Shared GraphQL helper that surfaces descriptive errors.
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

// Normalize queue names to AWS-friendly characters/length.
function makeSafeQueueName(input: string): string {
  let sanitized = input.replace(/[^a-zA-Z0-9-_]/g, '_');
  const maxMainLength = 75;
  if (sanitized.length > maxMainLength) {
    sanitized = sanitized.substring(0, maxMainLength);
  }
  return sanitized;
}

// Flip project status in AppSync so the UI reflects progress.
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

// Delete false negative annotations and observations using GraphQL
async function deleteFalseNegativeData(annotationSetId: string): Promise<void> {
  // Delete false negative observations
  await deleteFalseNegativeObservations(annotationSetId);

  // Delete false negative annotations
  await deleteFalseNegativeAnnotations(annotationSetId);
}

// Delete observations with source containing 'false-negative'
async function deleteFalseNegativeObservations(
  annotationSetId: string
): Promise<void> {
  console.log('Querying false negative observations', { annotationSetId });

  let nextToken: string | null | undefined = undefined;
  let totalFetched = 0;
  let totalDeleted = 0;
  const deleteLimit = pLimit(50);

  do {
    // Query observations using the index with source filter
    const response = (await client.graphql({
      query: observationsByAnnotationSetId,
      variables: {
        annotationSetId,
        filter: {
          source: { contains: 'false-negative' },
        },
        limit: 1000,
        nextToken,
      },
    } as any)) as GraphQLResult<{
      observationsByAnnotationSetId?: {
        items?: Array<{
          id?: string | null;
          source?: string | null;
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
    const items = page?.items ?? [];
    nextToken = page?.nextToken ?? null;

    totalFetched += items.length;

    if (items.length === 0) {
      break;
    }

    // Delete each item using GraphQL mutation
    const deleteTasks = items.map((item) =>
      deleteLimit(async () => {
        if (!item?.id) return;
        try {
          await executeGraphql<{ deleteObservation?: { id: string } }>(
            deleteObservationMutation,
            { input: { id: item.id } }
          );
        } catch (err) {
          console.warn('Failed to delete observation', {
            id: item.id,
            error: err,
          });
        }
      })
    );

    await Promise.all(deleteTasks);
    totalDeleted += items.length;
    console.log('Deleted observations batch', {
      deleted: items.length,
      totalDeleted,
    });
  } while (nextToken);

  console.log('Finished deleting false negative observations', {
    totalFetched,
    totalDeleted,
  });
}

// Delete annotations with source containing 'false-negative'
async function deleteFalseNegativeAnnotations(
  annotationSetId: string
): Promise<void> {
  console.log('Querying false negative annotations', { annotationSetId });

  let nextToken: string | null | undefined = undefined;
  let totalFetched = 0;
  let totalDeleted = 0;
  const deleteLimit = pLimit(50);

  do {
    // Query annotations using the index with source filter
    const response = (await client.graphql({
      query: annotationsByAnnotationSetId,
      variables: {
        setId: annotationSetId,
        filter: {
          source: { contains: 'false-negative' },
        },
        limit: 1000,
        nextToken,
      },
    } as any)) as GraphQLResult<{
      annotationsByAnnotationSetId?: {
        items?: Array<{
          id?: string | null;
          source?: string | null;
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
    const items = page?.items ?? [];
    nextToken = page?.nextToken ?? null;

    totalFetched += items.length;

    if (items.length === 0) {
      break;
    }

    // Delete each item using GraphQL mutation
    const deleteTasks = items.map((item) =>
      deleteLimit(async () => {
        if (!item?.id) return;
        try {
          await executeGraphql<{ deleteAnnotation?: { id: string } }>(
            deleteAnnotationMutation,
            { input: { id: item.id } }
          );
        } catch (err) {
          console.warn('Failed to delete annotation', {
            id: item.id,
            error: err,
          });
        }
      })
    );

    await Promise.all(deleteTasks);
    totalDeleted += items.length;
    console.log('Deleted annotations batch', {
      deleted: items.length,
      totalDeleted,
    });
  } while (nextToken);

  console.log('Finished deleting false negative annotations', {
    totalFetched,
    totalDeleted,
  });
}
