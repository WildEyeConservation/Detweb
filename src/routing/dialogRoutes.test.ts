import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  createMemoryRouter,
  matchRoutes,
  type RouteObject,
} from 'react-router-dom';
import { dialogSearch } from './dialogSearch';
import { dialogDate, dialogIds } from './dialogValues';
import {
  surveyDialogHref,
  surveyDialogRoutes,
} from '../survey/surveyDialogRoutes';

const routes: RouteObject[] = [
  {
    path: 'surveys',
    children: [
      { index: true },
      ...surveyDialogRoutes.map(({ path, kind }) => ({ path, id: kind })),
      { path: ':surveyId/edit/:tab?', id: 'surveyEditor' },
    ],
  },
];

test('every survey dialog resolves on a fresh direct link, including escaped identifiers', () => {
  for (const { kind } of surveyDialogRoutes) {
    const href = surveyDialogHref(kind, 'survey / 1', 'set ? 2');
    const match = matchRoutes(routes, href)?.at(-1);
    assert.equal(match?.route.id, kind);
    if (kind !== 'newSurvey')
      assert.equal(match?.params.surveyId, 'survey / 1');
    if (href.includes('/set/'))
      assert.equal(match?.params.annotationSetId, 'set ? 2');
  }
  assert.equal(
    matchRoutes(routes, '/surveys/p/edit/labels')?.at(-1)?.route.id,
    'surveyEditor'
  );
});

test('dialog links require the identifiers used by their route', () => {
  assert.equal(surveyDialogHref('newSurvey'), '/surveys/new');
  assert.throws(() => surveyDialogHref('addFiles'), /requires surveyId/);
  assert.throws(
    () => surveyDialogHref('editAnnotationSet', 'survey'),
    /requires annotationSetId/
  );
});

test('opening, changing and closing a dialog preserves parent filters without leaking prior dialog state', () => {
  const parent = new URLSearchParams(
    'organization=org&tab=surveys&filter=one&filter=two'
  );
  const first = dialogSearch(parent, 'configModal', {
    survey: 'a',
    preset: 'old',
  });
  const next = dialogSearch(first, 'exceptions', {
    user: 'user / 1',
    preset: undefined,
  });
  assert.equal(next.get('dialog.user'), 'user / 1');
  assert.equal(next.has('dialog.survey'), false);
  assert.equal(next.has('dialog.preset'), false);
  assert.deepEqual(next.getAll('filter'), ['one', 'two']);
  assert.equal(dialogSearch(next, null).toString(), parent.toString());
  assert.equal(parent.has('dialog'), false);
});

test('Back and Forward restore survey dialogs and nested results generation', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/surveys'] });
  try {
    await router.navigate(surveyDialogHref('annotationSetResults', 'p', 's'));
    await router.navigate(surveyDialogHref('generateJollyResults', 'p', 's'));
    await router.navigate(-1);
    assert.equal(router.state.matches.at(-1)?.route.id, 'annotationSetResults');
    await router.navigate(-1);
    assert.equal(router.state.location.pathname, '/surveys');
    await router.navigate(1);
    assert.equal(router.state.matches.at(-1)?.route.id, 'annotationSetResults');
  } finally {
    router.dispose();
  }
});

test('query dialog history restores the original viewer and closing keeps the report URL', async () => {
  const router = createMemoryRouter([{ path: '/report' }], {
    initialEntries: ['/report?organization=org'],
  });
  const open = async (image: string) =>
    router.navigate({
      search: dialogSearch(router.state.location.search, 'mapViewer', {
        image,
        set: 's',
      }).toString(),
    });
  try {
    await open('one');
    await open('two');
    await router.navigate(-1);
    assert.equal(
      new URLSearchParams(router.state.location.search).get('dialog.image'),
      'one'
    );
    await router.navigate({
      search: dialogSearch(router.state.location.search, null).toString(),
    });
    assert.equal(
      router.state.location.pathname + router.state.location.search,
      '/report?organization=org'
    );
  } finally {
    router.dispose();
  }
});

test('malformed report values cannot silently become another date or identifier list', () => {
  assert.deepEqual(dialogIds('["a","a","b"]'), ['a', 'b']);
  for (const value of [null, 'not-json', '{}', '[1]', '[""]'])
    assert.deepEqual(dialogIds(value), []);
  assert.equal(dialogDate('2024-02-29')?.getDate(), 29);
  for (const value of [
    null,
    '2025-02-29',
    '2025-13-01',
    '2025-01-32',
    '2025-1-1',
    '2025-01-01T00:00:00Z',
  ])
    assert.equal(dialogDate(value), null);
});
