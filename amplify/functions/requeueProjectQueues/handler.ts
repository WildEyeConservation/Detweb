import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/requeueProjectQueues';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import {
  ChangeMessageVisibilityCommand,
  DeleteMessageBatchCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SendMessageBatchCommand,
  type SendMessageBatchRequestEntry,
  SQSClient,
  type Message,
} from '@aws-sdk/client-sqs';
import { randomUUID } from 'crypto';
import { listQueues } from './graphql/queries';

// Inline minimal mutation – return key fields + `group` to avoid nested-resolver
// auth failures while still enabling subscription delivery via groupDefinedIn('group').
const updateQueue = /* GraphQL */ `
  mutation UpdateQueue($input: UpdateQueueInput!) {
    updateQueue(input: $input) { id group }
  }
`;

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
        clearCredentialsAndIdentityId: () => {
          /* noop */
        },
      },
    },
  }
);

const client = generateClient({
  authMode: 'iam',
});

const sqsClient = new SQSClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
  },
});

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const REQUEUE_LOOKBACK_DAYS = 12;
const RECEIVE_BATCH_SIZE = 10;
const MAX_IDLE_POLLS = 5;
const DEFAULT_VISIBILITY_SECONDS = 600;

type QueueType = 'FIFO' | 'Standard';

type PagedList<T> = {
  items: T[];
  nextToken?: string | null;
};

type QueueRecord = {
  id: string;
  projectId: string;
  url?: string | null;
  createdAt?: string | null;
  requeueAt?: string | null;
};

export const handler: Handler = async () => {
  console.log('Starting requeueProjectQueues');
  try {
    const now = Date.now();
    const cutoff = now - REQUEUE_LOOKBACK_DAYS * DAY_IN_MS;
    const queues = await fetchAllQueues();
    const candidates = queues.filter((queue) => shouldRequeueQueue(queue, cutoff));

    console.log(
      'Queues selected for requeue',
      JSON.stringify({ total: queues.length, candidates: candidates.length })
    );

    const results = [] as Array<{ queueId: string; requeued: number }>;

    for (const queue of candidates) {
      if (!queue.url) {
        console.warn('Skipping queue without URL', { queueId: queue.id });
        continue;
      }

      console.log('Processing queue candidate', {
        queueId: queue.id,
        url: queue.url,
        createdAt: queue.createdAt,
        requeueAt: queue.requeueAt ?? null,
      });

      try {
        const summary = await requeueQueueMessages(queue, now);
        console.log('Queue requeue summary', {
          queueId: queue.id,
          requeued: summary.requeued,
        });
        console.log('Updating queue timestamps', { queueId: queue.id });
        await touchQueueTimestamps(queue.id);
        console.log('Queue timestamps updated', { queueId: queue.id });
        results.push({ queueId: queue.id, requeued: summary.requeued });
        console.log('Requeued queue successfully', {
          queueId: queue.id,
          url: queue.url,
          requeued: summary.requeued,
        });
      } catch (error: any) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
            ? error
            : JSON.stringify(error);
        console.error('Failed to requeue queue', {
          queueId: queue.id,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        processed: candidates.length,
        queuesRequeued: results.length,
      }),
    };
  } catch (error: any) {
    console.error('Unhandled error in requeueProjectQueues', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to requeue queues', error: error?.message }),
    };
  }
};

