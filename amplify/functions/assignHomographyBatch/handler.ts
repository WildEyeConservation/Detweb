import type { AppSyncResolverHandler } from 'aws-lambda';
import { ddb } from '../shared/ddb';
import { GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const BATCH_TABLE = process.env.HOMOGRAPHY_BATCH_TABLE!;
const USER_STATUS_INDEX = process.env.BATCH_USER_STATUS_INDEX!;
const POOL_STATUS_INDEX = process.env.BATCH_POOL_STATUS_INDEX!;

interface AssignArgs {
  poolId: string;
}

export const handler: AppSyncResolverHandler<AssignArgs, string> = async (event) => {
  const { poolId } = event.arguments;
  const callerSub = event.identity && 'sub' in event.identity ? event.identity.sub : '';

  if (!callerSub) {
    throw new Error('Unauthorized: no user identity');
  }

  // Step 1: Check if user already has an assigned batch for this pool
  const existingResult = await ddb.send(new QueryCommand({
    TableName: BATCH_TABLE,
    IndexName: USER_STATUS_INDEX,
    KeyConditionExpression: 'assignedUserId = :userId AND #s = :status',
    FilterExpression: 'poolId = :poolId',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: {
      ':userId': callerSub,
      ':status': 'assigned',
      ':poolId': poolId,
    },
  }));

  // Step 2: If user already has an assigned batch, return it
  if (existingResult.Items && existingResult.Items.length > 0) {
    return JSON.stringify(existingResult.Items[0]);
  }

  // Step 3: Query for available batches in this pool, sorted by batchIndex
  const availableResult = await ddb.send(new QueryCommand({
    TableName: BATCH_TABLE,
    IndexName: POOL_STATUS_INDEX,
    KeyConditionExpression: 'poolId = :poolId AND #s = :status',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: {
      ':poolId': poolId,
      ':status': 'available',
    },
    Limit: 2,
  }));

  if (!availableResult.Items || availableResult.Items.length === 0) {
    return JSON.stringify({ error: 'No batches available', assigned: false });
  }

  // Step 4: Try up to 2 batches with conditional update
  const now = new Date().toISOString();

  for (const candidate of availableResult.Items) {
    try {
      await ddb.send(new UpdateCommand({
        TableName: BATCH_TABLE,
        Key: { id: candidate.id },
        UpdateExpression:
          'SET #s = :assigned, assignedUserId = :userId, assignedAt = :now, lastHeartbeat = :now',
        ConditionExpression: '#s = :available',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':assigned': 'assigned',
          ':available': 'available',
          ':userId': callerSub,
          ':now': now,
        },
        ReturnValues: 'ALL_NEW',
      }));

      // Fetch the full batch after update
      const updated = (await ddb.send(new GetCommand({
        TableName: BATCH_TABLE,
        Key: { id: candidate.id },
      }))).Item;

      return JSON.stringify(updated ?? candidate);
    } catch (err: unknown) {
      // ConditionalCheckFailedException means another user grabbed it; try next
      if (
        err &&
        typeof err === 'object' &&
        'name' in err &&
        (err as { name: string }).name === 'ConditionalCheckFailedException'
      ) {
        continue;
      }
      throw err;
    }
  }

  // All candidates were taken by other users
  return JSON.stringify({ error: 'No batches available (race condition)', assigned: false });
};
