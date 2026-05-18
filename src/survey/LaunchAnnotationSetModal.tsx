import { Button, Form } from 'react-bootstrap';
import { Modal, Body, Header, Footer, Title } from '../Modal';
import { useState, useContext, useEffect } from 'react';
import { Tabs, Tab } from '../Tabs';
import { Schema } from '../amplify/client-schema';
import { GlobalContext, UserContext } from '../Context';
import SpeciesLabelling from './SpeciesLabelling';
import FalseNegatives from './FalseNegatives';
import QCReview from './QCReview';
import HomographyLaunch from './HomographyLaunch';
import IndividualId from './IndividualId';

type TaskType = 'species-labelling' | 'registration' | 'false-negatives' | 'homographies' | 'qc-review' | 'individual-id';

type LaunchHandlerType = {
  execute: (
    onProgress: (msg: string) => void,
    onLaunchConfirmed: () => void
  ) => Promise<void>;
} | null;

export default function LaunchAnnotationSetModal({
  show,
  project,
  annotationSet,
  onOptimisticStatus,
}: {
  show: boolean;
  project: Schema['Project']['type'];
  annotationSet: Schema['AnnotationSet']['type'];
  onOptimisticStatus?: (
    projectId: string,
    status: Schema['Project']['type']['status']
  ) => void;
}) {
  const [taskType, setTaskType] = useState<TaskType>('species-labelling');
  const [launching, setLaunching] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [launchDisabled, setLaunchDisabled] = useState<boolean>(false);
  const [speciesLaunchHandler, setSpeciesLaunchHandler] = useState<LaunchHandlerType>(null);
  const [falseNegativesLaunchHandler, setFalseNegativesLaunchHandler] = useState<LaunchHandlerType>(null);
  const [qcLaunchHandler, setQCLaunchHandler] = useState<LaunchHandlerType>(null);
  const [homographyLaunchHandler, setHomographyLaunchHandler] = useState<LaunchHandlerType>(null);
  const [individualIdLaunchHandler, setIndividualIdLaunchHandler] = useState<LaunchHandlerType>(null);

  // set up queue creation helper
  const { client, showModal } = useContext(GlobalContext)! as any;
  const { cognitoGroups } = useContext(UserContext)!;
  const isSysadmin = cognitoGroups.includes('sysadmin');

  // Task type for each tab, in render order. The Individual ID tab is only
  // shown to sysadmins, so its presence shifts subsequent tab indices.
  const tabTaskTypes: TaskType[] = [
    'species-labelling',
    'false-negatives',
    'qc-review',
    'homographies',
    ...(isSysadmin ? (['individual-id'] as TaskType[]) : []),
    'registration',
  ];

  useEffect(() => {
    if (taskType === 'registration') {
      setLaunchDisabled(false);
    }
    // Other tabs manage their own disabled state via setLaunchDisabled
  }, [taskType]);

  function onClose() {
    setTaskType('species-labelling');
    setProgressMessage('');
    showModal(null);
  }

  async function createRegistrationTask() {
    // Display registration job
    // Cast to any to avoid overly complex union from generated types
    await (client.models.AnnotationSet.update as any)({
      id: annotationSet.id,
      register: true,
    });
    await client.mutations.updateProjectMemberships({
      projectId: project.id,
    });
  }

  async function handleSubmit() {
    const originalStatus = project.status ?? 'active';
    setLaunching(true);

    // Set optimistic status immediately so the project is blocked for the
    // user even before the modal closes, preventing rapid re-launches.
    if (taskType !== 'registration') {
      onOptimisticStatus?.(project.id, 'launching');
    }

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
            await falseNegativesLaunchHandler.execute(setProgressMessage, () => {});
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
        case 'individual-id':
          if (individualIdLaunchHandler) {
            setProgressMessage('Initializing launch...');
            await individualIdLaunchHandler.execute(setProgressMessage, () => {});
          }
          break;
        case 'registration':
          await createRegistrationTask();
          break;
      }
    } catch (error) {
      console.error('Launch error', error);
      onOptimisticStatus?.(project.id, originalStatus);
      throw error;
    } finally {
      setLaunching(false);
      onClose();
    }
  }

  return (
    <Modal show={show} strict={true} size='lg' disabled={launching}>
      <Header>
        <Title>Launch for Manual Annotation</Title>
      </Header>
      <Body>
        <Form>
          <Tabs
            onTabChange={(tab) => {
              if (launching) return;
              const next = tabTaskTypes[tab];
              if (next) setTaskType(next);
            }}
            disableSwitching={launching}
          >
            <Tab label='Species Labelling'>
              <SpeciesLabelling
                project={project}
                annotationSet={annotationSet}
                launching={launching}
                setLaunchDisabled={setLaunchDisabled}
                setSpeciesLaunchHandler={setSpeciesLaunchHandler as any}
              />
            </Tab>
            <Tab label='False Negatives'>
              <FalseNegatives
                project={project}
                annotationSet={annotationSet}
                launching={launching}
                setLaunchDisabled={setLaunchDisabled}
                setFalseNegativesLaunchHandler={setFalseNegativesLaunchHandler as any}
              />
            </Tab>
            <Tab label='Review'>
              <QCReview
                project={project}
                annotationSet={annotationSet}
                launching={launching}
                setLaunchDisabled={setLaunchDisabled}
                setQCLaunchHandler={setQCLaunchHandler as any}
              />
            </Tab>
            <Tab label='Homographies'>
              <HomographyLaunch
                project={project}
                annotationSet={annotationSet}
                launching={launching}
                setLaunchDisabled={setLaunchDisabled}
                setHomographyLaunchHandler={setHomographyLaunchHandler as any}
              />
            </Tab>
            {isSysadmin && (
              <Tab label='Individual ID'>
                <IndividualId
                  project={project}
                  annotationSet={annotationSet}
                  launching={launching}
                  setLaunchDisabled={setLaunchDisabled}
                  setIndividualIdLaunchHandler={
                    setIndividualIdLaunchHandler as any
                  }
                />
              </Tab>
            )}
            <Tab label='Registration'>
              <div className='p-3'>
                <p className='m-0'>
                  This will launch a registration task for the annotation set.
                </p>
              </div>
            </Tab>
          </Tabs>
        </Form>
        {progressMessage && (
          <div className='mt-3 text-center text-muted d-flex justify-content-center align-items-center gap-2'>
            <span role='status' aria-live='polite'>
              <span className='spinner-border spinner-border-sm me-2' />
              {progressMessage}
            </span>
          </div>
        )}
        <Footer>
          <Button
            variant='primary'
            disabled={
              launchDisabled ||
              launching ||
              (taskType === 'species-labelling' && !speciesLaunchHandler) ||
              (taskType === 'false-negatives' && !falseNegativesLaunchHandler) ||
              (taskType === 'qc-review' && !qcLaunchHandler) ||
              (taskType === 'homographies' && !homographyLaunchHandler) ||
              (taskType === 'individual-id' && !individualIdLaunchHandler)
            }
            onClick={handleSubmit}
          >
            Launch
          </Button>
          <Button variant='dark' disabled={launching} onClick={onClose}>
            Close
          </Button>
        </Footer>
      </Body>
    </Modal>
  );
}
