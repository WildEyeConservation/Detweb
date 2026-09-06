import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import type { GetQueueAttributesCommand, SQSClient } from '@aws-sdk/client-sqs';
import { queueCountQuery } from './queueCountQuery';

test('concurrent and freshly mounted queue consumers share a single request', async () => {
  const client = new QueryClient();
  let calls = 0;
  let finish!: () => void;
  const waiting = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const sqs = {
    send: async (command: GetQueueAttributesCommand) => {
      calls++;
      assert.equal(command.input.QueueUrl, 'queue-a');
      await waiting;
      return { Attributes: { ApproximateNumberOfMessages: '12' } };
    },
  } as unknown as Pick<SQSClient, 'send'>;
  const options = queueCountQuery('queue-a', async () => sqs);
  const first = client.fetchQuery(options);
  const second = client.fetchQuery(options);
  finish();
  assert.deepEqual(await Promise.all([first, second]), [12, 12]);
  assert.equal(await client.fetchQuery(options), 12);
  assert.equal(calls, 1);
  client.clear();
});

test('queue errors retain the previous count instead of declaring the queue empty', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const sqs = {
    send: async () => {
      throw new Error('Offline');
    },
  } as unknown as Pick<SQSClient, 'send'>;
  const options = queueCountQuery('queue-a', async () => sqs);
  client.setQueryData(options.queryKey, 7);
  await assert.rejects(
    client.fetchQuery({ ...options, staleTime: 0 }),
    /Offline/
  );
  assert.equal(client.getQueryData(options.queryKey), 7);
  client.clear();
});

test('query cancellation reaches the in-flight SQS request', async () => {
  const client = new QueryClient();
  let signal: AbortSignal | undefined;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const sqs = {
    send: async (
      _command: GetQueueAttributesCommand,
      options: { abortSignal: AbortSignal }
    ) => {
      signal = options.abortSignal;
      started();
      await new Promise<void>((_, reject) => {
        signal!.addEventListener('abort', () => reject(new Error('Aborted')), {
          once: true,
        });
      });
    },
  } as unknown as Pick<SQSClient, 'send'>;
  const options = queueCountQuery('queue-a', async () => sqs);
  const result = client.fetchQuery(options);
  const rejected = assert.rejects(result);
  await ready;
  await client.cancelQueries({ queryKey: options.queryKey });
  await rejected;
  assert.equal(signal?.aborted, true);
  client.clear();
});