async function requeueQueueMessages(queue: QueueRecord, requeueStartMs: number) {
  const queueUrl = queue.url!;
  const queueType = await getQueueType(queueUrl);
  let requeuedMessages = 0;
  let idlePolls = 0;
  console.log('Starting queue requeue loop', {
    queueId: queue.id,
    queueUrl,
    queueType,
  });

  while (idlePolls < MAX_IDLE_POLLS) {
    console.log('Polling for messages', {
      queueId: queue.id,
      queueUrl,
      idlePolls,
    });
    const response = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: RECEIVE_BATCH_SIZE,
        AttributeNames: ['All'],
        MessageAttributeNames: ['All'],
        VisibilityTimeout: DEFAULT_VISIBILITY_SECONDS,
        WaitTimeSeconds: 0,
      })
    );

    const messages = response.Messages ?? [];
    if (!messages.length) {
      console.log('No messages received for queue', {
        queueId: queue.id,
        queueUrl,
        idlePolls,
      });
      idlePolls += 1;
      continue;
    }

    const originalMessages: Message[] = [];
    const releaseHandles: string[] = [];

    for (const message of messages) {
      const sentTimestamp = parseInt(message.Attributes?.SentTimestamp ?? '0', 10);
      const messageInfo = {
        messageId: message.MessageId,
        sentTimestamp,
        receiptPresent: Boolean(message.ReceiptHandle),
      };

      if (Number.isNaN(sentTimestamp) || sentTimestamp < requeueStartMs) {
        if (message.ReceiptHandle) {
          originalMessages.push(message);
          console.log('Selected original message for requeue', {
            queueId: queue.id,
            ...messageInfo,
          });
        } else {
          console.warn('Original message missing receipt handle', {
            queueId: queue.id,
            ...messageInfo,
          });
        }
      } else if (message.ReceiptHandle) {
        releaseHandles.push(message.ReceiptHandle);
        console.log('Releasing new message without requeue', {
          queueId: queue.id,
          ...messageInfo,
        });
      } else {
        console.warn('New message missing receipt handle', {
          queueId: queue.id,
          ...messageInfo,
        });
      }
    }

    if (releaseHandles.length) {
      console.log('Releasing message handles', {
        queueId: queue.id,
        count: releaseHandles.length,
      });
    }

    await Promise.all(
      releaseHandles.map((handle) => releaseMessage(queueUrl, handle))
    );

    if (!originalMessages.length) {
      console.log('No original messages to requeue in this batch', {
        queueId: queue.id,
      });
      idlePolls += 1;
      continue;
    }

    idlePolls = 0;
    console.log('Requeueing original messages', {
      queueId: queue.id,
      count: originalMessages.length,
    });

    const entries = buildSendEntries(queueType, originalMessages);
    const sendResult = await sqsClient.send(
      new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: entries,
      })
    );
    console.log('SendMessageBatch result', {
      queueId: queue.id,
      successful: sendResult.Successful?.length ?? 0,
      failed: sendResult.Failed?.length ?? 0,
    });

    const successfulIds = new Set(
      (sendResult.Successful ?? []).map((entry) => entry.Id)
    );

    if ((sendResult.Failed?.length ?? 0) > 0) {
      const failedReasons = (sendResult.Failed ?? [])
        .map((failure) => `${failure.Id}:${failure.Message}`)
        .join(', ');
      console.error('SendMessageBatch encountered failures', {
        queueId: queue.id,
        failures: sendResult.Failed,
      });
      throw new Error(
        `Failed to requeue ${sendResult.Failed?.length} messages: ${failedReasons}`
      );
    }

    const deleteEntries = originalMessages
      .map((message, index) => ({
        Id: entries[index].Id,
        ReceiptHandle: message.ReceiptHandle!,
      }))
      .filter((entry) => successfulIds.has(entry.Id));

    if (deleteEntries.length) {
      console.log('Deleting original messages after successful requeue', {
        queueId: queue.id,
        deleteCount: deleteEntries.length,
      });
      await sqsClient.send(
        new DeleteMessageBatchCommand({
          QueueUrl: queueUrl,
          Entries: deleteEntries,
        })
      );
      requeuedMessages += deleteEntries.length;
      console.log('Updated requeued message count', {
        queueId: queue.id,
        requeuedMessages,
      });
    } else {
      console.warn('No messages qualified for deletion after requeue', {
        queueId: queue.id,
        attempted: originalMessages.length,
      });
    }
  }

  return { requeued: requeuedMessages };
}

