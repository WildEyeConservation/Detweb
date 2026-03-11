import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/releaseAbandonedHomographyBatches';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { ddb } from '../shared/ddb';
import { ScanCommand, QueryCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const BATCH_TABLE = process.env.HOMOGRAPHY_BATCH_TABLE!;
const POOL_TABLE = process.env.HOMOGRAPHY_POOL_TABLE!;
const POOL_STATUS_INDEX = process.env.BATCH_POOL_STATUS_INDEX!;
const WARNING_THRESHOLD_MINUTES = 20;
const RELEASE_THRESHOLD_MINUTES = 60;

// Configure Amplify for GraphQL publish mutation
Amplify.configure(
  {
    API: {
      GraphQL: {
        endpoint: env.AMPLIFY_DATA_GRAPHQL_ENDPOINT,
        region: env.AWS_REGION,
        defaultAuthMode: 'iam',
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
        clearCredentialsAndIdentityId: () => {},
      },
    },
  }
);

const gqlClient = generateClient();

const publishMutation = /* GraphQL */ `
  mutation Publish($channelName: String!, $content: String!) {
    publish(channelName: $channelName, content: $content)
  }
`;

async function publishWarning(userId: string, batchId: string) {
  try {
    await gqlClient.graphql({
      query: publishMutation,
      variables: {
        channelName: 'system/homography-warning',
        content: JSON.stringify({
          type: 'homography-abandonment-warning',
          userId,
          batchId,
          message: 'You have been inactive for 20 minutes. This batch will be released in ~40 minutes.',
        }),
      },
    });
  } catch (e) {
    console.error(`Failed to publish warning for batch ${batchId}:`, e);
  }
}

export const handler: Handler = async () => {
  const now = new Date();
  let released = 0;
  let warned = 0;

  // Scan for active pools
  const pools: any[] = [];
  let poolLastKey: any = undefined;
  do {
    const result = await ddb.send(new ScanCommand({
      TableName: POOL_TABLE,
      FilterExpression: '#s = :active',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':active': 'active' },
      ProjectionExpression: 'id',
      ...(poolLastKey ? { ExclusiveStartKey: poolLastKey } : {}),
    }));
    pools.push(...(result.Items || []));
    poolLastKey = result.LastEvaluatedKey;
  } while (poolLastKey);

  for (const pool of pools) {
    // Query assigned batches for this pool
    const batches: any[] = [];
    let batchLastKey: any = undefined;
    do {
      const result = await ddb.send(new QueryCommand({
        TableName: BATCH_TABLE,
        IndexName: POOL_STATUS_INDEX,
        KeyConditionExpression: 'poolId = :pid AND #s = :assigned',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':pid': pool.id, ':assigned': 'assigned' },
        ProjectionExpression: 'id, assignedUserId, lastHeartbeat, warningIssuedAt, #s',
        ...(batchLastKey ? { ExclusiveStartKey: batchLastKey } : {}),
      }));
      batches.push(...(result.Items || []));
      batchLastKey = result.LastEvaluatedKey;
    } while (batchLastKey);

    for (const batch of batches) {
      if (!batch.lastHeartbeat) continue;

      const lastHb = new Date(batch.lastHeartbeat);
      const elapsedMinutes = (now.getTime() - lastHb.getTime()) / 60000;

      if (elapsedMinutes > RELEASE_THRESHOLD_MINUTES) {
        try {
          // Release batch back to available
          await ddb.send(new UpdateCommand({
            TableName: BATCH_TABLE,
            Key: { id: batch.id },
            UpdateExpression: 'SET #s = :available, updatedAt = :now REMOVE assignedUserId, assignedAt, warningIssuedAt',
            ConditionExpression: '#s = :assigned',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: { ':available': 'available', ':now': now.toISOString(), ':assigned': 'assigned' },
          }));
          released++;

          // Increment pool abandoned count
          await ddb.send(new UpdateCommand({
            TableName: POOL_TABLE,
            Key: { id: pool.id },
            UpdateExpression: 'SET abandonedBatches = if_not_exists(abandonedBatches, :zero) + :one, updatedAt = :now',
            ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':now': now.toISOString() },
          }));
        } catch (e: any) {
          if (e.name !== 'ConditionalCheckFailedException') {
            console.error(`Failed to release batch ${batch.id}:`, e);
          }
        }
      } else if (elapsedMinutes > WARNING_THRESHOLD_MINUTES && !batch.warningIssuedAt) {
        try {
          await ddb.send(new UpdateCommand({
            TableName: BATCH_TABLE,
            Key: { id: batch.id },
            UpdateExpression: 'SET warningIssuedAt = :now, updatedAt = :now',
            ExpressionAttributeValues: { ':now': now.toISOString() },
          }));
          await publishWarning(batch.assignedUserId || '', batch.id);
          warned++;
        } catch (e) {
          console.error(`Failed to warn batch ${batch.id}:`, e);
        }
      }
    }
  }

  return JSON.stringify({ released, warned });
};
