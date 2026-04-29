import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Spinner } from 'react-bootstrap';
import { Schema } from '../amplify/client-schema';
import { GlobalContext } from '../Context';
import {
  Page,
  PageHeader,
  TabBar,
  ContentArea,
  Crumb,
  CrumbSep,
} from '../ss/PageShell';
import SpeciesLabelling from './SpeciesLabelling';
import FalseNegatives from './FalseNegatives';
import QCReview from './QCReview';
import HomographyLaunch from './HomographyLaunch';

type TaskType =
  | 'species-labelling'
  | 'false-negatives'
  | 'qc-review'
  | 'homographies'
  | 'registration';

type LaunchHandlerType = {
  execute: (
    onProgress: (msg: string) => void,
    onLaunchConfirmed: () => void
  ) => Promise<void>;
} | null;

const TABS = [
  { id: 'species-labelling', label: 'Species Labelling' },
  { id: 'false-negatives', label: 'False Negatives' },
  { id: 'qc-review', label: 'Review' },
  { id: 'homographies', label: 'Homographies' },
  { id: 'registration', label: 'Registration' },
];

const PROJECT_SELECTION_SET = [
  'id',
  'name',
  'status',
  'organizationId',
  'organization.id',
  'organization.name',
  'tiledLocationSetId',
  'queues.id',
  'annotationSets.id',
  'annotationSets.register',
] as const;

