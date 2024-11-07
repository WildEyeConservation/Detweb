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

async function updateStats(input: any) {
    try {
        const setId = input.annotationSetId.S
        const date = input.createdAt.S.split('T')[0]
        const userId = input.owner.S.split('::')[1]
        const projectId = input.projectId.S
        const annotationCount = parseInt(input.annotationCount.N)
        const timeTaken = parseFloat(input.timeTaken.N) 
        const waitingTime = parseFloat(input.waitingTime.N) || 0
        const sighting = (annotationCount > 0 ? 1 : 0)
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
        const stats = result.data?.getUserStats || {observationCount: 0, annotationCount: 0, sightingCount: 0, activeTime: 0, searchTime: 0, searchCount: 0, annotationTime: 0, waitingTime: 0}
        const variables={
            input: {
                userId,
                projectId,
                setId,
                date,
                observationCount: stats.observationCount + 1,
                annotationCount: stats.annotationCount + annotationCount,
                sightingCount: (stats.sightingCount || 0) + sighting,
                activeTime: (stats.activeTime || 0) + timeTaken,
                searchTime: (stats.searchTime || 0) + (1-sighting) * timeTaken,
                searchCount: (stats.searchCount || 0) + (1 - sighting),
                annotationTime: (stats.annotationTime || 0) + sighting * timeTaken,
                waitingTime:  (stats.waitingTime || 0) + Math.max(waitingTime, 0)
            }
        }
        if (!(variables.input.activeTime)) {
            logger.warn('Missing stats', JSON.stringify(variables))
        }
        if (result.data?.getUserStats) {
            logger.info(JSON.stringify(await client.graphql({
                query: updateUserStats,variables
            })))
        } else {
            logger.info(JSON.stringify(await client.graphql({
                query: createUserStats,
                variables})))
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
                await updateStats(record.dynamodb.NewImage);
            }
        }
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
