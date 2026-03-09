import { useState, useMemo, useContext, useEffect, useCallback } from 'react';
import { AnnotationSetDropdown } from '../AnnotationSetDropDown';
import Select from 'react-select';
import { ProjectContext } from '../Context';
import { Schema } from '../amplify/client-schema';
import { useQueries } from '@tanstack/react-query';
import { makeTransform, array2Matrix } from '../utils';
import { inv, matrix, type Matrix } from 'mathjs';
import { GlobalContext, ManagementContext } from '../Context';
import { Card, Button, Form } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import {
  PanelBottom,
  Undo2,
  Redo2,
} from 'lucide-react';
import {
  ManualHomographyEditor,
  solveHomography,
  MIN_HOMOGRAPHY_POINTS,
  type Point,
} from '../ManualHomographyEditor';
import { useHotkeys } from 'react-hotkeys-hook';
import { HomographyPairViewer } from './HomographyPairViewer';
import { MapboxPairViewer } from './MapboxPairViewer';

export function HomographyCreation({ showAnnotationSetDropdown = true }) {
  const { client } = useContext(GlobalContext)!;
  const { annotationSetId } = useParams();

  const [selectedCategories, setSelectedCategories] = useState<
    { label: string; value: string }[]
  >([]);
  const [selectedAnnotationSet, setSelectedAnnotationSet] =
    useState<string>('');
  const [showFilters, setShowFilters] = useState(true);

  const [points, setPoints] = useState<{ p1: Point[]; p2: Point[] }>({
    p1: [],
    p2: [],
  });
  const [history, setHistory] = useState<{ p1: Point[]; p2: Point[] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ p1: Point[]; p2: Point[] }[]>([]);

  const recordAction = useCallback(() => {
    setHistory((prev) => {
      // Avoid pushing duplicate states
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (last.p1 === points.p1 && last.p2 === points.p2) return prev;
      }
      return [...prev.slice(-49), points];
    });
    setRedoStack([]); // Clear redo stack on new action
  }, [points]);

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((redo) => [points, ...redo]);
      setPoints(last);
      return prev.slice(0, -1);
    });
  }, [points]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[0];
      setHistory((hist) => [...hist, points]);
      setPoints(next);
      return prev.slice(1);
    });
  }, [points]);

  useHotkeys('ctrl+z, meta+z', (e) => {
    e.preventDefault();
    undo();
  }, { enableOnFormTags: true });

  useHotkeys('ctrl+y, meta+shift+z, ctrl+shift+z', (e) => {
    e.preventDefault();
    redo();
  }, { enableOnFormTags: true });

  const points1 = points.p1;
  const points2 = points.p2;

  const setPoints1 = useCallback(
    (updater: Point[] | ((prev: Point[]) => Point[])) => {
      setPoints((prev) => ({
        ...prev,
        p1: typeof updater === 'function' ? updater(prev.p1) : updater,
      }));
    },
    []
  );

  const setPoints2 = useCallback(
    (updater: Point[] | ((prev: Point[]) => Point[])) => {
      setPoints((prev) => ({
        ...prev,
        p2: typeof updater === 'function' ? updater(prev.p2) : updater,
      }));
    },
    []
  );

  const [previewHomography, setPreviewHomography] = useState(false);
  const [useMapbox, setUseMapbox] = useState(false);

  // Direct annotation fetch (no useOptimisticUpdates)
  const [annotations, setAnnotations] = useState<
    Schema['Annotation']['type'][]
  >([]);
  const [loadingAnnotations, setLoadingAnnotations] = useState(false);

  const {
    categoriesHook: { data: categories },
    project,
  } = useContext(ProjectContext)!;
  const {
    annotationSetsHook: { data: annotationSets },
  } = useContext(ManagementContext)!;

  const selectedCategoryIDs = useMemo(
    () => selectedCategories.map((c) => c.value),
    [selectedCategories]
  );

  useEffect(() => {
    if (annotationSetId && !showAnnotationSetDropdown) {
      setSelectedAnnotationSet(annotationSetId);
    }
  }, [annotationSetId]);

  // Fetch annotations when filters change
  useEffect(() => {
    if (!selectedAnnotationSet || selectedCategoryIDs.length === 0) {
      setAnnotations([]);
      setLoadingAnnotations(false);
      return;
    }

    let cancelled = false;
    setLoadingAnnotations(true);

    (async () => {
      const all: Schema['Annotation']['type'][] = [];
      let nextToken: string | undefined;

      do {
        const resp: any =
          await client.models.Annotation.annotationsByAnnotationSetId(
            { setId: selectedAnnotationSet },
            {
              nextToken,
              limit: 1000,
              filter: {
                or: selectedCategoryIDs.map((id) => ({
                  categoryId: { eq: id },
                })),
              } as any,
            }
          );
        if (cancelled) return;
        all.push(...resp.data);
        nextToken = resp.nextToken ?? undefined;
      } while (nextToken);

      if (!cancelled) {
        setAnnotations(all);
        setLoadingAnnotations(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedAnnotationSet, selectedCategoryIDs, client]);

  const annotationsByImage = useMemo(() => {
    return annotations.reduce(
      (acc, a) => {
        (acc[a.imageId] ??= []).push(a);
        return acc;
      },
      {} as Record<string, Schema['Annotation']['type'][]>
    );
  }, [annotations]);

  const imageNeighboursQueries = useQueries({
    queries: Object.keys(annotationsByImage).map((imageId) => ({
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
      staleTime: Infinity,
      cacheTime: 1000 * 60 * 60,
    })),
  });

  const imageNeighbours = useMemo(() => {
    const defaultH = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    return imageNeighboursQueries
      .filter((q) => q.isSuccess)
      .reduce(
        (acc, q) => {
          q.data
            .filter((n) => !n.skipped)
            .forEach((n) => {
              const isDefault = !(n.homography?.length === 9);
              const rawH =
                n.homography?.length === 9 ? n.homography : defaultH;
              const MArray = array2Matrix(rawH);
              if (!MArray) return;
              const M = matrix(MArray) as Matrix;

              (acc[n.image1Id] ??= {})[n.image2Id] = {
                tf: makeTransform(M),
                noHomography: isDefault,
              };
              const invM = inv(M) as Matrix;
              (acc[n.image2Id] ??= {})[n.image1Id] = {
                tf: makeTransform(invM),
                noHomography: isDefault,
              };
            });
          return acc;
        },
        {} as Record<
          string,
          Record<
            string,
            {
              tf: (c: [number, number]) => [number, number];
              noHomography: boolean;
            }
          >
        >
      );
  }, [imageNeighboursQueries]);

  const imageMetaDataQueries = useQueries({
    queries: Object.keys(imageNeighbours).map((imageId) => ({
      queryKey: ['imageMetaData', imageId],
      queryFn: () => client.models.Image.get({ id: imageId }),
      staleTime: Infinity,
      cacheTime: 1000 * 60 * 60,
    })),
  });

  const imageMetaData = useMemo(() => {
    if (imageMetaDataQueries.some((q) => !q.isSuccess)) return {};
    return imageMetaDataQueries
      .filter((q) => q.isSuccess)
      .reduce(
        (acc, q) => {
          const img = q.data?.data;
          if (img) acc[img.id] = img;
          return acc;
        },
        {} as Record<string, Schema['Image']['type']>
      );
  }, [imageMetaDataQueries]);

  // Find pairs with missing homographies
  const { pairToFind, missingCount } = useMemo(() => {
    let firstPair:
      | { primary: string; secondary: string }
      | undefined;
    let count = 0;
    const seenPairs = new Set<string>();

    const imageIds = Object.keys(annotationsByImage).sort(
      (a, b) =>
        (imageMetaData[a]?.timestamp ?? 0) -
        (imageMetaData[b]?.timestamp ?? 0)
    );

    for (const imageId of imageIds) {
      if (!imageMetaData[imageId]) continue;
      const neighbours = Object.keys(
        imageNeighbours[imageId] || {}
      ).sort(
        (a, b) =>
          (imageMetaData[a]?.timestamp ?? 0) -
          (imageMetaData[b]?.timestamp ?? 0)
      );

      for (const nId of neighbours) {
        const pairKey = [imageId, nId].sort().join('::');
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        const fwd = imageNeighbours[imageId]?.[nId];
        const bwd = imageNeighbours[nId]?.[imageId];
        if (!fwd && !bwd) continue;
        if (!imageMetaData[nId]) continue;
        if (
          !(fwd?.noHomography ?? false) &&
          !(bwd?.noHomography ?? false)
        )
          continue;

        const hasAnno1 = (annotationsByImage[imageId]?.length ?? 0) > 0;
        const hasAnno2 = (annotationsByImage[nId]?.length ?? 0) > 0;
        if (!hasAnno1 && !hasAnno2) continue;

        count++;
        if (!firstPair) {
          firstPair = {
            primary: hasAnno1 ? imageId : nId,
            secondary: hasAnno1 ? nId : imageId,
          };
        }
      }
    }

    return { pairToFind: firstPair, missingCount: count };
  }, [annotationsByImage, imageNeighbours, imageMetaData]);

  const primaryImage = pairToFind
    ? imageMetaData[pairToFind.primary]
    : undefined;
  const secondaryImage = pairToFind
    ? imageMetaData[pairToFind.secondary]
    : undefined;
  const hasPair = !!(pairToFind && primaryImage && secondaryImage);

  // Reset points when pair changes
  useEffect(() => {
    setPoints({ p1: [], p2: [] });
    setHistory([]);
    setRedoStack([]);
    setPreviewHomography(false);
  }, [pairToFind?.primary, pairToFind?.secondary]);

  // Auto-enable preview when we first reach the minimum point pairs
  const numPairs = Math.min(points1.length, points2.length);
  useEffect(() => {
    if (
      !previewHomography &&
      numPairs === MIN_HOMOGRAPHY_POINTS &&
      points1.length === points2.length
    ) {
      setPreviewHomography(true);
    }
  }, [numPairs, points1.length, points2.length]);

  // Compute preview transforms from current points
  const previewTransforms = useMemo(() => {
    if (!previewHomography) return null;
    if (
      points1.length < MIN_HOMOGRAPHY_POINTS ||
      points2.length < MIN_HOMOGRAPHY_POINTS
    )
      return null;
    const H = solveHomography(points1, points2);
    if (!H) return null;
    try {
      return [
        makeTransform(H as any),
        makeTransform(inv(H as any) as any),
      ] as [
        (c: [number, number]) => [number, number],
        (c: [number, number]) => [number, number],
      ];
    } catch {
      return null;
    }
  }, [previewHomography, points1, points2]);

  const canPreview =
    points1.length >= MIN_HOMOGRAPHY_POINTS &&
    points2.length >= MIN_HOMOGRAPHY_POINTS;

  // Loading state
  const neighboursLoading = imageNeighboursQueries.length > 0 && !imageNeighboursQueries.every((q) => q.isSuccess);
  const metadataLoading = imageMetaDataQueries.length > 0 && !imageMetaDataQueries.every((q) => q.isSuccess);
  const isLoading = loadingAnnotations || neighboursLoading || metadataLoading;

  const loadingMessage = loadingAnnotations
    ? `Loading annotations... (${annotations.length} loaded)`
    : neighboursLoading
      ? `Loading image neighbours... (${imageNeighboursQueries.filter((q) => q.isSuccess).length}/${imageNeighboursQueries.length})`
      : metadataLoading
        ? `Loading image metadata... (${imageMetaDataQueries.filter((q) => q.isSuccess).length}/${imageMetaDataQueries.length})`
        : '';

  return (
    <div
      style={{
        width: '100%',
        paddingTop: '16px',
        paddingBottom: '16px',
        height: '100%',
      }}
    >
      <div className='w-100 h-100 d-flex flex-column flex-md-row gap-3'>
        {/* Sidebar */}
        <div
          className='d-flex flex-column gap-3 w-100'
          style={{ maxWidth: '360px' }}
        >
          {hasPair ? (
            <ManualHomographyEditor
              images={[primaryImage!, secondaryImage!]}
              points1={points1}
              points2={points2}
              setPoints1={setPoints1}
              setPoints2={setPoints2}
              onSaved={() => {}}
              onAction={recordAction}
            />
          ) : (
            <>
              <Card className='d-sm-block d-none w-100'>
                <Card.Header>
                  <Card.Title className='mb-0'>Information</Card.Title>
                </Card.Header>
                <Card.Body className='d-flex flex-column gap-2'>
                  <InfoTag label='Survey' value={project.name} />
                  <InfoTag
                    label='Annotation Set'
                    value={
                      annotationSets?.find(
                        (s) => s.id === selectedAnnotationSet
                      )?.name ?? 'Unknown'
                    }
                  />
                </Card.Body>
              </Card>
              <Card className='w-100 flex-grow-1'>
                <Card.Header>
                  <Card.Title className='mb-0 d-flex align-items-center'>
                    <Button
                      className='p-0 mb-0'
                      variant='outline'
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <PanelBottom
                        className='d-sm-none'
                        style={{
                          transform: showFilters
                            ? 'rotate(180deg)'
                            : 'rotate(0deg)',
                        }}
                      />
                    </Button>
                    Filters
                  </Card.Title>
                </Card.Header>
                {showFilters && (
                  <Card.Body className='d-flex flex-column gap-2'>
                    <div className='w-100'>
                      <Form.Label>Labels</Form.Label>
                      <Select
                        value={selectedCategories}
                        onChange={(v) =>
                          setSelectedCategories(
                            v as { label: string; value: string }[]
                          )
                        }
                        isMulti
                        name='Labels to register'
                        options={categories
                          ?.filter(
                            (c) =>
                              c.annotationSetId === selectedAnnotationSet
                          )
                          .map((q) => ({
                            label: q.name,
                            value: q.id,
                          }))}
                        className='text-black w-100'
                        closeMenuOnSelect={false}
                      />
                    </div>
                    {showAnnotationSetDropdown && (
                      <AnnotationSetDropdown
                        selectedSet={selectedAnnotationSet}
                        setAnnotationSet={setSelectedAnnotationSet}
                        canCreate={false}
                      />
                    )}
                  </Card.Body>
                )}
              </Card>
            </>
          )}
        </div>

        {/* Main content */}
        <div className='d-flex flex-column align-items-center h-100 w-100'>
          {selectedCategories.length === 0 ? (
            <div>No label selected</div>
          ) : isLoading ? (
            <div>{loadingMessage}</div>
          ) : hasPair ? (
            <>
              <div className='mb-2 d-flex align-items-center gap-3'>
                <span
                  style={{ fontSize: '1.1rem', fontWeight: 'bold' }}
                >
                  {missingCount} pair
                  {missingCount !== 1 ? 's' : ''} remaining
                </span>
                <Form.Check
                  type='switch'
                  id='preview-homography'
                  label='Preview homography'
                  checked={previewHomography}
                  onChange={(e) =>
                    setPreviewHomography(e.target.checked)
                  }
                  disabled={!canPreview}
                />
                {!canPreview && (
                  <span
                    className='text-muted'
                    style={{ fontSize: '0.85rem' }}
                  >
                    (min {MIN_HOMOGRAPHY_POINTS} point pairs)
                  </span>
                )}
                <Form.Check
                  type='switch'
                  id='use-mapbox'
                  label='Mapbox'
                  checked={useMapbox}
                  onChange={(e) => setUseMapbox(e.target.checked)}
                />

                <div className='d-flex align-items-center gap-1 border-start ps-3 border-secondary'>
                  <Button
                    size='sm'
                    variant='outline-secondary'
                    onClick={undo}
                    disabled={history.length === 0}
                    title='Undo (Ctrl+Z)'
                    className='p-1 d-flex align-items-center'
                  >
                    <Undo2 size={16} />
                  </Button>
                  <Button
                    size='sm'
                    variant='outline-secondary'
                    onClick={redo}
                    disabled={redoStack.length === 0}
                    title='Redo (Ctrl+Y / Ctrl+Shift+Z)'
                    className='p-1 d-flex align-items-center'
                  >
                    <Redo2 size={16} />
                  </Button>
                </div>
              </div>
              {useMapbox ? (
                <MapboxPairViewer
                  key={`mapbox-${pairToFind!.primary}::${pairToFind!.secondary}`}
                  images={[primaryImage!, secondaryImage!]}
                  points={[points1, points2]}
                  setPoints={[setPoints1, setPoints2]}
                  previewTransforms={previewTransforms}
                  onAction={recordAction}
                />
              ) : (
                <HomographyPairViewer
                  key={`leaflet-${pairToFind!.primary}::${pairToFind!.secondary}`}
                  images={[primaryImage!, secondaryImage!]}
                  points={[points1, points2]}
                  setPoints={[setPoints1, setPoints2]}
                  previewTransforms={previewTransforms}
                  onAction={recordAction}
                />
              )}
            </>
          ) : (
            <>
              <div
                className='mb-2'
                style={{ fontSize: '1.1rem', fontWeight: 'bold' }}
              >
                {missingCount} pair
                {missingCount !== 1 ? 's' : ''} remaining
              </div>
              <div>No more items to process</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoTag({ label, value }: { label: string; value: string }) {
  return (
    <p className='mb-0 d-flex flex-row gap-2 justify-content-between'>
      <span>{label}:</span>
      <span>{value}</span>
    </p>
  );
}