export default function LaunchAnnotationSet() {
  const { surveyId, annotationSetId } = useParams<{
    surveyId: string;
    annotationSetId: string;
  }>();
  const { client } = useContext(GlobalContext)!;
  const navigate = useNavigate();

  const [project, setProject] = useState<Schema['Project']['type'] | null>(
    null
  );
  const [annotationSet, setAnnotationSet] = useState<
    Schema['AnnotationSet']['type'] | null
  >(null);

  const [taskType, setTaskType] = useState<TaskType>('species-labelling');
  const [launching, setLaunching] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [launchDisabled, setLaunchDisabled] = useState<boolean>(false);
  const [speciesLaunchHandler, setSpeciesLaunchHandler] =
    useState<LaunchHandlerType>(null);
  const [falseNegativesLaunchHandler, setFalseNegativesLaunchHandler] =
    useState<LaunchHandlerType>(null);
  const [qcLaunchHandler, setQCLaunchHandler] =
    useState<LaunchHandlerType>(null);
  const [homographyLaunchHandler, setHomographyLaunchHandler] =
    useState<LaunchHandlerType>(null);

  useEffect(() => {
    if (!surveyId || !annotationSetId) return;
    let cancelled = false;
    (async () => {
      const [projRes, setRes] = await Promise.all([
        client.models.Project.get(
          { id: surveyId },
          { selectionSet: PROJECT_SELECTION_SET as unknown as string[] }
        ),
        client.models.AnnotationSet.get({ id: annotationSetId }),
      ]);
      if (cancelled) return;
      setProject(projRes.data as Schema['Project']['type'] | null);
      setAnnotationSet(setRes.data as Schema['AnnotationSet']['type'] | null);
    })();
    return () => {
      cancelled = true;
    };
  }, [surveyId, annotationSetId, client]);

  useEffect(() => {
    if (taskType === 'registration') setLaunchDisabled(false);
  }, [taskType]);

  async function createRegistrationTask() {
    if (!project || !annotationSet) return;
    await (client.models.AnnotationSet.update as any)({
      id: annotationSet.id,
      register: true,
    });
    await client.mutations.updateProjectMemberships({ projectId: project.id });
  }

  async function handleLaunch() {
    if (!project) return;
    setLaunching(true);
    try {
      switch (taskType) {
        case 'species-labelling':
          if (speciesLaunchHandler) {
            setProgressMessage('Initializing launch...');
            await speciesLaunchHandler.execute(setProgressMessage, () => {});
          }
          break;
        case 'false-negatives':
          if (falseNegativesLaunchHandler) {
            setProgressMessage('Initializing launch...');
            await falseNegativesLaunchHandler.execute(
              setProgressMessage,
              () => {}
            );
          }
          break;
        case 'qc-review':
          if (qcLaunchHandler) {
            setProgressMessage('Initializing launch...');
            await qcLaunchHandler.execute(setProgressMessage, () => {});
          }
          break;
        case 'homographies':
          if (homographyLaunchHandler) {
            setProgressMessage('Initializing launch...');
            await homographyLaunchHandler.execute(setProgressMessage, () => {});
          }
          break;
        case 'registration':
          await createRegistrationTask();
          break;
      }
      navigate(`/surveys/${surveyId}/detail?launching=1`);
    } catch (error) {
      console.error('Launch error', error);
      setProgressMessage('');
      setLaunching(false);
    }
  }

  const breadcrumb = (
    <>
      <Crumb onClick={() => navigate('/surveys')}>Surveys</Crumb>
      <CrumbSep />
      <Crumb onClick={() => navigate(`/surveys/${surveyId}/detail`)}>
        {project?.name || surveyId}
      </Crumb>
      <CrumbSep />
      <span>{annotationSet?.name || annotationSetId}</span>
      <CrumbSep />
      <span>Launch</span>
    </>
  );

  if (!project || !annotationSet) {
    return (
      <Page>
        <PageHeader
          title='Launch for Manual Annotation'
          breadcrumb={breadcrumb}
        />
        <ContentArea>
          <div style={{ color: 'var(--ss-text-dim)' }}>Loading…</div>
        </ContentArea>
      </Page>
    );
  }

  // "Active" requires status === 'active' AND no active jobs. The Surveys
  // page shows "Launched" as a derived status when queues/register are
  // present — that counts as not-active here.
  const projectHasActiveJob =
    ((project.queues as { id: string }[] | undefined)?.length ?? 0) > 0 ||
    (
      (project.annotationSets as { register?: boolean | null }[] | undefined) ??
      []
    ).some((s) => s.register === true);
  const projectRawStatus = (project.status || '').toLowerCase();
  const projectIsActive =
    projectRawStatus === 'active' && !projectHasActiveJob;
  if (!projectIsActive) {
    const statusLabel =
      projectHasActiveJob && projectRawStatus === 'active'
        ? 'launched'
        : projectRawStatus || 'inactive';
    return (
      <Page>
        <PageHeader
          title='Launch for Manual Annotation'
          breadcrumb={breadcrumb}
        />
        <ContentArea style={{ paddingTop: 16 }}>
          <Card>
            <Card.Body>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                Survey is {statusLabel}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--ss-text-muted)',
                  marginBottom: 16,
                }}
              >
                Annotation sets can only be launched while the survey is
                active.
              </div>
              <Button
                variant='primary'
                onClick={() => navigate(`/surveys/${surveyId}/detail`)}
              >
                Back to Survey
              </Button>
            </Card.Body>
          </Card>
        </ContentArea>
      </Page>
    );
  }

  const launchButtonDisabled =
    launchDisabled ||
    launching ||
    (taskType === 'species-labelling' && !speciesLaunchHandler) ||
    (taskType === 'false-negatives' && !falseNegativesLaunchHandler) ||
    (taskType === 'qc-review' && !qcLaunchHandler) ||
    (taskType === 'homographies' && !homographyLaunchHandler);

  const renderTabContent = () => {
    switch (taskType) {
      case 'species-labelling':
        return (
          <SpeciesLabelling
            project={project}
            annotationSet={annotationSet}
            launching={launching}
            setLaunchDisabled={setLaunchDisabled}
            setSpeciesLaunchHandler={setSpeciesLaunchHandler as any}
          />
        );
      case 'false-negatives':
        return (
          <FalseNegatives
            project={project}
            annotationSet={annotationSet}
            launching={launching}
            setLaunchDisabled={setLaunchDisabled}
            setFalseNegativesLaunchHandler={
              setFalseNegativesLaunchHandler as any
            }
          />
        );
      case 'qc-review':
        return (
          <QCReview
            project={project}
            annotationSet={annotationSet}
            launching={launching}
            setLaunchDisabled={setLaunchDisabled}
            setQCLaunchHandler={setQCLaunchHandler as any}
          />
        );
      case 'homographies':
        return (
          <HomographyLaunch
            project={project}
            annotationSet={annotationSet}
            launching={launching}
            setLaunchDisabled={setLaunchDisabled}
            setHomographyLaunchHandler={setHomographyLaunchHandler as any}
          />
        );
      case 'registration':
        return (
          <p className='m-0'>
            This will launch a registration task for the annotation set.
          </p>
        );
    }
  };

  return (
    <Page>
      <PageHeader
        title='Launch for Manual Annotation'
        breadcrumb={breadcrumb}
      />
      <TabBar
        tabs={TABS}
        active={taskType}
        onChange={(id) => {
          if (launching) return;
          setTaskType(id as TaskType);
        }}
      />
      <ContentArea style={{ paddingTop: 16 }}>
        <div className='d-flex flex-column gap-3'>
          {taskType === 'species-labelling' ||
          taskType === 'false-negatives' ||
          taskType === 'qc-review' ||
          taskType === 'homographies' ? (
            renderTabContent()
          ) : (
            <Card>
              <Card.Body>{renderTabContent()}</Card.Body>
            </Card>
          )}

          {progressMessage && (
            <div className='text-center text-muted d-flex justify-content-center align-items-center gap-2'>
              <Spinner size='sm' />
              <span role='status' aria-live='polite'>
                {progressMessage}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant='primary'
              disabled={launchButtonDisabled}
              onClick={handleLaunch}
            >
              Launch
            </Button>
          </div>
        </div>
      </ContentArea>
    </Page>
  );
}
