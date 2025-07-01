import { useContext, useCallback } from 'react';
import {
  GetQueueAttributesCommand,
  SendMessageBatchCommand,
} from '@aws-sdk/client-sqs';
import { QueryCommand } from '@aws-sdk/client-dynamodb';
import pLimit from 'p-limit';
import { GlobalContext, UserContext } from './Context';

// Types for options and function arguments
export type LaunchTaskOptions = {
  taskTag: string;
  annotationSetId: string;
  skipLocationWithAnnotations: boolean;
  allowOutside: boolean;
  filterObserved: boolean;
  lowerLimit: number;
  upperLimit: number;
  createQueue: (
    name: string,
    hidden: boolean,
    fifo: boolean
  ) => Promise<{ id: string; url: string; batchSize: number } | null>;
};

export type LaunchTaskArgs = {
  selectedTasks: string[];
  setStepsCompleted: (steps: number) => void;
  setTotalSteps: (steps: number) => void;
  queueOptions: {
    name: string;
    hidden: boolean;
    fifo: boolean;
  };
  secondaryQueueOptions?: {
    name: string;
    hidden: boolean;
    fifo: boolean;
  };
};

export function useLaunchTask(
  options: LaunchTaskOptions
): (args: LaunchTaskArgs) => Promise<void> {
  const { client, backend } = useContext(GlobalContext)!;
  const { getSqsClient, getDynamoClient } = useContext(UserContext)!;
  const limitConnections = pLimit(10);

  async function queryLocations(
    locationSetId: string,
    setStepsCompleted: (steps: number) => void
  ): Promise<string[]> {
    const dynamoClient = await getDynamoClient();
    const locationIds: string[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
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
        setStepsCompleted((s: number) => s + items.length);
        // Filter out locations with zero values
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
    setStepsCompleted: (steps: number) => void
  ): Promise<string[]> {
    const dynamoClient = await getDynamoClient();
    const locationIds: string[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
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
        setStepsCompleted((s: number) => s + items.length);
        const pageLocationIds = items.map((item: any) => item.locationId.S);
        locationIds.push(...pageLocationIds);
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

  async function getQueueType(queueUrl: string): Promise<string> {
    const sqsClient = await getSqsClient();
    const command = new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['All'],
    });
    try {
      const response = await sqsClient.send(command);
      if (response.Attributes && response.Attributes.FifoQueue) {
        return 'FIFO';
      }
      return 'Standard';
    } catch (error) {
      console.warn(
        'Error fetching queue attributes, assuming Standard queue:',
        error
      );
      return 'Standard';
    }
  }

  const launchTask = useCallback(
    async ({
      selectedTasks,
      setStepsCompleted,
      setTotalSteps,
      queueOptions,
      secondaryQueueOptions,
    }: LaunchTaskArgs) => {
      const allSeenLocations = options.filterObserved
        ? await queryObservations(options.annotationSetId, setStepsCompleted)
        : [];
      let allLocations = (
        await Promise.all(
          selectedTasks.map((task) => queryLocations(task, setStepsCompleted))
        )
      )
        .flat()
        .filter((l) => !allSeenLocations.includes(l));
      // Interleave locations in fixed chunks of 100 to keep users engaged
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

      setStepsCompleted(0);
      setTotalSteps(allLocations.length);

      if (allLocations.length === 0) {
        // Notify user when no unobserved locations (or no locations at all)
        if (options.filterObserved) {
          alert('No unobserved locations to launch');
        } else {
          alert('No locations to launch');
        }
        return;
      }

      const mainQueue = await options.createQueue(
        queueOptions.name,
        queueOptions.hidden,
        queueOptions.fifo
      );
      if (!mainQueue) {
        throw new Error('Primary queue creation failed');
      }

      const secondaryQueue = secondaryQueueOptions
        ? await options.createQueue(
            secondaryQueueOptions.name,
            secondaryQueueOptions.hidden,
            secondaryQueueOptions.fifo
          )
        : null;

      const queueType = await getQueueType(mainQueue.url);
      const groupId = crypto.randomUUID();
      const batchSize = 10;
      const batchPromises: Promise<any>[] = [];

      for (let i = 0; i < allLocations.length; i += batchSize) {
        const locationBatch = allLocations.slice(i, i + batchSize);
        const batchEntries: any[] = [];
        for (const locationId of locationBatch) {
          const location = {
            id: locationId,
            annotationSetId: options.annotationSetId,
          };
          const body = JSON.stringify({
            location,
            allowOutside: options.allowOutside,
            taskTag: options.taskTag,
            secondaryQueueUrl: secondaryQueue?.url,
            skipLocationWithAnnotations: options.skipLocationWithAnnotations,
          });
          if (queueType === 'FIFO') {
            batchEntries.push({
              Id: `msg-${locationId}`,
              MessageBody: body,
              MessageGroupId: groupId,
              MessageDeduplicationId: body
                .replace(/[^a-zA-Z0-9\-_\.]/g, '')
                .substring(0, 128),
            });
          } else {
            batchEntries.push({
              Id: `msg-${locationId}`,
              MessageBody: body,
            });
          }
        }

        if (batchEntries.length > 0) {
          const sendTask = limitConnections(() =>
            getSqsClient()
              .then((sqsClient) =>
                sqsClient.send(
                  new SendMessageBatchCommand({
                    QueueUrl: mainQueue.url,
                    Entries: batchEntries,
                  })
                )
              )
              .then(() =>
                setStepsCompleted((s: number) => s + batchEntries.length)
              )
          );
          batchPromises.push(sendTask);
        }
      }

      await Promise.all(batchPromises);

      await client.models.Queue.update({
        id: mainQueue.id,
        totalBatches: Math.ceil(allLocations.length / mainQueue.batchSize),
      });

      for (const taskId of selectedTasks) {
        await client.models.TasksOnAnnotationSet.create({
          annotationSetId: options.annotationSetId,
          locationSetId: taskId,
        });
      }
    },
    [options, client, backend, getSqsClient, getDynamoClient, limitConnections]
  );

  return launchTask;
}
