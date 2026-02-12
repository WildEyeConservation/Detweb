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
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { randomUUID } from 'crypto';
import pLimit from 'p-limit';
import {
  locationsBySetIdAndConfidence,
  annotationsByAnnotationSetId,
  imagesByProjectId,
  observationsByAnnotationSetId,
  getLocation,
} from './graphql/queries';

// Inline minimal mutations – return key fields + `group` to avoid nested-resolver
// auth failures while still enabling subscription delivery via groupDefinedIn('group').
const createQueueMutation = /* GraphQL */ `
  mutation CreateQueue($input: CreateQueueInput!) {
    createQueue(input: $input) { id group }
  }
`;

const updateQueueMutation = /* GraphQL */ `
  mutation UpdateQueue($input: UpdateQueueInput!) {
    updateQueue(input: $input) { id group }
  }
`;

const createLocationSetMutation = /* GraphQL */ `
  mutation CreateLocationSet($input: CreateLocationSetInput!) {
    createLocationSet(input: $input) { id group }
  }
`;

const updateLocationSetMutation = /* GraphQL */ `
  mutation UpdateLocationSet($input: UpdateLocationSetInput!) {
    updateLocationSet(input: $input) { id group }
  }
`;

const createLocationMutation = /* GraphQL */ `
  mutation CreateLocation($input: CreateLocationInput!) {
    createLocation(input: $input) { id group }
  }
`;

const createTasksOnAnnotationSetMutation = /* GraphQL */ `
  mutation CreateTasksOnAnnotationSet($input: CreateTasksOnAnnotationSetInput!) {
    createTasksOnAnnotationSet(input: $input) { id group }
  }
`;

const updateProjectMutation = /* GraphQL */ `
  mutation UpdateProject($input: UpdateProjectInput!) {
    updateProject(input: $input) { id group }
  }
`;

const updateProjectMembershipsMutation = /* GraphQL */ `
  mutation UpdateProjectMemberships($projectId: String!) {
    updateProjectMemberships(projectId: $projectId)
  }
`;

const createTilingTaskMutation = /* GraphQL */ `
  mutation CreateTilingTask($input: CreateTilingTaskInput!) {
    createTilingTask(input: $input) { id group }
  }
`;

const createTilingBatchMutation = /* GraphQL */ `
  mutation CreateTilingBatch($input: CreateTilingBatchInput!) {
    createTilingBatch(input: $input) { id group }
  }
`;

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

