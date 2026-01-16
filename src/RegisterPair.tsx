import {
  useState,
  useCallback,
  useMemo,
  useContext,
  Dispatch,
  SetStateAction,
} from 'react';
import BaseImage from './BaseImage';
import LinkMaps from './LinkMaps';
import CreateAnnotationOnClick from './CreateAnnotationOnClick';
// import OverlapOutline from "./OverlapOutline";
import { useHotkeys } from 'react-hotkeys-hook';
import { GotoAnnotation } from './GotoAnnotation';
import { useOptimalAssignment } from './useOptimalAssignment';
import { MapLegend } from './Legend';
import { ShowMarkers } from './ShowMarkers';
import { Map } from 'leaflet';
import { GlobalContext, CRUDhook, AnnotationsHook } from './Context';
import type {
  AnnotationType,
  ExtendedAnnotationType,
  ImageType,
} from './schemaTypes';
import { useOptimisticUpdates } from './useOptimisticUpdates';
import { useAnnotationNavigation } from './useAnnotationNavigation';
import { ImageContextFromHook } from './ImageContext';
// import { Schema } from "../amplify/data/resource";
import { PointsOverlay } from './ManualHomographyEditor';

type RegisterPairProps = {
  images: [ImageType, ImageType]; // The pair of images in which we need to register the annotations
  selectedSet: string; // The active AnnotationSet
  next: () => void; // Function to call to move to the next pair
  prev: () => void; // Function to call to move to the previous pair
  transforms?: ((coords: [number, number]) => [number, number])[]; // The transforms to map points image 1 coordinates to image 2 coordinates and vice versa.
  visible: boolean; // Whether the component is visible
  ack: () => void; // Function to call to acknowledge the pair (mark it as completed). This will typically remove the underlying message from the task queue.
  selectedCategoryIDs?: string[]; // The ids of the selected categories
  noHomography?: boolean; // Whether the images are not homographically linked
  // Manual homography selection support
  points1?: { id: string; x: number; y: number }[];
  points2?: { id: string; x: number; y: number }[];
  setPoints1?: (updater: any) => void;
  setPoints2?: (updater: any) => void;
  onSkip?: () => void; // Function to call to skip this pair (mark it as skipped)
  isEditingHomography?: boolean; // Whether the manual homography editor is currently open
};

type PointStateSetter = Dispatch<
  SetStateAction<{ id: string; x: number; y: number }[]>
>;

