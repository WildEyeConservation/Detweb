import { Button, Form } from 'react-bootstrap';
import { Modal, Body, Header, Footer, Title } from '../Modal';
import { useState, useContext, useEffect } from 'react';
import ImageSetDropdown from './ImageSetDropdown';
import { Tabs, Tab } from '../Tabs';
import CreateTask from '../CreateTask';
import { Schema } from '../../amplify/data/resource';
import { makeSafeQueueName } from '../utils';
import { CreateQueueCommand } from '@aws-sdk/client-sqs';
import { GlobalContext, UserContext } from '../Context';
import LaunchRegistration from '../LaunchRegistration';
import { useLaunchTask } from '../useLaunchTask';
import Select from 'react-select';
import LabeledToggleSwitch from '../LabeledToggleSwitch';

type TaskType = 'species-labelling' | 'registration';

export default function LaunchAnnotationSetModal({
  show,
  project,
  imageSets,
  annotationSet,
}: {
  show: boolean;
  project: Schema['Project']['type'];
  imageSets: { id: string; name: string }[];
  annotationSet: Schema['AnnotationSet']['type'];
}) {
  const [selectedImageSets, setSelectedImageSets] = useState<string[]>([]);
  const [batchSize, setBatchSize] = useState<number>(200);
  const [showAdvancedOptions, setShowAdvancedOptions] =
    useState<boolean>(false);
  const [skipLocationsWithAnnotations, setSkipLocationsWithAnnotations] =
    useState<boolean>(true);
  const [
    allowAnnotationsOutsideLocationBoundaries,
    setAllowAnnotationsOutsideLocationBoundaries,
  ] = useState<boolean>(true);
  const [viewUnobservedLocationsOnly, setViewUnobservedLocationsOnly] =
    useState<boolean>(true);
  const [manuallyDefineTileDimensions, setManuallyDefineTileDimensions] =
    useState<boolean>(false);
  const [taskTag, setTaskTag] = useState<string>(annotationSet.name);
  const [zoom, setZoom] = useState<number | undefined>(undefined);
  const [lowerLimit, setLowerLimit] = useState<number>(0.6);
  const [upperLimit, setUpperLimit] = useState<number>(1);
  const [hidden, setHidden] = useState<boolean>(false);
  const [handleCreateTask, setHandleCreateTask] =
    useState<
      (args: {
        setLocationsCompleted: (steps: number) => void;
        setTotalLocations: (steps: number) => void;
      }) => Promise<string>
    >(null);
  const [hasStandardOptions, setHasStandardOptions] = useState<boolean>(true);
  const [hasAdvancedOptions, setHasAdvancedOptions] = useState<boolean>(true);
  const [handleLaunchRegistration, setHandleLaunchRegistration] = useState<
    ((url: string) => Promise<void>) | null
  >(null);
  const [taskType, setTaskType] = useState<TaskType>('species-labelling');
  const [model, setModel] = useState<{ label: string; value: string }>();
  const [modelOptions, setModelOptions] = useState<
    {
      label: string;
      value: string;
    }[]
  >([]);
  const [locationSets, setLocationSets] = useState<
    Schema['LocationSet']['type'][]
  >([]);
  const [sendDetectionsToSecondaryQueue, setSendDetectionsToSecondaryQueue] =
    useState<boolean>(false);
  const [loadingLocationSets, setLoadingLocationSets] =
    useState<boolean>(false);
  const [launching, setLaunching] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [modelGuided, setModelGuided] = useState<boolean>(true);
  const [launchDisabled, setLaunchDisabled] = useState<boolean>(false);

  // set up queue creation helper
  const { client, showModal } = useContext(GlobalContext)!;
  const { getSqsClient } = useContext(UserContext)!;
  const createQueue = async (
    name: string,
    hidden: boolean,
    fifo: boolean,
    taskTag: string
  ): Promise<{ id: string; url: string; batchSize: number } | null> => {
    const safeName =
      makeSafeQueueName(name + crypto.randomUUID()) + (fifo ? '.fifo' : '');

    return getSqsClient()
      .then((sqsClient) =>
        sqsClient.send(
          new CreateQueueCommand({
            QueueName: safeName,
            Attributes: {
              MessageRetentionPeriod: '1209600',
              FifoQueue: fifo ? 'true' : undefined,
            },
          })
        )
      )
      .then(async ({ QueueUrl: url }) => {
        if (url) {
          const { data: queue } = await client.models.Queue.create({
            url,
            name: name,
            projectId: project.id,
            batchSize: batchSize,
            hidden: hidden,
            zoom: zoom,
            tag: taskTag,
            approximateSize: 1, // spoof so that the queue is not deleted while populating
          });

          if (queue) {
            return { id: queue.id, url: url, batchSize: batchSize };
          }
        }
        return null;
      });
  };

  const launchTask = useLaunchTask({
    allowOutside: allowAnnotationsOutsideLocationBoundaries,
    filterObserved: viewUnobservedLocationsOnly,
    lowerLimit: lowerLimit,
    upperLimit: upperLimit,
    skipLocationWithAnnotations: skipLocationsWithAnnotations,
    taskTag: taskTag,
    annotationSetId: annotationSet.id,
    createQueue,
  });

  function onClose() {
    setTaskType('species-labelling');
    setProgressMessage('');
    showModal(null);
  }

  async function createTiledTask() {
    if (handleCreateTask) {
      const locationSetId = await handleCreateTask({
        setLocationsCompleted: () => {},
        setTotalLocations: () => {},
      });
      setProgressMessage('Initializing launch...');
      await launchTask({
        selectedTasks: [locationSetId],
        onProgress: setProgressMessage,
        queueOptions: {
          name: 'Tiled Annotation',
          hidden: hidden,
          fifo: false,
        },
        secondaryQueueOptions: sendDetectionsToSecondaryQueue
          ? {
              name: 'Tiled Annotation Secondary',
              hidden: true,
              fifo: false,
            }
          : undefined,
      });
    }
  }

  async function createModelTask() {
    if (modelOptions.length === 0) {
      alert(
        'You must first process your images before launching a model guided task.'
      );
      return;
    }

    const modelGuidedLocationSets = locationSets.filter((ls) =>
      ls.name.toLowerCase().includes(model?.value)
    );

    if (modelGuidedLocationSets.length === 0) {
      alert('No model guided location set found');
      return;
    }

    setProgressMessage('Initializing launch...');
    await launchTask({
      selectedTasks: modelGuidedLocationSets.map((ls) => ls.id),
      onProgress: setProgressMessage,
      queueOptions: {
        name: 'Model Guided',
        hidden: false,
        fifo: false,
      },
    });
  }

  async function createAnnotationTask() {
    alert('create annotation task');
  }

  async function createRegistrationTask() {
    // Legacy registration task
    // if (handleLaunchRegistration) {
    //   const queueUrl = await createQueue("Registration", false, true);
    //   if (queueUrl) {
    //     await handleLaunchRegistration(queueUrl);
    //   }
    // }

    // Display registration job
    await client.models.AnnotationSet.update({
      id: annotationSet.id,
      register: true,
    });
  }

  async function handleSubmit() {
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
        if (modelGuided) {
          await createModelTask();
        } else {
          await createTiledTask();
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

  useEffect(() => {
    async function fetchLocationSets() {
      setLoadingLocationSets(true);
      const { data: locationSets } =
        await client.models.LocationSet.locationSetsByProjectId({
          projectId: project.id,
        });
      setLocationSets(locationSets);

      const modelOptions: { label: string; value: string }[] = [];

      for (const locationSet of locationSets) {
        if (locationSet.name.toLowerCase().includes('scoutbot')) {
          if (!modelOptions.some((option) => option.value === 'scoutbot')) {
            modelOptions.push({ label: 'ScoutBot', value: 'scoutbot' });
          }
        }
        if (locationSet.name.toLowerCase().includes('mad')) {
          if (!modelOptions.some((option) => option.value === 'mad')) {
            modelOptions.push({ label: 'MAD AI', value: 'mad' });
          }
        }
        if (
          locationSet.name.toLowerCase().includes('elephant-detection-nadir')
        ) {
          if (
            !modelOptions.some(
              (option) => option.value === 'elephant-detection-nadir'
            )
          ) {
            modelOptions.push({
              label: 'Elephant Detection Nadir',
              value: 'elephant-detection-nadir',
            });
          }
        }
      }

      if (modelOptions.length === 1) {
        setModel(modelOptions[0]);
      }

      setModelOptions(modelOptions);
      setLoadingLocationSets(false);
    }

    fetchLocationSets();
  }, [project.id]);

  useEffect(() => {
    if (loadingLocationSets) {
      setLaunchDisabled(true);
    } else {
      setLaunchDisabled(false);
    }
  }, [loadingLocationSets]);

  useEffect(() => {
    if (taskType === 'registration') {
      setHasStandardOptions(false);
      setHasAdvancedOptions(false);
    }
    if (taskType === 'species-labelling') {
      setHasStandardOptions(true);
      setHasAdvancedOptions(true);
    }
  }, [taskType]);

  return (
    <Modal show={show} strict={true} size='lg'>
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
                  setTaskType('registration');
                  break;
              }
            }}
            disableSwitching={launching}
            sharedChild={
              <div className='px-3'>
                {hasStandardOptions && (
                  <div className='d-flex flex-column gap-3 mt-2'>
                    <ImageSetDropdown
                      imageSets={imageSets}
                      selectedImageSets={selectedImageSets}
                      setSelectedImageSets={setSelectedImageSets}
                      hideIfOneImageSet
                    />
                    <Form.Group>
                      <Form.Label className='mb-0'>Batch Size</Form.Label>
                      <span
                        className='text-muted d-block mb-1'
                        style={{ fontSize: '12px' }}
                      >
                        The number of annotation jobs a user can pick up at a
                        time.
                      </span>
                      <Form.Control
                        type='number'
                        value={batchSize}
                        onChange={(e) => setBatchSize(Number(e.target.value))}
                      />
                    </Form.Group>
                  </div>
                )}
                {hasAdvancedOptions && (
                  <div className='d-flex flex-column mt-2'>
                    <Form.Group>
                      <Form.Switch
                        label='Show Advanced Options'
                        checked={showAdvancedOptions}
                        onChange={() =>
                          setShowAdvancedOptions(!showAdvancedOptions)
                        }
                      />
                    </Form.Group>
                  </div>
                )}
                {hasAdvancedOptions && showAdvancedOptions && (
                  <div
                    className='d-flex flex-column gap-3 border border-dark shadow-sm p-2'
                    style={{ backgroundColor: '#697582' }}
                  >
                    <Form.Group>
                      <Form.Label className='mb-0'>Job Name</Form.Label>
                      <span
                        className='text-muted d-block mb-1'
                        style={{ fontSize: '12px' }}
                      >
                        Modify this to display a different name for the job in
                        the jobs page.
                      </span>
                      <Form.Control
                        type='text'
                        value={taskTag}
                        onChange={(e) => setTaskTag(e.target.value)}
                      />
                    </Form.Group>
                    <Form.Group>
                      <Form.Label className='mb-0'>Zoom Level</Form.Label>
                      <span
                        className='text-muted d-block mb-1'
                        style={{ fontSize: '12px' }}
                      >
                        Select the default zoom level for images.
                      </span>
                      <Form.Select
                        value={zoom}
                        onChange={(e) =>
                          setZoom(
                            e.target.value == 'auto'
                              ? undefined
                              : e.target.value
                          )
                        }
                      >
                        <option value='auto'>Auto</option>
                        {[...Array(13)].map((_, i) => (
                          <option key={i} value={i}>
                            Level {i}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                    <Form.Group>
                      <Form.Label className='mb-0'>
                        Filter by confidence value:
                      </Form.Label>
                      <span
                        className='text-muted d-block mb-1'
                        style={{ fontSize: '12px' }}
                      >
                        Filter images by confidence value.
                      </span>
                      <div className='d-flex align-items-center gap-2'>
                        <Form.Control
                          type='number'
                          min={0}
                          max={1}
                          step={0.01}
                          value={lowerLimit}
                          onChange={(e) =>
                            setLowerLimit(Number(e.target.value))
                          }
                          style={{ width: '80px' }}
                        />
                        <span>to</span>
                        <Form.Control
                          type='number'
                          min={0}
                          max={1}
                          step={0.01}
                          value={upperLimit}
                          onChange={(e) =>
                            setUpperLimit(Number(e.target.value))
                          }
                          style={{ width: '80px' }}
                        />
                      </div>
                    </Form.Group>
                    <Form.Group>
                      <Form.Switch
                        label='Skip Locations With Annotations'
                        checked={skipLocationsWithAnnotations}
                        onChange={() =>
                          setSkipLocationsWithAnnotations(
                            !skipLocationsWithAnnotations
                          )
                        }
                      />
                    </Form.Group>
                    <Form.Group>
                      <Form.Switch
                        label='Allow Annotations Outside Location Boundaries'
                        checked={allowAnnotationsOutsideLocationBoundaries}
                        onChange={() =>
                          setAllowAnnotationsOutsideLocationBoundaries(
                            !allowAnnotationsOutsideLocationBoundaries
                          )
                        }
                      />
                    </Form.Group>
                    <Form.Group>
                      <Form.Switch
                        label='View Unobserved Locations Only'
                        checked={viewUnobservedLocationsOnly}
                        onChange={() =>
                          setViewUnobservedLocationsOnly(
                            !viewUnobservedLocationsOnly
                          )
                        }
                      />
                    </Form.Group>
                    {/* Fix this when required: This will create a secondary queue but the cleanup lambda will clear it before it's used */}
                    {/* <Form.Group>
                      <Form.Switch
                        label="Send Detections to Secondary Queue"
                        checked={sendDetectionsToSecondaryQueue}
                        onChange={() =>
                          setSendDetectionsToSecondaryQueue(
                            !sendDetectionsToSecondaryQueue
                          )
                        }
                      />
                    </Form.Group> */}
                    <Form.Group>
                      <Form.Switch
                        label='Hide Job From Non-Admin Workers'
                        checked={hidden}
                        onChange={() => setHidden(!hidden)}
                      />
                    </Form.Group>
                  </div>
                )}
              </div>
            }
          >
            <Tab label='Species Labelling'>
              <div className='px-3 pb-3 pt-1'>
                <LabeledToggleSwitch
                  className='m-0 border-top pt-2 mt-2 border-dark'
                  leftLabel='Model Guided'
                  rightLabel='Tiled Annotation'
                  checked={!modelGuided}
                  onChange={(checked) => {
                    setModelGuided(!checked);
                  }}
                />

                {modelGuided ? (
                  loadingLocationSets ? (
                    <p
                      className='text-muted mb-0 mt-2 text-center'
                      style={{ fontSize: '12px' }}
                    >
                      Loading models...
                    </p>
                  ) : modelOptions.length > 1 ? (
                    <Form.Group>
                      <Form.Label className='mb-0'>Model</Form.Label>
                      <Select
                        value={model}
                        onChange={(m) => setModel(m)}
                        options={modelOptions}
                        placeholder='Select a model'
                        className='text-black'
                        isDisabled={launching}
                      />
                    </Form.Group>
                  ) : (
                    modelOptions.length === 0 && (
                      <p
                        className='text-muted mb-0 mt-2 text-center'
                        style={{ fontSize: '12px' }}
                      >
                        You must first process your images before launching a
                        model guided task.
                      </p>
                    )
                  )
                ) : (
                  <CreateTask
                    name={annotationSet.name}
                    taskType={'tiled'}
                    labels={annotationSet.categories}
                    setHandleCreateTask={setHandleCreateTask}
                    projectId={project.id}
                    setLaunchDisabled={setLaunchDisabled}
                    disabled={launching}
                  />
                )}
              </div>
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
            disabled={launchDisabled || launching}
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

function StandardOptions({
  imageSets,
  selectedImageSets,
  setSelectedImageSets,
  batchSize,
  setBatchSize,
}: {
  imageSets: { id: string; name: string }[];
  selectedImageSets: string[];
  setSelectedImageSets: (imageSets: string[]) => void;
  batchSize: number;
  setBatchSize: (batchSize: number) => void;
}) {
  return (
    <div className='d-flex flex-column gap-3 mt-2'>
      <ImageSetDropdown
        imageSets={imageSets}
        selectedImageSets={selectedImageSets}
        setSelectedImageSets={setSelectedImageSets}
        hideIfOneImageSet
      />
      <Form.Group>
        <Form.Label className='mb-0'>Batch Size</Form.Label>
        <span className='text-muted d-block mb-1' style={{ fontSize: '12px' }}>
          The number of clusters in each unit of work collected by workers.
        </span>
        <Form.Control
          type='number'
          value={batchSize}
          onChange={(e) => setBatchSize(Number(e.target.value))}
        />
      </Form.Group>
    </div>
  );
}
