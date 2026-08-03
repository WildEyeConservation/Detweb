import assert from 'node:assert/strict';
import test from 'node:test';
import type { DataClient } from '../amplify/shared/data-schema.generated';
import {
  commitInfoTagsForAnnotation,
  finalizeInfoTagImage,
  infoTagIdsFromLinks,
  planInfoTagLinkChanges,
} from './infoTags';

type Call = { name: string; input: Record<string, unknown> };

function fakeClient(
  responses: Record<string, { errors?: Array<{ message: string }> }> = {}
) {
  const calls: Call[] = [];
  const respond = (name: string) => async (input: Record<string, unknown>) => {
    calls.push({ name, input });
    return { data: null, ...(responses[name] ?? {}) };
  };
  const client = {
    models: {
      AnnotationInfoTag: {
        create: respond('createLink'),
        delete: respond('deleteLink'),
      },
      Annotation: { update: respond('updateAnnotation') },
    },
  } as unknown as DataClient;
  return { client, calls };
}

const commit = {
  annotationId: 'annotation-1',
  annotationSetId: 'set-1',
  projectId: 'project-1',
  group: 'org-1',
  before: ['tag-old'],
  after: ['tag-new'],
  position: { x: 10, y: 20 },
  taggedBy: 'user-1',
};

test('planInfoTagLinkChanges reports only the differences', () => {
  const { added, removed } = planInfoTagLinkChanges(
    ['a', 'b'],
    ['b', 'c']
  );
  assert.deepEqual(added, ['c']);
  assert.deepEqual(removed, ['a']);
});

test('infoTagIdsFromLinks accepts array and paged link shapes', () => {
  assert.deepEqual(infoTagIdsFromLinks([{ infoTagId: 'a' }]), ['a']);
  assert.deepEqual(infoTagIdsFromLinks({ items: [{ infoTagId: 'b' }] }), ['b']);
  assert.deepEqual(infoTagIdsFromLinks(undefined), []);
  assert.deepEqual(infoTagIdsFromLinks([{ infoTagId: null }]), []);
});

test('a failed link write leaves the annotation untagged', async () => {
  const { client, calls } = fakeClient({
    createLink: { errors: [{ message: 'Network error' }] },
  });

  await assert.rejects(
    () => commitInfoTagsForAnnotation(client, commit),
    /Failed to add info tag tag-new: Network error/
  );
  assert.equal(
    calls.some((call) => call.name === 'updateAnnotation'),
    false,
    'infoTaggedBy must not be set while a tag link is missing'
  );
});

test('links are written before the annotation is marked tagged', async () => {
  const { client, calls } = fakeClient();

  await commitInfoTagsForAnnotation(client, commit);

  assert.deepEqual(
    calls.map((call) => call.name).sort(),
    ['createLink', 'deleteLink', 'updateAnnotation']
  );
  assert.equal(calls.at(-1)?.name, 'updateAnnotation');
  assert.deepEqual(calls.at(-1)?.input, {
    id: 'annotation-1',
    infoTaggedBy: 'user-1',
    x: 10,
    y: 20,
  });
});

test('a link that is already in the wanted state does not fail a retry', async () => {
  const { client, calls } = fakeClient({
    createLink: { errors: [{ message: 'The conditional request failed' }] },
    deleteLink: { errors: [{ message: 'The conditional request failed' }] },
  });

  await commitInfoTagsForAnnotation(client, commit);

  assert.equal(calls.at(-1)?.name, 'updateAnnotation');
});

test('a failed save is neither counted nor acknowledged', async () => {
  const progress = { counted: false, acknowledged: false };
  let counted = 0;
  let acknowledged = 0;

  await assert.rejects(
    () =>
      finalizeInfoTagImage({
        commits: [Promise.resolve(), Promise.reject(new Error('save failed'))],
        progress,
        countCompletion: true,
        incrementCount: async () => {
          counted++;
        },
        acknowledge: async () => {
          acknowledged++;
        },
      }),
    /save failed/
  );

  assert.equal(counted, 0);
  assert.equal(acknowledged, 0, 'the queue message must stay for redelivery');
  assert.deepEqual(progress, { counted: false, acknowledged: false });
});

test('a retried finish does not count the image twice', async () => {
  const progress = { counted: false, acknowledged: false };
  let counted = 0;
  let acknowledged = 0;
  const options = {
    commits: [],
    progress,
    countCompletion: true,
    incrementCount: async () => {
      counted++;
    },
    acknowledge: async () => {
      acknowledged++;
    },
  };

  await finalizeInfoTagImage(options);
  await finalizeInfoTagImage(options);

  assert.equal(counted, 1);
  assert.equal(acknowledged, 1);
  assert.deepEqual(progress, { counted: true, acknowledged: true });
});

test('an image with no work is acknowledged without being counted', async () => {
  const progress = { counted: false, acknowledged: false };
  let counted = 0;
  let acknowledged = 0;

  await finalizeInfoTagImage({
    commits: [],
    progress,
    countCompletion: false,
    incrementCount: async () => {
      counted++;
    },
    acknowledge: async () => {
      acknowledged++;
    },
  });

  assert.equal(counted, 0);
  assert.equal(acknowledged, 1);
});
