import { Button, Form } from 'react-bootstrap';
import { Modal, Body, Header, Footer, Title } from '../Modal';
import { useState, useContext, useEffect } from 'react';
import { Tabs, Tab } from '../Tabs';
import { Schema } from '../amplify/client-schema';
import { GlobalContext } from '../Context';
import SpeciesLabelling from './SpeciesLabelling';
import FalseNegatives from './FalseNegatives';

type TaskType = 'species-labelling' | 'registration' | 'false-negatives';

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
  const [speciesLaunchHandler, setSpeciesLaunchHandler] = useState<
    ((onProgress: (msg: string) => void) => Promise<void>) | null
  >(null);
  const [falseNegativesLaunchHandler, setFalseNegativesLaunchHandler] =
    useState<((onProgress: (msg: string) => void) => Promise<void>) | null>(
      null
    );

  // set up queue creation helper
  const { client, showModal } = useContext(GlobalContext)! as any;

  useEffect(() => {
    if (taskType === 'registration') {
      setLaunchDisabled(false);
    }
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
    let optimisticStatusApplied = false;
    if (
      taskType === 'species-labelling' &&
      typeof speciesLaunchHandler !== 'function'
    )
      return;
    if (
      taskType === 'false-negatives' &&
      typeof falseNegativesLaunchHandler !== 'function'
    )
      return;
    setLaunching(true);

    let dispatched: Promise<void> | null = null;

    try {
      switch (taskType) {
        case 'species-labelling':
          if (typeof speciesLaunchHandler === 'function') {
            setProgressMessage('Initializing launch...');
            onOptimisticStatus?.(project.id, 'launching');
            optimisticStatusApplied = true;
            dispatched = speciesLaunchHandler(
              setProgressMessage
            ) as Promise<void>;
          }
          break;
        case 'false-negatives':
          if (typeof falseNegativesLaunchHandler === 'function') {
            setProgressMessage('Initializing launch...');
            onOptimisticStatus?.(project.id, 'launching');
            optimisticStatusApplied = true;
            dispatched = falseNegativesLaunchHandler(
              setProgressMessage
            ) as Promise<void>;
          }
          break;
        case 'registration':
          await createRegistrationTask();
          break;
      }

      if (dispatched) {
        await dispatched;
      }
    } catch (error) {
      console.error('Launch error', error);
      if (optimisticStatusApplied) {
        onOptimisticStatus?.(project.id, originalStatus);
      }
      throw error;
    } finally {
      setLaunching(false);
      onClose();
      setTaskType('species-labelling');
      setProgressMessage('');
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
              switch (tab) {
                case 0:
                  setTaskType('species-labelling');
                  break;
                case 1:
                  setTaskType('false-negatives');
                  break;
                case 2:
                  setTaskType('registration');
                  break;
              }
            }}
            disableSwitching={launching}
          >
            <Tab label='Species Labelling'>
              <SpeciesLabelling
                project={project}
                annotationSet={annotationSet}
                launching={launching}
                setLaunchDisabled={setLaunchDisabled}
                setSpeciesLaunchHandler={setSpeciesLaunchHandler}
              />
            </Tab>
            <Tab label='False Negatives'>
              <FalseNegatives
                project={project}
                annotationSet={annotationSet}
                launching={launching}
                setLaunchDisabled={setLaunchDisabled}
                setFalseNegativesLaunchHandler={setFalseNegativesLaunchHandler}
              />
            </Tab>
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
              (taskType === 'species-labelling' &&
                typeof speciesLaunchHandler !== 'function') ||
              (taskType === 'false-negatives' &&
                typeof falseNegativesLaunchHandler !== 'function')
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
