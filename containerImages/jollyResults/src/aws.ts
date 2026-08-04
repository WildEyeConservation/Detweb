import {
  DescribeTableCommand,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
  type BatchWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import {
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type {
  CommitManifest,
  DynamoItem,
  JobInput,
  JobStatus,
  JollyResultRecord,
} from './types.js';

const region = process.env.AWS_REGION;
const baseConfig = {
  region,
  maxAttempts: 8,
};

export const rawDynamo = new DynamoDBClient(baseConfig);
export const dynamo = DynamoDBDocumentClient.from(rawDynamo, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});
export const s3 = new S3Client(baseConfig);

export interface WorkerEnvironment {
  outputBucketName: string;
  jobTableName: string;
  projectTableName: string;
  cameraTableName: string;
  stratumTableName: string;
  transectTableName: string;
  imageTableName: string;
  annotationTableName: string;
  jollyResultTableName: string;
}

export function readWorkerEnvironment(): WorkerEnvironment {
  const required = (name: string): string => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required`);
    return value;
  };
  return {
    outputBucketName: required('OUTPUTS_BUCKET_NAME'),
    jobTableName: required('JOLLY_JOB_TABLE_NAME'),
    projectTableName: required('PROJECT_TABLE_NAME'),
    cameraTableName: required('CAMERA_TABLE_NAME'),
    stratumTableName: required('STRATUM_TABLE_NAME'),
    transectTableName: required('TRANSECT_TABLE_NAME'),
    imageTableName: required('IMAGE_TABLE_NAME'),
    annotationTableName: required('ANNOTATION_TABLE_NAME'),
    jollyResultTableName: required('JOLLY_RESULT_TABLE_NAME'),
  };
}

export function readJobInput(): JobInput {
  const value = process.env.JOLLY_JOB_INPUT;
  if (!value) throw new Error('JOLLY_JOB_INPUT is required');
  const parsed = JSON.parse(value) as Partial<JobInput>;
  const stringFields: Array<keyof JobInput> = [
    'jobId',
    'jobKey',
    'surveyId',
    'annotationSetId',
    'organizationId',
    'statusKey',
  ];
  for (const field of stringFields) {
    if (typeof parsed[field] !== 'string' || !parsed[field]) {
      throw new Error(`JOLLY_JOB_INPUT.${field} is required`);
    }
  }
  if (
    !Array.isArray(parsed.categoryIds) ||
    parsed.categoryIds.length === 0 ||
    parsed.categoryIds.some((value) => typeof value !== 'string')
  ) {
    throw new Error(
      'JOLLY_JOB_INPUT.categoryIds must contain at least one ID'
    );
  }
  return parsed as JobInput;
}

export async function findHashIndex(
  tableName: string,
  hashAttribute: string
): Promise<string> {
  const response = await rawDynamo.send(
    new DescribeTableCommand({ TableName: tableName })
  );
  const candidates = (response.Table?.GlobalSecondaryIndexes ?? []).filter(
    (index) =>
      index.KeySchema?.some(
        (key) =>
          key.KeyType === 'HASH' &&
          key.AttributeName === hashAttribute
      )
  );
  const selected =
    candidates.find(
      (index) =>
        !index.KeySchema?.some((key) => key.KeyType === 'RANGE')
    ) ?? candidates[0];
  if (!selected?.IndexName) {
    throw new Error(
      `No ${hashAttribute} global secondary index found on ${tableName}`
    );
  }
  return selected.IndexName;
}

function projection(fields: string[]): {
  ProjectionExpression: string;
  ExpressionAttributeNames: Record<string, string>;
} {
  const names = Object.fromEntries(
    fields.map((field, index) => [`#field${index}`, field])
  );
  return {
    ProjectionExpression: Object.keys(names).join(', '),
    ExpressionAttributeNames: names,
  };
}

export async function queryByHash<T>(
  options: {
    tableName: string;
    indexName?: string;
    hashAttribute: string;
    hashValue: string;
    fields: string[];
    consistentRead?: boolean;
  },
  onPage?: (pageNumber: number, itemCount: number) => Promise<void>
): Promise<T[]> {
  const items: T[] = [];
  await consumeByHash<T>(
    options,
    async (pageItems) => {
      items.push(...pageItems);
    },
    onPage
  );
  return items;
}

