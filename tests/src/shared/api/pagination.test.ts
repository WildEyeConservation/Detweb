import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchAllPaginatedResults } from '../../../../src/shared/api/pagination';

test('list pagination carries options and reports cumulative row counts', async () => {
  const calls: Record<string, unknown>[] = [];
  const progress: number[] = [];
  const query = async (options: Record<string, unknown>) => {
    calls.push(options);
    return options.nextToken
      ? { data: [{ id: 'b' }], nextToken: null }
      : { data: [{ id: 'a' }], nextToken: 'page-2' };
  };
  const options = { filter: { active: { eq: true } }, limit: 10, selectionSet: ['id'] };

  assert.deepEqual(await fetchAllPaginatedResults(query, options, count => progress.push(count)), [
    { id: 'a' }, { id: 'b' },
  ]);
  assert.deepEqual(calls, [
    { ...options, nextToken: undefined },
    { ...options, nextToken: 'page-2' },
  ]);
  assert.deepEqual(progress, [1, 2]);
});

test('indexed pagination separates key conditions from query options', async () => {
  const calls: unknown[][] = [];
  const query = async (input: { projectId: string }, options?: Record<string, unknown>) => {
    calls.push([input, options]);
    return { data: [{ id: 'a' }] };
  };
  await fetchAllPaginatedResults(query, {
    projectId: 'project', source: { beginsWith: 'test' },
    selectionSet: ['id'], sortDirection: 'ASC', limit: 100,
  });
  assert.deepEqual(calls, [[
    { projectId: 'project', source: { beginsWith: 'test' } },
    { selectionSet: ['id'], sortDirection: 'ASC', limit: 100, nextToken: undefined },
  ]]);
});

test('empty pagination terminates and query failures propagate', async () => {
  assert.deepEqual(await fetchAllPaginatedResults(async () => ({ data: [] })), []);
  const failure = new Error('Query failed');
  await assert.rejects(fetchAllPaginatedResults(async () => { throw failure; }), failure);
});
