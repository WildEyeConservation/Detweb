import { useState, useMemo, useContext, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnnotationSetDropdown } from './AnnotationSetDropDown';
import Select from 'react-select';
import { ProjectContext } from './Context';
import { useOptimisticUpdates } from './useOptimisticUpdates';
import { Schema } from './amplify/client-schema';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { makeTransform, array2Matrix } from './utils';
import { inv, matrix, type Matrix } from 'mathjs';
import { GlobalContext, ManagementContext } from './Context';
import { RegisterPair } from './RegisterPair';
import { Card, Button, Form } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { PanelBottom, LogOut } from 'lucide-react';
import { AnnotateChromeContext } from './ss/AnnotateChrome';

export function Registration({ showAnnotationSetDropdown = true }) {
  const { client } = useContext(GlobalContext)!;
  const { annotationSetId } = useParams();
  const navigate = useNavigate();
  const { rightEl } = useContext(AnnotateChromeContext);
  const queryClient = useQueryClient();
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

  // selectedCategoryIDs contains the ids of the selected categories.
  const selectedCategoryIDs = useMemo(
    () => selectedCategories.map((c) => c.value),
    [selectedCategories]
  );

  // Reset numLoaded when categories or annotation set changes
  useEffect(() => {
    setNumLoaded(0);
  }, [selectedCategoryIDs, selectedAnnotationSet]);

  // Build filter that includes only selected categories (setId is a query parameter, not part of filter)
  const annotationFilter = useMemo(() => {
    // Only add category filter if categories are selected
    if (selectedCategoryIDs.length > 0) {
      return {
        filter: {
          or: selectedCategoryIDs.map((categoryId) => ({
            categoryId: { eq: categoryId },
          })),
        },
      };
    }
    return undefined;
  }, [selectedCategoryIDs]);

  // subscriptionFilter for real-time updates - includes both setId and categories
  const subscriptionFilter = useMemo(
    () => ({
      filter: {
        setId: { eq: selectedAnnotationSet },
        ...(selectedCategoryIDs.length > 0 && {
          or: selectedCategoryIDs.map((categoryId) => ({
            categoryId: { eq: categoryId },
          })),
        }),
      },
    }),
    [selectedAnnotationSet, selectedCategoryIDs]
  );

  // annotations contains an array of annotations in the selected annotation set and categories, that is kept updated.
  // Only fetch when annotation set is selected and at least one category is selected
  const annotationHook = (useOptimisticUpdates as any)(
    'Annotation',
    async (nextToken?: string) => {
      if (!selectedAnnotationSet || selectedCategoryIDs.length === 0) {
        return { data: [], nextToken: undefined };
      }

      return client.models.Annotation.annotationsByAnnotationSetId(
        { setId: selectedAnnotationSet },
        {
          nextToken,
          limit: 10000,
          filter: annotationFilter?.filter,
        }
      );
    },
    subscriptionFilter,
    undefined, // options
    selectedCategoryIDs.length > 0 ? setNumLoaded : undefined // updateFunction
  );

  const annotations = annotationHook.data;

  // annotationsByImage contains a map of image ids to their annotations.
  // No need to filter by category since we fetch only selected categories
  const annotationsByImage = useMemo(() => {
    return annotations?.reduce((acc: Record<string, Schema['Annotation']['type'][]>, a: Schema['Annotation']['type']) => {
      const acc2 = acc[a.imageId] || [];
      acc[a.imageId] = [...acc2, a];
      return acc;
    }, {} as Record<string, Schema['Annotation']['type'][]>);
  }, [annotations]);

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
  // Skipped pairs are excluded from this map.
  const imageNeighbours = useMemo(() => {
    return imageNeighboursQueries
      .filter((query) => query.isSuccess)
      .reduce((acc, query) => {
        const neighbours = query.data;
        const defaultHomography = [1, 0, 0, 0, 1, 0, 0, 0, 1];
        neighbours
          // Filter out skipped pairs - they don't need registration
          .filter((n) => !n.skipped)
          .forEach((n) => {
            const isDefault = !(n.homography?.length === 9);
            // if no valid homography, use identity
            const rawH =
              n.homography?.length === 9 ? n.homography : defaultHomography;
            const MArray = array2Matrix(rawH);
            if (!MArray) return; // Skip if matrix conversion failed
            const M = matrix(MArray) as Matrix;

            const acc2 = acc[n.image1Id] || {};
            acc[n.image1Id] = {
              ...acc2,
              [n.image2Id]: { tf: makeTransform(M), noHomography: isDefault },
            };
            const acc3 = acc[n.image2Id] || {};
            const invM = inv(M) as Matrix;
            acc[n.image2Id] = {
              ...acc3,
              [n.image1Id]: {
                tf: makeTransform(invM),
                noHomography: isDefault,
              },
            };
          });
        return acc;
      }, {} as Record<string, Record<string, { tf: (c: [number, number]) => [number, number]; noHomography: boolean }>>);
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
    if (imageMetaDataQueries.some((query) => !query.isSuccess)) {
      return {};
    }

    const images = imageMetaDataQueries
      .filter((query) => query.isSuccess)
      .map((query) => query.data?.data)
      .filter(
        (image): image is Schema['Image']['type'] => Boolean(image)
      );

    return images.reduce((acc, image) => {
      acc[image.id] = image;
      return acc;
    }, {} as Record<string, Schema['Image']['type']>);
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
      if (!imageMetaData[t.id]) {
        continue;
      }
      const annotationsPrimary = annotationsByImage[t.id];
      for (const n of t.neighbours) {
        const forward = imageNeighbours[t.id]?.[n.id];
        const backward = imageNeighbours[n.id]?.[t.id];
        const secondaryImage = imageMetaData[n.id];
        if (!forward || !backward || !secondaryImage) {
          continue;
        }

        // Skip pairs without homographies — those are handled by the homography workflow
        if (forward.noHomography || backward.noHomography) {
          continue;
        }

        const tf = forward.tf;
        const annotationsSecondary = annotationsByImage[n.id]?.map(
          (a: Schema['Annotation']['type']) => a.objectId
        );
        const width = secondaryImage.width;
        const height = secondaryImage.height;
        const annotationsToLink = annotationsPrimary
          // Only keep annotations that are not already matched to some object in the secondary image
          ?.filter((a: Schema['Annotation']['type']) =>
            a.objectId ? !annotationsSecondary?.includes(a.objectId) : true
          )
          // And that map to some point inside the secondary image
          ?.filter((a: Schema['Annotation']['type']) => {
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

  // Skip this image pair - mark as skipped so it won't be shown again
  const handleSkip = useCallback(async () => {
    if (!activePair) return;

    if (
      !window.confirm(
        'Are you sure you want to skip this pair? The images will remain neighbours but won\'t require registration.'
      )
    )
      return;

    const nb1Resp: any = await (client.models.ImageNeighbour.get as any)({
      image1Id: activePair.primary,
      image2Id: activePair.secondary,
    });
    const nb1 = nb1Resp?.data;

    await client.models.ImageNeighbour.update({
      image1Id: nb1 ? activePair.primary : activePair.secondary,
      image2Id: nb1 ? activePair.secondary : activePair.primary,
      skipped: true,
    });

    // Force-refetch neighbours for both images
    await Promise.all([
      queryClient.refetchQueries({
        queryKey: ['imageNeighbours', activePair.primary],
      }),
      queryClient.refetchQueries({
        queryKey: ['imageNeighbours', activePair.secondary],
      }),
      queryClient.refetchQueries({
        queryKey: ['prevNeighbours', activePair.primary],
      }),
      queryClient.refetchQueries({
        queryKey: ['prevNeighbours', activePair.secondary],
      }),
      queryClient.refetchQueries({
        queryKey: ['nextNeighbours', activePair.primary],
      }),
      queryClient.refetchQueries({
        queryKey: ['nextNeighbours', activePair.secondary],
      }),
    ]);

    // Move to next pair
    nextPair();
  }, [activePair, client, queryClient, nextPair]);

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

  useEffect(() => {
    if (!activePair) {
      return;
    }

    const primaryMeta = imageMetaData[activePair.primary];
    const secondaryMeta = imageMetaData[activePair.secondary];
    const forward = imageNeighbours[activePair.primary]?.[activePair.secondary];
    const backward =
      imageNeighbours[activePair.secondary]?.[activePair.primary];

    if (!primaryMeta || !secondaryMeta || !forward || !backward) {
      nextPair();
    }
  }, [activePair, imageMetaData, imageNeighbours, nextPair]);

  useEffect(() => {
    if (annotationSetId && !showAnnotationSetDropdown) {
      setSelectedAnnotationSet(annotationSetId);
    }
  }, [annotationSetId]);

  const activePrimaryImage = activePair
    ? imageMetaData[activePair.primary]
    : undefined;
  const activeSecondaryImage = activePair
    ? imageMetaData[activePair.secondary]
    : undefined;
  const activeForwardNeighbour = activePair
    ? imageNeighbours[activePair.primary]?.[activePair.secondary]
    : undefined;
  const activeBackwardNeighbour = activePair
    ? imageNeighbours[activePair.secondary]?.[activePair.primary]
    : undefined;

  const canRenderRegisterPair =
    !!(
      activePair &&
      activePrimaryImage &&
      activeSecondaryImage &&
      activeForwardNeighbour &&
      activeBackwardNeighbour
    );

  const chromeRight = rightEl
    ? createPortal(
        <Button
          onClick={() => navigate('/jobs')}
          className='d-flex align-items-center gap-2'
          style={{
            background: 'transparent',
            borderColor: 'rgba(255,255,255,0.4)',
            color: '#fff',
            fontWeight: 500,
            fontSize: 13,
            padding: '5px 12px',
            borderRadius: 6,
          }}
        >
          <LogOut size={14} />
          <span className='d-none d-sm-inline'>Save &amp; Exit</span>
        </Button>,
        rightEl
      )
    : null;

  return (
    <div
      style={{
        width: '100%',
        paddingTop: '16px',
        paddingBottom: '16px',
        height: '100%',
      }}
    >
      {chromeRight}
      <div className='w-100 h-100 d-flex flex-column flex-md-row gap-3'>
        <div
          className='d-flex flex-column gap-3 w-100'
          style={{ maxWidth: '360px' }}
        >
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
                    (set) => set.id === selectedAnnotationSet
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
                    onChange={(newValue) => setSelectedCategories(newValue as { label: string; value: string }[])}
                    isMulti
                    name='Labels to register'
                    options={categories
                      ?.filter(
                        (c) => c.annotationSetId === selectedAnnotationSet
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
        </div>
        <div className='d-flex flex-column align-items-center h-100 w-100'>
          {annotationHook.meta?.isLoading ? (
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
          ) : canRenderRegisterPair ? (
            <RegisterPair
              key={activePair.primary + activePair.secondary}
              images={[
                activePrimaryImage!,
                activeSecondaryImage!,
              ]}
              selectedCategoryIDs={selectedCategoryIDs}
              selectedSet={selectedAnnotationSet}
              transforms={[
                activeForwardNeighbour!.tf,
                activeBackwardNeighbour!.tf,
              ]}
              next={nextPair}
              prev={() => { }}
              visible={true}
              ack={() => { }}
              onSkip={handleSkip}
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
    <p className='mb-0 d-flex flex-row gap-2 justify-content-between'>
      <span>{label}:</span>
      <span>{value}</span>
    </p>
  );
}
