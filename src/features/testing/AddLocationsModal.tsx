import type { Schema } from '../../shared/api/client-schema';
import { getErrorMessage } from '../../../amplify/shared/errorMessage';
import { useDialogGuard } from '../../shared/routing/useDialogGuard';
import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { Modal, Header, Title, Body, Footer } from '../../shared/components/Modal';
import { client } from '../../shared/api/appClient';
import { fetchAllPaginatedResults } from '../../shared/api/pagination';
import { type FetcherType, type TaskPayload, TaskBuffer } from '../tasks/TaskBuffer';
import LightLocationView from './LightLocationView';
import { ProjectScope } from '../../shared/data/ProjectScopeProvider';

type Props = {
  show: boolean;
  onClose: () => void;
  organizationId: string;
  preset: { id: string; name: string };
  surveyId: string;
};

type LocationReferenceTask = TaskPayload & {
  id: string;
  message_id: string;
  location: { id: string; annotationSetId: string };
};

export default function AddLocationsModal({ show, preset, surveyId, organizationId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  useDialogGuard({ busy: adding });
  const [candidates, setCandidates] = useState<
    { annotationSetId: string; locationId: string }[]
  >([]);
  const [index, setIndex] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [maxAnnotations, setMaxAnnotations] = useState<number | ''>('');
  const [pendingCategoryId, setPendingCategoryId] = useState<string>('');
  const [pendingMaxAnnotations, setPendingMaxAnnotations] = useState<
    number | ''
  >('');
  const [loadedCount, setLoadedCount] = useState(0);
  const [locationSets, setLocationSets] = useState<Schema['LocationSet']['type'][]>([]);
  const [loadingLocationSets, setLoadingLocationSets] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);
  const [changeSize, setChangeSize] = useState<boolean>(false);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [customWidth, setCustomWidth] = useState<number | ''>('');
  const [customHeight, setCustomHeight] = useState<number | ''>('');
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const candidatesRef = useRef<
    {
      annotationSetId: string;
      locationId: string;
    }[]
  >([]);
  const candidateIndexRef = useRef(0);
  const currentCandidate = candidatesRef.current[index] ?? null;
  const [addedLocations, setAddedLocations] = useState<Record<string, boolean>>(
    {}
  );


  const fetcher: FetcherType<LocationReferenceTask> = useCallback(async () => {
    const cand = candidatesRef.current[candidateIndexRef.current];
    candidateIndexRef.current += 1;
    const id = crypto.randomUUID();
    return {
      id,
      message_id: id,
      location: { id: cand.locationId, annotationSetId: cand.annotationSetId },
    };
  }, []);

  const refreshCandidates = useCallback<
    (categoryId: string, maxAnn: number | '') => Promise<void>
  >(
    async (categoryId: string, maxAnn: number | '') => {
      setLoading(true);
      setLoadedCount(0);

      // Get existing preset locations to exclude
      const existingRaw = await (fetchAllPaginatedResults)(
        (client).models.TestPresetLocation.locationsByTestPresetId,
        {
          testPresetId: preset.id,
          selectionSet: ['locationId', 'annotationSetId'] as const,
          limit: 10000,
        }
      );
      const presetKeys = new Set(
        existingRaw.map(
          (loc) => `${loc.annotationSetId}_${loc.locationId}`
        )
      );

      // Get all annotation sets for the project
      const annotationSets = (await fetchAllPaginatedResults(
        (client).models.AnnotationSet.annotationSetsByProjectId,
        {
          projectId: surveyId,
          selectionSet: ['id'] as const,
        }
      ));

      const allCandidates: { annotationSetId: string; locationId: string }[] =
        [];
      const uniqueLocationIds = new Set<string>();

      // Callback to update observation count as they're loaded
      const updateObservationCount = (count: number) => {
        setLoadedCount((prev) => prev + count);
      };

      // OPTIMIZATION 1: Batch fetch observations for all annotation sets
      // Instead of nested loops, collect all observations with their location data
      const observationPromises = annotationSets.map(async (as) => {
        const observations = (await fetchAllPaginatedResults(
          (client).models.Observation.observationsByAnnotationSetId,
          {
            annotationSetId: as.id,
            filter: { annotationCount: { gt: 0 } },
            selectionSet: [
              'locationId',
              'annotationSetId',
              'location.id',
              'location.imageId',
              'location.width',
              'location.height',
              'location.x',
              'location.y',
            ] as const,
            limit: 10000,
          },
          updateObservationCount
        ));
        return observations;
      });

      // Wait for all observation queries to complete
      const observationResults = await Promise.all(observationPromises);
      const allObservations = observationResults.flat();

      // OPTIMIZATION 2: Group observations by image to batch annotation queries
      const imageGroups = new Map<string, Schema['Observation']['type'][]>();
      for (const obs of allObservations) {
        const key = `${obs.annotationSetId}_${obs.location.imageId}`;
        if (!imageGroups.has(key)) {
          imageGroups.set(key, []);
        }
        imageGroups.get(key)!.push(obs);
      }

      // OPTIMIZATION 3: Batch annotation queries by image
      const annotationPromises = Array.from(imageGroups.entries()).map(
        async ([key, observations]) => {
          const [annotationSetId, imageId] = key.split('_');
          const annotations = (await fetchAllPaginatedResults(
            (client).models.Annotation.annotationsByImageIdAndSetId,
            {
              imageId,
              setId: { eq: annotationSetId },
              selectionSet: ['x', 'y', 'categoryId'] as const,
              limit: 10000,
            }
          ));

          return { key, annotations, observations };
        }
      );

      // Wait for all annotation queries to complete
      const annotationResults = await Promise.all(annotationPromises);

      // Process results
      for (const { annotations, observations } of annotationResults) {
        for (const obs of observations) {
          const presetKey = `${obs.annotationSetId}_${obs.locationId}`;
          if (presetKeys.has(presetKey)) continue;

          // Check location bounds
          if (
            !obs.location ||
            obs.location.width == null ||
            obs.location.height == null
          ) {
            continue;
          }

          const location = obs.location;
          const minX = location.x - location.width / 2;
          const minY = location.y - location.height / 2;
          const maxX = location.x + location.width / 2;
          const maxY = location.y + location.height / 2;

          // Filter annotations inside location bounds
          const inside = annotations.filter(
            (ann) =>
              ann.x >= minX && ann.y >= minY && ann.x <= maxX && ann.y <= maxY
          );

          // Apply category filter
          if (
            categoryId &&
            !inside.some((a) => a.categoryId === categoryId)
          ) {
            continue;
          }

          // Apply max annotations limit
          const limit = maxAnn === '' ? null : Number(maxAnn);
          if (limit != null && inside.length > limit) {
            continue;
          }

          if (inside.length > 0) {
            allCandidates.push({
              annotationSetId: obs.annotationSetId,
              locationId: obs.locationId,
            });

            if (!uniqueLocationIds.has(obs.locationId)) {
              uniqueLocationIds.add(obs.locationId);
            }
          }
        }
      }

      const filteredCandidates = allCandidates.filter(
        (cand, i, arr) =>
          arr.findIndex((c) => c.locationId === cand.locationId) === i
      );

      candidatesRef.current = filteredCandidates;
      setCandidates(filteredCandidates);
      candidateIndexRef.current = 0;
      setIndex(0);
      setLoading(false);
    },
    [preset.id, surveyId]
  );

  // Fetch project location sets for tiled sizes / testing set
  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingLocationSets(true);
        const { data } = (await (
          (client).models.LocationSet.locationSetsByProjectId
        )(
          { projectId: surveyId },
          { selectionSet: ['id', 'name', 'description'] as const }
        ));
        if (!cancelled) setLocationSets(Array.isArray(data) ? data : []);
      } finally {
        if (!cancelled) setLoadingLocationSets(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [show, surveyId]);

  const tiledSizeOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { label: string; value: string; w: number; h: number }[] = [];
    for (const s of locationSets || []) {
      try {
        if (!s?.description) continue;
        const desc = JSON.parse(s.description);
        if (
          desc &&
          desc.mode === 'tiled' &&
          typeof desc.width === 'number' &&
          typeof desc.height === 'number'
        ) {
          const key = `${desc.width}x${desc.height}`;
          if (!seen.has(key)) {
            seen.add(key);
            opts.push({
              label: `${desc.width} x ${desc.height} px`,
              value: key,
              w: desc.width,
              h: desc.height,
            });
          }
        }
      } catch {
        // ignore bad JSON
      }
    }
    return opts.sort((a, b) => a.w * a.h - b.w * b.h);
  }, [locationSets]);

  const overlayEnabled =
    advancedOpen && (changeSize || offsetX !== 0 || offsetY !== 0);

  useEffect(() => {
    if (show) {
      refreshCandidates(selectedCategoryId, maxAnnotations);
    } else {
      candidatesRef.current = [];
      setCandidates([]);
      setIndex(0);
    }
  }, [show, preset.id, surveyId, refreshCandidates, selectedCategoryId, maxAnnotations]);

  useEffect(() => {
    if (show) {
      setPendingCategoryId(selectedCategoryId);
      setPendingMaxAnnotations(maxAnnotations);
    }
  }, [maxAnnotations, selectedCategoryId, show]);

  const applyFilters = useCallback(() => {
    setSelectedCategoryId(pendingCategoryId);
    setMaxAnnotations(pendingMaxAnnotations || '');
  }, [pendingCategoryId, pendingMaxAnnotations]);

  // Ensure a dedicated testing location set exists
  const getOrCreateTestingLocationSetId = useCallback(async () => {
    const TESTING_SET_NAME = 'Testing Locations';
    const existing = (locationSets || []).find(
      (s) => s?.name === TESTING_SET_NAME
    );
    if (existing?.id) return existing.id as string;
    const { data: created } = await (client).models.LocationSet.create({
      name: TESTING_SET_NAME,
      projectId: surveyId,
      group: organizationId,
    });
    setLocationSets((prev) => (created ? [...prev, created] : prev));
    return created?.id as string;
  }, [surveyId, locationSets, organizationId]);

  async function saveAnnotations(cand: {
    annotationSetId: string;
    locationId: string;
  }) {
    // mirror EditLocationsModal saveAnnotations logic
    const { data: location } = await client.models.Location.get({ id: cand.locationId }, { selectionSet: ['imageId', 'width', 'height', 'x', 'y'] as const });
    if (!location) return;
    const annotations = (await fetchAllPaginatedResults(
      (client).models.Annotation.annotationsByImageIdAndSetId,
      {
        imageId: location.imageId,
        setId: { eq: cand.annotationSetId },
        selectionSet: ['categoryId', 'x', 'y'] as const,
        limit: 10000,
      }
    ));
    if (location.width == null || location.height == null) return;
    const boundsxy: [number, number][] = [
      [
        location.x - (location.width as number) / 2,
        location.y - (location.height as number) / 2,
      ],
      [
        location.x + (location.width as number) / 2,
        location.y + (location.height as number) / 2,
      ],
    ];
    const annotationCounts: Record<string, number> = {};
    for (const ann of annotations) {
      if (
        ann.x >= boundsxy[0][0] &&
        ann.y >= boundsxy[0][1] &&
        ann.x <= boundsxy[1][0] &&
        ann.y <= boundsxy[1][1]
      ) {
        annotationCounts[ann.categoryId] =
          (annotationCounts[ann.categoryId] || 0) + 1;
      }
    }
    for (const [categoryId, count] of Object.entries(annotationCounts)) {
      const { data: lac } = await (
        client
      ).models.LocationAnnotationCount.get({
        locationId: cand.locationId,
        categoryId,
        annotationSetId: cand.annotationSetId,
      });
      if (lac) {
        await (client).models.LocationAnnotationCount.update({
          locationId: cand.locationId,
          categoryId,
          annotationSetId: cand.annotationSetId,
          count,
        });
      } else {
        await (client).models.LocationAnnotationCount.create({
          locationId: cand.locationId,
          categoryId,
          annotationSetId: cand.annotationSetId,
          count,
          group: organizationId,
        });
      }
    }
  }

  async function handleAdd() {
    const cand = currentCandidate;
    if (!cand) return;
    setAdding(true);
    try {
      // Load original location
      const { data: orig } = await client.models.Location.get({ id: cand.locationId }, { selectionSet: ['imageId', 'x', 'y', 'width', 'height'] as const });
      if (!orig) throw new Error('Original location not found');

      const testingSetId = await getOrCreateTestingLocationSetId();
      const finalWidth =
        (advancedOpen && changeSize ? customWidth : orig.width) ?? 100;
      const finalHeight =
        (advancedOpen && changeSize ? customHeight : orig.height) ?? 100;
      const finalX = Math.round(
        (orig.x as number) + (advancedOpen ? offsetX || 0 : 0)
      );
      const finalY = Math.round(
        (orig.y as number) + (advancedOpen ? offsetY || 0 : 0)
      );

      // Create a new testing location
      const { data: newLoc } = await client.models.Location.create({
        projectId: surveyId,
        setId: testingSetId,
        imageId: orig.imageId,
        x: finalX,
        y: finalY,
        width: Number(finalWidth),
        height: Number(finalHeight),
        source: 'testing',
        group: organizationId,
      });

      if (!newLoc?.id) throw new Error('Failed to create testing location');

      // Add the new location to the preset
      await client.models.TestPresetLocation.create({
        testPresetId: preset.id,
        locationId: newLoc.id,
        annotationSetId: cand.annotationSetId,
        group: organizationId,
      });

      // mark for effect using the new location
      await saveAnnotations({ annotationSetId: cand.annotationSetId, locationId: newLoc.id });
      setAddedLocations((prev) => ({
        ...prev,
        [`${cand.annotationSetId}_${cand.locationId}`]: true,
      }));
    } catch (error) {
      alert(error instanceof Error ? getErrorMessage(error) : "Unable to add location.");
    } finally {
      setAdding(false);
    }
  }


  return (
    <ProjectScope projectId={surveyId}>
      <Modal show={show} strict={true}>
        <Header>
          <Title>Add Locations to {preset.name}</Title>
        </Header>
        <Body>
          <div
            className='d-flex flex-column gap-3 px-3 pb-3 pt-0'
            style={{ height: '75vh' }}
          >
            {loading ? (
              <p className='d-flex align-items-center gap-2 p-2'>
                <Spinner animation='border' size='sm' /> {loadedCount}{' '}
                observations loaded
              </p>
            ) : candidates.length === 0 ? (
              <p>No available locations to add.</p>
            ) : (
              <div className='d-flex flex-row gap-3 h-100'>
                {/* Left controls column */}
                <div
                  className='d-flex flex-column gap-3 border-end border-dark mt-3 pe-3'
                  style={{ width: '360px', maxWidth: '40%', overflowY: 'auto' }}
                >
                  <Form.Group className='d-flex flex-column gap-2'>
                    <Form.Group>
                      <Form.Label className='mb-0'>Label filter</Form.Label>
                      <Form.Select
                        value={pendingCategoryId}
                        onChange={(e) => setPendingCategoryId(e.target.value)}
                      >
                        <option value=''>All labels</option>
                        {/* options loaded lazily below via current candidate's annotationSetId */}
                        {currentCandidate && (
                          <CategoryOptions
                            annotationSetId={currentCandidate.annotationSetId}
                          />
                        )}
                      </Form.Select>
                    </Form.Group>
                    <Form.Group>
                      <Form.Label className='mb-0'>Max annotations</Form.Label>
                      <Form.Control
                        type='number'
                        min={0}
                        placeholder='No limit'
                        value={pendingMaxAnnotations}
                        onChange={(e) =>
                          setPendingMaxAnnotations(
                            e.target.value === ''
                              ? ''
                              : Number(e.target.value) || ''
                          )
                        }
                      />
                    </Form.Group>
                    <Button
                      variant='primary'
                      onClick={applyFilters}
                      disabled={loading}
                    >
                      Filter
                    </Button>
                  </Form.Group>
                  <Form.Group className='d-flex flex-column gap-2 pb-3'>
                    <Form.Check
                      type='checkbox'
                      label='Advanced options'
                      checked={advancedOpen}
                      onChange={(e) => setAdvancedOpen(e.target.checked)}
                    />
                    {advancedOpen && (
                      <div className='d-flex flex-row align-items-end gap-2 flex-wrap'>
                        <Form.Check
                          type='checkbox'
                          label='Change location size when adding'
                          checked={changeSize}
                          onChange={(e) => setChangeSize(e.target.checked)}
                        />
                        <Form.Group>
                          <Form.Label className='mb-0'>
                            From tiled sizes
                          </Form.Label>
                          <Form.Select
                            disabled={
                              loadingLocationSets ||
                              tiledSizeOptions.length === 0 ||
                              !changeSize
                            }
                            value={selectedSize}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedSize(val);
                              const found = tiledSizeOptions.find(
                                (o) => o.value === val
                              );
                              if (found) {
                                setCustomWidth(found.w);
                                setCustomHeight(found.h);
                              }
                            }}
                          >
                            <option value=''>Select size</option>
                            {tiledSizeOptions.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                        <Form.Group>
                          <Form.Label className='mb-0'>Width (px)</Form.Label>
                          <Form.Control
                            type='number'
                            min={1}
                            placeholder='e.g. 1024'
                            disabled={!changeSize}
                            value={customWidth}
                            onChange={(e) =>
                              setCustomWidth(
                                e.target.value === ''
                                  ? ''
                                  : Math.max(1, Number(e.target.value) || 1)
                              )
                            }
                          />
                        </Form.Group>
                        <Form.Group>
                          <Form.Label className='mb-0'>Height (px)</Form.Label>
                          <Form.Control
                            type='number'
                            min={1}
                            placeholder='e.g. 1024'
                            disabled={!changeSize}
                            value={customHeight}
                            onChange={(e) =>
                              setCustomHeight(
                                e.target.value === ''
                                  ? ''
                                  : Math.max(1, Number(e.target.value) || 1)
                              )
                            }
                          />
                        </Form.Group>
                        <Form.Group>
                          <Form.Label className='mb-0'>
                            Offset X (px)
                          </Form.Label>
                          <Form.Control
                            type='number'
                            step={1}
                            value={offsetX}
                            onChange={(e) =>
                              setOffsetX(Number(e.target.value) || 0)
                            }
                          />
                        </Form.Group>
                        <Form.Group>
                          <Form.Label className='mb-0'>
                            Offset Y (px)
                          </Form.Label>
                          <Form.Control
                            type='number'
                            step={1}
                            value={offsetY}
                            onChange={(e) =>
                              setOffsetY(Number(e.target.value) || 0)
                            }
                          />
                        </Form.Group>
                      </div>
                    )}
                  </Form.Group>
                </div>

                {/* Right image column */}
                <div className='d-flex flex-column flex-grow-1 h-100 w-100'>
                  <Form.Group className='mt-3 h-100 w-100'>
                    <TaskBuffer
                      index={index}
                      setIndex={setIndex}
                      fetcher={fetcher}
                      preloadN={5}
                      historyN={5}
                      renderTask={(task) => (
                        <LightLocationView
                          {...task}
                          location={task.location}
                          overlay={{
                            enabled: overlayEnabled,
                            width: changeSize
                              ? customWidth || undefined
                              : undefined,
                            height: changeSize
                              ? customHeight || undefined
                              : undefined,
                            offsetX,
                            offsetY,
                          }}
                        />
                      )}
                    />
                  </Form.Group>
                  <div className='d-flex flex-column w-100 gap-2 pt-3'>
                    {currentCandidate && (
                      <a
                        className='btn btn-outline-info'
                        target='_blank'
                        href={`/surveys/${surveyId}/location/${
                          currentCandidate!.locationId
                        }/${currentCandidate!.annotationSetId}`}
                      >
                        Edit Location
                      </a>
                    )}
                    <Button
                      variant='success'
                      onClick={handleAdd}
                      disabled={
                        adding ||
                        !currentCandidate ||
                        (changeSize &&
                          (customWidth === '' || customHeight === '')) ||
                        addedLocations[
                          `${currentCandidate!.annotationSetId}_${
                            currentCandidate!.locationId
                          }`
                        ]
                      }
                    >
                      {adding
                        ? 'Adding...'
                        : addedLocations[
                            `${currentCandidate!.annotationSetId}_${
                              currentCandidate!.locationId
                            }`
                          ]
                        ? 'Added'
                        : 'Add to pool'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Body>
        <Footer>
          <Button variant='dark' onClick={() => onClose()}>
            Close
          </Button>
        </Footer>
      </Modal>
    </ProjectScope>
  );
}

function CategoryOptions({ annotationSetId }: { annotationSetId: string }) {
  const [cats, setCats] = useState<Schema['Category']['type'][]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const categories = (await fetchAllPaginatedResults(
        (client).models.Category.categoriesByAnnotationSetId,
        {
          annotationSetId,
          selectionSet: ['id', 'name', 'annotationSetId'] as const,
        }
      ));
      if (!cancelled) {
        setCats(
          categories
            ?.filter((c) => c.annotationSetId === annotationSetId)
            ?.sort((a, b) => a.name.localeCompare(b.name)) || []
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [annotationSetId]);
  return (
    <>
      {(Array.isArray(cats) ? (cats) : []).map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </>
  );
}
