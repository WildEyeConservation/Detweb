import { useContext, useCallback } from 'react';
import { QueryCommand } from '@aws-sdk/client-dynamodb';
import { uploadData } from 'aws-amplify/storage';
import { GlobalContext, UserContext } from './Context';
import type {
  LaunchQueueOptions,
  TiledLaunchRequest,
} from './types/LaunchTask';
import type { DataClient } from '../amplify/shared/data-schema.generated';

// Types for options and function arguments
export type LaunchTaskOptions = {
  taskTag: string;
  annotationSetId: string;
  projectId: string;
  skipLocationWithAnnotations: boolean;
  allowOutside: boolean;
  filterObserved: boolean;
  lowerLimit: number;
  upperLimit: number;
  batchSize: number;
  zoom?: number;
};

export type LaunchTaskArgs = {
  selectedTasks: string[];
  onProgress?: (message: string) => void;
  queueOptions: LaunchQueueOptions;
  secondaryQueueOptions?: LaunchQueueOptions;
  tiledRequest?: TiledLaunchRequest | null;
  launchImageIds?: string[];
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
  locationManifestS3Key?: string | null;
  launchedCount?: number | null;
  launchImageIds?: string[];
};

export function useLaunchTask(
  options: LaunchTaskOptions
): (args: LaunchTaskArgs) => Promise<void> {
  const { client, backend } = useContext(GlobalContext)!;
  const { getDynamoClient } = useContext(UserContext)!;

  type LocationWithConfidence = {
    id: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
    imageId: string;
  };

  type AnnotationPoint = { x: number; y: number };

  async function queryLocations(
    locationSetId: string,
    onProgress?: (message: string) => void
  ): Promise<LocationWithConfidence[]> {
    const dynamoClient = await getDynamoClient();
    const locations: LocationWithConfidence[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    onProgress?.(`Querying locations...`);
    do {
      const command = new QueryCommand({
        TableName: backend.custom.locationTable,
        IndexName: 'locationsBySetIdAndConfidence',
        KeyConditionExpression:
          'setId = :locationSetId and confidence BETWEEN :lowerLimit and :upperLimit',
        ExpressionAttributeValues: {
          ':locationSetId': { S: locationSetId },
          ':lowerLimit': { N: options.lowerLimit.toString() },
          ':upperLimit': { N: options.upperLimit.toString() },
        },
        ProjectionExpression: 'id, x, y, width, height, confidence, imageId',
        ScanIndexForward: false, // Descending order by confidence
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 1000,
      });
      try {
        const response = await dynamoClient.send(command);
        const items = response.Items || [];
        const pageLocations = items
          .filter((item: any) => {
            const x = parseFloat(item.x?.N || '0');
            const y = parseFloat(item.y?.N || '0');
            const width = parseFloat(item.width?.N || '0');
            const height = parseFloat(item.height?.N || '0');
            const confidence = parseFloat(item.confidence?.N || '0');
            return (
              x !== 0 &&
              y !== 0 &&
              width !== 0 &&
              height !== 0 &&
              confidence !== 0
            );
          })
          .map((item: any) => ({
            id: item.id.S as string,
            confidence: parseFloat(item.confidence?.N || '0'),
            x: parseFloat(item.x?.N || '0'),
            y: parseFloat(item.y?.N || '0'),
            width: parseFloat(item.width?.N || '0'),
            height: parseFloat(item.height?.N || '0'),
            imageId: item.imageId?.S || '',
          }));
        locations.push(...pageLocations);
        onProgress?.(`Loaded ${locations.length} locations`);
        lastEvaluatedKey = response.LastEvaluatedKey as
          | Record<string, any>
          | undefined;
      } catch (error) {
        console.error('Error querying DynamoDB:', error);
        throw error;
      }
    } while (lastEvaluatedKey);
    return locations;
  }

  async function queryObservations(
    annotationSetId: string,
    onProgress?: (message: string) => void
  ): Promise<string[]> {
    const dynamoClient = await getDynamoClient();
    const locationIds: string[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    onProgress?.(`Querying observations...`);
    do {
      const command = new QueryCommand({
        TableName: backend.custom.observationTable,
        IndexName: 'observationsByAnnotationSetIdAndCreatedAt',
        KeyConditionExpression: 'annotationSetId = :annotationSetId',
        ExpressionAttributeValues: {
          ':annotationSetId': { S: annotationSetId },
        },
        ProjectionExpression: 'locationId',
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 1000,
      });
      try {
        const response = await dynamoClient.send(command);
        const items = response.Items || [];
        const pageLocationIds = items.map((item: any) => item.locationId.S);
        locationIds.push(...pageLocationIds);
        onProgress?.(`Loaded ${locationIds.length} observations`);
        lastEvaluatedKey = response.LastEvaluatedKey as
          | Record<string, any>
          | undefined;
      } catch (error) {
        console.error('Error querying DynamoDB:', error);
        throw error;
      }
    } while (lastEvaluatedKey);
    return locationIds;
  }

  // Query all annotations for an annotation set (for filtering locations with existing annotations)
  async function queryAnnotations(
    annotationSetId: string,
    onProgress?: (message: string) => void
  ): Promise<AnnotationPoint[]> {
    const dynamoClient = await getDynamoClient();
    const annotations: AnnotationPoint[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    onProgress?.(`Querying annotations...`);
    do {
      const command = new QueryCommand({
        TableName: backend.custom.annotationTable,
        IndexName: 'annotationsBySetId',
        KeyConditionExpression: 'setId = :setId',
        ExpressionAttributeValues: {
          ':setId': { S: annotationSetId },
        },
        ProjectionExpression: 'x, y',
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 1000,
      });
      try {
        const response = await dynamoClient.send(command);
        const items = response.Items || [];
        const pageAnnotations = items.map((item: any) => ({
          x: parseFloat(item.x?.N || '0'),
          y: parseFloat(item.y?.N || '0'),
        }));
        annotations.push(...pageAnnotations);
        onProgress?.(`Loaded ${annotations.length} annotations`);
        lastEvaluatedKey = response.LastEvaluatedKey as
          | Record<string, any>
          | undefined;
      } catch (error) {
        console.error('Error querying DynamoDB:', error);
        throw error;
      }
    } while (lastEvaluatedKey);
    return annotations;
  }

  // Check if an annotation falls within a location's bounds
  // Location (x, y) is the CENTER, so bounds are calculated as:
  // minX = x - width/2, maxX = x + width/2
  // minY = y - height/2, maxY = y + height/2
  function isAnnotationWithinLocation(
    annotation: AnnotationPoint,
    location: LocationWithConfidence
  ): boolean {
    const minX = location.x - location.width / 2;
    const maxX = location.x + location.width / 2;
    const minY = location.y - location.height / 2;
    const maxY = location.y + location.height / 2;

    return (
      annotation.x >= minX &&
      annotation.x <= maxX &&
      annotation.y >= minY &&
      annotation.y <= maxY
    );
  }

  // Filter out locations that have annotations within their bounds
  function filterLocationsWithAnnotations(
    locations: LocationWithConfidence[],
    annotations: AnnotationPoint[],
    onProgress?: (message: string) => void
  ): LocationWithConfidence[] {
    onProgress?.(`Filtering ${locations.length} locations against ${annotations.length} annotations...`);

    const filtered = locations.filter((location) => {
      // Check if any annotation falls within this location's bounds
      const hasAnnotationWithin = annotations.some((annotation) =>
        isAnnotationWithinLocation(annotation, location)
      );
      // Keep the location only if it has NO annotations within
      return !hasAnnotationWithin;
    });

    const skipped = locations.length - filtered.length;
    onProgress?.(`Filtered out ${skipped} locations with existing annotations, ${filtered.length} remaining`);

    return filtered;
  }

  const launchTask = useCallback(
    async ({
      selectedTasks,
      onProgress,
      queueOptions,
      secondaryQueueOptions,
      tiledRequest,
      launchImageIds,
    }: LaunchTaskArgs) => {
      onProgress?.('Preparing launch request');
      let collectedLocations: string[] | undefined;

      if (!tiledRequest) {
        const allSeenLocations = options.filterObserved
          ? new Set(await queryObservations(options.annotationSetId, onProgress))
          : new Set<string>();

        // If skipLocationWithAnnotations is enabled, query all annotations for the set
        const allAnnotations = options.skipLocationWithAnnotations
          ? await queryAnnotations(options.annotationSetId, onProgress)
          : [];

        // Collect locations from all sets, filter observed, and sort by confidence (descending)
        let allLocationsWithConfidence = (
          await Promise.all(
            selectedTasks.map((task) => queryLocations(task, onProgress))
          )
        )
          .flat()
          .filter((l) => !allSeenLocations.has(l.id));

        // Filter out locations that already have annotations within their bounds
        if (options.skipLocationWithAnnotations && allAnnotations.length > 0) {
          allLocationsWithConfidence = filterLocationsWithAnnotations(
            allLocationsWithConfidence,
            allAnnotations,
            onProgress
          );
        }

        // Sort by confidence (descending) - High confidence first
        allLocationsWithConfidence.sort((a, b) => b.confidence - a.confidence);

        // Extract IDs for interleaving (now sorted by confidence)
        let allLocationIds = allLocationsWithConfidence.map((l) => l.id);

        // Interleave locations to distribute across confidence levels
        const chunkSize = 100;
        const passes = Math.ceil(allLocationIds.length / chunkSize);
        const interleavedLocations: string[] = [];
        for (let i = 0; i < chunkSize; i++) {
          for (let j = 0; j < passes; j++) {
            const index = j * chunkSize + i;
            if (index < allLocationIds.length) {
              interleavedLocations.push(allLocationIds[index]);
            }
          }
        }
        allLocationIds = interleavedLocations.reverse();
        onProgress?.(`Found ${allLocationIds.length} locations to launch`);

        if (allLocationIds.length === 0) {
          if (options.filterObserved) {
            alert('No unobserved locations to launch');
          } else {
            alert('No locations to launch');
          }
          return;
        }

        collectedLocations = allLocationIds;

        onProgress?.('Uploading location manifest...');
        const manifestKey = `queue-manifests/${crypto.randomUUID()}.json`;

        // Map back to the full location objects for the manifest
        const locationsMap = new Map(allLocationsWithConfidence.map((l) => [l.id, l]));
        const manifestItems = collectedLocations.map((id) => {
          const loc = locationsMap.get(id);
          return {
            locationId: id,
            imageId: loc?.imageId || '',
            x: loc?.x || 0,
            y: loc?.y || 0,
            width: loc?.width || 0,
            height: loc?.height || 0,
          };
        });

        await uploadData({
          path: manifestKey,
          data: JSON.stringify({ items: manifestItems }),
          options: {
            bucket: 'outputs',
            contentType: 'application/json',
          },
        }).result;

        // Note: we can't update payload directly here if it's defined later, 
        // but we can store these in variables.
        const locationManifestS3Key = manifestKey;
        const launchedCount = manifestItems.length;

        const payload: LaunchLambdaPayload = {
          projectId: options.projectId,
          annotationSetId: options.annotationSetId,
          queueOptions,
          secondaryQueueOptions: secondaryQueueOptions ?? null,
          allowOutside: options.allowOutside,
          skipLocationWithAnnotations: options.skipLocationWithAnnotations,
          taskTag: options.taskTag,
          batchSize: options.batchSize,
          zoom: options.zoom ?? null,
          locationIds: collectedLocations,
          locationSetIds: selectedTasks,
          tiledRequest: tiledRequest ?? null,
          locationManifestS3Key,
          launchedCount,
        };

        onProgress?.('Enqueuing jobs...');
        sendLaunchLambdaRequest(client, payload);
        onProgress?.('Launch request submitted');
        return; // Exit early for model-guided
      }

      const payload: LaunchLambdaPayload = {
        projectId: options.projectId,
        annotationSetId: options.annotationSetId,
        queueOptions,
        secondaryQueueOptions: secondaryQueueOptions ?? null,
        allowOutside: options.allowOutside,
        skipLocationWithAnnotations: options.skipLocationWithAnnotations,
        taskTag: options.taskTag,
        batchSize: options.batchSize,
        zoom: options.zoom ?? null,
        locationIds: collectedLocations,
        locationSetIds: selectedTasks,
        tiledRequest: tiledRequest ?? null,
        launchImageIds: tiledRequest ? tiledRequest.launchImageIds : launchImageIds, // Pass it if provided
      };

      onProgress?.('Enqueuing jobs...');
      sendLaunchLambdaRequest(client, payload);
      onProgress?.('Launch request submitted');
    },
    [options, client, backend, getDynamoClient]
  );

  return launchTask;
}

// Threshold in bytes above which we upload the payload to S3.
// Lambda sync limit is 6MB, but we use a conservative threshold.
const PAYLOAD_SIZE_THRESHOLD = 200 * 1024; // 200KB

async function sendLaunchLambdaRequest(
  client: DataClient,
  payload: LaunchLambdaPayload
) {
  const payloadStr = JSON.stringify(payload);
  const payloadSize = new Blob([payloadStr]).size;

  let requestPayload: string;

  if (payloadSize > PAYLOAD_SIZE_THRESHOLD) {
    // Upload large payload to S3 and send only the reference.
    const s3Key = `launch-payloads/${crypto.randomUUID()}.json`;
    console.log(
      `Payload size ${payloadSize} exceeds threshold, uploading to S3`,
      { key: s3Key }
    );
    await uploadData({
      path: s3Key,
      data: payloadStr,
      options: {
        bucket: 'outputs',
        contentType: 'application/json',
      },
    }).result;
    requestPayload = JSON.stringify({ payloadS3Key: s3Key });
  } else {
    requestPayload = payloadStr;
  }

  try {
    await client.mutations.launchAnnotationSet({
      request: requestPayload,
    });
  } catch (error: any) {
    if (shouldIgnoreLaunchError(error)) {
      console.warn('Ignoring launch lambda timeout response', error);
      return;
    }
    throw error;
  }
}

function shouldIgnoreLaunchError(error: any): boolean {
  const messages: string[] = [];
  if (error?.message) {
    messages.push(String(error.message));
  }
  if (Array.isArray(error?.errors)) {
    for (const err of error.errors) {
      if (err?.message) {
        messages.push(String(err.message));
      }
    }
  }
  return messages.some((msg) =>
    /timed out|timeout|Task timed out|socket hang up/i.test(msg)
  );
}
