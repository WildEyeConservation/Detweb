import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { surveyEditorHref, surveyEditorTabIndex, surveyEditorTabs } from './surveyEditorTabs';

test('editor links round trip every tab, including escaped project ids', () => {
  surveyEditorTabs.forEach((tab, index) => {
    const path = surveyEditorHref('survey / 1', index);
    assert.equal(path, `/surveys/survey%20%2F%201/edit/${tab.path}`);
    assert.equal(surveyEditorTabIndex(path.split('/').at(-1)), index);
  });
});

test('direct editor links default to information; unknown tabs are rejected', () => {
  assert.equal(surveyEditorTabIndex(), 0);
  assert.equal(surveyEditorTabIndex('missing'), -1);
});
