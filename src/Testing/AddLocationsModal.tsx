import {
  useState,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import { GlobalContext } from '../Context';
import { fetchAllPaginatedResults } from '../utils';
import { FetcherType, PreloaderFactory } from '../Preloader';
import LightLocationView from './LightLocationView';
import ProjectContext from './ProjectContext';

type Props = {
  show: boolean;
  onClose: () => void;
  preset: { id: string; name: string };
  surveyId: string;
};

export default function AddLocationsModal({
  show,
  onClose,
  preset,
  surveyId,
}: Props) {
  const { client } = useContext(GlobalContext)!;
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
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
  const candidatesRef = useRef<
    {
      annotationSetId: string;
      locationId: string;
    }[]
  >([]);
  const candidateIndexRef = useRef(0);
  const currentCandidate = candidates[index] ?? null;
  const [addedLocations, setAddedLocations] = useState<Record<string, boolean>>(
    {}
  );
  const lastAddedRef = useRef<{
    annotationSetId: string;
    locationId: string;
  } | null>(null);

  const Preloader = useMemo(() => PreloaderFactory(LightLocationView), []);

  const fetcher: FetcherType = useCallback(async () => {
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
      const existingRaw: any[] = await (fetchAllPaginatedResults as any)(
        (client as any).models.TestPresetLocation.locationsByTestPresetId,
        {
          testPresetId: preset.id,
          selectionSet: ['locationId', 'annotationSetId'] as const,
          limit: 1000,
        }
      );
      const presetKeys = new Set(
        existingRaw.map(
          (loc: any) => `${loc.annotationSetId}_${loc.locationId}`
        )
      );

      // Get all annotation sets for the project
      const annotationSets = (await fetchAllPaginatedResults(
        (client as any).models.AnnotationSet.annotationSetsByProjectId,
        {
          projectId: surveyId,
          selectionSet: ['id'] as const,
        }
      )) as any[];

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
          (client as any).models.Observation.observationsByAnnotationSetId,
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
            limit: 1000,
          },
          updateObservationCount
        )) as any[];
        return observations;
      });

      // Wait for all observation queries to complete
      const observationResults = await Promise.all(observationPromises);
      const allObservations = observationResults.flat();

      // OPTIMIZATION 2: Group observations by image to batch annotation queries
      const imageGroups = new Map<string, any[]>();
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
            (client as any).models.Annotation.annotationsByImageIdAndSetId,
            {
              imageId,
              setId: { eq: annotationSetId },
              selectionSet: ['x', 'y', 'categoryId'] as const,
              limit: 1000,
            }
          )) as any[];

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
            (ann: any) =>
              ann.x >= minX && ann.y >= minY && ann.x <= maxX && ann.y <= maxY
          );

          // Apply category filter
          if (
            categoryId &&
            !inside.some((a: any) => a.categoryId === categoryId)
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

      candidatesRef.current = allCandidates.filter(
        (cand, i, arr) =>
          arr.findIndex((c) => c.locationId === cand.locationId) === i
      );

      setCandidates(allCandidates);
      candidateIndexRef.current = 0;
      setIndex(0);
      setLoading(false);
    },
    [client, preset.id, surveyId]
  );

  useEffect(() => {
    if (show) {
      refreshCandidates(selectedCategoryId, maxAnnotations);
    } else {
      candidatesRef.current = [];
      setCandidates([]);
      setIndex(0);
    }
  }, [show, preset.id, surveyId]);

  useEffect(() => {
    if (show) {
      setPendingCategoryId(selectedCategoryId);
      setPendingMaxAnnotations(maxAnnotations);
    }
  }, [show]);

  const applyFilters = useCallback(() => {
    setSelectedCategoryId(pendingCategoryId);
    setMaxAnnotations(pendingMaxAnnotations || '');
    refreshCandidates(pendingCategoryId, pendingMaxAnnotations);
  }, [pendingCategoryId, pendingMaxAnnotations, refreshCandidates]);

  async function saveAnnotations(cand: {
    annotationSetId: string;
    locationId: string;
  }) {
    // mirror EditLocationsModal saveAnnotations logic
    // @ts-ignore
    const { data: location } = await client.models.Location.get({
      id: cand.locationId,
      selectionSet: ['imageId', 'width', 'height', 'x', 'y'] as const,
    } as any);
    if (!location) return;
    const annotations = (await fetchAllPaginatedResults(
      // @ts-ignore: complex union types from generated client
      (client as any).models.Annotation.annotationsByImageIdAndSetId,
      {
        imageId: location.imageId,
        setId: { eq: cand.annotationSetId },
        selectionSet: ['categoryId', 'x', 'y'] as const,
        limit: 1000,
      }
    )) as any[];
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
      // @ts-ignore: complex union types from generated client
      const { data: lac } = await (
        client as any
      ).models.LocationAnnotationCount.get({
        locationId: cand.locationId,
        categoryId,
        annotationSetId: cand.annotationSetId,
      });
      if (lac) {
        // @ts-ignore: complex union types from generated client
        await (client as any).models.LocationAnnotationCount.update({
          locationId: cand.locationId,
          categoryId,
          annotationSetId: cand.annotationSetId,
          count,
        });
      } else {
        // @ts-ignore: complex union types from generated client
        await (client as any).models.LocationAnnotationCount.create({
          locationId: cand.locationId,
          categoryId,
          annotationSetId: cand.annotationSetId,
          count,
        });
      }
    }
  }

  async function handleAdd() {
    const cand = currentCandidate;
    if (!cand) return;
    setAdding(true);
    // @ts-ignore
    await client.models.TestPresetLocation.create({
      testPresetId: preset.id,
      locationId: cand.locationId,
      annotationSetId: cand.annotationSetId,
    });
    // mark for effect
    lastAddedRef.current = cand;
    setAddedLocations((prev) => ({
      ...prev,
      [`${cand.annotationSetId}_${cand.locationId}`]: true,
    }));
    setAdding(false);
  }

  useEffect(() => {
    if (lastAddedRef.current) {
      saveAnnotations(lastAddedRef.current);
      lastAddedRef.current = null;
    }
  }, [addedLocations]);

  return (
    <ProjectContext surveyId={surveyId}>
      <Modal show={show} onHide={onClose} size='xl'>
        <Modal.Header closeButton>
          <Modal.Title>Add Locations to {preset.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body
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
            <>
              <Form.Group className='d-flex flex-row align-items-end gap-3 border-bottom pb-3 border-dark pt-2'>
                <Form.Group>
                  <Form.Label className='mb-0'>Label filter</Form.Label>
                  <Form.Select
                    value={pendingCategoryId}
                    onChange={(e) => setPendingCategoryId(e.target.value)}
                  >
                    <option value=''>All labels</option>
                    {/* options loaded lazily below via current candidate's annotationSetId */}
                    {currentCandidate && (
                      // @ts-ignore: will be re-evaluated as index changes
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
              <Form.Group className='mt-3 h-100 w-100'>
                <Preloader
                  index={index}
                  setIndex={setIndex}
                  fetcher={fetcher}
                  preloadN={5}
                  historyN={5}
                />
              </Form.Group>
              <div className='d-flex flex-column w-100 gap-2'>
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
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant='dark' onClick={onClose}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </ProjectContext>
  );
}

function CategoryOptions({ annotationSetId }: { annotationSetId: string }) {
  const { client } = useContext(GlobalContext)!;
  const [cats, setCats] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const categories = (await fetchAllPaginatedResults(
        // @ts-ignore: complex union types from generated client
        (client as any).models.Category.categoriesByAnnotationSetId,
        {
          annotationSetId,
          selectionSet: ['id', 'name', 'annotationSetId'] as const,
        }
      )) as any[];
      if (!cancelled) {
        setCats(
          categories
            ?.filter((c: any) => c.annotationSetId === annotationSetId)
            ?.sort((a: any, b: any) => a.name.localeCompare(b.name)) || []
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [annotationSetId]);
  return (
    <>
      {(Array.isArray(cats) ? (cats as any[]) : []).map((c: any) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </>
  );
}
