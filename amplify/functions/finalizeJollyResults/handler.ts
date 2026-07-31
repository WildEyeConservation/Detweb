import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  type BatchWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

type DynamoItem = Record<string, unknown>;

interface CommitManifest {
  jobId: string;
  jobKey: string;
  surveyId: string;
  annotationSetId: string;
  tableName: string;
  oldRows: DynamoItem[];
  newRows: DynamoItem[];
}

interface FinalizeEvent {
  jobId: string;
  jobKey: string;
  outcome: 'SUCCEEDED' | 'FAILED';
  workflowError?: {
    Error?: string;
    Cause?: string;
  };
}

const region = process.env.AWS_REGION;
const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region, maxAttempts: 8 }),
  { marshallOptions: { removeUndefinedValues: true } }
);
const s3 = new S3Client({ region, maxAttempts: 8 });

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function resultKey(item: DynamoItem): string {
  return `${String(item.surveyId)}|${String(
    item['stratumId#annotationSetId#categoryId']
  )}`;
}

function deleteKey(item: DynamoItem): DynamoItem {
  return {
    surveyId: item.surveyId,
    'stratumId#annotationSetId#categoryId':
      item['stratumId#annotationSetId#categoryId'],
  };
}

async function batchWriteAll(
  tableName: string,
  requests: NonNullable<
    BatchWriteCommandInput['RequestItems']
  >[string]
): Promise<void> {
  for (let offset = 0; offset < requests.length; offset += 25) {
    let pending = requests.slice(offset, offset + 25);
    for (let attempt = 0; pending.length > 0; attempt += 1) {
      if (attempt >= 8) {
        throw new Error(
          `Rollback still had ${pending.length} unprocessed writes`
        );
      }
      const response = await dynamo.send(
        new BatchWriteCommand({
          RequestItems: { [tableName]: pending },
        })
      );
      pending = response.UnprocessedItems?.[tableName] ?? [];
      if (pending.length > 0) {
        const delay =
          Math.min(5_000, 100 * 2 ** attempt) *
          (0.5 + Math.random());
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}

async function readJson<T>(
  bucketName: string,
  key: string
): Promise<T> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: bucketName, Key: key })
  );
  if (!response.Body) throw new Error(`${key} had no body`);
  return JSON.parse(await response.Body.transformToString()) as T;
}

async function putStatus(
  bucketName: string,
  statusKey: string,
  job: DynamoItem,
  status: string,
  error: string | null
): Promise<void> {
  const now = new Date().toISOString();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: statusKey,
      Body: JSON.stringify({
        jobId: job.jobId,
        surveyId: job.surveyId,
        annotationSetId: job.annotationSetId,
        status,
        phase: status,
        updatedAt: now,
        error,
      }),
      ContentType: 'application/json',
    })
  );
}

async function updateTerminalStatus(
  tableName: string,
  event: FinalizeEvent,
  status: string,
  error: string | null
): Promise<void> {
  const now = new Date().toISOString();
  await dynamo.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { jobKey: event.jobKey },
      ConditionExpression: 'jobId = :jobId',
      UpdateExpression:
        'SET #status = :status, phase = :status, heartbeatAt = :heartbeatAt, updatedAt = :updatedAt, #error = :error',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#error': 'error',
      },
      ExpressionAttributeValues: {
        ':jobId': event.jobId,
        ':status': status,
        ':heartbeatAt': Date.now(),
        ':updatedAt': now,
        ':error': error,
      },
    })
  );
}

