import { useState, useMemo, useContext, useCallback, useEffect } from 'react';
import { AnnotationSetDropdown } from './AnnotationSetDropDown';
import Select from 'react-select';
import { Card, Button, Form, Alert, ProgressBar, Badge } from 'react-bootstrap';
import { ProjectContext, GlobalContext, UserContext } from './Context';
import { ManagementContext } from './Context';
import { useOptimisticUpdates } from './useOptimisticUpdates';
import { Schema } from './amplify/client-schema';
import { useQueries } from '@tanstack/react-query';
import { makeTransform, array2Matrix } from './utils';
import { inv } from 'mathjs';
import { RegisterPair } from './RegisterPair';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PanelBottom } from 'lucide-react';
import { ManualHomographyEditor } from './ManualHomographyEditor';

const HEARTBEAT_INTERVAL_MS = 1000 * 60 * 5;
const STALE_THRESHOLD_MS = 1000 * 60 * 30;

function categorySelectionsEqual(
  a: { label: string; value: string }[],
  b: { label: string; value: string }[]
) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].value !== b[i].value) return false;
  }
  return true;
}

function homographyQueuesEqual(
  a: {
    primary: Schema['Image']['type'];
    secondary: Schema['Image']['type'];
    neighbour: { noHomography: boolean };
  }[],
  b: {
    primary: Schema['Image']['type'];
    secondary: Schema['Image']['type'];
    neighbour: { noHomography: boolean };
  }[]
) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].primary.id !== b[i].primary.id ||
      a[i].secondary.id !== b[i].secondary.id
    ) {
      return false;
    }
  }
  return true;
}

type RegistrationAssignment = Schema['RegistrationAssignment']['type'];

type RegistrationJob = Schema['RegistrationJob']['type'] & {
  annotationSet?: {
    id: string;
    name: string;
  } | null;
};