// Function to transform a point using a homography matrix
export function RegisterPair(props: RegisterPairProps) {
  const {
    images,
    selectedSet,
    transforms,
    next,
    prev,
    visible,
    selectedCategoryIDs,
    noHomography,
    points1,
    points2,
    setPoints1,
    setPoints2,
    onSkip,
    isEditingHomography,
  } = props;
  const [map1, setMap1] = useState<Map | null>(null);
  const [map2, setMap2] = useState<Map | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [linkImages, setLinkImages] = useState(
    transforms && !noHomography ? true : false
  );
  const [leniency, setLeniency] = useState(400);
  const effectiveTransforms = transforms;
  const [localPoints1, setLocalPoints1] = useState<
    { id: string; x: number; y: number }[]
  >([]);
  const [localPoints2, setLocalPoints2] = useState<
    { id: string; x: number; y: number }[]
  >([]);

  const resolvedPoints: [
    { id: string; x: number; y: number }[],
    { id: string; x: number; y: number }[]
  ] = [points1 ?? localPoints1, points2 ?? localPoints2];

  const resolvedSetters: [PointStateSetter, PointStateSetter] = [
    (setPoints1 as PointStateSetter | undefined) ?? setLocalPoints1,
    (setPoints2 as PointStateSetter | undefined) ?? setLocalPoints2,
  ];

  const subscriptionFilter1 = useMemo(
    () => ({
      filter: {
        and: [
          { setId: { eq: selectedSet } },
          { imageId: { eq: images[0].id } },
        ],
      },
    }),
    [selectedSet, images[0].id]
  );

  const subscriptionFilter2 = useMemo(
    () => ({
      filter: {
        and: [
          { setId: { eq: selectedSet } },
          { imageId: { eq: images[1].id } },
        ],
      },
    }),
    [selectedSet, images[1].id]
  );

  const { client } = useContext(GlobalContext)!;

  const annotationsHooks = [
    (useOptimisticUpdates as any)(
      'Annotation',
      async (nextToken?: string) => {
        const resp =
          await client.models.Annotation.annotationsByImageIdAndSetId(
            { imageId: images[0].id, setId: { eq: selectedSet } },
            { nextToken }
          );
        return {
          data: (resp as any).data,
          nextToken: (resp as any).nextToken ?? undefined,
        };
      },
      subscriptionFilter1 as any
    ),
    (useOptimisticUpdates as any)(
      'Annotation',
      async (nextToken?: string) => {
        const resp =
          await client.models.Annotation.annotationsByImageIdAndSetId(
            { imageId: images[1].id, setId: { eq: selectedSet } },
            { nextToken }
          );
        return {
          data: (resp as any).data,
          nextToken: (resp as any).nextToken ?? undefined,
        };
      },
      subscriptionFilter2 as any
    ),
  ] as unknown as [CRUDhook<'Annotation'>, CRUDhook<'Annotation'>];

  const [matchStatus] = useState<Record<string, number>>({});

  // const rejectMatch = useCallback(
  //   ([anno1, anno2]: [ExtendedAnnotationType, ExtendedAnnotationType]) => {
  //     setMatch(anno1, anno2, -1);
  //   },
  //   [setMatch]
  // );

  const getMatchStatus = useCallback(
    ([anno1, anno2]: [AnnotationType, AnnotationType]): number => {
      return matchStatus[anno1.id + anno2.id] || 0;
    },
    [matchStatus]
  );

  const { enhancedAnnotationHooks, repositionShadow } = (
    useOptimalAssignment as any
  )({
    annotationsHooks,
    transforms: effectiveTransforms as any,
    getMatchStatus,
    images,
    leniency,
  });

  const {
    next: nextAnnotation,
    prev: prevAnnotation,
    activeObjectId,
    confirmMatch,
    setActiveObject,
  } = (useAnnotationNavigation as any)({
    annotationHooks: enhancedAnnotationHooks as any,
    // The hook expects create/update but only uses update; provide no-op create to satisfy type
    create: () => {},
    update: () => {},
    next,
    prev,
    selectedCategoryIDs: selectedCategoryIDs || [],
  });
  const handleAnnotationSelect = useCallback(
    (annotation: ExtendedAnnotationType) => {
      const objectId = annotation.objectId || annotation.proposedObjectId;
      if (objectId) {
        setActiveObject(objectId);
      }
    },
    [setActiveObject]
  );

  const activeAnnotation = useMemo<ExtendedAnnotationType | undefined>(() => {
    if (!activeObjectId) return undefined;
    return (
      (enhancedAnnotationHooks[0].data as any[]).find(
        (anno: any) => anno.proposedObjectId === activeObjectId
      ) ||
      (enhancedAnnotationHooks[1].data as any[]).find(
        (anno: any) => anno.proposedObjectId === activeObjectId
      )
    );
  }, [activeObjectId, enhancedAnnotationHooks]);

  // Added state and callback to debounce the spacebar press
  const [isSpaceDisabled, setIsSpaceDisabled] = useState(false);
  const SPACE_DISABLE_TIMEOUT_MS = 300;
  const handleSpace = useCallback(() => {
    if (isSpaceDisabled) return;
    confirmMatch();
    setIsSpaceDisabled(true);
    setTimeout(() => setIsSpaceDisabled(false), SPACE_DISABLE_TIMEOUT_MS);
  }, [isSpaceDisabled, confirmMatch]);

  useHotkeys('ArrowRight', nextAnnotation, { enabled: visible });
  useHotkeys('Ctrl+ArrowRight', next, { enabled: visible });
  useHotkeys('ArrowLeft', prevAnnotation, { enabled: visible });
  useHotkeys('Ctrl+ArrowLeft', prev, { enabled: visible });
  useHotkeys('Space', handleSpace, { enabled: visible });
  // Backspace currently unused after refactor; reserved for future per-pair rejection UI

  return (
    <div className='w-100 h-100 d-flex flex-column gap-3'>
      <div className='w-100 h-100 d-flex flex-row justify-content-between gap-3'>
        {images?.length == 2 &&
          images?.map((image, i) => (
            <div
              className='w-50 h-100'
              style={{
                position: 'relative',
              }}
              key={image.id}
            >
              {(() => {
                const fallbackLocation = {
                  id: `registerpair-${image.id}-${i}`,
                  projectId: image.projectId ?? '',
                  setId: selectedSet,
                  annotationSetId: selectedSet,
                  source: 'registerpair',
                  x: image.width / 2,
                  y: image.height / 2,
                  width: image.width,
                  height: image.height,
                  image,
                } as any;
                const fallbackAnnotationSet = { id: selectedSet } as any;
                const baseImageProps: any = {
                  image,
                  visible,
                  otherImageId: images[1 - i].id,
                  annotationSet: fallbackAnnotationSet,
                  location: fallbackLocation,
                };
                return (
                  <ImageContextFromHook
                    key={i}
                    hook={
                      enhancedAnnotationHooks[i] as unknown as AnnotationsHook
                    }
                    image={image as any}
                    locationId={crypto.randomUUID()}
                    taskTag={'RegisterPair'}
                  >
                    <BaseImage {...(baseImageProps as any)}>
                      {effectiveTransforms && (
                        <GotoAnnotation
                          image={image as any}
                          activeAnnotation={activeAnnotation}
                          transform={effectiveTransforms![1 - i]}
                        />
                      )}
                      {(noHomography || !effectiveTransforms) && (
                        <PointsOverlay
                          points={resolvedPoints[i]}
                          setPoints={resolvedSetters[i]}
                        />
                      )}
                      {!noHomography && effectiveTransforms && (
                        <CreateAnnotationOnClick
                          setId={selectedSet}
                          image={image as any}
                          source='registerpair'
                          disabled={!effectiveTransforms}
                          location={
                            {
                              x: image.width / 2,
                              y: image.height / 2,
                              width: image.width,
                              height: image.height,
                              annotationSetId: selectedSet,
                              image: image as any,
                            } as any
                          }
                        />
                      )}
                      {!noHomography && effectiveTransforms && (
                        <ShowMarkers
                          annotationSetId={selectedSet}
                          activeAnnotation={activeAnnotation}
                          onShadowDrag={(id, x, y) =>
                            repositionShadow(i, id, x, y)
                          }
                          onSelectAnnotation={handleAnnotationSelect}
                        />
                      )}
                      {effectiveTransforms && linkImages && (
                        <LinkMaps
                          otherMap={[map2, map1][i]}
                          setMap={[setMap1, setMap2][i]}
                          transform={effectiveTransforms![i]}
                          blocked={blocked}
                          setBlocked={setBlocked}
                        />
                      )}
                      {i == 1 && (
                        <MapLegend
                          position='bottomright'
                          annotationSetId={selectedSet}
                          alwaysVisible={true}
                        />
                      )}
                    </BaseImage>
                  </ImageContextFromHook>
                );
              })()}
            </div>
          ))}
      </div>
      {effectiveTransforms && !isEditingHomography && (
        <div className='w-100 d-flex flex-column gap-2 bg-secondary p-3'>
          <span style={{ fontSize: '12px', color: '#f8f9fa' }}>
            Tip: click a suggested marker or use Arrow keys to focus it, then
            press Space to confirm the match.
          </span>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              userSelect: 'none',
            }}
          >
            <input
              type='checkbox'
              checked={linkImages}
              disabled={!effectiveTransforms || noHomography}
              onChange={(e) => setLinkImages(e.target.checked)}
            />
            Link Images according to linking transform
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              userSelect: 'none',
            }}
          >
            <label htmlFor='leniency'>Pairing leniency (px)</label>
            <input
              type='range'
              id='leniency'
              min='0'
              max='1000'
              value={leniency}
              style={{ width: '200px' }}
              onChange={(e) => setLeniency(parseInt(e.target.value))}
            />
          </div>
          {onSkip && (
            <div className='mt-2 pt-2 border-top border-dark'>
              <button
                className='btn btn-sm btn-outline-warning w-100'
                onClick={onSkip}
              >
                Skip this pair
              </button>
            </div>
          )}
        </div>
      )}
      {/* Manual homography editor now rendered by parent (Registration) in sidebar */}
    </div>
  );
}
