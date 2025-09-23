import { Button, Form } from 'react-bootstrap';
import { Modal, Body, Header, Footer, Title } from '../Modal';
import { useState, useContext } from 'react';
import { Tabs, Tab } from '../Tabs';
import { Schema } from '../../amplify/client-schema';
import { GlobalContext } from '../Context';
import SpeciesLabelling from './SpeciesLabelling';
import FalseNegatives from './FalseNegatives';

type TaskType = 'species-labelling' | 'registration' | 'false-negatives';

export default function LaunchAnnotationSetModal({
  show,
  project,
  annotationSet,
}: {
  show: boolean;
  project: Schema['Project']['type'];
  annotationSet: Schema['AnnotationSet']['type'];
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
  }

  async function handleSubmit() {
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

    await client.models.Project.update({
      id: project.id,
      status: 'launching',
    });

    await client.mutations.updateProjectMemberships({
      projectId: project.id,
    });

    switch (taskType) {
      case 'species-labelling':
        if (typeof speciesLaunchHandler === 'function') {
          setProgressMessage('Initializing launch...');
          await speciesLaunchHandler(setProgressMessage);
        }
        break;
      case 'false-negatives':
        if (typeof falseNegativesLaunchHandler === 'function') {
          setProgressMessage('Initializing launch...');
          await falseNegativesLaunchHandler(setProgressMessage);
        }
        break;
      case 'registration':
        await createRegistrationTask();
        break;
    }

    await client.models.Project.update({
      id: project.id,
      status: 'active',
    });

    await client.mutations.updateProjectMemberships({
      projectId: project.id,
    });

    setLaunching(false);
    onClose();
    setTaskType('species-labelling');
    setProgressMessage('');
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
          <p className='mt-3 text-center text-muted'>{progressMessage}</p>
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
