import { useState, useCallback,useMemo,useContext} from "react";
import BaseImage from "./BaseImage";
import LinkMaps from "./LinkMaps";
import CreateAnnotationOnClick from "./CreateAnnotationOnClick";
import OverlapOutline from "./OverlapOutline";
import { useHotkeys } from "react-hotkeys-hook";
import { GotoAnnotation } from "./GotoAnnotation";
import { useOptimalAssignment } from "./useOptimalAssignment";
import { Legend } from "./Legend";
import { multiply, inv, Matrix } from "mathjs";
import useAckOnTimeout from "./useAckOnTimeout";
import { ShowMarkers } from "./ShowMarkers";
import { Map } from 'leaflet';
import { GlobalContext } from "./Context";
import type { AnnotationType, ExtendedAnnotationType, ImageType } from "./schemaTypes";
import { useOptimisticUpdates } from "./useOptimisticUpdates";
import { useAnnotationNavigation } from "./useAnnotationNavigation";
import { CRUDHook } from "./Context";
import { ImageContextFromHook } from "./ImageContext";
import { Schema } from "../amplify/data/resource";

type RegisterPairProps = {
  images: [ImageType, ImageType]; // The pair of images in which we need to register the annotations
  selectedSet: string; // The active AnnotationSet
  next: () => void; // Function to call to move to the next pair
  prev: () => void;  // Function to call to move to the previous pair
  transforms?: Matrix[]; // The transforms to map points image 1 coordinates to image 2 coordinates and vice versa. 
  visible: boolean; // Whether the component is visible
  ack: () => void; // Function to call to acknowledge the pair (mark it as completed). This will typically remove the underlying message from the task queue.
  selectedCategoryIDs?: string[]; // The ids of the selected categories
};

// Function to transform a point using a homography matrix
const transform = (H: Matrix) => (c1: [number, number]): [number, number] => {
  const result = multiply(H, [c1[0], c1[1], 1]).valueOf() as number[];
  return [result[0] / result[2], result[1] / result[2]]; 
};

