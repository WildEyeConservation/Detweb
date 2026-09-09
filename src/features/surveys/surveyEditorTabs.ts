export const surveyEditorTabs = [
  { path: 'information', label: 'Information' },
  { path: 'cameras', label: 'Edit Cameras' },
  { path: 'shape-file', label: 'Edit Shape File' },
  { path: 'transects', label: 'Define Transects & Strata' },
  { path: 'tiles', label: 'Manage Tiles' },
  { path: 'processing', label: 'Process Images' },
  { path: 'users', label: 'Manage Users' },
  { path: 'delete-images', label: 'Delete Images' },
  { path: 'advanced', label: 'Advanced Options' },
  { path: 'logs', label: 'Logs' },
] as const;

export function surveyEditorHref(projectId: string, tab = 0) {
  return `/surveys/${encodeURIComponent(projectId)}/edit/${surveyEditorTabs[tab]?.path ?? 'information'}`;
}

export function surveyEditorTabIndex(path?: string) {
  return path === undefined ? 0 : surveyEditorTabs.findIndex((tab) => tab.path === path);
}
