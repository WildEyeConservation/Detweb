import type { Handler } from "aws-lambda";
import { env } from "$amplify/env/cleanupJobs";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { listQueues, listUserProjectMemberships, getProject } from "./graphql/queries";
import { updateQueue, updateUserProjectMembership } from "./graphql/mutations";
import type { GraphQLResult } from "@aws-amplify/api-graphql";
import {
  DeleteQueueCommand,
  type GetQueueAttributesCommandInput,
  GetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";
import { Queue, UserProjectMembership } from "./graphql/API";
import { SQSClient } from "@aws-sdk/client-sqs";
import { deleteQueue } from "./graphql/mutations";

Amplify.configure(
  {
    API: {
      GraphQL: {
        endpoint: env.AMPLIFY_DATA_GRAPHQL_ENDPOINT,
        region: env.AWS_REGION,
        defaultAuthMode: "iam",
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
  authMode: "iam",
});

interface PagedList<T> {
  items: T[];
  nextToken: string | null | undefined;
}

// Helper function to handle pagination for GraphQL queries
async function fetchAllPages<T, K extends string>(
  queryFn: (
    nextToken?: string
  ) => Promise<GraphQLResult<{ [key in K]: PagedList<T> }>>,
  queryName: K
): Promise<T[]> {
  const allItems: T[] = [];
  let nextToken: string | undefined;

  do {
    console.log(`Fetching ${queryName} next page`);
    const response = await queryFn(nextToken);
    const items = response.data?.[queryName]?.items ?? [];
    allItems.push(...(items as T[]));
    nextToken = response.data?.[queryName]?.nextToken ?? undefined;
  } while (nextToken);

  console.log(
    `Completed fetching all ${queryName} pages. Total items: ${allItems.length}`
  );
  return allItems;
}

export const handler: Handler = async (event, context) => {
  console.log("Starting cleanupJobs function execution");
  try {
    console.log("Fetching all queues");
    const allQueues = await fetchAllPages<Queue, "listQueues">(
      (nextToken) =>
        client.graphql({
          query: listQueues,
          variables: {
            nextToken,
          },
        }) as Promise<GraphQLResult<{ listQueues: PagedList<Queue> }>>,
      "listQueues"
    );

    const deletedProjectIds = new Set<string>();

    for (const queue of allQueues) {
      if (!queue.url) {
        continue;
      }

      const params: GetQueueAttributesCommandInput = {
        QueueUrl: queue.url,
        AttributeNames: ["ApproximateNumberOfMessages"],
      };

      const sqsClient = new SQSClient({
        region: env.AWS_REGION,
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          sessionToken: env.AWS_SESSION_TOKEN,
        },
      });

      const result = await sqsClient.send(
        new GetQueueAttributesCommand(params)
      );

      if (
        (!queue.approximateSize || queue.approximateSize === 0) &&
        parseInt(result.Attributes?.ApproximateNumberOfMessages ?? "0") === 0
      ) {
        // Fetch project name for logging
        let projectName = "Unknown";
        try {
          const projectResponse = await client.graphql({
            query: getProject,
            variables: { id: queue.projectId },
          });
          projectName = projectResponse.data?.getProject?.name || "Unknown";
        } catch (err) {
          console.error(`Failed to fetch project name for ${queue.projectId}:`, err);
        }

        await client.graphql({
          query: deleteQueue,
          variables: {
            input: {
              id: queue.id,
            },
          },
        });

        await sqsClient.send(new DeleteQueueCommand({ QueueUrl: queue.url }));
        
        // Log the cleanup action
        const queueName = queue.tag || queue.name || "Unknown";
        const logMessage = `Cancelled queue job "${queueName}" for project "${projectName}"`;
        
        try {
          await client.graphql({
            query: /* GraphQL */ `
              mutation CreateAdminActionLog($input: CreateAdminActionLogInput!) {
                createAdminActionLog(input: $input) {
                  id
                  userId
                  message
                  projectId
                  createdAt
                }
              }
            `,
            variables: {
              input: {
                userId: "SurveyScope",
                message: logMessage,
                projectId: queue.projectId,
              },
            },
          });
        } catch (logError) {
          // Log error but don't fail the cleanup
          console.error("Failed to log admin action:", logError);
        }

        deletedProjectIds.add(queue.projectId);
        continue;
      }

      await client.graphql({
        query: updateQueue,
        variables: {
          input: {
            id: queue.id,
            approximateSize: parseInt(
              result.Attributes?.ApproximateNumberOfMessages ?? "0"
            ),
          },
        },
      });
    }

    for (const projectId of deletedProjectIds) {
      const userMemberships = await fetchAllPages<
        UserProjectMembership,
        "listUserProjectMemberships"
      >(
        (nextToken) =>
          client.graphql({
            query: listUserProjectMemberships,
            variables: {
              filter: {
                projectId: {
                  eq: projectId,
                },
              },
              nextToken,
            },
          }) as Promise<
            GraphQLResult<{
              listUserProjectMemberships: PagedList<UserProjectMembership>;
            }>
          >,
        "listUserProjectMemberships"
      );

      for (const membership of userMemberships) {
        await client.graphql({
          query: updateUserProjectMembership,
          variables: {
            input: {
              id: membership.id,
            },
          },
        });
      }
    }

    console.log("Job status monitoring completed successfully");
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Job status monitoring completed successfully",
      }),
    };
  } catch (error: any) {
    console.error("Error in cleanupJobs:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error monitoring job status",
        error: error.message,
      }),
    };
  }
};