async function rollback(
  bucketName: string,
  expectedResultTable: string,
  expectedSurveyId: string,
  expectedAnnotationSetId: string,
  manifestKey: string,
  event: FinalizeEvent
): Promise<void> {
  const manifest = await readJson<CommitManifest>(
    bucketName,
    manifestKey
  );
  if (
    manifest.jobId !== event.jobId ||
    manifest.jobKey !== event.jobKey ||
    manifest.surveyId !== expectedSurveyId ||
    manifest.annotationSetId !== expectedAnnotationSetId ||
    manifest.tableName !== expectedResultTable
  ) {
    throw new Error('Commit manifest did not match the failed job');
  }

  const oldKeys = new Set(manifest.oldRows.map(resultKey));
  const newOnlyRows = manifest.newRows.filter(
    (row) => !oldKeys.has(resultKey(row))
  );
  const requests: NonNullable<
    BatchWriteCommandInput['RequestItems']
  >[string] = [
    ...manifest.oldRows.map((item) => ({
      PutRequest: { Item: item },
    })),
    ...newOnlyRows.map((item) => ({
      DeleteRequest: { Key: deleteKey(item) },
    })),
  ];
  await batchWriteAll(expectedResultTable, requests);

  const restoredKeys = new Set<string>();
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await dynamo.send(
      new QueryCommand({
        TableName: expectedResultTable,
        KeyConditionExpression: 'surveyId = :surveyId',
        ExpressionAttributeValues: {
          ':surveyId': manifest.surveyId,
        },
        ProjectionExpression:
          'surveyId, annotationSetId, #resultSortKey',
        ExpressionAttributeNames: {
          '#resultSortKey':
            'stratumId#annotationSetId#categoryId',
        },
        ConsistentRead: true,
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    for (const item of page.Items ?? []) {
      if (item.annotationSetId === manifest.annotationSetId) {
        restoredKeys.add(resultKey(item));
      }
    }
    exclusiveStartKey = page.LastEvaluatedKey;
  } while (exclusiveStartKey);

  const expectedKeys = new Set(manifest.oldRows.map(resultKey));
  if (
    restoredKeys.size !== expectedKeys.size ||
    [...expectedKeys].some((key) => !restoredKeys.has(key))
  ) {
    throw new Error(
      'Rollback verification did not restore the prior result set'
    );
  }
}

export const handler = async (
  event: FinalizeEvent
): Promise<{ ok: boolean; status: string }> => {
  const jobTableName = requiredEnvironment('JOLLY_JOB_TABLE_NAME');
  const resultTableName = requiredEnvironment(
    'JOLLY_RESULT_TABLE_NAME'
  );
  const bucketName = requiredEnvironment('OUTPUTS_BUCKET_NAME');
  const response = await dynamo.send(
    new GetCommand({
      TableName: jobTableName,
      Key: { jobKey: event.jobKey },
      ConsistentRead: true,
    })
  );
  const job = response.Item;
  if (!job || job.jobId !== event.jobId) {
    return { ok: false, status: 'SUPERSEDED' };
  }
  if (job.status === 'COMPLETED') {
    return { ok: true, status: 'COMPLETED' };
  }

  const statusKey = String(job.statusKey);
  let existingError: string | null = null;
  try {
    const status = await readJson<{ error?: string | null }>(
      bucketName,
      statusKey
    );
    existingError = status.error ?? null;
  } catch {
    existingError = null;
  }
  // Reaching here on the SUCCEEDED branch means the container exited 0 but the
  // job never reached COMPLETED — the worker died between its last commit and
  // its final status write, so the manifest (if any) still needs rolling back.
  const workflowMessage =
    event.outcome === 'SUCCEEDED'
      ? 'The worker exited without publishing completed results'
      : (event.workflowError?.Cause ??
        event.workflowError?.Error ??
        'The Fargate worker stopped before publishing completed results');
  const error = existingError ?? workflowMessage;
  const manifestKey =
    typeof job.commitManifestKey === 'string'
      ? job.commitManifestKey
      : undefined;

  try {
    if (manifestKey) {
      await updateTerminalStatus(
        jobTableName,
        event,
        'ROLLING_BACK',
        error
      );
      await putStatus(
        bucketName,
        statusKey,
        job,
        'ROLLING_BACK',
        error
      );
      await rollback(
        bucketName,
        resultTableName,
        String(job.surveyId),
        String(job.annotationSetId),
        manifestKey,
        event
      );
    }
    await updateTerminalStatus(
      jobTableName,
      event,
      'FAILED',
      error
    );
    await putStatus(bucketName, statusKey, job, 'FAILED', error);
    return { ok: false, status: 'FAILED' };
  } catch (rollbackError) {
    const rollbackMessage =
      rollbackError instanceof Error
        ? rollbackError.message
        : String(rollbackError);
    const combinedError = `${error}. Rollback failed: ${rollbackMessage}`;
    await updateTerminalStatus(
      jobTableName,
      event,
      'ROLLBACK_FAILED',
      combinedError
    );
    await putStatus(
      bucketName,
      statusKey,
      job,
      'ROLLBACK_FAILED',
      combinedError
    );
    throw rollbackError;
  }
};