// S3 client for writing batch files.
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
  locationSetId?: string;
  locationTiles?: MinimalTile[];
  tiledRequest?: TiledLaunchRequest | null;
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
  const { projectId, annotationSetId } = payload;

  // Fetch the organizationId from the project for group-based access.
  const projectData = await executeGraphql<{
    getProject?: { organizationId?: string | null };
  }>(getProjectOrganizationId, { id: projectId });
  const organizationId = projectData.getProject?.organizationId;
  if (!organizationId) {
    throw new Error('Unable to determine organizationId for project');
  }
  console.log('Fetched organizationId', { projectId, organizationId });

  // If we need to create tiles from tiledRequest, use distributed tiling
  if (!payload.locationSetId && payload.tiledRequest) {
    return handleDistributedFalseNegativesLaunch(payload, organizationId);
  }

  // Use locationTiles if provided (fetched on client), otherwise fetch from locationSetId
  let tiles: MinimalTile[];
  let locationSetId: string | undefined;

  if (payload.locationTiles && payload.locationTiles.length > 0) {
    // Locations were fetched on the client
    tiles = payload.locationTiles;
    locationSetId = payload.locationSetId;
    console.log('Using locations from client payload', {
      locationSetId,
      tileCount: tiles.length,
    });
  } else if (payload.locationSetId) {
    // Fallback: fetch locations in lambda (shouldn't happen with new client code)
    locationSetId = payload.locationSetId;
    tiles = await withTiming('fetchTiles', () => fetchTiles(locationSetId!));
    console.log('Fetched tiles in lambda', {
      locationSetId,
      tileCount: tiles.length,
    });
  } else if (payload.tiledRequest) {
    // Create from tiledRequest synchronously (for small sets)
    locationSetId = await withTiming('createTiledLocationSet', () =>
      createTiledLocationSetSync(projectId, payload.tiledRequest!, organizationId)
    );
    tiles = await withTiming('fetchTiles', () => fetchTiles(locationSetId!));
    console.log('Created and fetched tiles', {
      locationSetId,
      tileCount: tiles.length,
    });
  } else {
    throw new Error('No location source provided');
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
    createQueue(payload.queueOptions, payload.queueTag, projectId, workerBatchSize, organizationId)
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
          group: organizationId,
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

// Handle distributed tiling for false negatives when creating a new location set
async function handleDistributedFalseNegativesLaunch(payload: LaunchFalseNegativesPayload, organizationId: string) {
  const tiledRequest = payload.tiledRequest!;
  const workerBatchSize = payload.batchSize ?? 200;

  // Fetch filtering data BEFORE generating tiles (so we can filter before creating DB records)
  console.log('Fetching filtering data for false negatives...');
  const observationMap = await withTiming('fetchObservationPoints', () =>
    fetchObservationPoints(payload.annotationSetId)
  );
  console.log('Fetched observation points', {
    annotationSetId: payload.annotationSetId,
    observationImageCount: observationMap.size,
  });

  const annotationMap = await withTiming('fetchAnnotationPoints', () =>
    fetchAnnotationPoints(payload.annotationSetId)
  );
  console.log('Fetched annotations', {
    annotationSetId: payload.annotationSetId,
    annotationImageCount: annotationMap.size,
  });

  const imageTimestamps = await withTiming('fetchImageTimestamps', () =>
    fetchImageTimestamps(payload.projectId)
  );
  console.log('Fetched image timestamps', {
    projectId: payload.projectId,
    imageCount: imageTimestamps.size,
  });

  // Create the location set first
  const locationSetData = await executeGraphql<{
    createLocationSet?: { id: string };
  }>(createLocationSetMutation, {
    input: {
      name: tiledRequest.name,
      projectId: payload.projectId,
      description: tiledRequest.description,
      locationCount: tiledRequest.locationCount,
      group: organizationId,
    },
  });

  const locationSetId = locationSetData.createLocationSet?.id;
  if (!locationSetId) {
    throw new Error('Unable to create location set');
  }

  console.log('Created location set', { locationSetId });

  // Generate all tile locations in memory
  const allLocations = generateTiledLocations(payload.projectId, locationSetId, tiledRequest);
  console.log('Generated locations in memory', { count: allLocations.length });

  // Convert to MinimalTile format for filtering
  const allTiles: MinimalTile[] = allLocations.map((loc) => ({
    id: '', // Will be assigned after DB creation
    imageId: loc.imageId,
    x: loc.x,
    y: loc.y,
    width: loc.width,
    height: loc.height,
  }));

  // Filter tiles: keep only those without observations and without annotations
  console.log('Filtering false negative candidates...');
  const candidateTimingStart = Date.now();
  const candidates = allTiles.filter((tile) => {
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
    totalTiles: allTiles.length,
    candidateCount: candidates.length,
    durationMs: Date.now() - candidateTimingStart,
  });

  // Sort by image timestamp
  candidates.sort((a, b) => {
    const tsA = imageTimestamps.get(a.imageId) ?? 0;
    const tsB = imageTimestamps.get(b.imageId) ?? 0;
    return tsA - tsB;
  });

  // Apply sampling
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
    await setProjectStatus(payload.projectId, 'active');
    console.log('No false-negative candidate tiles were found');
    return {
      message: 'No candidate tiles discovered',
      locationCount: 0,
      queueId: null,
    };
  }

  // Map filtered tiles back to LocationInput format, preserving order
  const filteredLocations: LocationInput[] = [];
  const tileMap = new Map<string, LocationInput>();
  for (const loc of allLocations) {
    const key = `${loc.imageId}-${loc.x}-${loc.y}-${loc.width}-${loc.height}`;
    tileMap.set(key, loc);
  }

  for (const tile of selectedTiles) {
    const key = `${tile.imageId}-${tile.x}-${tile.y}-${tile.width}-${tile.height}`;
    const loc = tileMap.get(key);
    if (loc) {
      filteredLocations.push(loc);
    }
  }

  console.log('Filtered locations', {
    originalCount: allLocations.length,
    filteredCount: filteredLocations.length,
  });

  // Update location set with filtered count
  await executeGraphql<{ updateLocationSet?: { id: string } }>(
    updateLocationSetMutation,
    {
      input: {
        id: locationSetId,
        locationCount: filteredLocations.length,
      },
    }
  );
  console.log('Updated location set count', {
    locationSetId,
    locationCount: filteredLocations.length,
  });

  // Batch only the filtered locations and write to S3
  const batches = batchLocations(filteredLocations, TILING_BATCH_SIZE);
  console.log('Created batches from filtered locations', { batchCount: batches.length });

  // Create the launch config for the control lambda to use later
  // Note: filteringAlreadyDone indicates filtering was done before batching
  const launchConfig = JSON.stringify({
    queueOptions: payload.queueOptions,
    secondaryQueueOptions: null,
    allowOutside: true,
    skipLocationWithAnnotations: false,
    taskTag: payload.queueTag,
    batchSize: workerBatchSize,
    zoom: null,
    // False negatives specific config
    isFalseNegatives: true,
    samplePercent: payload.samplePercent,
  });

  // Create TilingTask record
  const tilingTaskData = await executeGraphql<{
    createTilingTask?: { id: string };
  }>(createTilingTaskMutation, {
    input: {
      projectId: payload.projectId,
      locationSetId,
      annotationSetId: payload.annotationSetId,
      status: 'processing',
      launchConfig,
      totalBatches: batches.length,
      completedBatches: 0,
      totalLocations: filteredLocations.length, // Use filtered count, not original
      group: organizationId,
    },
  });

  const tilingTaskId = tilingTaskData.createTilingTask?.id;
  if (!tilingTaskId) {
    throw new Error('Failed to create tiling task');
  }

  console.log('Created tiling task', { tilingTaskId, totalBatches: batches.length });

  // Write batches to S3 and create TilingBatch records (but don't invoke yet)
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
          group: organizationId,
        },
      });

      const batchId = batchData.createTilingBatch?.id;
      if (!batchId) {
        throw new Error(`Failed to create tiling batch ${index}`);
      }

      console.log('Created tiling batch', { batchId, batchIndex: index, locationCount: batch.length });

      return { batchId, batchIndex: index };
    })
  );

  const createdBatches = await Promise.all(batchTasks);

  // Sort by batchIndex to ensure we get the first one
  createdBatches.sort((a, b) => a.batchIndex - b.batchIndex);

  // Invoke ONLY the first batch (index 0) - it will chain to subsequent batches
  const firstBatch = createdBatches.find((b) => b.batchIndex === 0);
  if (firstBatch) {
    await invokeTilingBatchLambda(firstBatch.batchId);
    console.log('Invoked first batch to start sequential chain', { batchId: firstBatch.batchId });
  }

  console.log('Distributed tiling initiated for false negatives', {
    tilingTaskId,
    totalBatches: batches.length,
    totalLocations: filteredLocations.length,
    originalLocationCount: allLocations.length,
  });

  return {
    message: 'Distributed tiling initiated for false negatives',
    tilingTaskId,
    locationSetId,
    totalBatches: batches.length,
    totalLocations: filteredLocations.length,
    originalLocationCount: allLocations.length,
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
async function writeBatchToS3(key: string, locations: LocationInput[]): Promise<void> {
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
    throw new Error('PROCESS_TILING_BATCH_FUNCTION_NAME environment variable not set');
  }

  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event', // Async invocation
      Payload: JSON.stringify({ batchId }),
    })
  );
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

