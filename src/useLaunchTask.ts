import { useContext, useCallback } from 'react';
import { QueryCommand } from '@aws-sdk/client-dynamodb';
import { GlobalContext, UserContext } from './Context';
import type {
  LaunchQueueOptions,
  TiledLaunchRequest,
} from './types/LaunchTask';

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
};

export function useLaunchTask(
  options: LaunchTaskOptions
): (args: LaunchTaskArgs) => Promise<void> {
  const { client, backend } = useContext(GlobalContext)!;
  const { getDynamoClient } = useContext(UserContext)!;

  async function queryLocations(
    locationSetId: string,
    onProgress?: (message: string) => void
  ): Promise<string[]> {
    const dynamoClient = await getDynamoClient();
    const locationIds: string[] = [];
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
        ProjectionExpression: 'id, x, y, width, height, confidence',
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 1000,
      });
      try {
        const response = await dynamoClient.send(command);
        const items = response.Items || [];
        const pageLocationIds = items
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
          .map((item: any) => item.id.S);
        locationIds.push(...pageLocationIds);
        onProgress?.(`Loaded ${locationIds.length} locations`);
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

  const launchTask = useCallback(
    async ({
      selectedTasks,
      onProgress,
      queueOptions,
      secondaryQueueOptions,
      tiledRequest,
    }: LaunchTaskArgs) => {
      onProgress?.('Preparing launch request');
      let collectedLocations: string[] | undefined;

      if (!tiledRequest) {
      const allSeenLocations = options.filterObserved
        ? await queryObservations(options.annotationSetId, onProgress)
        : [];
      let allLocations = (
        await Promise.all(
          selectedTasks.map((task) => queryLocations(task, onProgress))
        )
      )
        .flat()
        .filter((l) => !allSeenLocations.includes(l));

      const chunkSize = 100;
      const passes = Math.ceil(allLocations.length / chunkSize);
      const interleavedLocations: string[] = [];
      for (let i = 0; i < chunkSize; i++) {
        for (let j = 0; j < passes; j++) {
          const index = j * chunkSize + i;
          if (index < allLocations.length) {
            interleavedLocations.push(allLocations[index]);
          }
        }
      }
      allLocations = interleavedLocations.reverse();
      onProgress?.(`Found ${allLocations.length} locations to launch`);

      if (allLocations.length === 0) {
        if (options.filterObserved) {
          alert('No unobserved locations to launch');
        } else {
          alert('No locations to launch');
        }
        return;
      }

        collectedLocations = allLocations;
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
      };

      onProgress?.('Enqueuing jobs...');
      sendLaunchLambdaRequest(client, payload);
      onProgress?.('Launch request submitted');
    },
    [options, client, backend, getDynamoClient]
  );

  return launchTask;
}

async function sendLaunchLambdaRequest(
  client: any,
  payload: LaunchLambdaPayload
) {
  try {
    await (client.mutations as any).launchAnnotationSet({
      request: JSON.stringify(payload),
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
