import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { ALL_USERS_QUERY_KEY, userDirectoryQuery } from '../../../../src/shared/data/userDirectoryQuery';

test('directory remounts reuse fresh data; explicit invalidation and expiry refresh it', async () => {
  const client = new QueryClient();
  let calls = 0;
  const options = userDirectoryQuery(async () => {
    calls++;
    return [];
  });
  await client.fetchQuery(options);
  await client.fetchQuery(options);
  assert.equal(calls, 1);
  await client.invalidateQueries({ queryKey: ALL_USERS_QUERY_KEY });
  await client.fetchQuery(options);
  assert.equal(calls, 2);
  client.setQueryData(ALL_USERS_QUERY_KEY, [], {
    updatedAt: Date.now() - 5 * 60_000 - 1,
  });
  await client.fetchQuery(options);
  assert.equal(calls, 3);
  client.clear();
});