export function Registration({ showAnnotationSetDropdown = true }) {
  const { client } = useContext(GlobalContext)!;
  const { user } = useContext(UserContext)!;
  const navigate = useNavigate();
  const { annotationSetId } = useParams();
  const [searchParams] = useSearchParams();
  const transectIdFromUrl = searchParams.get('transect') ?? undefined;
  const [selectedCategories, setSelectedCategories] = useState<
    { label: string; value: string }[]
  >([]);
  const [selectedAnnotationSet, setSelectedAnnotationSet] =
    useState<string>('');
  const {
    categoriesHook: { data: categories },
    project,
  } = useContext(ProjectContext)!;
  const {
    annotationSetsHook: { data: annotationSets },
  } = useContext(ManagementContext)!;
  const [activePair, setActivePair] = useState<{
    primary: string;
    secondary: string;
    annotations: Schema['Annotation']['type'][];
  } | null>(null);
  const [numLoaded, setNumLoaded] = useState(0);
  const [showFilters, setShowFilters] = useState(true);
  const [points1, setPoints1] = useState<
    { id: string; x: number; y: number }[]
  >([]);
  const [points2, setPoints2] = useState<
    { id: string; x: number; y: number }[]
  >([]);
  const [localTransforms, setLocalTransforms] = useState<
    Record<string, ((c: [number, number]) => [number, number])[]>
  >({});
  const [registrationJob, setRegistrationJob] =
    useState<RegistrationJob | null>(null);
  const [assignment, setAssignment] = useState<RegistrationAssignment | null>(
    null
  );
  const [heartbeatTimer, setHeartbeatTimer] = useState<NodeJS.Timeout | null>(
    null
  );
  const [completionHandled, setCompletionHandled] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [homographyQueue, setHomographyQueue] = useState<
    {
      primary: Schema['Image']['type'];
      secondary: Schema['Image']['type'];
      neighbour: { noHomography: boolean };
    }[]
  >([]);
  const [currentHomographyIndex, setCurrentHomographyIndex] = useState(0);
  const currentHomographyPair = homographyQueue[currentHomographyIndex];
  const hasHomographyPairs = homographyQueue.length > 0;

  const subscriptionFilter = useMemo(
    () => ({ filter: { setId: { eq: selectedAnnotationSet } } }),
    [selectedAnnotationSet]
  );
  // annotations contains an array of annotations in the selected annotation set, that is kept updated.
  const annotationHook = useOptimisticUpdates<
    Schema['Annotation']['type'],
    'Annotation'
  >(
    'Annotation',
    async (nextToken) =>
      client.models.Annotation.annotationsByAnnotationSetId(
        { setId: selectedAnnotationSet },
        { nextToken }
      ),
    subscriptionFilter,
    setNumLoaded
  );

  const annotations = annotationHook.data;

  // selectedCategoryIDs contains the ids of the selected categories.
  const selectedCategoryIDs = useMemo(
    () => selectedCategories.map((c) => c.value),
    [selectedCategories]
  );

  // annotationsByImage contains a map of image ids to their annotations.
  const annotationsByImage = useMemo(() => {
    return annotations
      ?.filter((a) => selectedCategoryIDs.includes(a.categoryId))
      .reduce((acc, a) => {
        const acc2 = acc[a.imageId] || [];
        acc[a.imageId] = [...acc2, a];
        return acc;
      }, {} as Record<string, Annotation[]>);
  }, [annotations, selectedCategories]);

  // imageNeighboursQueries contains a list of queries that fetch the neighbours of each image represented in annotationsByImage.
  const imageNeighboursQueries = useQueries({
    queries: Object.keys(annotationsByImage || {}).map((imageId) => ({
      queryKey: ['imageNeighbours', imageId],
      queryFn: async () => {
        const { data: n1 } =
          await client.models.ImageNeighbour.imageNeighboursByImage1key({
            image1Id: imageId,
          });
        const { data: n2 } =
          await client.models.ImageNeighbour.imageNeighboursByImage2key({
            image2Id: imageId,
          });
        return [...n1, ...n2];
      },
      staleTime: Infinity, // Data will never become stale automatically
      cacheTime: 1000 * 60 * 60, // Cache for 1 hour
    })),
  });

  // imageNeighbours contains a two level map to easily find the transform from imageA to imageB
  // tf = imageNeighbours[imageA][imageB].tf
  // It contains each transform (and its inverse) represented in imageNeighboursQueries.
  const imageNeighbours = useMemo(() => {
    return imageNeighboursQueries
      .filter((query) => query.isSuccess)
      .reduce((acc, query) => {
        const neighbours = query.data as Schema['ImageNeighbour']['type'][];
        const defaultHomography = [1, 0, 0, 0, 1, 0, 0, 0, 1];
        neighbours.forEach((n) => {
          const hasCustomHomography = n.homography?.length === 9;
          const rawH = hasCustomHomography ? n.homography! : defaultHomography;
          const M = array2Matrix(rawH);

          const acc2 = acc[n.image1Id] || {};
          acc[n.image1Id] = {
            ...acc2,
            [n.image2Id]: {
              tf: makeTransform(M),
              noHomography: !hasCustomHomography,
              raw: rawH,
            },
          };
          const acc3 = acc[n.image2Id] || {};
          acc[n.image2Id] = {
            ...acc3,
            [n.image1Id]: {
              tf: makeTransform(inv(M)),
              noHomography: !hasCustomHomography,
              raw: rawH,
            },
          };
        });
        return acc;
      }, {} as Record<string, Record<string, { tf: Transform; noHomography: boolean; raw: number[] }>>);
  }, [imageNeighboursQueries]);

  // imageMetaDataQueries contains a list of queries that fetch the metadata of each relevant image (contains annotations or has overlap with an image that has annotations).
  const imageMetaDataQueries = useQueries({
    queries: Object.keys(imageNeighbours || {})?.map((imageId) => ({
      queryKey: ['imageMetaData', imageId],
      queryFn: () => {
        return client.models.Image.get({ id: imageId });
      },
      staleTime: Infinity, // Data will never become stale automatically
      cacheTime: 1000 * 60 * 60, // Cache for 1 hour
    })),
  });

  // imageMetaData contains a map of image ids to their metadata.
  const imageMetaData = useMemo(() => {
    // First check if all queries are successfull
    if (imageMetaDataQueries.some((query) => !query.isSuccess)) {
      return {};
    }
    return imageMetaDataQueries
      .filter((query) => query.isSuccess)
      .reduce((acc, { data: { data } }) => {
        acc[data.id] = data;
        return acc;
      }, {} as Record<string, Image>);
  }, [imageMetaDataQueries]);

  // targetData contains a list of images sorted by timestamp, and for each image, a list of its neighbours sorted by timestamp.
  const targetData = useMemo(() => {
    return Object.keys(annotationsByImage || {})
      ?.sort((a, b) => {
        const aImage = imageMetaData[a];
        const bImage = imageMetaData[b];
        return (aImage?.timestamp ?? 0) - (bImage?.timestamp ?? 0);
      })
      ?.map((i) => {
        const neighbours = Object.keys(imageNeighbours?.[i] || {})?.sort(
          (a, b) => {
            const aImage = imageMetaData[a];
            const bImage = imageMetaData[b];
            return (aImage?.timestamp ?? 0) - (bImage?.timestamp ?? 0);
          }
        );
        return {
          id: i,
          neighbours: neighbours.map((n) => ({
            id: n,
          })),
        };
      });
  }, [imageMetaData, imageNeighbours, annotations]);

  const pairToRegister = useMemo(() => {
    for (const t of targetData) {
      const annotationsPrimary = annotationsByImage[t.id];
      for (const n of t.neighbours) {
        const tf = imageNeighbours[t.id][n.id].tf;
        const annotationsSecondary = annotationsByImage[n.id]?.map(
          (a) => a.objectId
        );
        const width = imageMetaData[n.id]?.width;
        const height = imageMetaData[n.id]?.height;
        const annotationsToLink = annotationsPrimary
          // Only keep annotations that are not allready matched to some object in the secondary image
          ?.filter((a) =>
            a.objectId ? !annotationsSecondary?.includes(a.objectId) : true
          )
          // And that map to some point inside the secondary image
          ?.filter((a) => {
            const transformed = tf([a.x, a.y]);
            return (
              transformed[0] >= 0 &&
              transformed[1] >= 0 &&
              transformed[0] < width &&
              transformed[1] < height
            );
          });
        if (annotationsToLink.length > 0) {
          return {
            primary: t.id,
            secondary: n.id,
            annotations: annotationsToLink,
          };
        }
      }
    }
  }, [targetData, annotationsByImage, imageNeighbours, imageMetaData]);

  const nextPair = useCallback(() => {
    setActivePair(pairToRegister ?? null);
  }, [pairToRegister]);

  useEffect(() => {
    if (!activePair && pairToRegister) {
      setActivePair(pairToRegister);
    }
  }, [activePair, pairToRegister]);
  // Clear activePair when no items left to register
  useEffect(() => {
    if (!pairToRegister) {
      setActivePair(null);
    }
  }, [pairToRegister]);

  // Move to next pair when current pair is no longer valid
  useEffect(() => {
    if (
      activePair &&
      pairToRegister &&
      (activePair.primary !== pairToRegister.primary ||
        activePair.secondary !== pairToRegister.secondary)
    ) {
      nextPair();
    }
  }, [activePair, pairToRegister, nextPair]);

  const homographyCandidates = useMemo(() => {
    if (!registrationJob) return [];
    const result: {
      primary: Schema['Image']['type'];
      secondary: Schema['Image']['type'];
      neighbour: { noHomography: boolean };
    }[] = [];
    for (const t of targetData) {
      const annotationsPrimary = annotationsByImage[t.id];
      if (!annotationsPrimary?.length) continue;
      for (const n of t.neighbours) {
        const neighbourInfo = imageNeighbours[t.id]?.[n.id];
        if (!neighbourInfo || !neighbourInfo.noHomography) continue;
        const annotationsSecondary = annotationsByImage[n.id];
        if (!annotationsSecondary?.length) continue;
        const imageA = imageMetaData[t.id];
        const imageB = imageMetaData[n.id];
        if (!imageA || !imageB) continue;
        result.push({
          primary: imageA,
          secondary: imageB,
          neighbour: neighbourInfo,
        });
      }
    }
    return result;
  }, [
    targetData,
    annotationsByImage,
    imageNeighbours,
    imageMetaData,
    registrationJob,
  ]);

  useEffect(() => {
    setHomographyQueue((prev) =>
      homographyQueuesEqual(prev, homographyCandidates)
        ? prev
        : homographyCandidates
    );
    setCurrentHomographyIndex(0);
  }, [homographyCandidates]);

  useEffect(() => {
    if (wizardStep === 1 && homographyQueue.length === 0) {
      setWizardStep((prev) => (prev === 1 ? 2 : prev));
    }
  }, [wizardStep, homographyQueue.length]);

  useEffect(() => {
    if (
      wizardStep === 1 &&
      homographyQueue.length > 0 &&
      currentHomographyIndex > homographyQueue.length - 1
    ) {
      setWizardStep((prev) => (prev === 1 ? 2 : prev));
    }
  }, [wizardStep, currentHomographyIndex, homographyQueue.length]);

  const buildCategorySelection = useCallback(
    (
      ids: string[] | null | undefined,
      names: (string | null)[] | null | undefined
    ) => {
      if (!ids?.length) return [];
      return ids.map((id, index) => {
        const cat = categories?.find((c) => c.id === id);
        const nameFromHook = cat?.name;
        const fallbackName = names?.[index] ?? id;
        return {
          value: id,
          label: nameFromHook ?? fallbackName,
        };
      });
    },
    [categories]
  );

  useEffect(() => {
    async function ensureRegistrationContext() {
      const annotationSetToUse = annotationSetId ?? selectedAnnotationSet;
      if (!annotationSetToUse) return;

      const { data: job } = (await client.models.RegistrationJob.get({
        annotationSetId: annotationSetToUse,
      })) as { data: RegistrationJob | null };

      if (!job) {
        navigate(`/surveys/${project.id}`);
        return;
      }

      setRegistrationJob(job);
      if (!selectedAnnotationSet) {
        setSelectedAnnotationSet(annotationSetToUse);
      }

      const defaultSelection = buildCategorySelection(
        job.categoryIds,
        job.categoryNames
      );
      if (defaultSelection.length) {
        setSelectedCategories(defaultSelection);
      }

      if (job.mode === 'per-transect') {
        const transectId = transectIdFromUrl;
        if (!transectId) {
          navigate(`/surveys/${project.id}/jobs`, { replace: true });
          return;
        }
        const assignmentRecord = await client.models.RegistrationAssignment.get(
          {
            registrationJobId: annotationSetToUse,
            transectId,
          }
        );
        if (!assignmentRecord.data) {
          navigate(`/surveys/${project.id}/jobs`, { replace: true });
          return;
        }
        const lastHeartbeat = assignmentRecord.data.lastHeartbeatAt
          ? new Date(assignmentRecord.data.lastHeartbeatAt).getTime()
          : 0;
        if (
          assignmentRecord.data.assignedUserId &&
          assignmentRecord.data.assignedUserId !== user.userId &&
          Date.now() - lastHeartbeat < STALE_THRESHOLD_MS
        ) {
          alert('This transect is currently assigned to another user.');
          navigate(`/surveys/${project.id}/jobs`, { replace: true });
          return;
        }
        setAssignment(assignmentRecord.data);
      } else {
        setAssignment(null);
      }
    }

    ensureRegistrationContext();
  }, [
    annotationSetId,
    selectedAnnotationSet,
    client.models,
    categories,
    project.id,
    transectIdFromUrl,
    navigate,
    user.userId,
    buildCategorySelection,
  ]);

  useEffect(() => {
    if (annotationSetId && !showAnnotationSetDropdown) {
      setSelectedAnnotationSet(annotationSetId);
    }
  }, [annotationSetId, showAnnotationSetDropdown]);

  useEffect(() => {
    const selection = registrationJob?.categoryIds?.length
      ? buildCategorySelection(
          registrationJob.categoryIds,
          registrationJob.categoryNames
        )
      : [];

    setSelectedCategories((prev) =>
      categorySelectionsEqual(prev, selection) ? prev : selection
    );
  }, [registrationJob, buildCategorySelection]);

  useEffect(() => {
    setPoints1([]);
    setPoints2([]);
  }, [activePair?.primary, activePair?.secondary]);

  useEffect(() => {
    if (!registrationJob) return;

    async function sendHeartbeat() {
      const nowIso = new Date().toISOString();
      if (registrationJob.mode === 'per-transect' && assignment) {
        await client.models.RegistrationAssignment.update({
          registrationJobId: assignment.registrationJobId,
          transectId: assignment.transectId,
          assignedUserId: user.userId,
          lastHeartbeatAt: nowIso,
          status: 'active',
        });
      } else {
        await client.models.RegistrationJob.update({
          annotationSetId: registrationJob.annotationSetId,
          assignedUserId: user.userId,
          lastHeartbeatAt: nowIso,
          status: 'active',
        });
      }
    }

    sendHeartbeat();
    const timer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    setHeartbeatTimer(timer);

    return () => {
      clearInterval(timer);
      setHeartbeatTimer(null);
    };
  }, [registrationJob, assignment, client.models, user.userId]);

  useEffect(() => {
    return () => {
      if (!registrationJob || wizardStep === 1) return;
      (async () => {
        if (completionHandled) return;
        if (registrationJob.mode === 'per-transect' && assignment) {
          await client.models.RegistrationAssignment.update({
            registrationJobId: assignment.registrationJobId,
            transectId: assignment.transectId,
            assignedUserId: null,
            status: 'available',
          });
        } else {
          await client.models.RegistrationJob.update({
            annotationSetId: registrationJob.annotationSetId,
            assignedUserId: null,
          });
        }
      })();
    };
  }, [
    registrationJob,
    assignment,
    client.models,
    completionHandled,
    wizardStep,
  ]);

  const shouldShowFilters = showAnnotationSetDropdown;
  const readOnlyFilters = registrationJob?.categoryIds?.length;
  const homographyPairKey = currentHomographyPair
    ? `${currentHomographyPair.primary.id}::${currentHomographyPair.secondary.id}`
    : null;

  const needsManualHomographyEditor = Boolean(
    wizardStep === 1 && currentHomographyPair
  );

  const pairKey = activePair
    ? `${activePair.primary}::${activePair.secondary}`
    : '';

  // wizard navigation handlers
  function gotoNextHomographyPair() {
    setPoints1([]);
    setPoints2([]);
    setCurrentHomographyIndex((prev) =>
      Math.min(prev + 1, homographyQueue.length)
    );
  }

  function skipHomographyPair() {
    if (
      window.confirm('Skip fixing this homography? You can return to it later.')
    ) {
      gotoNextHomographyPair();
    }
  }

  useEffect(() => {
    if (
      wizardStep === 1 &&
      currentHomographyIndex >= homographyQueue.length &&
      homographyQueue.length > 0
    ) {
      setWizardStep(2);
    }
  }, [wizardStep, currentHomographyIndex, homographyQueue.length]);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1555px',
        paddingTop: '16px',
        paddingBottom: '16px',
        height: '100%',
      }}
    >
      <div className="d-flex flex-column gap-3 mb-3">
        <div className="d-flex align-items-center gap-3">
          <h5 className="mb-0">Registration Wizard</h5>
          <Badge bg={wizardStep === 1 ? 'primary' : 'secondary'}>
            Step 1: Homographies
          </Badge>
          <Badge bg={wizardStep === 2 ? 'primary' : 'secondary'}>
            Step 2: Registration
          </Badge>
        </div>
        {wizardStep === 1 && (
          <ProgressBar
            now={
              wizardStep === 1
                ? homographyQueue.length === 0
                  ? 100
                  : (currentHomographyIndex / homographyQueue.length) * 100
                : 100
            }
            label={
              wizardStep === 1
                ? `Homographies ${Math.min(
                    currentHomographyIndex + 1,
                    homographyQueue.length
                  )} / ${homographyQueue.length}`
                : 'Complete'
            }
          />
        )}
      </div>

      <div className="w-100 h-100 d-flex flex-column flex-md-row gap-3">
        {wizardStep === 1 && (
          <div
            className="d-flex flex-column gap-2"
            style={{ maxWidth: '360px', width: '100%' }}
          >
            <Card className="w-100">
              <Card.Header>
                <Card.Title className="mb-0">Homography Prep</Card.Title>
              </Card.Header>
              <Card.Body className="d-flex flex-column gap-3">
                {homographyQueue.length === 0 ? (
                  <Alert variant="success" className="mb-0">
                    All relevant homographies are set.
                  </Alert>
                ) : (
                  <>
                    <p className="mb-0">
                      Fix homographies for the listed image pairs before
                      registering annotations.
                    </p>
                    <div className="d-flex flex-column gap-2">
                      <p className="mb-0">
                        Pairs remaining:{' '}
                        {homographyQueue.length - currentHomographyIndex}
                      </p>
                      {currentHomographyPair ? (
                        <div>
                          <p className="mb-2">Current pair:</p>
                          <div className="d-flex flex-column gap-1">
                            <small className="text-muted">
                              Image A:{' '}
                              {currentHomographyPair.primary.originalPath ??
                                currentHomographyPair.primary.id}
                            </small>
                            <small className="text-muted">
                              Image B:{' '}
                              {currentHomographyPair.secondary.originalPath ??
                                currentHomographyPair.secondary.id}
                            </small>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="d-flex gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          setPoints1([]);
                          setPoints2([]);
                        }}
                      >
                        Reset Points
                      </Button>
                      <Button
                        size="sm"
                        variant="warning"
                        onClick={skipHomographyPair}
                      >
                        Skip Pair
                      </Button>
                      {currentHomographyIndex >= homographyQueue.length - 1 && (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => setWizardStep(2)}
                        >
                          Continue to Step 2
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </Card.Body>
            </Card>
          </div>
        )}
        <div className="d-flex flex-column align-items-center h-100 w-100">
          {wizardStep === 1 ? (
            homographyQueue.length === 0 ? (
              <div className="text-center w-100">
                <Alert variant="success">
                  No homography issues detected. Proceed to registration.
                </Alert>
                <Button variant="primary" onClick={() => setWizardStep(2)}>
                  Go to Step 2
                </Button>
              </div>
            ) : currentHomographyIndex >= homographyQueue.length ? (
              <div className="text-center w-100">
                <Alert variant="info">
                  No more pairs to fix. Proceed to the next step.
                </Alert>
                <Button variant="primary" onClick={() => setWizardStep(2)}>
                  Go to Step 2
                </Button>
              </div>
            ) : currentHomographyPair ? (
              <div className="w-100 d-flex flex-column gap-3">
                <Card>
                  <Card.Header>
                    <Card.Title className="mb-0">
                      Manual Homography Editor
                    </Card.Title>
                  </Card.Header>
                  <Card.Body>
                    <p className="mb-3">
                      Fix the alignment for the selected image pair.
                    </p>
                    <ManualHomographyEditor
                      images={[
                        currentHomographyPair.primary as any,
                        currentHomographyPair.secondary as any,
                      ]}
                      points1={points1}
                      points2={points2}
                      setPoints1={setPoints1}
                      setPoints2={setPoints2}
                      onSaved={() => {
                        setLocalTransforms((old) => ({
                          ...old,
                          [homographyPairKey ?? '']: [],
                        }));
                        gotoNextHomographyPair();
                      }}
                    />
                  </Card.Body>
                </Card>
                <div className="d-flex justify-content-end gap-2">
                  <Button variant="secondary" onClick={skipHomographyPair}>
                    Skip Pair
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      gotoNextHomographyPair();
                    }}
                  >
                    Next Pair
                  </Button>
                </div>
              </div>
            ) : null
          ) : annotationHook.meta?.isLoading ? (
            <div>
              Phase 1/3: Loading annotations... {numLoaded} annotations loaded
              so far
            </div>
          ) : !imageNeighboursQueries.every((q) => q.isSuccess) ? (
            <div>
              Phase 2/3: Loading image neighbours...
              {imageNeighboursQueries.reduce(
                (acc, q) => acc + (q.isSuccess ? 1 : 0),
                0
              )}{' '}
              of {imageNeighboursQueries.length} neighbours loaded
            </div>
          ) : !imageMetaDataQueries.every((q) => q.isSuccess) ? (
            <div>
              Phase 3/3: Loading image metadata...
              {imageMetaDataQueries.reduce(
                (acc, q) => acc + (q.isSuccess ? 1 : 0),
                0
              )}{' '}
              of {imageMetaDataQueries.length} images loaded
            </div>
          ) : selectedCategories.length === 0 ? (
            <div>No label selected</div>
          ) : activePair &&
            imageNeighbours[activePair.primary]?.[activePair.secondary] &&
            imageNeighbours[activePair.secondary]?.[activePair.primary] ? (
            <RegisterPair
              key={activePair.primary + activePair.secondary}
              images={[
                imageMetaData[activePair.primary],
                imageMetaData[activePair.secondary],
              ]}
              selectedCategoryIDs={selectedCategoryIDs}
              selectedSet={selectedAnnotationSet}
              transforms={
                localTransforms[pairKey] || [
                  imageNeighbours[activePair.primary]?.[activePair.secondary]
                    ?.tf,
                  imageNeighbours[activePair.secondary]?.[activePair.primary]
                    ?.tf,
                ]
              }
              next={nextPair}
              prev={() => {}}
              visible={true}
              ack={async () => {
                if (registrationJob?.mode === 'per-transect' && assignment) {
                  await client.models.RegistrationAssignment.update({
                    registrationJobId: assignment.registrationJobId,
                    transectId: assignment.transectId,
                    assignedUserId: user.userId,
                    lastHeartbeatAt: new Date().toISOString(),
                    status: 'active',
                  });
                }
              }}
              noHomography={
                (imageNeighbours[activePair.primary]?.[activePair.secondary]
                  ?.noHomography ??
                  false) &&
                !localTransforms[pairKey]
              }
              points1={points1}
              points2={points2}
              setPoints1={setPoints1}
              setPoints2={setPoints2}
            />
          ) : (
            <div>No more items to register</div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoTag({ label, value }: { label: string; value: string }) {
  return (
    <p className="mb-0 d-flex flex-row gap-2 justify-content-between">
      <span>{label}:</span>
      <span>{value}</span>
    </p>
  );
}
