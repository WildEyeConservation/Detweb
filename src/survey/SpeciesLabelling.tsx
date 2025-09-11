import { useContext, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Form } from 'react-bootstrap';
import Select from 'react-select';
import { CreateQueueCommand } from '@aws-sdk/client-sqs';
import { Schema } from '../../amplify/data/resource';
import { GlobalContext, UserContext } from '../Context';
import { useLaunchTask } from '../useLaunchTask';
import { makeSafeQueueName } from '../utils';
import ImageSetDropdown from './ImageSetDropdown';
import CreateTask from '../CreateTask';
import LabeledToggleSwitch from '../LabeledToggleSwitch';

export default function SpeciesLabelling({
  project,
  annotationSet,
  launching,
  setLaunchDisabled,
  setSpeciesLaunchHandler,
}: {
  project: Schema['Project']['type'];
  annotationSet: Schema['AnnotationSet']['type'];
  launching: boolean;
  setLaunchDisabled: Dispatch<SetStateAction<boolean>>;
  setSpeciesLaunchHandler: Dispatch<
    SetStateAction<
      ((onProgress: (msg: string) => void) => Promise<void>) | null
    >
  >;
}) {
  const { client } = useContext(GlobalContext)!;
  const { getSqsClient } = useContext(UserContext)!;

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
  const [taskTag, setTaskTag] = useState<string>(annotationSet.name);
  const [zoom, setZoom] = useState<number | undefined>(undefined);
  const [lowerLimit, setLowerLimit] = useState<number>(0.6);
  const [upperLimit, setUpperLimit] = useState<number>(1);
  const [hidden, setHidden] = useState<boolean>(false);
  const [handleCreateTaskWithArgs, setHandleCreateTaskWithArgs] =
    useState<any>(null);
  const [modelGuided, setModelGuided] = useState<boolean>(true);
  const [model, setModel] = useState<{ label: string; value: string }>();
  const [modelOptions, setModelOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [locationSets, setLocationSets] = useState<any[]>([]);
  const [loadingLocationSets, setLoadingLocationSets] =
    useState<boolean>(false);

  // queue helper used by useLaunchTask
  const createQueue = async (
    name: string,
    isHidden: boolean,
    fifo: boolean,
    tag: string
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
      .then(async (result: any) => {
        const url = (result && result.QueueUrl) as string | undefined;
        if (url) {
          const { data: queue } = await (client.models.Queue.create as any)({
            url,
            name: name,
            projectId: project.id,
            batchSize: batchSize,
            hidden: isHidden,
            zoom: zoom,
            tag: tag,
            approximateSize: 1,
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

  // load model options from location sets
  useEffect(() => {
    let mounted = true;
    async function fetchLocationSets() {
      setLoadingLocationSets(true);
      const { data } = (await (
        client.models.LocationSet.locationSetsByProjectId as any
      )({
        projectId: project.id,
      })) as { data: any[] };
      if (!mounted) return;
      setLocationSets(data);

      const options: { label: string; value: string }[] = [];
      for (const ls of data) {
        const n = ls.name.toLowerCase();
        if (n.includes('scoutbot')) {
          if (!options.some((o) => o.value === 'scoutbot')) {
            options.push({ label: 'ScoutBot', value: 'scoutbot' });
          }
        }
        if (n.includes('mad')) {
          if (!options.some((o) => o.value === 'mad')) {
            options.push({ label: 'MAD AI', value: 'mad' });
          }
        }
        if (n.includes('elephant-detection-nadir')) {
          if (!options.some((o) => o.value === 'elephant-detection-nadir')) {
            options.push({
              label: 'Elephant Detection Nadir',
              value: 'elephant-detection-nadir',
            });
          }
        }
      }
      if (options.length === 1) {
        setModel(options[0]);
      }
      setModelOptions(options);
      setLoadingLocationSets(false);
    }
    fetchLocationSets();
    return () => {
      mounted = false;
    };
  }, [client.models.LocationSet, project.id]);

  // Control Launch disabled state based on mode
  useEffect(() => {
    const shouldDisable = modelGuided
      ? loadingLocationSets ||
        modelOptions.length === 0 ||
        (modelOptions.length > 1 && !model)
      : false;
    setLaunchDisabled(shouldDisable);
  }, [
    modelGuided,
    loadingLocationSets,
    modelOptions.length,
    model,
    setLaunchDisabled,
  ]);

  // Expose launch handler to parent (stable to avoid update depth loops)
  const modelGuidedRef = useRef(modelGuided);
  const modelRef = useRef(model);
  const modelOptionsLengthRef = useRef(modelOptions.length);
  const locationSetsRef = useRef(locationSets);
  const launchTaskRef = useRef(launchTask);
  const handleCreateTaskRef = useRef(handleCreateTaskWithArgs);
  const hiddenRef = useRef(hidden);

  useEffect(() => {
    modelGuidedRef.current = modelGuided;
  }, [modelGuided]);
  useEffect(() => {
    modelRef.current = model as any;
  }, [model]);
  useEffect(() => {
    modelOptionsLengthRef.current = modelOptions.length;
  }, [modelOptions.length]);
  useEffect(() => {
    locationSetsRef.current = locationSets;
  }, [locationSets]);
  useEffect(() => {
    launchTaskRef.current = launchTask;
  }, [launchTask]);
  useEffect(() => {
    handleCreateTaskRef.current = handleCreateTaskWithArgs;
  }, [handleCreateTaskWithArgs]);
  useEffect(() => {
    hiddenRef.current = hidden;
  }, [hidden]);

  useEffect(() => {
    // Wrap in function to store a function value (not treat as state updater)
    setSpeciesLaunchHandler(() => async (onProgress: (msg: string) => void) => {
      if (modelGuidedRef.current) {
        if (modelOptionsLengthRef.current === 0) return;
        const currentModelValue = (modelRef.current?.value ?? '') as string;
        const sets = (locationSetsRef.current || []).filter((ls: any) =>
          String(ls.name || '')
            .toLowerCase()
            .includes(currentModelValue)
        );
        if (sets.length === 0) return;
        onProgress('Initializing launch...');
        await launchTaskRef.current({
          selectedTasks: sets.map((ls: any) => ls.id),
          onProgress,
          queueOptions: {
            name: 'Model Guided',
            hidden: false,
            fifo: false,
          },
        });
      } else {
        const createTask = handleCreateTaskRef.current;
        if (!createTask) return;
        const locationSetId = await createTask({
          setLocationsCompleted: () => {},
          setTotalLocations: () => {},
        });
        onProgress('Initializing launch...');
        await launchTaskRef.current({
          selectedTasks: [locationSetId],
          onProgress,
          queueOptions: {
            name: 'Tiled Annotation',
            hidden: hiddenRef.current,
            fifo: false,
          },
        });
      }
    });
    return () => {
      setSpeciesLaunchHandler(null);
    };
  }, [setSpeciesLaunchHandler]);

  return (
    <div className='px-3 pb-3 pt-1'>
      <div className='d-flex flex-column gap-3 mt-2'>
        <Form.Group>
          <Form.Label className='mb-0'>Batch Size</Form.Label>
          <span
            className='text-muted d-block mb-1'
            style={{ fontSize: '12px' }}
          >
            The number of annotation jobs a user can pick up at a time.
          </span>
          <Form.Control
            type='number'
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
          />
        </Form.Group>
      </div>

      <div className='d-flex flex-column mt-2'>
        <Form.Group>
          <Form.Switch
            label='Show Advanced Options'
            checked={showAdvancedOptions}
            onChange={() => setShowAdvancedOptions(!showAdvancedOptions)}
          />
        </Form.Group>
      </div>

      {showAdvancedOptions && (
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
              Modify this to display a different name for the job in the jobs
              page.
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
              value={zoom as any}
              onChange={(e) =>
                setZoom(
                  e.target.value == 'auto' ? undefined : (e.target.value as any)
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
                onChange={(e) => setLowerLimit(Number(e.target.value))}
                style={{ width: '80px' }}
              />
              <span>to</span>
              <Form.Control
                type='number'
                min={0}
                max={1}
                step={0.01}
                value={upperLimit}
                onChange={(e) => setUpperLimit(Number(e.target.value))}
                style={{ width: '80px' }}
              />
            </div>
          </Form.Group>
          <Form.Group>
            <Form.Switch
              label='Skip Locations With Annotations'
              checked={skipLocationsWithAnnotations}
              onChange={() =>
                setSkipLocationsWithAnnotations(!skipLocationsWithAnnotations)
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
                setViewUnobservedLocationsOnly(!viewUnobservedLocationsOnly)
              }
            />
          </Form.Group>
          <Form.Group>
            <Form.Switch
              label='Hide Job From Non-Admin Workers'
              checked={hidden}
              onChange={() => setHidden(!hidden)}
            />
          </Form.Group>
        </div>
      )}

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
              value={model as any}
              onChange={(m) => setModel(m as any)}
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
              You must first process your images before launching a model guided
              task.
            </p>
          )
        )
      ) : (
        <CreateTask
          name={annotationSet.name}
          setHandleCreateTask={setHandleCreateTaskWithArgs}
          projectId={project.id}
          setLaunchDisabled={setLaunchDisabled}
          disabled={launching}
        />
      )}
    </div>
  );
}
