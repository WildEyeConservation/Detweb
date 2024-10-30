import type { DynamoDBStreamHandler } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Amplify } from "aws-amplify";
import { env } from '$amplify/env/updateUserObservationStats'
import { generateClient } from "aws-amplify/data";
import { Handler } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getUserObservationStats } from './graphql/queries'
import { updateUserObservationStats, createUserObservationStats} from './graphql/mutations'

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

const logger = new Logger({
  logLevel: "INFO",
  serviceName: "dynamodb-stream-handler",
});

async function updateStats(input: any) {
    const result = await client.graphql({
        query: getUserObservationStats,
        variables: {
            userId: input.owner.S.split('::')[1],
            projectId: input.projectId.S
        }
    })
    logger.info(JSON.stringify(result))
    const stats = result.data?.getUserObservationStats;
    if (stats) {
        const elapsed = (new Date().getTime() - new Date(stats.updatedAt).getTime()) / 1000;
        logger.info(JSON.stringify(await client.graphql({
            // Calculate the number of seconds elapsed since stats.updatedAt which is an ISO string
            query: updateUserObservationStats,
            variables: {
                input: {
                    userId: input.owner.S.split('::')[1],
                    projectId: input.projectId.S,
                    count: stats.count + 1,
                    activeTime: (elapsed < 120) ? Math.round((stats.activeTime || 0) + elapsed) : stats.activeTime
                }
            }
        })))
    } else {
        logger.info(JSON.stringify(await client.graphql({
            query: createUserObservationStats,
            variables: {
                input: {
                    projectId: input.projectId.S,
                    userId: input.owner.S.split('::')[1],
                    count: 1,
                    activeTime: 0
                }
            }
        })))
    }
}


export const handler: DynamoDBStreamHandler = async (event) => {
  logger.info(`Complete Event : ${JSON.stringify(event)}`);
  for (const record of event.Records) {
    logger.info(`Processing record: ${record.eventID}`);
    logger.info(`Event Type: ${record.eventName}`);

    if (record.eventName === "INSERT") {
      // business logic to process new records
        logger.info(`New Image: ${JSON.stringify(record.dynamodb?.NewImage)}`);
        await updateStats(record.dynamodb?.NewImage)
    }
  }
  logger.info(`Successfully processed ${event.Records.length} records.`);

  return {
    batchItemFailures: [],
  };
};
