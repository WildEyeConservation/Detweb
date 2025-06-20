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
};

export type LaunchTaskArgs = {
  selectedTasks: string[];
  queue: { id: string; url: string; batchSize: number };
  secondaryQueue: { id: string; url: string; batchSize: number } | null;
  setStepsCompleted: (steps: number) => void;
  setTotalSteps: (steps: number) => void;
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
      queue,
      secondaryQueue,
      setStepsCompleted,
      setTotalSteps,
    }: LaunchTaskArgs) => {
      const allSeenLocations = options.filterObserved
        ? await queryObservations(options.annotationSetId, setStepsCompleted)
        : [];
      const allLocations = (
        await Promise.all(
          selectedTasks.map((task) => queryLocations(task, setStepsCompleted))
        )
      )
        .flat()
        .filter((l) => !allSeenLocations.includes(l));

      setStepsCompleted(0);
      setTotalSteps(allLocations.length);
      if (!queue.url) {
        throw new Error('Queue URL not found');
      }

      const queueType = await getQueueType(queue.url);
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
                    QueueUrl: queue.url,
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
        id: queue.id,
        totalBatches: Math.ceil(allLocations.length / queue.batchSize),
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
