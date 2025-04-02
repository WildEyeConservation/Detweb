import { useContext, useEffect } from "react";
import { useUpdateProgress } from "./useUpdateProgress";
import { GlobalContext, UserContext } from "./Context";
import { SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { QueryCommand } from "@aws-sdk/client-dynamodb";
import pLimit from "p-limit";
import { GetQueueAttributesCommand } from "@aws-sdk/client-sqs";

interface LaunchTaskProps {
  options: {
    taskTag: string;
    annotationSetId: string;
    skipLocationWithAnnotations: boolean;
    allowOutside: boolean;
    filterObserved: boolean;
    lowerLimit: number;
    upperLimit: number;
  };
  setHandleLaunchTask: React.Dispatch<
    React.SetStateAction<
      (options: {
        selectedTasks: string[];
        queueUrl: string;
        secondaryQueueUrl: string | null;
      }) => Promise<void> | null
    >
  >;
}

export default function LaunchTask({
  options,
  setHandleLaunchTask,
}: LaunchTaskProps) {
  const { client, backend } = useContext(GlobalContext)!;
  const { getSqsClient, getDynamoClient } = useContext(UserContext)!;
  const userContext = useContext(UserContext);

  if (!userContext) {
    return null;
  }
  const limitConnections = pLimit(10);

  async function queryLocations(locationSetId: string): Promise<string[]> {
    const dynamoClient = await getDynamoClient();
    const locationIds: string[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const command = new QueryCommand({
        TableName: backend.custom.locationTable,
        IndexName: "locationsBySetIdAndConfidence",
        KeyConditionExpression:
          "setId = :locationSetId and confidence BETWEEN :lowerLimit and :upperLimit",
        ExpressionAttributeValues: {
          ":locationSetId": {
            S: locationSetId,
          },
          ":lowerLimit": {
            N: options.lowerLimit.toString(),
          },
          ":upperLimit": {
            N: options.upperLimit.toString(),
          },
        },
        ProjectionExpression: "id",
        ExclusiveStartKey: lastEvaluatedKey,
        // Increase page size for better throughput
        Limit: 1000,
      });

      try {
        const response = await dynamoClient.send(command);
        setStepsCompleted((s: number) => s + response.Items.length);
        // Extract imageIds from the response
        if (response.Items) {
          const pageLocationIds = response.Items.map((item) => item.id.S!);
          locationIds.push(...pageLocationIds);
        }
        lastEvaluatedKey = response.LastEvaluatedKey;
      } catch (error) {
        console.error("Error querying DynamoDB:", error);
        throw error;
      }
    } while (lastEvaluatedKey);

    return locationIds;
  }

  async function queryObservations(annotationSetId: string): Promise<string[]> {
    const dynamoClient = await getDynamoClient();
    const locationIds: string[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const command = new QueryCommand({
        TableName: backend.custom.observationTable,
        IndexName: "observationsByAnnotationSetIdAndCreatedAt",
        KeyConditionExpression: "annotationSetId  = :annotationSetId ",
        ExpressionAttributeValues: {
          ":annotationSetId": {
            S: annotationSetId,
          },
        },
        ProjectionExpression: "locationId",
        ExclusiveStartKey: lastEvaluatedKey,
        // Increase page size for better throughput
        Limit: 1000,
      });

      try {
        const response = await dynamoClient.send(command);
        setStepsCompleted((s: number) => s + response.Items.length);
        // Extract imageIds from the response
        if (response.Items) {
          const pageLocationIds = response.Items.map(
            (item) => item.locationId.S!
          );
          locationIds.push(...pageLocationIds);
        }
        lastEvaluatedKey = response.LastEvaluatedKey;
      } catch (error) {
        console.error("Error querying DynamoDB:", error);
        throw error;
      }
    } while (lastEvaluatedKey);
    return locationIds;
  }

  const [setStepsCompleted, setTotalSteps] = useUpdateProgress({
    taskId: `Launch task`,
    indeterminateTaskName: `Loading locations`,
    determinateTaskName: "Enqueueing locations",
    stepFormatter: (count) => `${count} locations`,
  });

  async function getQueueType(queueUrl: string): Promise<string> {
    const sqsClient = await getSqsClient();
    const command = new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ["FifoQueue"],
    });

    try {
      const response = await sqsClient.send(command);
      return response.Attributes?.FifoQueue === "true" ? "FIFO" : "Standard";
    } catch (error) {
      console.warn(
        "Error fetching queue attributes, assuming Standard queue:",
        error
      );
      return "Standard"; // Assume Standard if there's an error
    }
  }

  async function handleSubmit({
    selectedTasks,
    queueUrl,
    secondaryQueueUrl,
  }: {
    selectedTasks: string[];
    queueUrl: string;
    secondaryQueueUrl: string | null;
  }) {
    const allSeenLocations = options.filterObserved
      ? await queryObservations(options.annotationSetId)
      : [];
    const allLocations = await Promise.all(
      selectedTasks.map(async (task) => {
        return await queryLocations(task);
      })
    )
      .then((arrays) => arrays.flat())
      .then((locations) =>
        locations.filter((l) => !allSeenLocations.includes(l))
      );

    setStepsCompleted(0);
    setTotalSteps(allLocations.length);
    if (!queueUrl) {
      throw new Error("Queue URL not found");
    }

    const queueType = await getQueueType(queueUrl);

    const groupId = crypto.randomUUID();
    const batchSize = 10;
    for (let i = 0; i < allLocations.length; i += batchSize) {
      const locationBatch = allLocations.slice(i, i + batchSize);
      const batchEntries = [];

      for (const locationId of locationBatch) {
        const location = {
          id: locationId,
          annotationSetId: options.annotationSetId,
        };

        const body = JSON.stringify({
          location,
          allowOutside: options.allowOutside,
          taskTag: options.taskTag,
          secondaryQueueUrl: secondaryQueueUrl,
          skipLocationWithAnnotations: options.skipLocationWithAnnotations,
        });

        if (queueType === "FIFO") {
          batchEntries.push({
            Id: `msg-${locationId}`,
            MessageBody: body,
            MessageGroupId: groupId,
            MessageDeduplicationId: body
              .replace(/[^a-zA-Z0-9\-_\.]/g, "")
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
        limitConnections(() =>
          getSqsClient().then((sqsClient) =>
            sqsClient.send(
              new SendMessageBatchCommand({
                QueueUrl: queueUrl,
                Entries: batchEntries,
              })
            )
          )
        ).then(() => setStepsCompleted((s: number) => s + batchEntries.length));
      }
    }

    for (const taskId of selectedTasks) {
      await client.models.TasksOnAnnotationSet.create({
        annotationSetId: options.annotationSetId,
        locationSetId: taskId,
      });
    }
  }

  useEffect(() => {
    if (setHandleLaunchTask) {
      setHandleLaunchTask(() => handleSubmit);
    }
  }, [setHandleLaunchTask]);
}
