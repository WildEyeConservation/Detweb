import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { QueryClient, QueriesObserver } from '@tanstack/react-query';
import { selectSurveySummaries, surveyListQuery, surveyPage, type SurveySummary } from './surveyListQuery';

function project(id: string, organizationId = 'ewan'): SurveySummary {
  return {
    id, name: id, organizationId, organization: { name: organizationId },
    status: 'active', createdAt: '2026-09-01',
    annotationSets: [], queues: [], individualIdJobs: [],
  };
}

test('survey summaries use the user index and organisation filter across every page', async () => {
  const client = new QueryClient();
  const calls: unknown[] = [];
  const options = surveyListQuery('user', 'ewan', async (input, options) => {
    calls.push(options.nextToken);
    assert.deepEqual(input, { userId: 'user' });
    assert.deepEqual(options.filter, { isAdmin: { eq: true }, group: { eq: 'ewan' } });
    assert.ok(!options.selectionSet.some((field) => /imageCount|observedCount|url/.test(field)));
    return options.nextToken
      ? { data: [{ project: project('b') }, { project: null }] }
      : { data: [{ project: project('a') }, { project: project('outside', 'other') }], nextToken: 'next' };
  });
  assert.deepEqual((await client.fetchQuery(options)).map((row) => row.id), ['a', 'b']);
  await client.fetchQuery(options);
  assert.deepEqual(calls, [undefined, 'next']);
  client.clear();
});

test('all organisations omits the group filter and separate organisations own separate caches', async () => {
  const client = new QueryClient();
  let calls = 0;
  const list: Parameters<typeof surveyListQuery>[2] = async (_input, options) => {
    calls++;
    const org = options.filter.group?.eq;
    return { data: [{ project: project('one', org || 'ewan') }] };
  };
  await client.fetchQuery(surveyListQuery('user', '', list));
  await client.fetchQuery(surveyListQuery('user', 'ewan', list));
  await client.fetchQuery(surveyListQuery('user', 'other', list));
  assert.equal(calls, 3);
  client.clear();
});

test('summary errors surface instead of caching a partial or empty successful result', async () => {
  const options = surveyListQuery('user', 'ewan', async () => ({
    data: [], errors: [{ message: 'Unavailable' }],
  }));
  await assert.rejects(options.queryFn({ signal: new AbortController().signal }), /Unavailable/);
});

test('search and active-job sorting use all summaries before taking a page', () => {
  const rows = Array.from({ length: 1000 }, (_, i) => project(String(i).padStart(4, '0')));
  rows[900].annotationSets = [{ id: 'set', name: 'Elephants' }];
  rows[950].individualIdJobs = [{ id: 'job', status: 'active' }];
  assert.deepEqual(selectSurveySummaries(rows, 'ewan', 'elephants', 'name').map((row) => row.id), ['0900']);
  assert.equal(surveyPage(selectSurveySummaries(rows, 'ewan', '', 'activeJobs'), 0, 5).rows[0].id, '0950');
  assert.equal(surveyPage(rows, 1, 5).rows[0].id, '0005');
  assert.deepEqual(surveyPage(rows, 0, 5).nextRows.map((row) => row.id), ['0005', '0006', '0007', '0008', '0009']);
  assert.deepEqual(surveyPage(rows, 199, 5).nextRows, []);
  assert.deepEqual(surveyPage([], 0, 5).nextRows, []);
  assert.equal(surveyPage(rows.slice(0, 3), 199, 5).currentPage, 0);
  assert.equal(surveyPage([], 2, 5).pageCount, 1);
});

test('prefetched next-page details are reused on navigation without becoming active pollers', async () => {
  const client = new QueryClient();
  const rows = Array.from({ length: 1000 }, (_, i) => project(String(i)));
  const calls: string[] = [];
  const query = ({ id }: SurveySummary) => ({
    queryKey: ['surveys-project-details', id], staleTime: 30_000,
    queryFn: async () => { calls.push(id); return project(id); },
  });
  const first = surveyPage(rows, 0, 5);
  await Promise.all(first.rows.map((row) => client.fetchQuery(query(row))));
  await Promise.all(first.nextRows.map((row) => client.prefetchQuery(query(row))));
  assert.equal(calls.length, 10);
  for (const row of first.nextRows) {
    assert.equal(client.getQueryCache().find({ queryKey: query(row).queryKey })?.getObserversCount(), 0);
  }
  const observer = new QueriesObserver(client, surveyPage(rows, 1, 5).rows.map(query));
  const unsubscribe = observer.subscribe(() => {});
  assert.ok(observer.getCurrentResult().every((result) => result.isSuccess && !result.isFetching));
  assert.equal(calls.length, 10);
  unsubscribe();
  client.clear();
});

test('a thousand summaries produce only five active detail requests; hidden invalidation waits for navigation', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rows = Array.from({ length: 1000 }, (_, i) => project(String(i)));
  const calls: string[] = [];
  const queries = (page: number) => surveyPage(rows, page, 5).rows.map(({ id }) => ({
    queryKey: ['surveys-project-details', id], staleTime: 30_000,
    queryFn: async () => { calls.push(id); return project(id); },
  }));
  const observer = new QueriesObserver(client, queries(0));
  const unsubscribe = observer.subscribe(() => {});
  await Promise.all(queries(0).map((query) => client.fetchQuery(query)));
  assert.deepEqual(calls, ['0', '1', '2', '3', '4']);
  observer.setQueries(queries(1));
  await Promise.all(queries(1).map((query) => client.fetchQuery(query)));
  assert.equal(calls.length, 10);
  await client.invalidateQueries({ queryKey: ['surveys-project-details', '0'] });
  assert.equal(calls.length, 10);
  observer.setQueries(queries(0));
  await Promise.all(queries(0).map((query) => client.fetchQuery(query)));
  assert.deepEqual(calls.slice(10), ['0']);
  unsubscribe();
  client.clear();
});
