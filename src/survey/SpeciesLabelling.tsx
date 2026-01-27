import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Alert, Form, Modal, Button } from 'react-bootstrap';
import Select from 'react-select';
import { Schema } from '../amplify/client-schema';
import { GlobalContext, UserContext } from '../Context';
import { useLaunchTask } from '../useLaunchTask';
import LabeledToggleSwitch from '../LabeledToggleSwitch';
import { logAdminAction } from '../utils/adminActionLogger';

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
    SetStateAction<{
      execute: (
        onProgress: (msg: string) => void,
        onLaunchConfirmed: () => void
      ) => Promise<void>;
    } | null>
  >;
}) {
  const { client } = useContext(GlobalContext)!;
  const { user } = useContext(UserContext)!;

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
  const [modelGuided, setModelGuided] = useState<boolean>(true);
  const [model, setModel] = useState<{ label: string; value: string }>();
  const [modelOptions, setModelOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [locationSets, setLocationSets] = useState<any[]>([]);
  const [loadingLocationSets, setLoadingLocationSets] =
    useState<boolean>(false);

  // Global tiled location set state
  const [globalTileCount, setGlobalTileCount] = useState<number | null>(null);
  const [loadingTileCount, setLoadingTileCount] = useState<boolean>(false);

  // False negative data detection
  const [hasFalseNegativeData, setHasFalseNegativeData] =
    useState<boolean>(false);
  const [showFnConfirmModal, setShowFnConfirmModal] = useState<boolean>(false);
  const confirmPromiseRef = useRef<{
    resolve: (value: boolean) => void;
    reject: (reason?: any) => void;
  } | null>(null);

  // Get the tiled location set ID from project
  const tiledLocationSetId = (project as any).tiledLocationSetId as
    | string
    | undefined;

  const launchTask = useLaunchTask({
    allowOutside: allowAnnotationsOutsideLocationBoundaries,
    filterObserved: viewUnobservedLocationsOnly,
    lowerLimit: lowerLimit,
    upperLimit: upperLimit,
    skipLocationWithAnnotations: skipLocationsWithAnnotations,
    taskTag: taskTag,
    annotationSetId: annotationSet.id,
    projectId: project.id,
    batchSize,
    zoom: zoom as number | undefined,
  });

  // Check for false negative data on mount
  useEffect(() => {
    let mounted = true;
    async function checkForFnData() {
      try {
        // Query observations with source filter - looking for any with 'false-negative'
        // The index has sortKeys on createdAt and source, so we need to scan
        const { data } =
          await client.models.Observation.observationsByAnnotationSetId(
            {
              annotationSetId: annotationSet.id,
            },
            {
              filter: {
                source: { contains: 'false-negative' },
              },
              selectionSet: ['id', 'source'] as const,
              limit: 1000,
            }
          );
        if (!mounted) return;
        // Check if any observation has false-negative in source
        const hasFn = (data || []).some(
          (obs: any) =>
            obs?.source && String(obs.source).includes('false-negative')
        );
        console.log('hasFn', hasFn);
        setHasFalseNegativeData(hasFn);
      } catch (err) {
        console.error('Failed to check for FN data', err);
        if (mounted) {
          setHasFalseNegativeData(false);
        }
      }
    }
    checkForFnData();
    return () => {
      mounted = false;
    };
  }, [client, annotationSet.id]);

  // Load global tile count when switching to tiled mode
  useEffect(() => {
    if (modelGuided) return;
    if (!tiledLocationSetId) {
      setGlobalTileCount(0);
      return;
    }

    let mounted = true;
    const locationSetIdToFetch = tiledLocationSetId;
    async function loadTileCount() {
      setLoadingTileCount(true);
      try {
        const { data } = await client.models.LocationSet.get(
          { id: locationSetIdToFetch as string },
          { selectionSet: ['locationCount'] }
        );
        if (mounted) {
          setGlobalTileCount(data?.locationCount ?? 0);
        }
      } catch (err) {
        console.error('Failed to load tile count', err);
        if (mounted) {
          setGlobalTileCount(0);
        }
      }
      if (mounted) {
        setLoadingTileCount(false);
      }
    }
    loadTileCount();
    return () => {
      mounted = false;
    };
  }, [client.models.LocationSet, tiledLocationSetId, modelGuided]);

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
    let shouldDisable = false;

    if (modelGuided) {
      // Model guided mode
      shouldDisable =
        loadingLocationSets ||
        modelOptions.length === 0 ||
        (modelOptions.length > 1 && !model);
    } else {
      // Tiled annotation mode - check if global tiles exist
      shouldDisable =
        loadingTileCount ||
        !tiledLocationSetId ||
        (globalTileCount !== null && globalTileCount === 0);
    }

    setLaunchDisabled(shouldDisable);
  }, [
    modelGuided,
    loadingLocationSets,
    modelOptions.length,
    model,
    loadingTileCount,
    tiledLocationSetId,
    globalTileCount,
    setLaunchDisabled,
  ]);

  // Expose launch handler to parent (stable to avoid update depth loops)
  const modelGuidedRef = useRef(modelGuided);
  const modelRef = useRef(model);
  const modelOptionsLengthRef = useRef(modelOptions.length);
  const locationSetsRef = useRef(locationSets);
  const launchTaskRef = useRef(launchTask);
  const hiddenRef = useRef(hidden)
  const lowerLimitRef = useRef(lowerLimit);
  const upperLimitRef = useRef(upperLimit);
  const batchSizeRef = useRef(batchSize);
  const skipLocationsWithAnnotationsRef = useRef(skipLocationsWithAnnotations);
  const allowAnnotationsOutsideLocationBoundariesRef = useRef(allowAnnotationsOutsideLocationBoundaries);
  const viewUnobservedLocationsOnlyRef = useRef(viewUnobservedLocationsOnly);
  const zoomRef = useRef(zoom);
  const taskTagRef = useRef(taskTag);
  const tiledLocationSetIdRef = useRef(tiledLocationSetId);

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
    hiddenRef.current = hidden;
  }, [hidden]);
  useEffect(() => {
    lowerLimitRef.current = lowerLimit;
  }, [lowerLimit]);
  useEffect(() => {
    upperLimitRef.current = upperLimit;
  }, [upperLimit]);
  useEffect(() => {
    batchSizeRef.current = batchSize;
  }, [batchSize]);
  useEffect(() => {
    skipLocationsWithAnnotationsRef.current = skipLocationsWithAnnotations;
  }, [skipLocationsWithAnnotations]);
  useEffect(() => {
    allowAnnotationsOutsideLocationBoundariesRef.current = allowAnnotationsOutsideLocationBoundaries;
  }, [allowAnnotationsOutsideLocationBoundaries]);
  useEffect(() => {
    viewUnobservedLocationsOnlyRef.current = viewUnobservedLocationsOnly;
  }, [viewUnobservedLocationsOnly]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    taskTagRef.current = taskTag;
  }, [taskTag]);
  useEffect(() => {
    tiledLocationSetIdRef.current = tiledLocationSetId;
  }, [tiledLocationSetId]);

  const hasFalseNegativeDataRef = useRef(hasFalseNegativeData);
  useEffect(() => {
    hasFalseNegativeDataRef.current = hasFalseNegativeData;
  }, [hasFalseNegativeData]);

  // The actual launch logic - called after confirmation if FN data exists
  const performLaunch = useCallback(
    async (
      onProgress: (msg: string) => void,
      onLaunchConfirmed: () => void,
      deleteFnData: boolean
    ) => {
      if (modelGuidedRef.current) {
        // Model guided launch
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
          hasFN: deleteFnData,
          onLaunchConfirmed,
        });
        // Log the launch action with settings
        const modelName = modelOptions.find((m) => m.value === currentModelValue)?.label || currentModelValue;
        const settings = [
          `Confidence: ${lowerLimitRef.current}-${upperLimitRef.current}`,
          `Batch size: ${batchSizeRef.current}`,
          `Skip locations with annotations: ${skipLocationsWithAnnotationsRef.current ? 'Yes' : 'No'}`,
          `Allow annotations outside boundaries: ${allowAnnotationsOutsideLocationBoundariesRef.current ? 'Yes' : 'No'}`,
          `View unobserved only: ${viewUnobservedLocationsOnlyRef.current ? 'Yes' : 'No'}`,
          zoomRef.current !== undefined ? `Zoom: ${zoomRef.current}` : null,
          taskTagRef.current !== annotationSet.name ? `Job name: "${taskTagRef.current}"` : null,
        ].filter(Boolean).join(', ');

        await logAdminAction(
          client,
          user.userId,
          `Launched Model Guided queue for annotation set "${annotationSet.name}" in project "${project.name}" (Model: ${modelName}, ${settings})`,
          project.id
        ).catch(console.error);
      } else {
        // Tiled annotation launch - use global tiled location set
        if (!tiledLocationSetIdRef.current) {
          onProgress('No tiles configured for this survey.');
          return;
        }

        onProgress('Initializing launch...');
        await launchTaskRef.current({
          selectedTasks: [tiledLocationSetIdRef.current],
          onProgress,
          queueOptions: {
            name: 'Tiled Annotation',
            hidden: hiddenRef.current,
            fifo: false,
          },
          hasFN: deleteFnData,
          onLaunchConfirmed,
        });
        // Log the launch action
        await logAdminAction(
          client,
          user.userId,
          `Launched Tiled Annotation queue for annotation set "${annotationSet.name}" in project "${project.name}"`,
          project.id
        ).catch(console.error);
      }
    },
    [
      client,
      user.userId,
      annotationSet.name,
      project.name,
      project.id,
      modelOptions,
    ]
  );

  const performLaunchRef = useRef(performLaunch);
  useEffect(() => {
    performLaunchRef.current = performLaunch;
  }, [performLaunch]);

  // Handle confirmation dialog result
  const handleFnConfirm = useCallback(async () => {
    setShowFnConfirmModal(false);
    if (confirmPromiseRef.current) {
      confirmPromiseRef.current.resolve(true);
      confirmPromiseRef.current = null;
    }
  }, []);

  const handleFnCancel = useCallback(() => {
    setShowFnConfirmModal(false);
    if (confirmPromiseRef.current) {
      confirmPromiseRef.current.reject(new Error('User cancelled launch'));
      confirmPromiseRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Wrap in function to store a function value (not treat as state updater)
    setSpeciesLaunchHandler({
      execute: async (onProgress: (msg: string) => void, onLaunchConfirmed: () => void) => {
        // Check if FN data exists - if so, show confirmation dialog
        if (hasFalseNegativeDataRef.current) {
          try {
            // Create a promise that will be resolved/rejected when user confirms/cancels
            const userConfirmed = await new Promise<boolean>(
              (resolve, reject) => {
                confirmPromiseRef.current = { resolve, reject };
                setShowFnConfirmModal(true);
              }
            );

            if (!userConfirmed) {
              // User cancelled, don't proceed with launch
              return;
            }

            // User confirmed, proceed with launch and delete FN data
            await performLaunchRef.current(onProgress, onLaunchConfirmed, true);
          } catch (error) {
            // User cancelled via rejection - propagate the error to parent
            throw error;
          }
          return;
        }
        // No FN data, proceed with launch directly
        await performLaunchRef.current(onProgress, onLaunchConfirmed, false);
      }
    });
    return () => {
      setSpeciesLaunchHandler(null);
    };
  }, [setSpeciesLaunchHandler, client, user.userId, annotationSet.name, project.name, project.id, modelOptions]);

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
          {modelGuided &&
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
          }
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
        <div className='mt-2'>
          {loadingTileCount ? (
            <p
              className='text-muted mb-0 text-center'
              style={{ fontSize: '12px' }}
            >
              Loading tile information...
            </p>
          ) : !tiledLocationSetId || globalTileCount === 0 ? (
            <Alert variant='warning' className='mb-0'>
              <strong>No tiles configured.</strong>
              <p className='mb-0 mt-1' style={{ fontSize: '14px' }}>
                Please go to <strong>Edit Survey &gt; Manage Tiles</strong> to
                create tiles for this survey before launching a tiled annotation
                task.
              </p>
            </Alert>
          ) : (
            <div
              className='border border-dark shadow-sm p-2'
              style={{ backgroundColor: '#697582' }}
            >
              <p className='mb-0 text-white'>
                <strong>{globalTileCount}</strong> tiles available for
                annotation.
              </p>
              <p className='mb-0 mt-1 text-muted' style={{ fontSize: '12px' }}>
                To modify tiles, go to Edit Survey &gt; Manage Tiles.
              </p>
            </div>
          )}
        </div>
      )}

      {/* False Negative Data Confirmation Modal */}
      <Modal
        show={showFnConfirmModal}
        onHide={handleFnCancel}
        centered
        backdrop='static'
        keyboard={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>False Negative Data Detected</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            This annotation set contains data from a previous False Negatives
            task. Launching a new annotation task will{' '}
            <strong>permanently delete</strong> all false negative annotations
            and observations to maintain statistical accuracy.
          </p>
          <p className='mb-0'>Do you want to proceed?</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant='secondary' onClick={handleFnCancel}>
            Cancel
          </Button>
          <Button variant='danger' onClick={handleFnConfirm}>
            Delete FN Data & Launch
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