export async function consumeByHash<T>(
  options: {
    tableName: string;
    indexName?: string;
    hashAttribute: string;
    hashValue: string;
    fields: string[];
    consistentRead?: boolean;
  },
  consume: (items: T[]) => Promise<void>,
  onPage?: (pageNumber: number, itemCount: number) => Promise<void>
): Promise<void> {
  let exclusiveStartKey: Record<string, unknown> | undefined;
  let pageNumber = 0;
  let itemCount = 0;
  const selectedFields = projection(options.fields);
  do {
    const page = await dynamo.send(
      new QueryCommand({
        TableName: options.tableName,
        IndexName: options.indexName,
        KeyConditionExpression: '#hash = :hash',
        ExpressionAttributeValues: { ':hash': options.hashValue },
        ...selectedFields,
        ExpressionAttributeNames: {
          ...selectedFields.ExpressionAttributeNames,
          '#hash': options.hashAttribute,
        },
        ConsistentRead: options.consistentRead,
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    const pageItems = (page.Items ?? []) as T[];
    await consume(pageItems);
    itemCount += pageItems.length;
    exclusiveStartKey = page.LastEvaluatedKey;
    pageNumber += 1;
    await onPage?.(pageNumber, itemCount);
  } while (exclusiveStartKey);
}

export async function getProjectOrganizationId(
  tableName: string,
  surveyId: string
): Promise<string> {
  const response = await dynamo.send(
    new GetCommand({
      TableName: tableName,
      Key: { id: surveyId },
      ProjectionExpression: 'organizationId',
      ConsistentRead: true,
    })
  );
  const organizationId = response.Item?.organizationId;
  if (typeof organizationId !== 'string' || !organizationId) {
    throw new Error('Survey does not have an organizationId');
  }
  return organizationId;
}

export class ProgressReporter {
  private lastEmittedAt = 0;
  private readonly startedAt = new Date().toISOString();

  constructor(
    private readonly environment: WorkerEnvironment,
    private readonly job: JobInput
  ) {}

  async emit(
    status: string,
    phase: string,
    options: {
      progress?: Record<string, number | string>;
      validation?: JobStatus['validation'];
      warnings?: string[];
      error?: string | null;
      commitManifestKey?: string;
      force?: boolean;
    } = {}
  ): Promise<void> {
    const nowMilliseconds = Date.now();
    if (
      !options.force &&
      nowMilliseconds - this.lastEmittedAt < 30_000
    ) {
      return;
    }
    const now = new Date(nowMilliseconds).toISOString();
    const expressionNames: Record<string, string> = {
      '#status': 'status',
      '#phase': 'phase',
    };
    const expressionValues: Record<string, unknown> = {
      ':status': status,
      ':phase': phase,
      ':jobId': this.job.jobId,
      ':heartbeatAt': nowMilliseconds,
      ':updatedAt': now,
    };
    const sets = [
      '#status = :status',
      '#phase = :phase',
      'heartbeatAt = :heartbeatAt',
      'updatedAt = :updatedAt',
    ];
    if (options.commitManifestKey) {
      expressionValues[':manifest'] = options.commitManifestKey;
      sets.push('commitManifestKey = :manifest');
    }

    await dynamo.send(
      new UpdateCommand({
        TableName: this.environment.jobTableName,
        Key: { jobKey: this.job.jobKey },
        ConditionExpression: 'jobId = :jobId',
        UpdateExpression: `SET ${sets.join(', ')}`,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues,
      })
    );

    const body: JobStatus = {
      jobId: this.job.jobId,
      surveyId: this.job.surveyId,
      annotationSetId: this.job.annotationSetId,
      status,
      phase,
      progress: options.progress,
      validation: options.validation,
      warnings: options.warnings,
      startedAt: this.startedAt,
      updatedAt: now,
      error: options.error ?? null,
    };
    await s3.send(
      new PutObjectCommand({
        Bucket: this.environment.outputBucketName,
        Key: this.job.statusKey,
        Body: JSON.stringify(body),
        ContentType: 'application/json',
      })
    );
    this.lastEmittedAt = nowMilliseconds;
  }

  // Bumps the heartbeat and asserts this worker still owns the job, without the
  // S3 write that `emit` performs. The batch commit path writes outside a
  // transaction, so it needs this guard between batches: if a launch has already
  // treated this job as stale and claimed it, the condition fails and we stop
  // rather than interleaving rows with the newer worker.
  async assertStillOwner(): Promise<void> {
    await dynamo.send(
      new UpdateCommand({
        TableName: this.environment.jobTableName,
        Key: { jobKey: this.job.jobKey },
        ConditionExpression:
          'jobId = :jobId AND #status = :running',
        UpdateExpression: 'SET heartbeatAt = :heartbeatAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':jobId': this.job.jobId,
          ':running': 'RUNNING',
          ':heartbeatAt': Date.now(),
        },
      })
    );
  }
}

export async function queryExistingResults(
  tableName: string,
  surveyId: string,
  annotationSetId: string
): Promise<DynamoItem[]> {
  const all = await queryByHash<DynamoItem>({
    tableName,
    hashAttribute: 'surveyId',
    hashValue: surveyId,
    consistentRead: true,
    fields: [
      'surveyId',
      'stratumId',
      'annotationSetId',
      'categoryId',
      'animals',
      'areaSurveyed',
      'estimate',
      'density',
      'variance',
      'standardError',
      'numSamples',
      'lowerBound95',
      'upperBound95',
      'group',
      'createdAt',
      'updatedAt',
      '__typename',
      'stratumId#annotationSetId#categoryId',
    ],
  });
  return all.filter(
    (item) => item.annotationSetId === annotationSetId
  );
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
  >[string],
  beforeBatch?: (batchSize: number) => Promise<void>
): Promise<void> {
  for (let offset = 0; offset < requests.length; offset += 25) {
    let pending = requests.slice(offset, offset + 25);
    await beforeBatch?.(pending.length);
    for (let attempt = 0; pending.length > 0; attempt += 1) {
      if (attempt >= 8) {
        throw new Error(
          `DynamoDB still returned ${pending.length} unprocessed result writes`
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

export async function commitResults(options: {
  environment: WorkerEnvironment;
  job: JobInput;
  reporter: ProgressReporter;
  results: JollyResultRecord[];
  validation: JobStatus['validation'];
  warnings: string[];
}): Promise<void> {
  const { environment, job, reporter } = options;
  const oldRows = await queryExistingResults(
    environment.jollyResultTableName,
    job.surveyId,
    job.annotationSetId
  );
  const newRows = options.results as unknown as DynamoItem[];
  const newKeys = new Set(newRows.map(resultKey));
  const staleRows = oldRows.filter(
    (row) => !newKeys.has(resultKey(row))
  );
  const manifest: CommitManifest = {
    jobId: job.jobId,
    jobKey: job.jobKey,
    surveyId: job.surveyId,
    annotationSetId: job.annotationSetId,
    tableName: environment.jollyResultTableName,
    createdAt: new Date().toISOString(),
    oldRows,
    newRows,
  };
  const manifestKey = `jolly-commits/${job.jobId}.json`;
  await s3.send(
    new PutObjectCommand({
      Bucket: environment.outputBucketName,
      Key: manifestKey,
      Body: JSON.stringify(manifest),
      ContentType: 'application/json',
    })
  );
  await reporter.emit('RUNNING', 'COMMITTING', {
    progress: {
      rowsToWrite: newRows.length,
      staleRowsToDelete: staleRows.length,
    },
    validation: options.validation,
    warnings: options.warnings,
    commitManifestKey: manifestKey,
    force: true,
  });

  const mutationCount = newRows.length + staleRows.length;
  if (mutationCount <= 99) {
    await dynamo.send(
      new TransactWriteCommand({
        ClientRequestToken: job.jobId,
        TransactItems: [
          {
            ConditionCheck: {
              TableName: environment.jobTableName,
              Key: { jobKey: job.jobKey },
              ConditionExpression:
                'jobId = :jobId AND #status = :running',
              ExpressionAttributeNames: { '#status': 'status' },
              ExpressionAttributeValues: {
                ':jobId': job.jobId,
                ':running': 'RUNNING',
              },
            },
          },
          ...newRows.map((item) => ({
            Put: {
              TableName: environment.jollyResultTableName,
              Item: item,
            },
          })),
          ...staleRows.map((item) => ({
            Delete: {
              TableName: environment.jollyResultTableName,
              Key: deleteKey(item),
            },
          })),
        ],
      })
    );
  } else {
    const requests: NonNullable<
      BatchWriteCommandInput['RequestItems']
    >[string] = [
      ...newRows.map((item) => ({ PutRequest: { Item: item } })),
      ...staleRows.map((item) => ({
        DeleteRequest: { Key: deleteKey(item) },
      })),
    ];
    let rowsWritten = 0;
    await batchWriteAll(
      environment.jollyResultTableName,
      requests,
      async (batchSize) => {
        await reporter.assertStillOwner();
        // Not forced: `emit` throttles to one status artifact every 30s, so a
        // large commit does not turn into one S3 PutObject per 25 rows.
        await reporter.emit('RUNNING', 'COMMITTING', {
          progress: {
            rowsToWrite: newRows.length,
            staleRowsToDelete: staleRows.length,
            rowsCommitted: rowsWritten,
          },
          validation: options.validation,
          warnings: options.warnings,
        });
        rowsWritten += batchSize;
      }
    );
  }

  const committed = await queryExistingResults(
    environment.jollyResultTableName,
    job.surveyId,
    job.annotationSetId
  );
  const committedKeys = new Set(committed.map(resultKey));
  if (
    committedKeys.size !== newKeys.size ||
    [...newKeys].some((key) => !committedKeys.has(key))
  ) {
    throw new Error(
      'Result verification failed after the DynamoDB commit'
    );
  }
}