export function RegisterPair({
  images,
  selectedSet,
  transforms,
  next,
  prev,
  visible,
  selectedCategoryIDs,
  ack
}: RegisterPairProps) {
  const [index, setIndex] = useState(-1);
  const [map1, setMap1] = useState<Map | null>(null);
  const [map2, setMap2] = useState<Map | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [linkImages, setLinkImages] = useState(true);
  const [leniency, setLeniency] = useState(400);
  
  const subscriptionFilter1 = useMemo(() => ({
    filter: { and:[{setId: { eq: selectedSet }}, {imageId: { eq: images[0].id }}]}
  }), [selectedSet, images[0].id]);
  
  const subscriptionFilter2 = useMemo(() => ({
    filter: { and:[{setId: { eq: selectedSet }}, {imageId: { eq: images[1].id }}]}
  }), [selectedSet, images[1].id]);

  const {client} = useContext(GlobalContext)!;

  const annotationsHooks =[
    useOptimisticUpdates<Schema['Annotation']['type'], 'Annotation'>(
      'Annotation',
      async (nextToken) => client.models.Annotation.annotationsByImageIdAndSetId(
        { imageId: images[0].id, setId: { eq: selectedSet } },
        { nextToken }
      ),
      subscriptionFilter1
    ),
    useOptimisticUpdates<Schema['Annotation']['type'], 'Annotation'>(
      'Annotation',
      async (nextToken) => client.models.Annotation.annotationsByImageIdAndSetId(
        { imageId: images[1].id, setId: { eq: selectedSet } },
        { nextToken }
      ),
      subscriptionFilter2
    )
  ] as [CRUDHook<AnnotationType>, CRUDHook<AnnotationType>];

  const [matchStatus, setMatchStatus] = useState<Record<string, number>>({});

  const setMatch = useCallback((anno1: Partial<ExtendedAnnotationType>, anno2: Partial<ExtendedAnnotationType>, val: number) => {
    setMatchStatus((m) => {
      const mNew = { ...m };
      if (anno1.id && anno2.id) {
        mNew[anno1.id + anno2.id] = val;
      }
      return mNew;
    });
  }, []);

  const rejectMatch = useCallback(([anno1, anno2]: [ExtendedAnnotationType, ExtendedAnnotationType]) => {
    setMatch(anno1, anno2, -1);
  }, [setMatch]);

  const getMatchStatus = useCallback(
    ([anno1, anno2]: [AnnotationType, AnnotationType]): number => {
      return matchStatus[anno1.id + anno2.id] || 0;
    },
    [matchStatus],
  );

  const { enhancedAnnotationHooks } = useOptimalAssignment({
    annotationsHooks,
    transforms: transforms ? transforms.map(transform) : [],
    getMatchStatus,
    images,
    leniency,
  });

  const { 
    next: nextAnnotation, 
    prev: prevAnnotation, 
    activeObjectId, 
    confirmMatch 
  } = useAnnotationNavigation({
    images,
    annotationHooks: enhancedAnnotationHooks as [any, any],
    next,
    prev,
    selectedCategoryIDs: selectedCategoryIDs || []
  });

  const activeAnnotation = useMemo(() => {
    if (!activeObjectId) return undefined;
    return enhancedAnnotationHooks[0].data.find(anno => anno.proposedObjectId === activeObjectId) ||
           enhancedAnnotationHooks[1].data.find(anno => anno.proposedObjectId === activeObjectId);
  }, [activeObjectId, enhancedAnnotationHooks]);

  useHotkeys("ArrowRight", nextAnnotation,{enabled:visible});
  useHotkeys("Ctrl+ArrowRight", next, { enabled: visible });
  useHotkeys("ArrowLeft", prevAnnotation, { enabled: visible });
  useHotkeys("Ctrl+ArrowLeft",prev, { enabled: visible });
  useHotkeys("Space",confirmMatch,{ enabled: visible });
  useHotkeys(
    "BACKSPACE",
    () => {
      if (index >= 0) {
        rejectMatch(matches[index]);
      }
    },
    { enabled: visible },
  );


  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      width: '100%',
      gap: '10px'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        gap: '10px'
      }}>
        {images?.length == 2 && images?.map((image, i) =>
          <ImageContextFromHook key={i} hook={enhancedAnnotationHooks[i]} image={image}>
            <BaseImage
            visible={visible}
            activeAnnotation={activeAnnotation}
            location={{ image, annotationSetId: selectedSet }}
            setId={selectedSet}
              fullImage={false}
              otherImageId={images[1 - i].id}
            boundsxy={[
              [0, 0],
              [image.width, image.height],
            ]}
            containerwidth="45vw"
            containerheight="80vh"
            img={image}
            x={image.width / 2}
            y={image.height / 2}
            width={image.width}
            height={image.height}
            >
            {transforms && (
              <GotoAnnotation
                image={image}
                activeAnnotation={activeAnnotation}
                transform={transforms![1 - i]}
              />
            )}
            <CreateAnnotationOnClick
              setId={selectedSet}
              image={image}
              annotationsHook={enhancedAnnotationHooks[i]}
              source="registerpair"
              location={{ x: image.width / 2, y: image.height / 2, width: image.width, height: image.height, annotationSetId: selectedSet, image }}
            />
            <ShowMarkers annotationsHook={enhancedAnnotationHooks[i]} activeAnnotation={activeAnnotation} />
            {transforms && linkImages && (
              <LinkMaps
                otherMap={[map2, map1][i]}
                setMap={[setMap1, setMap2][i]}
                transform={transforms![i]}
                blocked={blocked}
                setBlocked={setBlocked}
              />
            )}
            {i == 1 && <Legend position="bottomright" />}
            </BaseImage>
          </ImageContextFromHook>
        )}
      </div>
      {transforms && (
        <>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            userSelect: 'none'
          }}>
            <input
              type="checkbox"
              checked={linkImages}
              onChange={(e) => setLinkImages(e.target.checked)}
            />
            Link Images according to linking transform
          </label>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            userSelect: 'none'
          }}>
            <label htmlFor="leniency">Pairing leniency (px)</label>
            <input
              type="range"
              id="leniency"
              min="0"
              max="1000"
              value={leniency}
              style={{ width: '200px' }}
              onChange={(e) => setLeniency(parseInt(e.target.value))}
            />
          </div>
        </>
      )}
    </div>
  );
}
