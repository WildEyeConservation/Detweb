import { useEffect, useRef } from 'react';
import { Button } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMyMemberships } from '../data/memberships';
import { surveyDetailsQuery } from '../data/surveyDetails';
import { Modal, Header, Title, Body, Footer } from '../Modal';
import EditSurveyModal from './editSurveyModal';
import { surveyEditorHref, surveyEditorTabIndex } from './surveyEditorTabs';

export default function SurveyEditorRoute() {
  const { surveyId, tab } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const memberships = useMyMemberships();
  const canEdit = memberships.data.some((row) => row.projectId === surveyId && row.isAdmin);
  const project = useQuery({
    ...surveyDetailsQuery(surveyId ?? ''),
    enabled: Boolean(canEdit && surveyId),
  });
  const admittedProject = useRef<string>();
  const status = project.data?.status;
  const busy = status === 'uploading' || status?.includes('processing') ||
    status === 'launching' || status === 'updating' || status === 'deleting' ||
    (project.data?.queues?.length ?? 0) > 0 ||
    project.data?.individualIdJobs?.some((job: { status?: string | null }) =>
      job.status === 'active' || job.status === 'launching');
  // Match the table's entry guard without unmounting an editor that starts a job.
  if (canEdit && project.data && !busy) admittedProject.current = surveyId;
  const tabIndex = surveyEditorTabIndex(tab);

  useEffect(() => () => {
    // Editors also mutate through direct client calls. Refresh the table and
    // reference lists on return, including observers using the same cached data.
    void queryClient.invalidateQueries({ queryKey: ['surveys-project-details', surveyId] });
    void queryClient.invalidateQueries({ queryKey: ['project', surveyId] });
    for (const model of ['Category', 'ImageSet', 'LocationSet', 'AnnotationSet']) {
      void queryClient.invalidateQueries({ queryKey: [model, { filter: { projectId: { eq: surveyId } } }] });
    }
  }, [queryClient, surveyId]);

  // A direct link has no guaranteed in-app history entry to go back to.
  // The effect above also refreshes data when leaving via browser Back.
  const onClose = () => navigate('/surveys');

  const message = memberships.meta.isError || project.isError
    ? 'Unable to load this survey. Please try again.'
    : memberships.meta.isPending
      ? 'Loading survey access...'
      : !canEdit
        ? 'You do not have permission to edit this survey.'
        : busy && admittedProject.current !== surveyId
          ? 'This survey has an active job or upload. Wait for it to finish before editing.'
        : tabIndex < 0
          ? 'This survey editor tab does not exist.'
          : project.isPending
            ? 'Loading survey...'
            : !project.data
              ? 'This survey is no longer available.'
              : null;

  if (message || !project.data) {
    return (
      <Modal show onHide={onClose}>
        <Header><Title>Edit Survey</Title></Header>
        <Body><p className='p-3 mb-0' role='status'>{message}</p></Body>
        <Footer><Button variant='dark' onClick={onClose}>Close</Button></Footer>
      </Modal>
    );
  }

  return (
    <EditSurveyModal
      key={surveyId}
      show
      project={project.data}
      onClose={onClose}
      openTab={tabIndex}
      onTabChange={(index) => navigate(surveyEditorHref(surveyId!, index))}
    />
  );
}
