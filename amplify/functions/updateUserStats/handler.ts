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

interface StatsEntry {
    setId: string;
    date: string;
    userId: string;
    projectId: string;
    observationCount: number;
    annotationCount: number;
    sightingCount: number;
    activeTime: number;
    searchTime: number;
    searchCount: number;
    annotationTime: number;
    waitingTime: number;
}

let stats: Record<string, StatsEntry> = {};

function accumulateStats(input: any) {
    const setId = input.annotationSetId.S
    const date = input.createdAt.S.split('T')[0]
    const userId = input.owner.S.split('::')[1]
    const projectId = input.projectId.S
    const annotationCount = parseInt(input.annotationCount.N)
    const timeTaken = parseFloat(input.timeTaken.N) || 0
    const waitingTime = parseFloat(input.waitingTime.N) || 0
    const sighting = (annotationCount > 0 ? 1 : 0)
    const key = `${setId}-${date}-${userId}-${projectId}`
    if (!stats[key]) {
        stats[key] = stats[key] ||
        {
            setId,
            date,
            userId,
            projectId,
            observationCount: 0,
            annotationCount: 0,
            sightingCount: 0,
            activeTime: 0,
            searchTime: 0,
            searchCount: 0,
            annotationTime: 0,
            waitingTime: 0
        }
    }
    stats[key].observationCount += 1
    stats[key].annotationCount += annotationCount
    stats[key].sightingCount += sighting
    stats[key].activeTime += timeTaken
    stats[key].searchTime += (1-sighting) * timeTaken
    stats[key].searchCount += (1 - sighting)
    stats[key].annotationTime += sighting * timeTaken
    stats[key].waitingTime += Math.max(waitingTime, 0)
    logger.info(`Accumulated stats for ${key}`)
}

async function applyUpdate(update: any) {
    const result = await client.graphql({
        query: getUserStats,
        variables: {
            userId: update.userId,
            projectId: update.projectId,
            setId: update.setId,
            date: update.date
        }
    })
    const statExists = result.data?.getUserStats
    const stats = result.data?.getUserStats || { observationCount: 0, annotationCount: 0, sightingCount: 0, activeTime: 0, searchTime: 0, searchCount: 0, annotationTime: 0, waitingTime: 0 }
    const variables={
        input: {
            userId : update.userId,
            projectId: update.projectId,
            setId: update.setId,
            date: update.date,
            observationCount: stats.observationCount + 1,
            annotationCount: stats.annotationCount + update.annotationCount,
            sightingCount: (stats.sightingCount || 0) + update.sightingCount,
            activeTime: (stats.activeTime || 0) + update.activeTime,
            searchTime: (stats.searchTime || 0) + update.searchTime,
            searchCount: (stats.searchCount || 0) + update.searchCount,
            annotationTime: (stats.annotationTime || 0) + update.annotationTime,
            waitingTime:  (stats.waitingTime || 0) + update.waitingTime
        }
    }
    if (statExists) {
        await client.graphql({query: updateUserStats, variables: variables})
    } else {
        await client.graphql({query: createUserStats, variables: variables})
    }
}

async function updateStats() {
    const promises = Object.values(stats).map(async (update) => await applyUpdate(update))
    await Promise.all(promises)
    logger.info(`Updated ${promises.length} stats`)
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
                accumulateStats(record.dynamodb.NewImage)
            }
        }
        await updateStats()
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
