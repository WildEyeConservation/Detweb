import { Modal, Button, Form } from 'react-bootstrap';
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
import { useUpdateProgress } from '../useUpdateProgress';
import Select from 'react-select';
import LabeledToggleSwitch from '../LabeledToggleSwitch';

type TaskType = 'species-labelling' | 'registration';

export default function LaunchAnnotationSetModal({
  show,
  onClose,
  project,
  imageSets,
  annotationSet,
}: {
  show: boolean;
  onClose: () => void;
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
  const [modelGuided, setModelGuided] = useState<boolean>(true);

  const launchTask = useLaunchTask({
    allowOutside: allowAnnotationsOutsideLocationBoundaries,
    filterObserved: viewUnobservedLocationsOnly,
    lowerLimit: lowerLimit,
    upperLimit: upperLimit,
    skipLocationWithAnnotations: skipLocationsWithAnnotations,
    taskTag: taskTag,
    annotationSetId: annotationSet.id,
  });

  const [setLoadingLocations, setTotalLocations] = useUpdateProgress({
    taskId: `Launch annotation set`,
    indeterminateTaskName: `Loading locations`,
    determinateTaskName: 'Processing locations',
    stepFormatter: (count) => `${count} locations`,
  });

  const { client } = useContext(GlobalContext)!;
  const { getSqsClient } = useContext(UserContext)!;

  const createQueue = async (
    name: string,
    hidden: boolean,
    fifo: boolean
  ): Promise<{ id: string; url: string } | null> => {
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
          });

          if (queue) {
            return { id: queue.id, url: url, batchSize: batchSize };
          }
        }
        return null;
      });
  };

  async function createTiledTask() {
    onClose();

    if (handleCreateTask) {
      const locationSetId = await handleCreateTask({
        setLocationsCompleted: setLoadingLocations,
        setTotalLocations: setTotalLocations,
      });

      setLoadingLocations(0);
      setTotalLocations(0);

      const queue = await createQueue('Tiled Annotation', false, false);

      const secondaryQueue = sendDetectionsToSecondaryQueue
        ? await createQueue('Tiled Annotation Secondary', true, false)
        : null;

      //push messages to queue
      if (queue) {
        await launchTask({
          selectedTasks: [locationSetId],
          queue: queue,
          secondaryQueue: secondaryQueue,
          setStepsCompleted: setLoadingLocations,
          setTotalSteps: setTotalLocations,
        });
      }
    }
  }

  async function createModelTask() {
    if (modelOptions.length === 0) {
      alert(
        'You must first process your images before launching a model guided task.'
      );
      return;
    }

    onClose();

    const modelGuidedLocationSets = locationSets.filter((ls) =>
      ls.name.toLowerCase().includes(model?.value)
    );

    if (modelGuidedLocationSets.length === 0) {
      alert('No model guided location set found');
      return;
    }

    //create queue
    const queue = await createQueue('Model Guided', false, false);

    //push messages to queue
    if (queue) {
      await launchTask({
        selectedTasks: modelGuidedLocationSets.map((ls) => ls.id),
        queue: queue,
        secondaryQueue: null,
        setStepsCompleted: setLoadingLocations,
        setTotalSteps: setTotalLocations,
      });
    }
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

    onClose();

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

  return (
    <Modal
      show={show}
      onHide={() => {
        onClose();
        setTaskType('species-labelling');
      }}
      size="lg"
    >
      <Modal.Header closeButton>
        <Modal.Title>Launch for Manual Annotation</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Tabs
            onTabChange={(tab) => {
              switch (tab) {
                case 0:
                  setTaskType('species-labelling');
                  setHasAdvancedOptions(true);
                  break;
                case 1:
                  setTaskType('registration');
                  setHasAdvancedOptions(false);
                  break;
              }
            }}
            sharedChild={
              <div className="">
                {hasStandardOptions && (
                  <div className="d-flex flex-column gap-3 mt-2">
                    <ImageSetDropdown
                      imageSets={imageSets}
                      selectedImageSets={selectedImageSets}
                      setSelectedImageSets={setSelectedImageSets}
                      hideIfOneImageSet
                    />
                    <Form.Group>
                      <Form.Label className="mb-0">Batch Size</Form.Label>
                      <span
                        className="text-muted d-block mb-1"
                        style={{ fontSize: '12px' }}
                      >
                        The number of annotation jobs a user can pick up at a
                        time.
                      </span>
                      <Form.Control
                        type="number"
                        value={batchSize}
                        onChange={(e) => setBatchSize(Number(e.target.value))}
                      />
                    </Form.Group>
                  </div>
                )}
                {hasAdvancedOptions && (
                  <div className="d-flex flex-column mt-2">
                    <Form.Group>
                      <Form.Switch
                        label="Show Advanced Options"
                        checked={showAdvancedOptions}
                        onChange={() =>
                          setShowAdvancedOptions(!showAdvancedOptions)
                        }
                      />
                    </Form.Group>
                  </div>
                )}
                {hasAdvancedOptions && showAdvancedOptions && (
                  <div className="d-flex flex-column gap-3 border border-dark shadow-sm p-2">
                    <Form.Group>
                      <Form.Label className="mb-0">Task Tag</Form.Label>
                      <span
                        className="text-muted d-block mb-1"
                        style={{ fontSize: '12px' }}
                      >
                        This tag will be added to all locations in the task.
                      </span>
                      <Form.Control
                        type="text"
                        value={taskTag}
                        onChange={(e) => setTaskTag(e.target.value)}
                      />
                    </Form.Group>
                    <Form.Group>
                      <Form.Label className="mb-0">Zoom Level</Form.Label>
                      <span
                        className="text-muted d-block mb-1"
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
                        <option value="auto">Auto</option>
                        {[...Array(13)].map((_, i) => (
                          <option key={i} value={i}>
                            Level {i}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                    <Form.Group>
                      <Form.Label className="mb-0">
                        Filter by confidence value:
                      </Form.Label>
                      <span
                        className="text-muted d-block mb-1"
                        style={{ fontSize: '12px' }}
                      >
                        Filter images by confidence value.
                      </span>
                      <div className="d-flex align-items-center gap-2">
                        <Form.Control
                          type="number"
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
                          type="number"
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
                        label="Skip Locations With Annotations"
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
                        label="Allow Annotations Outside Location Boundaries"
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
                        label="View Unobserved Locations Only"
                        checked={viewUnobservedLocationsOnly}
                        onChange={() =>
                          setViewUnobservedLocationsOnly(
                            !viewUnobservedLocationsOnly
                          )
                        }
                      />
                    </Form.Group>
                    <Form.Group>
                      <Form.Switch
                        label="Send Detections to Secondary Queue"
                        checked={sendDetectionsToSecondaryQueue}
                        onChange={() =>
                          setSendDetectionsToSecondaryQueue(
                            !sendDetectionsToSecondaryQueue
                          )
                        }
                      />
                    </Form.Group>
                    <Form.Group>
                      <Form.Switch
                        label="Hide Job From Non-Admin Workers"
                        checked={hidden}
                        onChange={() => setHidden(!hidden)}
                      />
                    </Form.Group>
                  </div>
                )}
              </div>
            }
          >
            <Tab label="Species Labelling">
              <LabeledToggleSwitch
                className="m-0 border-top pt-2 mt-2 border-dark"
                leftLabel="Model Guided"
                rightLabel="Tiled Annotation"
                checked={!modelGuided}
                onChange={(checked) => {
                  setModelGuided(!checked);
                }}
              />

              {modelGuided ? (
                loadingLocationSets ? (
                  <p
                    className="text-muted mb-0 mt-2 text-center"
                    style={{ fontSize: '12px' }}
                  >
                    Loading models...
                  </p>
                ) : modelOptions.length > 1 ? (
                  <Form.Group>
                    <Form.Label className="mb-0">Model</Form.Label>
                    <Select
                      value={model}
                      onChange={(m) => setModel(m)}
                      options={modelOptions}
                      placeholder="Select a model"
                      className="text-black"
                    />
                  </Form.Group>
                ) : (
                  modelOptions.length === 0 && (
                    <p
                      className="text-muted mb-0 mt-2 text-center"
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
                  imageSets={selectedImageSets}
                  labels={annotationSet.categories}
                  setHandleCreateTask={setHandleCreateTask}
                  projectId={project.id}
                />
              )}
            </Tab>
            <Tab label="Registration" className="mt-1">
              <></>
            </Tab>
          </Tabs>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" disabled={launching} onClick={handleSubmit}>
          Launch
        </Button>
        <Button variant="dark" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
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
    <div className="d-flex flex-column gap-3 mt-2">
      <ImageSetDropdown
        imageSets={imageSets}
        selectedImageSets={selectedImageSets}
        setSelectedImageSets={setSelectedImageSets}
        hideIfOneImageSet
      />
      <Form.Group>
        <Form.Label className="mb-0">Batch Size</Form.Label>
        <span className="text-muted d-block mb-1" style={{ fontSize: '12px' }}>
          The number of clusters in each unit of work collected by workers.
        </span>
        <Form.Control
          type="number"
          value={batchSize}
          onChange={(e) => setBatchSize(Number(e.target.value))}
        />
      </Form.Group>
    </div>
  );
}
