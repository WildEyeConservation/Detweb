import { useEventCallback } from '../../shared/hooks/useLatestRef';
import type { Schema } from '../../shared/api/client-schema';
import { getErrorMessage } from '../../../amplify/shared/errorMessage';
import { useDialogGuard } from '../../shared/routing/useDialogGuard';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { Modal, Header, Title, Body, Footer } from '../../shared/components/Modal';
import { setCurrentAnnoCountAction, useCurrentAnnoCount } from '../tasks/taskStore';
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

export default function EditLocationsModal({ show, preset, surveyId, organizationId, onClose }: Props) {
  const currentAnnoCount = useCurrentAnnoCount();
  const setCurrentAnnoCount = setCurrentAnnoCountAction;
  const locationsRef = useRef<
    { testPresetId: string; locationId: string; annotationSetId: string }[]
  >([]);
  const locationIndexRef = useRef<number>(0);
  const [locations, setLocations] = useState<
    {
      testPresetId: string;
      locationId: string;
      annotationSetId: string;
    }[]
  >([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [maxAnnotations, setMaxAnnotations] = useState<number | ''>('');
  const [pendingCategoryId, setPendingCategoryId] = useState<string>('');
  const [pendingMaxAnnotations, setPendingMaxAnnotations] = useState<
    number | ''
  >('');
  const [removing, setRemoving] = useState(false);
  const [countSaves, setCountSaves] = useState(0);
  useDialogGuard({ busy: removing || countSaves > 0 });
  const currentLocation = useRef<{
    locationId: string;
    annotationSetId: string;
  } | null>(null);

  const fetcher: FetcherType<LocationReferenceTask> = useCallback(async () => {
    const loc = locationsRef.current[locationIndexRef.current];
    locationIndexRef.current = locationIndexRef.current + 1;
    const id = crypto.randomUUID();
    return {
      id,
      message_id: id,
      location: {
        id: loc.locationId,
        annotationSetId: loc.annotationSetId,
      },
    };
  }, []);

  const applyFilters = useCallback(() => {
    setSelectedCategoryId(pendingCategoryId);
    setMaxAnnotations(pendingMaxAnnotations || '');
  }, [pendingCategoryId, pendingMaxAnnotations]);

  const refreshLocations = useCallback(async () => {
    setLoading(true);
    setLoadedCount(0);
    const baseLocs = (await (fetchAllPaginatedResults)(
      (client).models.TestPresetLocation.locationsByTestPresetId,
      {
        testPresetId: preset.id,
        selectionSet: [
          'testPresetId',
          'locationId',
          'annotationSetId',
        ] as const,
        limit: 10000,
      }
    ));

    // If no filters, keep as-is
    if (
      !selectedCategoryId &&
      (maxAnnotations === '' || maxAnnotations == null)
    ) {
      locationsRef.current = baseLocs;
      setLocations(baseLocs);
      locationIndexRef.current = 0;
      setIndex(0);
      setLoading(false);
      return;
    }

    // Apply filters similar to AddLocationsModal
    const filtered: {
      testPresetId: string;
      locationId: string;
      annotationSetId: string;
    }[] = [];
    const seenIds = new Set<string>();
    for (const loc of baseLocs) {
      try {
        const { data: location } = await (client).models.Location.get({ id: loc.locationId }, { selectionSet: ['imageId', 'width', 'height', 'x', 'y'] as const });
        if (!location || location.width == null || location.height == null)
          continue;
        const anns = (await (fetchAllPaginatedResults)(
          (client).models.Annotation.annotationsByImageIdAndSetId,
          {
            imageId: location.imageId,
            setId: { eq: loc.annotationSetId },
            selectionSet: ['x', 'y', 'categoryId'] as const,
          }
        ));
        const minX = location.x - (location.width ?? 0) / 2;
        const minY = location.y - (location.height ?? 0) / 2;
        const maxX = location.x + (location.width ?? 0) / 2;
        const maxY = location.y + (location.height ?? 0) / 2;
        const inside = anns.filter(
          (a) => a.x >= minX && a.y >= minY && a.x <= maxX && a.y <= maxY
        );
        if (
          selectedCategoryId &&
          !inside.some((a) => a.categoryId === selectedCategoryId)
        ) {
          setLoadedCount((c) => c + 1);
          continue;
        }
        const limit = maxAnnotations === '' ? null : Number(maxAnnotations);
        if (limit != null && inside.length > limit) {
          setLoadedCount((c) => c + 1);
          continue;
        }
        filtered.push(loc);
        if (!seenIds.has(loc.locationId)) {
          seenIds.add(loc.locationId);
          setLoadedCount(seenIds.size);
        }
      } catch {
        // ignore errors per item
      }
    }

    locationsRef.current = filtered;
    setLocations(filtered);
    locationIndexRef.current = 0;
    setIndex(0);
    setLoading(false);
  }, [preset.id, selectedCategoryId, maxAnnotations]);

  useEffect(() => {
    if (show) refreshLocations();
    else {
      setLocations([]);
      setIndex(0);
    }
  }, [show, preset.id, refreshLocations]);

  useEffect(() => {
    if (show) {
      setPendingCategoryId(selectedCategoryId);
      setPendingMaxAnnotations(maxAnnotations);
    }
  }, [maxAnnotations, selectedCategoryId, show]);

  useEffect(() => {
    if (locations.length > 0) {
      const loc = locations[index];
      currentLocation.current = {
        locationId: loc.locationId,
        annotationSetId: loc.annotationSetId,
      };
    } else {
      currentLocation.current = null;
    }
  }, [index, locations]);

  async function handleRemove() {
    const loc = locations[index];
    if (!loc) return;
    setRemoving(true);
    try {
      await (client).models.TestPresetLocation.delete({
        testPresetId: preset.id,
        locationId: loc.locationId,
        annotationSetId: loc.annotationSetId,
      });
      await refreshLocations();
    } catch (error) {
      alert(error instanceof Error ? getErrorMessage(error) : "Unable to remove location.");
    } finally {
      setRemoving(false);
    }
  }
  const saveAnnotations = useEventCallback(async function saveAnnotations(cLocation: {
    locationId: string;
    annotationSetId: string;
  }) {
    setCountSaves((count) => count + 1);
    try {
      const { data: location } = await (client).models.Location.get({ id: cLocation.locationId }, { selectionSet: ['imageId', 'width', 'height', 'x', 'y'] as const });
      if (!location) return;

      const annotations = (await (fetchAllPaginatedResults)(
        (client).models.Annotation.annotationsByImageIdAndSetId,
        {
          imageId: location.imageId,
          setId: { eq: cLocation.annotationSetId },
          selectionSet: ['categoryId', 'x', 'y'] as const,
        }
      ));

      const boundsxy: [number, number][] = [
        [location.x - (location.width ?? 0) / 2, location.y - (location.height ?? 0) / 2],
        [location.x + (location.width ?? 0) / 2, location.y + (location.height ?? 0) / 2],
      ];

      const annotationCounts: Record<string, number> = {};
      for (const annotation of annotations) {
        const isWithin =
          annotation.x >= boundsxy[0][0] &&
          annotation.y >= boundsxy[0][1] &&
          annotation.x <= boundsxy[1][0] &&
          annotation.y <= boundsxy[1][1];

        if (isWithin) {
          annotationCounts[annotation.categoryId] =
            (annotationCounts[annotation.categoryId] || 0) + 1;
        }
      }

      for (const [categoryId, count] of Object.entries(annotationCounts)) {
        const { data: locationAnnotationCount } = await (
          client
        ).models.LocationAnnotationCount.get({
          locationId: cLocation.locationId,
          categoryId,
          annotationSetId: cLocation.annotationSetId,
        });

        if (locationAnnotationCount) {
          await (client).models.LocationAnnotationCount.update({
            locationId: cLocation.locationId,
            categoryId,
            annotationSetId: cLocation.annotationSetId,
            count,
          });
        } else {
          await (client).models.LocationAnnotationCount.create({
            locationId: cLocation.locationId,
            categoryId,
            annotationSetId: cLocation.annotationSetId,
            count,
            group: organizationId,
          });
        }
      }

      setCurrentAnnoCount({});
    } catch (error) {
      alert(error instanceof Error ? getErrorMessage(error) : 'Unable to save annotation counts.');
    } finally {
      setCountSaves((count) => count - 1);
    }
  });


  useEffect(() => {
    if (Object.keys(currentAnnoCount).length > 0 && currentLocation.current) {
      saveAnnotations(currentLocation.current);
    }
  }, [currentAnnoCount, saveAnnotations]);

  return (
    <ProjectScope projectId={surveyId}>
      <Modal show={show} strict={true}>
        <Header>
          <Title>Edit Locations for {preset.name}</Title>
        </Header>
        <Body>
          <div
            className='d-flex flex-column gap-3 px-3 pb-3 pt-0'
            style={{ height: '75vh' }}
          >
            {loading ? (
              <p className='d-flex align-items-center gap-2 p-2'>
                <Spinner animation='border' size='sm' /> {loadedCount} locations
                checked
              </p>
            ) : locations.length === 0 ? (
              <p>No locations in this preset.</p>
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
                        {locations[index] && (
                          <CategoryOptions
                            annotationSetId={locations[index].annotationSetId}
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
                        <LightLocationView {...task} location={task.location} />
                      )}
                    />
                  </Form.Group>
                  <div className='d-flex flex-column w-100 gap-2 pt-3'>
                    {locations[index] && (
                      <a
                        className='btn btn-outline-info'
                        target='_blank'
                        href={`/surveys/${surveyId}/location/${locations[index].locationId}/${locations[index].annotationSetId}`}
                      >
                        Edit Location
                      </a>
                    )}
                    <Button
                      variant='danger'
                      onClick={handleRemove}
                      disabled={removing}
                    >
                      {removing ? 'Removing...' : 'Remove from pool'}
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