async function releaseMessage(queueUrl: string, receiptHandle?: string) {
  if (!receiptHandle) {
    return;
  }
  try {
    await sqsClient.send(
      new ChangeMessageVisibilityCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
        VisibilityTimeout: 0,
      })
    );
  } catch (error) {
    console.error('Failed to release message visibility', {
      queueUrl,
      receiptHandle,
      error,
    });
  }
}

async function getQueueType(queueUrl: string): Promise<QueueType> {
  if (queueUrl.toLowerCase().endsWith('.fifo')) {
    return 'FIFO';
  }

  try {
    const result = await sqsClient.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ['QueueArn'],
      })
    );
    const arn = result.Attributes?.QueueArn ?? '';
    if (arn.toLowerCase().endsWith('.fifo')) {
      return 'FIFO';
    }
  } catch (error) {
    console.warn('Falling back to Standard queue type', {
      queueUrl,
      error,
    });
  }

  return 'Standard';
}

function buildSendEntries(
  queueType: QueueType,
  messages: Message[]
): SendMessageBatchRequestEntry[] {
  return messages.map((message, index) => {
    const baseId = message.MessageId ?? `${Date.now()}-${index}`;
    const entry: SendMessageBatchRequestEntry = {
      Id: baseId.slice(0, 80),
      MessageBody: message.Body ?? '',
      MessageAttributes: message.MessageAttributes,
    };

    if (queueType === 'FIFO') {
      entry.MessageGroupId =
        message.Attributes?.MessageGroupId ?? 'requeue-group';
      entry.MessageDeduplicationId = randomUUID();
    }

    return entry;
  });
}

async function touchQueueTimestamps(queueId: string) {
  const timestamp = new Date().toISOString();
  try {
    await executeGraphql<{ updateQueue?: { id: string } }>(updateQueue, {
      input: {
        id: queueId,
        requeueAt: timestamp,
        updatedAt: timestamp,
      },
    });
  } catch (error) {
    console.error('Failed to update queue timestamps', {
      queueId,
      timestamp,
      error,
    });
    throw error;
  }
}

function shouldRequeueQueue(queue: QueueRecord, cutoffMs: number) {
  if (!queue.requeueAt) {
    console.log('Queue has no requeueAt timestamp; scheduling for requeue', {
      queueId: queue.id,
    });
    return true;
  }
  const requeueAtTime = Date.parse(queue.requeueAt);
  if (Number.isNaN(requeueAtTime)) {
    console.warn('Queue requeueAt timestamp is invalid; scheduling for requeue', {
      queueId: queue.id,
      requeueAt: queue.requeueAt,
    });
    return true;
  }
  return requeueAtTime <= cutoffMs;
}

async function fetchAllQueues() {
  return fetchAllPages<QueueRecord, 'listQueues'>(
    (nextToken) =>
      client.graphql({
        query: listQueues,
        variables: { nextToken },
      }) as Promise<GraphQLResult<{ listQueues: PagedList<QueueRecord> }>>,
    'listQueues'
  );
}

async function fetchAllPages<T, K extends string>(
  queryFn: (
    nextToken?: string
  ) => Promise<GraphQLResult<{ [key in K]: PagedList<T> }>>,
  queryName: K
): Promise<T[]> {
  const items: T[] = [];
  let nextToken: string | undefined;

  do {
    const response = await queryFn(nextToken);
    const page = response.data?.[queryName];
    if (page?.items?.length) {
      items.push(...page.items);
    }
    nextToken = page?.nextToken ?? undefined;
  } while (nextToken);

  return items;
}

async function executeGraphql<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const response = (await (client.graphql as any)({
    query,
    variables,
  })) as GraphQLResult<T>;

  if (response.errors && response.errors.length) {
    throw new Error(
      response.errors.map((error) => error.message).join(', ')
    );
  }

  if (!response.data) {
    throw new Error('GraphQL response missing data');
  }

  return response.data;
}