// Fetch the working set of tiles for a location set.
async function fetchTiles(locationSetId: string): Promise<MinimalTile[]> {
  const tiles: MinimalTile[] = [];
  let nextToken: string | null | undefined = undefined;

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
  } while (nextToken);

  return tiles;
}

// Inline query to fetch the organizationId from a project.
const getProjectOrganizationId = /* GraphQL */ `
  query GetProject($id: ID!) {
    getProject(id: $id) { organizationId }
  }
`;

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
  batchSize: number,
  organizationId: string
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
      group: organizationId,
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

// Derive a location set from tiled launch parameters (synchronous version for small sets).
async function createTiledLocationSetSync(
  projectId: string,
  tiledRequest: TiledLaunchRequest,
  organizationId: string
) {
  if (!tiledRequest) {
    throw new Error('tiledRequest is required when no location set is provided');
  }
  if (!tiledRequest.images || tiledRequest.images.length === 0) {
    throw new Error('Tiled launch requires at least one image');
  }

  console.log('Creating tiled location set (sync)', {
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
      group: organizationId,
    },
  });

  const locationSetId = locationSetData.createLocationSet?.id;
  if (!locationSetId) {
    throw new Error('Unable to create location set');
  }

  const creationConcurrency = 100;
  const creationLimit = pLimit(creationConcurrency);
  const creationTasks: Array<Promise<void>> = [];
  let createdCount = 0;

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
                group: organizationId,
              },
            });
            createdCount += 1;
            if (createdCount % 1000 === 0) {
              console.log('Created tiled locations progress', {
                locationSetId,
                createdCount,
              });
            }
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
