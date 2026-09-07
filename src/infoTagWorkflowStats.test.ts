import assert from 'node:assert/strict';
import test from 'node:test';
import { infoTagWorkflowMetrics, type InfoTagChange } from './infoTagWorkflowStats';

function change(before: string[], after: string[], moved = false): InfoTagChange {
  return {
    beforeTags: new Set(before), afterTags: new Set(after),
    beforePosition: { x: 1, y: 2 }, afterPosition: { x: moved ? 3 : 1, y: 2 },
  };
}

test('counts changed annotations once while counting individual tag additions and removals', () => {
  assert.deepEqual(infoTagWorkflowMetrics([
    change(['old', 'kept'], ['kept', 'new', 'newer']),
    change([], ['young'], true),
    change(['kept'], ['kept']),
    change([], [], true),
  ]), { annotationsTagged: 2, tagsAdded: 3, tagsRemoved: 1, markersRepositioned: 2 });
});

test('restoring initial tags and marker position contributes no net changes', () => {
  assert.deepEqual(infoTagWorkflowMetrics([change(['a', 'b'], ['b', 'a'])]), {
    annotationsTagged: 0, tagsAdded: 0, tagsRemoved: 0, markersRepositioned: 0,
  });
});
