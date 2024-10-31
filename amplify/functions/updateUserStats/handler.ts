import type { DynamoDBStreamHandler } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Amplify } from "aws-amplify";
import { env } from '$amplify/env/updateUserStats'
import { generateClient } from "aws-amplify/data";
import { Handler } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getUserStats } from './graphql/queries'
import { updateUserStats, createUserStats} from './graphql/mutations'

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

async function updateStats(input: any, isDeletion: boolean = false) {
    try {
        const isAnnotation = input.__typename.S == "Annotation"
        const setId = isAnnotation ? input.setId.S : input.annotationSetId.S
        const date = input.createdAt.S.split('T')[0]
        const userId = input.owner.S.split('::')[1]
        const projectId = input.projectId.S

        logger.info({
            message: 'Processing stats update',
            date,
            userId,
            projectId,
            setId,
            isAnnotation,
            isDeletion
        });

        const result = await client.graphql({
            query: getUserStats,
            variables: {
                userId,
                projectId,
                setId,
                date
            }
        }).catch(error => {
            logger.error('GraphQL getUserStats error:', { error: JSON.stringify(error, null, 2) });
            throw error;
        });

        logger.info(JSON.stringify(result))
        const stats = result.data?.getUserStats;
        if (stats) {
            // Calculate the number of seconds elapsed since stats.updatedAt which is an ISO string
            let elapsed = (new Date().getTime() - new Date(stats.updatedAt).getTime()) / 1000;
            // If more than 2 minutes have passed without a user action, we assume this was a break and 
            // don't count it towards active time.
            if (elapsed > 120) { elapsed = 0 };
            logger.info(JSON.stringify(await client.graphql({
                query: updateUserStats,
                variables: {
                    input: {
                        userId,
                        projectId,
                        setId,
                        date,
                        observationCount: stats.observationCount + (isAnnotation ? 0 : 1) * (isDeletion ? -1 : 1),
                        annotationCount: stats.annotationCount + (isAnnotation ? 1 : 0) * (isDeletion ? -1 : 1),
                        activeTime: stats.activeTime + elapsed
                    }
                }
            })))
        } else {
            logger.info(JSON.stringify(await client.graphql({
                query: createUserStats,
                variables: {
                    input: {
                        userId,
                        projectId,
                        setId,
                        date,
                        observationCount: isAnnotation ? 0 : 1 * (isDeletion ? -1 : 1),
                        annotationCount: isAnnotation ? 1 : 0 * (isDeletion ? -1 : 1),
                        activeTime: 0
                    }
                }
            })))
        }
    } catch (error) {
        logger.error('Error in updateStats:', {
            error: JSON.stringify(error, null, 2),
            input: JSON.stringify(input, null, 2)
        });
        throw error;
    }
}

export const handler: DynamoDBStreamHandler = async (event) => {
    try {
        logger.info(`Processing ${event.Records.length} records`);
        
        for (const record of event.Records) {
            logger.info(`Processing record: ${record.eventID}`);
            logger.info(`Event Type: ${record.eventName}`);

            if (!record.dynamodb) {
                logger.warn('No dynamodb data in record', { record });
                continue;
            }

            if (record.eventName === "INSERT") {
                await updateStats(record.dynamodb.NewImage, false);
            } else if (record.eventName === "REMOVE") {
                await updateStats(record.dynamodb.OldImage, true);
            }
        }

        logger.info(`Successfully processed ${event.Records.length} records.`);

        return {
            batchItemFailures: [],
        };
    } catch (error) {
        logger.error('Error processing records:', {
            error: JSON.stringify(error, null, 2),
            event: JSON.stringify(event, null, 2)
        });
        throw error;
    }
};
