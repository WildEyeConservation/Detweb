import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { GlobalContext, UserContext } from '../Context';
import { fetchAllPaginatedResults } from '../utils';
import { FetcherType, PreloaderFactory } from '../Preloader';
import { TaskSelector } from '../TaskSelector';
import ProjectContext from './ProjectContext';

type Props = {
  show: boolean;
  onClose: () => void;
  preset: { id: string; name: string };
  surveyId: string;
};

export default function EditLocationsModal({ show, onClose, preset, surveyId }: Props) {
  const { client } = useContext(GlobalContext)!;
  const { currentAnnoCount, setCurrentAnnoCount } = useContext(UserContext)!;
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
  const Preloader = useMemo(() => PreloaderFactory(TaskSelector), []);
  const fetcher: FetcherType = useCallback(async () => {
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
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const currentLocation = useRef<{ locationId: string; annotationSetId: string } | null>(null);

  const refreshLocations = useCallback(async () => {
    setLoading(true);
    const locs = await fetchAllPaginatedResults(
      client.models.TestPresetLocation.locationsByTestPresetId,
      {
        testPresetId: preset.id,
        selectionSet: [
          'testPresetId',
          'locationId',
          'annotationSetId',
        ] as const,
      }
    );
    locationsRef.current = locs;
    setLocations(locs);
    locationIndexRef.current = 0;
    setIndex(0);
    setLoading(false);
  }, [client, preset.id]);

  useEffect(() => {
    if (show) refreshLocations();
    else { setLocations([]); setIndex(0); }
  }, [show, preset.id, refreshLocations]);

  useEffect(() => {
    if (locations.length > 0) {
      const loc = locations[index];
      currentLocation.current = { locationId: loc.locationId, annotationSetId: loc.annotationSetId };
    } else {
      currentLocation.current = null;
    }
  }, [index, locations]);

  async function handleRemove() {
    const loc = locations[index];
    if (!loc) return;
    setRemoving(true);
    await client.models.TestPresetLocation.delete({
      testPresetId: preset.id,
      locationId: loc.locationId,
      annotationSetId: loc.annotationSetId,
    });
    await refreshLocations();
    setRemoving(false);
  }

  async function saveAnnotations(cLocation: { locationId: string; annotationSetId: string }) {
    const { data: location } = await client.models.Location.get({
      id: cLocation.locationId,
      selectionSet: ['imageId', 'width', 'height', 'x', 'y'] as const,
    });

    const annotations = await fetchAllPaginatedResults(
      client.models.Annotation.annotationsByImageIdAndSetId,
      {
        imageId: location!.imageId,
        setId: { eq: cLocation.annotationSetId },
        selectionSet: ['categoryId', 'x', 'y'] as const,
      }
    );

    const boundsxy: [number, number][] = [
      [location!.x - location!.width / 2, location!.y - location!.height / 2],
      [location!.x + location!.width / 2, location!.y + location!.height / 2],
    ];

    const annotationCounts: { [key: string]: number } = {};
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
      const { data: locationAnnotationCount } =
        await client.models.LocationAnnotationCount.get({
          locationId: cLocation.locationId,
          categoryId,
          annotationSetId: cLocation.annotationSetId,
        });

      if (locationAnnotationCount) {
        await client.models.LocationAnnotationCount.update({
          locationId: cLocation.locationId,
          categoryId,
          annotationSetId: cLocation.annotationSetId,
          count,
        });
      } else {
        await client.models.LocationAnnotationCount.create({
          locationId: cLocation.locationId,
          categoryId,
          annotationSetId: cLocation.annotationSetId,
          count,
        });
      }
    }

    setCurrentAnnoCount({});
  }

  useEffect(() => {
    if (Object.keys(currentAnnoCount).length > 0 && currentLocation.current) {
      saveAnnotations(currentLocation.current);
    }
  }, [currentAnnoCount]);

  return (
    <ProjectContext surveyId={surveyId}>
      <Modal show={show} onHide={onClose} size='xl'>
        <Modal.Header closeButton>
          <Modal.Title>Edit Locations for {preset.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body className='d-flex flex-column gap-3 px-3 pb-3 pt-0' style={{ height: '75vh' }}>
          {loading ? (
            <p>Loading locations...</p>
          ) : locations.length === 0 ? (
            <p>No locations in this preset.</p>
          ) : (
            <>
              <Form.Group className='mt-3 h-100 w-100' >
                <Preloader
                  index={index}
                  setIndex={setIndex}
                  fetcher={fetcher}
                  preloadN={2}
                  historyN={2}
                />
              </Form.Group>
              <Button
                variant='danger'
                onClick={handleRemove}
                disabled={removing}
              >
                {removing ? 'Removing...' : 'Remove from pool'}
              </Button>
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
