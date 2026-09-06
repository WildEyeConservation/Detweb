import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { refreshAfterMutations } from './refreshAfterMutations';

const key = ['Annotation', { filter: { imageId: { eq: 'image' } } }];
function pendingWrite(client: QueryClient, mutationKey = key) {
  let finish!: () => void;
  const waiting = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const mutation = client.getMutationCache().build(client, {
    mutationKey,
    mutationFn: () => waiting,
    onSuccess: () => {
      client.setQueryData(mutationKey, ['saved']);
    },
  });
  return { done: mutation.execute(undefined), finish };
}

test('activation refresh waits for every write to the same query to reconcile', async () => {
  const client = new QueryClient();
  const first = pendingWrite(client);
  const second = pendingWrite(client);
  let refreshes = 0;
  const stop = refreshAfterMutations(client, key, () => {
    assert.deepEqual(client.getQueryData(key), ['saved']);
    refreshes++;
  });
  assert.equal(refreshes, 0);
  first.finish();
  await first.done;
  assert.equal(refreshes, 0);
  second.finish();
  await second.done;
  assert.equal(refreshes, 1);
  client.setQueryData(key, ['later']);
  assert.equal(refreshes, 1);
  stop();
  client.clear();
});

test('hiding a waiting view cancels its activation refresh', async () => {
  const client = new QueryClient();
  const write = pendingWrite(client);
  let refreshes = 0;
  const stop = refreshAfterMutations(client, key, () => {
    refreshes++;
  });
  stop();
  write.finish();
  await write.done;
  assert.equal(refreshes, 0);
  client.clear();
});

test('unrelated writes do not delay a visible image refresh', async () => {
  const client = new QueryClient();
  const write = pendingWrite(client, [
    'Annotation',
    { filter: { imageId: { eq: 'other' } } },
  ]);
  let refreshes = 0;
  const stop = refreshAfterMutations(client, key, () => {
    refreshes++;
  });
  assert.equal(refreshes, 1);
  write.finish();
  await write.done;
  assert.equal(refreshes, 1);
  stop();
  client.clear();
});

test('failed writes also release the activation refresh', async () => {
  const client = new QueryClient();
  let fail!: (error: Error) => void;
  const waiting = new Promise<void>((_, reject) => {
    fail = reject;
  });
  const mutation = client
    .getMutationCache()
    .build(client, { mutationKey: key, mutationFn: () => waiting });
  const done = mutation.execute(undefined);
  let refreshes = 0;
  const stop = refreshAfterMutations(client, key, () => {
    refreshes++;
  });
  fail(new Error('Write failed'));
  await assert.rejects(done, /Write failed/);
  assert.equal(refreshes, 1);
  stop();
  client.clear();
});
