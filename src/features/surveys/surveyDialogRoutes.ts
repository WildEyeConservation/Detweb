export const surveyDialogRoutes = [
  { kind: 'newSurvey', path: 'new' },
  { kind: 'addFiles', path: ':surveyId/upload' },
  { kind: 'addAnnotationSet', path: ':surveyId/sets/new' },
  { kind: 'annotationCount', path: ':surveyId/set/:annotationSetId/details' },
  { kind: 'editAnnotationSet', path: ':surveyId/set/:annotationSetId/edit' },
  {
    kind: 'annotationSetResults',
    path: ':surveyId/set/:annotationSetId/results',
  },
  {
    kind: 'launchAnnotationSet',
    path: ':surveyId/set/:annotationSetId/launch',
  },
  {
    kind: 'generateJollyResults',
    path: ':surveyId/set/:annotationSetId/results/generate',
  },
] as const;

export type SurveyDialogKind = (typeof surveyDialogRoutes)[number]['kind'];

export function surveyDialogHref(
  kind: SurveyDialogKind,
  surveyId?: string,
  annotationSetId?: string
) {
  let path: string = surveyDialogRoutes.find(
    (route) => route.kind === kind
  )!.path;
  for (const [key, value] of Object.entries({ surveyId, annotationSetId })) {
    if (!path.includes(`:${key}`)) continue;
    if (!value) throw new Error(`${kind} requires ${key}`);
    path = path.replace(`:${key}`, encodeURIComponent(value));
  }
  return `/surveys/${path}`;
}
