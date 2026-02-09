import type { DynamoDBStreamHandler } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Amplify } from "aws-amplify";
import { env } from '$amplify/env/updateUserStats'
import { generateClient } from "aws-amplify/data";
import { Handler } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getUserStats, getQueue } from './graphql/queries'
import { updateUserStats, createUserStats, updateQueue } from './graphql/mutations'
import type { CreateUserStatsInput, UpdateUserStatsInput } from './graphql/API'

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

const getProjectOrganizationId = /* GraphQL */ `
  query GetProject($id: ID!) {
    getProject(id: $id) { organizationId }
  }
`;

const organizationIdCache: Record<string, string | undefined> = {};

async function getOrganizationId(projectId: string): Promise<string | undefined> {
    if (projectId in organizationIdCache) return organizationIdCache[projectId];
    try {
        const projectResponse = await client.graphql({
            query: getProjectOrganizationId,
            variables: { id: projectId },
        });
        const organizationId = (projectResponse as any).data?.getProject?.organizationId;
        organizationIdCache[projectId] = organizationId;
        return organizationId;
    } catch (error) {
        logger.error('Failed to fetch organizationId for project', {
            projectId,
            error: error instanceof Error ? error.message : String(error),
        });
        organizationIdCache[projectId] = undefined;
        return undefined;
    }
}

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
let queueCounts: Record<string, number> = {}; // queueId → observation count delta

function accumulateStats(input: any): boolean {
    try {
        // Validate required fields exist
        if (!input.annotationSetId?.S || !input.createdAt?.S || !input.owner?.S || !input.projectId?.S) {
            logger.warn('Missing required fields in observation', {
                hasAnnotationSetId: !!input.annotationSetId?.S,
                hasCreatedAt: !!input.createdAt?.S,
                hasOwner: !!input.owner?.S,
                hasProjectId: !!input.projectId?.S
            });
            return false;
        }

        const setId = input.annotationSetId.S;
        const date = input.createdAt.S.split('T')[0];
        
        // Extract userId from owner field - handle different formats
        let userId: string;
        const ownerValue = input.owner.S;
        if (ownerValue.includes('::')) {
            userId = ownerValue.split('::')[1];
        } else {
            // If no '::' separator, use the entire owner value as userId
            userId = ownerValue;
        }

        if (!userId || userId.trim() === '') {
            logger.warn('Invalid userId extracted from owner', { owner: ownerValue });
            return false;
        }

        const projectId = input.projectId.S;
        const annotationCount = parseInt(input.annotationCount?.N || '0', 10) || 0;
        let timeTaken = parseFloat(input.timeTaken?.N || '0') || 0;
        const waitingTime = parseFloat(input.waitingTime?.N || '0') || 0;
        const sighting = (annotationCount > 0 ? 1 : 0);
        if (timeTaken > (sighting ? 900*1000 : 120*1000)) timeTaken = 0;
        
        const key = `${setId}-${date}-${userId}-${projectId}`;
        if (!stats[key]) {
            stats[key] = {
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
            };
        }
        stats[key].observationCount += 1;
        stats[key].annotationCount += annotationCount;
        stats[key].sightingCount += sighting;
        stats[key].activeTime += timeTaken;
        stats[key].searchTime += (1-sighting) * timeTaken;
        stats[key].searchCount += (1 - sighting);
        stats[key].annotationTime += sighting * timeTaken;
        stats[key].waitingTime += Math.max(waitingTime, 0);

        // Track queue observation counts for requeue detection
        const queueId = input.queueId?.S;
        if (queueId) {
            queueCounts[queueId] = (queueCounts[queueId] || 0) + 1;
        }

        logger.info(`Accumulated stats for ${key}`);
        return true;
    } catch (error) {
        logger.error('Error accumulating stats', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            input: JSON.stringify(input, null, 2)
        });
        return false;
    }
}

