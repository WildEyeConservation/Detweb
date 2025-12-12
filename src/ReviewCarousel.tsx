import { useContext, useEffect, useMemo, useState } from 'react';
import { GlobalContext, ProjectContext } from './Context';
import AnnotationImage from './AnnotationImage';
import { PreloaderFactory } from './Preloader';
import BufferSource from './BufferSource';
import { Spinner } from 'react-bootstrap';

type LabeledValue = { label: string; value: string };

interface ReviewCarouselProps {
  selectedAnnotationSet: string;
  selectedCategories: LabeledValue[];
  selectedUsers?: LabeledValue[];
  imageBased?: boolean;
}

interface LocationLike {
  location: {
    x: number;
    y: number;
    width: number;
    height: number;
    image: { id: string; width: number; height: number; timestamp: number };
    annotationSetId: string;
    id?: string;
  };
  taskTag?: string;
  id: string;
}

export default function ReviewCarousel({
  selectedAnnotationSet,
  selectedCategories,
  selectedUsers = [],
  imageBased = true,
}: ReviewCarouselProps) {
  const { client } = useContext(GlobalContext)!;
  const {
    categoriesHook: { data: categories },
  } = useContext(ProjectContext)!;

  const [annotations, setAnnotations] = useState<LocationLike[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [locationsLoaded, setLocationsLoaded] = useState(0);

  const [index, setIndex] = useState(0);
  const [bufferSource, setBufferSource] = useState<BufferSource | null>(null);

  // When none selected, assume all categories from the selected set
  const effectiveCategories = useMemo<LabeledValue[]>(() => {
    if (!selectedAnnotationSet) return [];
    if (selectedCategories.length > 0) return selectedCategories;
    const all = (categories ?? [])
      .filter((c) => c.annotationSetId === selectedAnnotationSet)
      .map((c) => ({ label: c.name, value: c.id }));
    return all;
  }, [selectedCategories, selectedAnnotationSet, categories]);

  // Helper to extract userId from owner field
  // If contains "::", take the part before it; otherwise the whole field is the userId
  const extractUserIdFromOwner = (owner: string | null | undefined): string | null => {
    if (!owner) return null;
    if (owner.includes('::')) {
      return owner.split('::')[0];
    }
    return owner;
  };

  // Set of selected user IDs for filtering
  const selectedUserIds = useMemo(
    () => new Set(selectedUsers.map((u) => u.value)),
    [selectedUsers]
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchAnnotationsPoints() {
      setIsLoading(true);

      setLocationsLoaded(0);

      try {
        for (const { value: categoryId } of effectiveCategories) {
          let nextNextToken: string | null | undefined = undefined;
          do {
            const result =
              await client.models.Annotation.annotationsByCategoryId(
                { categoryId },
                {
                  selectionSet: [
                    'x',
                    'y',
                    'owner',
                    'image.id',
                    'image.width',
                    'image.height',
                    'image.timestamp',
                  ],
                  filter: { setId: { eq: selectedAnnotationSet } },
                  nextToken: nextNextToken,
                }
              );
            const { data, nextToken } = result as {
              data: Array<{
                x: number;
                y: number;
                owner?: string | null;
                image: {
                  id: string;
                  width: number;
                  height: number;
                  timestamp: number;
                };
              }>;
              nextToken?: string | null;
            };
            if (cancelled) return;

            // Filter by user if users are selected
            const filteredData =
              selectedUserIds.size > 0
                ? data.filter((ann) => {
                    const userId = extractUserIdFromOwner(ann.owner);
                    return userId && selectedUserIds.has(userId);
                  })
                : data;

            setAnnotations((prev) => [
              ...prev,
              ...filteredData.map(({ x, y, image }) => ({
                location: {
                  x,
                  y,
                  width: 100,
                  height: 100,
                  image: {
                    id: image.id,
                    width: image.width,
                    height: image.height,
                    timestamp: image.timestamp,
                  },
                  annotationSetId: selectedAnnotationSet,
                },
                id: crypto.randomUUID(),
              })),
            ]);
            setLocationsLoaded((prev) => prev + filteredData.length);

            nextNextToken = nextToken ?? null;
          } while (nextNextToken);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    async function fetchImagesUnique() {
      if (!effectiveCategories.length || !selectedAnnotationSet) return;
      setIsLoading(true);

      setLocationsLoaded(0);
      try {
        const imagesFound = new Set<string>();
        const locations: LocationLike[] = [];
        for (const { value: categoryId } of effectiveCategories) {
          let nextNextToken: string | null | undefined = undefined;
          do {
            const result =
              await client.models.Annotation.annotationsByCategoryId(
                { categoryId },
                {
                  selectionSet: [
                    'owner',
                    'image.id',
                    'image.width',
                    'image.height',
                    'image.timestamp',
                  ],
                  filter: { setId: { eq: selectedAnnotationSet } },
                  nextToken: nextNextToken,
                }
              );
            const { data, nextToken } = result as {
              data: Array<{
                owner?: string | null;
                image: {
                  id: string;
                  width: number;
                  height: number;
                  timestamp: number;
                };
              }>;
              nextToken?: string | null;
            };

            // Filter by user if users are selected
            const filteredData =
              selectedUserIds.size > 0
                ? data.filter((ann) => {
                    const userId = extractUserIdFromOwner(ann.owner);
                    return userId && selectedUserIds.has(userId);
                  })
                : data;

            for (const { image } of filteredData) {
              if (!imagesFound.has(image.id)) {
                imagesFound.add(image.id);
                locations.push({
                  location: {
                    x: image.width / 2,
                    y: image.height / 2,
                    width: image.width,
                    height: image.height,
                    image: {
                      id: image.id,
                      width: image.width,
                      height: image.height,
                      timestamp: image.timestamp,
                    },
                    annotationSetId: selectedAnnotationSet,
                  },
                  taskTag: 'review',
                  id: crypto.randomUUID(),
                });
                setLocationsLoaded((prev) => prev + 1);
              }
            }
            nextNextToken = nextToken ?? null;
          } while (nextNextToken);
        }
        if (cancelled) return;
        locations.sort(
          (a, b) => a.location.image.timestamp - b.location.image.timestamp
        );
        setAnnotations(locations);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    // reset state on change
    setAnnotations([]);
    setBufferSource(null);
    setIndex(0);
    setLocationsLoaded(0);

    if (selectedAnnotationSet && effectiveCategories.length) {
      if (imageBased) {
        fetchImagesUnique();
      } else {
        fetchAnnotationsPoints();
      }
    }

    return () => {
      cancelled = true;
    };
  }, [client, selectedAnnotationSet, effectiveCategories, selectedUserIds, imageBased]);

  useEffect(() => {
    if (annotations.length) {
      setBufferSource(new BufferSource(annotations));
    }
  }, [annotations]);

  const Preloader = useMemo(() => PreloaderFactory(AnnotationImage), []);

  if (!selectedAnnotationSet) {
    return (
      <div className='d-flex flex-column align-items-center justify-content-center h-100 w-100'>
        Select an annotation set to begin.
      </div>
    );
  }

  return (
    <>
      {!annotations.length && isLoading ? (
        <div className='d-flex flex-column align-items-center justify-content-center h-100 w-100 p-4'>
          <div className='text-center'>
            <div className='d-flex flex-row align-items-center justify-content-center h-100 w-100'>
              <Spinner size='sm' />
              <span className='ms-2'>
                {locationsLoaded > 0
                  ? `${locationsLoaded} items loaded so far`
                  : 'Preparing to load data'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        bufferSource && (
          <div className='d-flex flex-column align-items-center h-100 w-100 mt-3'>
            <Preloader
              key={
                selectedAnnotationSet +
                effectiveCategories.map((cat) => cat.value).join(',')
              }
              index={index}
              setIndex={setIndex}
              fetcher={() => bufferSource.fetch()}
              preloadN={2}
              historyN={2}
              hideZoomSetting={true}
              // Tight fit around locations for review; 0.55 keeps a small margin
              viewBoundsScale={0.55}
            />
            <div className='mt-2 w-100'>
              <input
                type='range'
                value={index}
                onChange={(e) => setIndex(parseInt(e.target.value))}
                min={0}
                max={Math.max(annotations.length - 1, 0)}
                className='form-range'
              />
              <div style={{ textAlign: 'center' }}>
                Done with {index} out of {annotations.length} locations
              </div>
            </div>
          </div>
        )
      )}
    </>
  );
}
