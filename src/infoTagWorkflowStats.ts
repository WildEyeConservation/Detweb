export interface InfoTagChange {
  beforeTags: ReadonlySet<string>;
  afterTags: ReadonlySet<string>;
  beforePosition: { x: number; y: number };
  afterPosition: { x: number; y: number };
}

/** One initial/final comparison per annotation, so undo does not inflate work. */
export function infoTagWorkflowMetrics(changes: Iterable<InfoTagChange>) {
  const metrics = { annotationsTagged: 0, tagsAdded: 0, tagsRemoved: 0, markersRepositioned: 0 };
  for (const change of changes) {
    const added = [...change.afterTags].filter((id) => !change.beforeTags.has(id)).length;
    const removed = [...change.beforeTags].filter((id) => !change.afterTags.has(id)).length;
    if (added || removed) metrics.annotationsTagged += 1;
    metrics.tagsAdded += added;
    metrics.tagsRemoved += removed;
    if (change.beforePosition.x !== change.afterPosition.x || change.beforePosition.y !== change.afterPosition.y) {
      metrics.markersRepositioned += 1;
    }
  }
  return metrics;
}