async function applyUpdate(update: StatsEntry): Promise<boolean> {
    try {
        // Validate required fields
        if (!update.userId || !update.projectId || !update.setId || !update.date) {
            logger.error('Invalid update entry - missing required fields', {
                userId: update.userId,
                projectId: update.projectId,
                setId: update.setId,
                date: update.date
            });
            return false;
        }

        const result = await client.graphql({
            query: getUserStats,
            variables: {
                userId: update.userId,
                projectId: update.projectId,
                setId: update.setId,
                date: update.date
            }
        });

        // Check for GraphQL errors
        if (result.errors && result.errors.length > 0) {
            logger.error('GraphQL query errors', {
                errors: result.errors,
                variables: { userId: update.userId, projectId: update.projectId, setId: update.setId, date: update.date }
            });
            return false;
        }

        const statExists = !!result.data?.getUserStats;
        const existingStats = result.data?.getUserStats || {
            observationCount: 0,
            annotationCount: 0,
            sightingCount: 0,
            activeTime: 0,
            searchTime: 0,
            searchCount: 0,
            annotationTime: 0,
            waitingTime: 0
        };

        // Add accumulated deltas from this batch to existing stats
        const baseInput = {
                userId: update.userId,
                projectId: update.projectId,
                setId: update.setId,
                date: update.date,
                observationCount: existingStats.observationCount + update.observationCount,
                annotationCount: existingStats.annotationCount + update.annotationCount,
                sightingCount: (existingStats.sightingCount || 0) + update.sightingCount,
                activeTime: (existingStats.activeTime || 0) + update.activeTime,
                searchTime: (existingStats.searchTime || 0) + update.searchTime,
                searchCount: (existingStats.searchCount || 0) + update.searchCount,
                annotationTime: (existingStats.annotationTime || 0) + update.annotationTime,
                waitingTime: (existingStats.waitingTime || 0) + update.waitingTime
        };

        let mutationResult;
        if (statExists) {
            const input: UpdateUserStatsInput = baseInput;
            mutationResult = await client.graphql({ query: updateUserStats, variables: { input } });
        } else {
            const organizationId = await getOrganizationId(update.projectId);
            const input: CreateUserStatsInput = {
                ...baseInput,
                ...(organizationId ? { group: organizationId } : {}),
            };
            mutationResult = await client.graphql({ query: createUserStats, variables: { input } });
        }

        // Check for mutation errors
        if (mutationResult.errors && mutationResult.errors.length > 0) {
            logger.error('GraphQL mutation errors', {
                errors: mutationResult.errors,
                operation: statExists ? 'updateUserStats' : 'createUserStats',
                input: baseInput
            });
            return false;
        }

        return true;
    } catch (error) {
        logger.error('Error applying update', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            update: JSON.stringify(update, null, 2)
        });
        return false;
    }
}

async function updateStats() {
    const updates = Object.values(stats);
    logger.info(`Updating ${updates.length} unique stat entries`);
    
    const results = await Promise.allSettled(
        updates.map(async (update) => await applyUpdate(update))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    const failed = results.length - successful;

    if (failed > 0) {
        logger.warn(`Failed to update ${failed} out of ${results.length} stat entries`);
        results.forEach((result, index) => {
            if (result.status === 'rejected' || (result.status === 'fulfilled' && result.value === false)) {
                logger.error(`Failed update ${index + 1}`, {
                    status: result.status,
                    reason: result.status === 'rejected' ? result.reason : 'applyUpdate returned false',
                    update: updates[index]
                });
            }
        });
    }

    logger.info(`Successfully updated ${successful} stat entries`);
}

async function updateQueueObservedCounts() {
    const entries = Object.entries(queueCounts);
    if (entries.length === 0) return;

    logger.info(`Updating observedCount for ${entries.length} queues`);

    for (const [queueId, delta] of entries) {
        try {
            const result = await client.graphql({
                query: getQueue,
                variables: { id: queueId }
            });

            const queue = result.data?.getQueue;
            if (!queue) {
                logger.warn(`Queue ${queueId} not found, skipping observedCount update`);
                continue;
            }

            const newCount = (queue.observedCount || 0) + delta;
            await client.graphql({
                query: updateQueue,
                variables: {
                    input: {
                        id: queueId,
                        observedCount: newCount,
                    }
                }
            });
            logger.info(`Updated queue ${queueId} observedCount: ${queue.observedCount || 0} -> ${newCount} (+${delta})`);
        } catch (error) {
            logger.error(`Failed to update observedCount for queue ${queueId}`, {
                error: error instanceof Error ? error.message : String(error),
                delta
            });
        }
    }
}

export const handler: DynamoDBStreamHandler = async (event) => {
    stats = {};
    queueCounts = {};
    try {
        logger.info(`Processing ${event.Records.length} records`);
        
        let processedCount = 0;
        let skippedCount = 0;

        for (const record of event.Records) {
            logger.info(`Processing record: ${record.eventID}`);
            logger.info(`Event Type: ${record.eventName}`);

            if (!record.dynamodb) {
                logger.warn('No dynamodb data in record', { record });
                skippedCount++;
                continue;
            }
            if (record.eventName === "INSERT") {
                const success = accumulateStats(record.dynamodb.NewImage);
                if (success) {
                    processedCount++;
                } else {
                    skippedCount++;
                }
            } else {
                skippedCount++;
            }
        }

        logger.info(`Processed ${processedCount} records, skipped ${skippedCount} records`);
        await updateStats();
        await updateQueueObservedCounts();
        return {
            batchItemFailures: [],
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        const errorDetails = error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
        } : error;

        logger.error('Error processing records:', {
            error: errorMessage,
            errorDetails: errorDetails,
            errorString: JSON.stringify(errorDetails, Object.getOwnPropertyNames(errorDetails), 2),
            stack: errorStack,
            recordCount: event.Records?.length || 0
        });
        throw error;
    }
};
