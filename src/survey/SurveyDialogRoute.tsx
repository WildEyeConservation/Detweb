import { lazy, useEffect, useRef } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMyOrganizations, useMyMemberships } from '../data/memberships';
import { surveyDetailsKey, surveyDetailsQuery } from '../data/surveyDetails';
import { surveyNamesQuery } from '../data/surveyNamesQuery';
import { client } from '../stores/appClient';
import SurveyDialogFrame from './SurveyDialogFrame';
import { surveyDialogHref, type SurveyDialogKind } from './surveyDialogRoutes';
import { useSession } from '../session';
import { useActiveUploadProjectId } from '../upload/uploadUi';
import { logAdminAction } from '../utils/adminActionLogger';

const NewSurvey = lazy(() => import('./NewSurveyModal'));
const Upload = lazy(() => import('../FilesUploadComponent'));
const AddSet = lazy(() => import('./AddAnnotationSetModal'));
const Details = lazy(() => import('../AnnotationCountModal'));
const EditSet = lazy(() => import('../EditAnnotationSet'));
const Results = lazy(() => import('../AnnotationSetResults'));
const Launch = lazy(() => import('./LaunchAnnotationSetModal'));
const Generate = lazy(() => import('../GenerateJollyResults'));

export default function SurveyDialogRoute({
  kind,
}: {
  kind: SurveyDialogKind;
}) {
  const { surveyId, annotationSetId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const { user } = useSession();
  const activeUploadProjectId = useActiveUploadProjectId();
  const memberships = useMyMemberships();
  const organizations = useMyOrganizations();
  const organizationAdmin = organizations.data.some((row) => row.isAdmin);
  const canOpen =
    kind === 'newSurvey'
      ? organizationAdmin
      : memberships.data.some(
          (row) => row.projectId === surveyId && row.isAdmin
        );
  const projectQuery = useQuery({
    ...surveyDetailsQuery(surveyId ?? ''),
    enabled: Boolean(canOpen && surveyId),
  });
  const namesQuery = useQuery({
    ...surveyNamesQuery(user.username, (input, options) =>
      client.models.UserProjectMembership.userProjectMembershipsByUserId(input, options)),
    enabled: kind === 'newSurvey' && canOpen,
  });
  const needsAllProjects = kind === 'addAnnotationSet';
  const projectQueries = useQueries({
    queries:
      needsAllProjects && canOpen
        ? memberships.data
            .filter((row) => row.isAdmin)
            .map((row) => surveyDetailsQuery(row.projectId))
        : [],
  });
  const setQuery = useQuery({
    queryKey: ['annotationSet', annotationSetId],
    enabled: Boolean(canOpen && annotationSetId),
    staleTime: 30_000,
    queryFn: async () =>
      (await client.models.AnnotationSet.get({ id: annotationSetId! })).data,
  });
  const project = projectQuery.data;
  const set = setQuery.data;
  const allProjects = projectQueries.flatMap((query) =>
    query.data ? [query.data] : []
  );
  const admitted = useRef<string>();
  const identity = `${kind}:${surveyId}:${annotationSetId}:${kind === 'addFiles' ? search.get('resume') : ''}`;
  const busy =
    project &&
    (['uploading', 'launching', 'updating', 'deleting'].includes(
      project.status ?? ''
    ) ||
      project.status?.includes('processing') ||
      (project.queues?.length ?? 0) > 0 ||
      project.individualIdJobs?.some((job: { status?: string }) =>
        ['active', 'launching'].includes(job.status ?? '')
      ));
  const requiresIdle = [
    'addAnnotationSet',
    'editAnnotationSet',
    'launchAnnotationSet',
  ].includes(kind);
  const isUpload = kind === 'newSurvey' || kind === 'addFiles';
  const staleUpload =
    project?.status === 'uploading' &&
    search.get('resume') === 'stale' &&
    new Date(project.updatedAt ?? '').getTime() < Date.now() - 5 * 60_000;
  const uploadBlocked =
    activeUploadProjectId !== null ||
    (kind === 'addFiles' && busy && !staleUpload);
  if (canOpen && (isUpload ? !uploadBlocked : project && !busy))
    admitted.current = identity;

  useEffect(
    () => () => {
      void cache.invalidateQueries({ queryKey: ['surveys-list'] });
      void cache.invalidateQueries({ queryKey: ['surveys-names'] });
      if (!surveyId) return;
      void cache.invalidateQueries({ queryKey: surveyDetailsKey(surveyId) });
      void cache.invalidateQueries({ queryKey: ['project', surveyId] });
      if (annotationSetId)
        void cache.invalidateQueries({
          queryKey: ['annotationSet', annotationSetId],
        });
      for (const model of [
        'Category',
        'ImageSet',
        'LocationSet',
        'AnnotationSet',
      ]) {
        void cache.invalidateQueries({
          queryKey: [model, { filter: { projectId: { eq: surveyId } } }],
        });
      }
    },
    [cache, surveyId, annotationSetId, kind]
  );

  const close = () =>
    navigate(
      kind === 'generateJollyResults'
        ? surveyDialogHref('annotationSetResults', surveyId, annotationSetId)
        : '/surveys'
    );
  let message: string | undefined;
  if (
    memberships.meta.isPending ||
    (kind === 'newSurvey' && organizations.meta.isPending)
  )
    message = kind === 'newSurvey' ? 'Checking organisation access...' : 'Loading survey access...';
  else if (!canOpen)
    message = 'You do not have permission to open this survey dialog.';
  else if (kind === 'newSurvey' && namesQuery.isError)
    message = 'Unable to load existing survey names. Please close and try again.';
  else if (kind === 'newSurvey' && namesQuery.isPending)
    message = 'Loading existing survey names...';
  else if (
    projectQueries.some((query) => query.isError) ||
    (surveyId && projectQuery.isError) ||
    setQuery.isError
  )
    message = 'Unable to load this survey. Please try again.';
  else if (
    projectQueries.some((query) => query.isPending) ||
    (surveyId && projectQuery.isPending) ||
    (annotationSetId && setQuery.isPending)
  )
    message = 'Loading survey...';
  else if (
    surveyId &&
    (!project || ['deleted', 'hidden'].includes(project.status ?? ''))
  )
    message = 'This survey is no longer available.';
  else if (annotationSetId && (!set || set.projectId !== surveyId))
    message = 'This annotation set is no longer available in this survey.';
  else if (requiresIdle && busy && admitted.current !== identity)
    message =
      'Wait for the active job or upload to finish before making this change.';
  else if (isUpload && uploadBlocked && admitted.current !== identity)
    message =
      'Wait for the active job or upload to finish before preparing another upload.';

  return (
    <SurveyDialogFrame
      kind={kind}
      projectName={project?.name}
      setName={set?.name ?? project?.annotationSets?.find(
        (row: { id: string; name: string }) => row.id === annotationSetId
      )?.name}
      resume={search.get('resume') === 'stale'}
      identity={identity}
      message={message}
      onClose={close}
    >
      {kind === 'newSurvey' && (
        <NewSurvey
          embedded
          show
          onClose={close}
          projects={namesQuery.data ?? []}
        />
      )}
      {project && kind === 'addFiles' && (
        <Upload
          embedded
          show
          handleClose={close}
          project={project}
          fromStaleUpload={search.get('resume') === 'stale'}
        />
      )}
      {project && kind === 'addAnnotationSet' && (
        <AddSet
          embedded
          show
          onClose={close}
          project={project}
          allProjects={allProjects}
          addAnnotationSet={(created) => {
            void cache.invalidateQueries({
              queryKey: surveyDetailsKey(project.id),
            });
            void logAdminAction(
              client,
              user.userId,
              `Added annotation set "${created.name}" to project "${project.name}"`,
              project.id,
              project.organizationId
            );
          }}
        />
      )}
      {set && kind === 'annotationCount' && (
        <Details embedded show setId={set.id} handleClose={close} />
      )}
      {set && project && kind === 'editAnnotationSet' && (
        <EditSet
          embedded
          show
          annotationSet={set}
          project={project}
          handleClose={close}
        />
      )}
      {set && project && kind === 'annotationSetResults' && (
        <Results
          embedded
          show
          annotationSet={set}
          surveyId={project.id}
          onClose={close}
          onGenerateResults={() =>
            navigate(
              surveyDialogHref('generateJollyResults', project.id, set.id)
            )
          }
        />
      )}
      {set && project && kind === 'launchAnnotationSet' && (
        <Launch
          embedded
          show
          annotationSet={set}
          project={project}
          onClose={close}
          onOptimisticStatus={(id, status) => {
            cache.setQueryData(
              surveyDetailsKey(id),
              (previous: typeof project) =>
                previous ? { ...previous, status } : previous
            );
          }}
        />
      )}
      {set && project && kind === 'generateJollyResults' && (
        <Generate
          embedded
          surveyId={project.id}
          annotationSetId={set.id}
          onClose={close}
        />
      )}
    </SurveyDialogFrame>
  );
}
