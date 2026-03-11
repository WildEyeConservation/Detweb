import type { AppSyncResolverHandler } from 'aws-lambda';
import { ddb } from '../shared/ddb';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const BATCH_TABLE = process.env.HOMOGRAPHY_BATCH_TABLE!;

export const handler: AppSyncResolverHandler<{ batchId: string }, string> = async (event) => {
  const { batchId } = event.arguments;
  const callerSub = event.identity && 'sub' in event.identity ? event.identity.sub : '';

  // Get batch, verify ownership
  const batch = (await ddb.send(new GetCommand({
    TableName: BATCH_TABLE,
    Key: { id: batchId },
    ProjectionExpression: 'id, #s, assignedUserId',
    ExpressionAttributeNames: { '#s': 'status' },
  }))).Item;

  if (!batch) throw new Error(`Batch ${batchId} not found`);
  if (batch.status !== 'assigned') return JSON.stringify({ ok: false, reason: 'Batch not assigned' });
  if (batch.assignedUserId !== callerSub) throw new Error('Batch is not assigned to you');

  const now = new Date().toISOString();
  await ddb.send(new UpdateCommand({
    TableName: BATCH_TABLE,
    Key: { id: batchId },
    UpdateExpression: 'SET lastHeartbeat = :now REMOVE warningIssuedAt',
    ExpressionAttributeValues: { ':now': now },
  }));

  return JSON.stringify({ ok: true, lastHeartbeat: now });
};
