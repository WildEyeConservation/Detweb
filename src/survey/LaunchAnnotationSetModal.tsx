import { Button, Form } from 'react-bootstrap';
import { Modal, Body, Header, Footer, Title } from '../Modal';
import { useState, useContext, useMemo, useEffect } from 'react';
import { Tabs, Tab } from '../Tabs';
import { Schema } from '../amplify/client-schema';
import { GlobalContext } from '../Context';
import SpeciesLabelling from './SpeciesLabelling';
import FalseNegatives from './FalseNegatives';
import Select from 'react-select';

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
  const [selectedRegistrationCategories, setSelectedRegistrationCategories] =
    useState<{ label: string; value: string }[]>([]);
  const [enableTransectConcurrency, setEnableTransectConcurrency] =
    useState<boolean>(false);
  const [transects, setTransects] = useState<Schema['Transect']['type'][]>([]);

  // set up queue creation helper
  const { client, showModal } = useContext(GlobalContext)! as any;

  const categoryOptions = useMemo(() => {
    return (
      annotationSet.categories?.map((category: any) => ({
        label: category.name,
        value: category.id,
      })) ?? []
    );
  }, [annotationSet.categories]);

  useEffect(() => {
    let cancelled = false;
    async function loadTransects() {
      const collected: Schema['Transect']['type'][] = [];
      let nextToken: string | null | undefined = undefined;
      do {
        const { data, nextToken: nt } =
          await client.models.Transect.transectsByProjectId({
            projectId: project.id,
            nextToken,
            limit: 200,
          });
        collected.push(...(data as Schema['Transect']['type'][]));
        nextToken = nt;
      } while (nextToken);
      if (!cancelled) {
        setTransects(collected);
      }
    }
    loadTransects();
    return () => {
      cancelled = true;
    };
  }, [client.models.Transect, project.id]);

  const transectCount = transects.length;

  useEffect(() => {
    // Reset registration state when tab changes away
    if (taskType !== 'registration') {
      setSelectedRegistrationCategories([]);
      setEnableTransectConcurrency(false);
    } else {
      setLaunchDisabled(false);
    }
  }, [taskType]);

  function onClose() {
    setTaskType('species-labelling');
    setProgressMessage('');
    showModal(null);
  }

  async function createRegistrationTask() {
    if (selectedRegistrationCategories.length === 0) return;
    const categoryIds = selectedRegistrationCategories.map((c) => c.value);
    const categoryNames = selectedRegistrationCategories.map((c) => c.label);

    const { data: existingJob } = await client.models.RegistrationJob.get({
      annotationSetId: annotationSet.id,
    });

    const mode =
      enableTransectConcurrency && transectCount > 1 ? 'per-transect' : 'single';

    if (existingJob) {
      await client.models.RegistrationJob.update({
        annotationSetId: annotationSet.id,
        categoryIds,
        categoryNames,
        mode,
        status: 'active',
        assignedUserId: undefined,
      });
    } else {
      await client.models.RegistrationJob.create({
        annotationSetId: annotationSet.id,
        projectId: project.id,
        categoryIds,
        categoryNames,
        mode,
        status: 'active',
      });
    }

    if (mode === 'per-transect' && transectCount > 1) {
      const existingAssignments = await client.models.RegistrationAssignment.registrationAssignmentsByJobId(
        {
          registrationJobId: annotationSet.id,
          limit: 500,
        }
      );
      const existingTransectIds = new Set(
        existingAssignments.data.map(
          (assignment: Schema['RegistrationAssignment']['type']) =>
            assignment.transectId
        )
      );

      for (const transect of transects) {
        if (!existingTransectIds.has(transect.id)) {
          await client.models.RegistrationAssignment.create({
            registrationJobId: annotationSet.id,
            projectId: project.id,
            annotationSetId: annotationSet.id,
            transectId: transect.id,
            status: 'available',
          });
        }
      }
    } else {
      // ensure no stale assignments if we switch back to single mode
      const existingAssignments = await client.models.RegistrationAssignment.registrationAssignmentsByJobId(
        {
          registrationJobId: annotationSet.id,
          limit: 500,
        }
      );
      if (existingAssignments.data.length) {
        await Promise.all(
          existingAssignments.data.map(
            (assignment: Schema['RegistrationAssignment']['type']) =>
              client.models.RegistrationAssignment.delete({
                registrationJobId: assignment.registrationJobId,
                transectId: assignment.transectId,
              })
          )
        );
      }
    }

    // clear legacy register flag
    await client.models.AnnotationSet.update({
      id: annotationSet.id,
      register: false,
    });
  }

  async function handleSubmit() {
    if (taskType === 'registration') {
      if (selectedRegistrationCategories.length === 0) return;
    }
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
              <div className='p-3 d-flex flex-column gap-3'>
                <div>
                  <Form.Label className='mb-1'>Species to register</Form.Label>
                  <Select
                    isMulti
                    isDisabled={launching}
                    value={selectedRegistrationCategories}
                    onChange={(value) =>
                      setSelectedRegistrationCategories(value as any)
                    }
                    options={categoryOptions}
                    className='text-black'
                    placeholder='Select one or more species'
                  />
                  <small className='text-muted'>
                    Selected species will be pre-loaded in the registration workflow.
                  </small>
                </div>
                {transectCount > 1 && (
                  <Form.Check
                    type='switch'
                    id='registration-concurrency'
                    label={`Enable concurrency by transect (${transectCount} transects detected)`}
                    checked={enableTransectConcurrency}
                    onChange={(event) =>
                      setEnableTransectConcurrency(event.target.checked)
                    }
                    disabled={launching}
                  />
                )}
                {transectCount <= 1 && (
                  <div className='alert alert-info mb-0'>
                    Transect data not available — registration will be single-worker.
                  </div>
                )}
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
                typeof falseNegativesLaunchHandler !== 'function') ||
              (taskType === 'registration' &&
                selectedRegistrationCategories.length === 0)
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
