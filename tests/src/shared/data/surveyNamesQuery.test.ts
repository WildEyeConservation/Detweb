import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { surveyNamesQuery } from '../../../../src/shared/data/surveyNamesQuery';

test('new-survey duplicate checks fetch only names in batches, including later pages', async () => {
  const calls: (string | undefined)[] = [];
  const query = surveyNamesQuery('user', async (input, options) => {
    assert.deepEqual(input, { userId: 'user' });
    assert.deepEqual(options.selectionSet, ['project.name']);
    assert.deepEqual(options.filter, { isAdmin: { eq: true } });
    calls.push(options.nextToken);
    return options.nextToken
      ? { data: [{ project: { name: 'Second' } }, { project: { name: 'FIRST' } }] }
      : { data: [{ project: { name: 'First' } }, { project: null }], nextToken: 'page2' };
  });
  assert.deepEqual(await query.queryFn({ signal: new AbortController().signal }), ['first', 'second']);
  assert.deepEqual(calls, [undefined, 'page2']);
});

test('failed name lookup cannot silently allow a duplicate name', async () => {
  const query = surveyNamesQuery('user', async () => ({
    data: [], errors: [{ message: 'Lookup failed' }],
  }));
  await assert.rejects(query.queryFn({ signal: new AbortController().signal }), /Lookup failed/);
});
