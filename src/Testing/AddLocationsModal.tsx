import {
  useState,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { GlobalContext } from '../Context';
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
  const candidatesRef = useRef<{
    annotationSetId: string;
    locationId: string;
  }[]>([]);
  const candidateIndexRef = useRef(0);
  const currentCandidate = candidates[index] ?? null;
  const [addedLocations, setAddedLocations] = useState<Record<string, boolean>>(
    {}
  );

  const Preloader = useMemo(() => PreloaderFactory(TaskSelector), []);

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

  const refreshCandidates = useCallback(async () => {
    setLoading(true);
    const existing = await fetchAllPaginatedResults(
      client.models.TestPresetLocation.locationsByTestPresetId,
      {
        testPresetId: preset.id,
        selectionSet: [
          'testPresetId',
          'locationId',
          'annotationSetId',
        ] as const,
      }
    ) as { testPresetId: string; locationId: string; annotationSetId: string }[];
    const presetKeys = new Set(
      existing.map((loc) => `${loc.annotationSetId}_${loc.locationId}`)
    );

    const annotationSets = await fetchAllPaginatedResults(
      client.models.AnnotationSet.annotationSetsByProjectId,
      {
        projectId: surveyId,
        selectionSet: ['id'] as const,
      }
    ) as { id: string }[];
    const allCandidates: { annotationSetId: string; locationId: string }[] = [];
    for (const as of annotationSets) {
      const observations = await fetchAllPaginatedResults(
        client.models.Observation.observationsByAnnotationSetId,
        {
          annotationSetId: as.id,
          filter: {
            annotationCount: { gt: 0 },
          },
          selectionSet: ['locationId', 'annotationSetId'] as const,
        }
      ) as { locationId: string; annotationSetId: string }[];
      for (const obs of observations) {
        const key = `${as.id}_${obs.locationId}`;
        if (!presetKeys.has(key)) {
          allCandidates.push({
            annotationSetId: as.id,
            locationId: obs.locationId,
          });
        }
      }
    }

    candidatesRef.current = allCandidates;
    setCandidates(allCandidates);
    candidateIndexRef.current = 0;
    setIndex(0);
    setLoading(false);
  }, [client, preset.id, surveyId]);

  useEffect(() => {
    if (show) {
      refreshCandidates();
    } else {
      candidatesRef.current = [];
      setCandidates([]);
      setIndex(0);
    }
  }, [show, preset.id, surveyId, refreshCandidates]);

  async function handleAdd() {
    const cand = currentCandidate;
    if (!cand) return;
    setAdding(true);
    await client.models.TestPresetLocation.create({
      testPresetId: preset.id,
      locationId: cand.locationId,
      annotationSetId: cand.annotationSetId,
    } as any);
    setAdding(false);
    setAddedLocations((prev) => ({
      ...prev,
      [`${cand.annotationSetId}_${cand.locationId}`]: true,
    }));
  }

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
            <p>Loading locations...</p>
          ) : candidates.length === 0 ? (
            <p>No available locations to add.</p>
          ) : (
            <>
              <Form.Group className='mt-3 h-100 w-100'>
                <Preloader
                  index={index}
                  setIndex={setIndex}
                  fetcher={fetcher}
                  preloadN={2}
                  historyN={2}
                />
              </Form.Group>
              <Button
                variant='success'
                onClick={handleAdd}
                disabled={
                  adding ||
                  !currentCandidate ||
                  addedLocations[
                    `${currentCandidate!.annotationSetId}_${currentCandidate!.locationId}`
                  ]
                }
              >
                {adding
                  ? 'Adding...'
                  : addedLocations[
                      `${currentCandidate!.annotationSetId}_${currentCandidate!.locationId}`
                    ]
                  ? 'Added'
                  : 'Add to pool'}
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
