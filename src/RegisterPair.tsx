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
import { useOptimisticAnnotation } from "./useOptimisticUpdates";

type RegisterPairProps = {
  images: [ImageType, ImageType]; // The pair of images in which we need to register the annotations
  selectedSet: string; // The active AnnotationSet
  next: () => void; // Function to call to move to the next pair
  prev: () => void;  // Function to call to move to the previous pair
  homography?: Matrix; // The homography matrix if available
  visible: boolean; // Whether the component is visible
  ack: () => void; // Function to call to acknowledge the pair (mark it as completed). This will typically remove the underlying message from the task queue.
};

// Function to transform a point using a homography matrix
const transform = (H: Matrix) => (c1: [number, number]): [number, number] => {
  const result = multiply(H, [c1[0], c1[1], 1]).valueOf() as number[];
  return [result[0] / result[2], result[1] / result[2]]; 
};

export function RegisterPair({
  images,
  selectedSet,
  next,
  prev,
  homography,
  visible,
  message_id,
  ack }: RegisterPairProps) {
  const [index, setIndex] = useState(-1); // A marker to track which annotation we are currently registering
  const [map1, setMap1] = useState<Map | null>(null); // The map for the first image
  const [map2, setMap2] = useState<Map | null>(null); // The map for the second image
  const [blocked, setBlocked] = useState(false);
  // memoized subscription filters for the annotations in the two images. 
  const subscriptionFilter1 = useMemo(() => ({
    filter: { and:[{setId: { eq: selectedSet }}, {imageId: { eq: images[0].id }}]}
  }), [selectedSet,images[0].id]);
  const subscriptionFilter2 = useMemo(() => ({
      filter: { and:[{setId: { eq: selectedSet }}, {imageId: { eq: images[1].id }}]}
  }), [selectedSet, images[1].id]);
  // The GQL client to interact with the backend
  const {client} = useContext(GlobalContext)!;
  // The annotations hooks for the two images. Each hook provides a list of annotations (called Data) that is kept updated in 
  //realtime and functions to create / update / delete them.
  const annotationsHooks = [
    useOptimisticAnnotation(
      async () => client.models.Annotation.annotationsByImageIdAndSetId({imageId: images[0].id, setId: {eq: selectedSet}}),
      subscriptionFilter1),
    useOptimisticAnnotation(
      async () => client.models.Annotation.annotationsByImageIdAndSetId({imageId: images[1].id, setId: {eq: selectedSet}}),
      subscriptionFilter2)]
  /* We need to keep track of which potential matches has been rejected by the user, so that we don't keep suggesting the same
  previously rejected match. This dictionary is keyed by a string which is just id1 concatenated to id2 where id1 and id2 are 
  the ids of the two annotations that are potential matches. The value is 1 if the match is accepted, -1 if it is rejected, and 0 if 
  we haven't made a decision about it.
  */
  const [matchStatus, setMatchStatus] = useState<Record<string, number>>({});
  const setMatch = (anno1: Partial<ExtendedAnnotationType>, anno2: Partial<ExtendedAnnotationType>, val: number) => {
    setMatchStatus((m) => {
      const mNew = { ...m };
      mNew[anno1.id + anno2.id] = val;
      return mNew;
    });
  };

  const rejectMatch = ([anno1, anno2]: [ExtendedAnnotationType, ExtendedAnnotationType]) => {
    setMatch(anno1, anno2, -1);
  };

  // The transforms to map points image 1 coordinates to image 2 coordinates and vice versa. 
  const transforms = homography
    ? [transform(homography), transform(inv(homography))]
    : null;
  
    /* This function is used to get the status of a potential match. It is used by the useOptimalAssignment hook to avoid
  suggesting previously rejected matches.
  */
  const getMatchStatus = useCallback(
    ([anno1, anno2]: [AnnotationType, AnnotationType]): number => {
      return matchStatus[anno1.id + anno2.id];
    },
    [matchStatus],
  );

  // The useOptimalAssignment hook is used to find a good pairing of annotations between the two images. It also suggests
  // some new annotations that it think should be created (e.g. when a annotation in image1 projects to a location inside image2)
  // and there is no annotation in image2 that matches it. The getAugmentedHook function is used to get an augmented hook that contains
  // a deep copy of the original annotations with proposed objectIds as well as the shadow annotations that we are suggesting (also with
  // proposed objectIds).
  // It also provides a list of matches which is a list of pairs of annotations that are potential matches, so that we can itarte through
  // the matches and confirm or reject them one by one..
  
  const { matches, getAugmentedHook } = useOptimalAssignment({
    annotationsHooks,
    transforms: transforms || [],
    getMatchStatus,
    images,
  });

  // This just allows us to automatically acknowledge a pair as having been registered similar to how we acknowledge locations in AnnotationImage.
  // This doesn't currently go anywhere (there is no equivalent of the observations table to keep track of which user registered which pair)
  // but it is here if or when we need it.
  const newNext = useAckOnTimeout({ next, visible, ack });

  const nextAnnotation = () => {
    // If we are still iterating through the matches, just move to the next one.
    if (index < matches.length - 1) {
      setIndex((i) => i + 1);
    } else {
    // Once we get to the end, send all the updates 
      getAugmentedHook(0).annotations?.map((anno: AnnotationType) =>
        confirmAnnotation(anno, getAugmentedHook(0)),
      );
      getAugmentedHook(1).annotations?.map((anno: Annotation) =>
        confirmAnnotation(anno, getAugmentedHook(1)),
      );// Move to the next pair and set the index to -1, which corresponds to a zoomed out overview.
      setIndex(-1);
      newNext?.();
    }
    //setLocalAnnotations(localAnnotations)
  };

  // useHotkeys("ArrowRight", () => {
  //   nextAnnotation();
  // }, [matches, index]);

  function confirmAnnotation(anno: AnnotationType, hook: any) {
    if (!anno.objectId && anno.proposedObjectId) {
      anno.objectId = anno.proposedObjectId; // The proposed ObjectID becomes the actual objectId
      anno.shadow = false; // Once the annotation has been confirmed, it is no longer a shadow annotation.
    }
    if (anno.id) { // If the annotation already exists, update it
      hook.update(anno);
    } else { // Otherwise create it (ie. it was a shadow annotation).
      hook.create(anno);
    }
  }

  useHotkeys(
    "Space",
    () => {
      console.log("Spacebar");
      if (index >= 0) {
        matches[index].forEach((anno, i) => {
          confirmAnnotation(anno, annotationsHooks[i]);
        })
      }
      nextAnnotation();
    },
    { enabled: visible },
  );

  useHotkeys(
    "`",
    () => {
      if (index >= 0) {
        rejectMatch(matches[index]);
      }
    },
    { enabled: visible },
  );

  useHotkeys(
    "Ctrl+ArrowRight",
    () => {
      setIndex(-1);
      newNext?.();
    },
    { enabled: visible },
  );

  const prevAnnotation = () => {
    if (index > -1) {
      setIndex((i) => i - 1);
    } else {
      prev();
    }
    console.log("+");
  };

  // useHotkeys("ArrowLeft", prevAnnotation , [index]);

  useHotkeys(
    "Ctrl+ArrowLeft",
    () => {
      setIndex(-1);
      prev();
    },
    { enabled: visible },
  );

  const activeAnnotation = matches?.[index]?.[0] || matches?.[index]?.[1];

  return <>{images?.length == 2 && images?.map((image, i) => 
          <BaseImage
              key={i}
              visible={visible}
            //activeAnnotation={activeAnnotation}
              location={{ image }}
              setId={selectedSet}
              fullImage={false}
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
              next={i === 0 ? nextAnnotation : undefined}
              prev={i === 0 ? prevAnnotation : undefined}
            >
              {transforms && (
                <GotoAnnotation
                  image={image}
                  activeAnnotation={activeAnnotation}
                  transform={transforms![1 - i]}
                />
              )}
              {transforms && (
                <OverlapOutline image={image} transform={transforms![1 - i]} />
              )}
              <CreateAnnotationOnClick
                setId={selectedSet}
                image={image}
                annotationsHook={annotationsHooks[i]}
                location={{ x: image.width / 2, y: image.height / 2, width: image.width, height: image.height }}
                // Removed activeAnnotation prop
              />
                <ShowMarkers annotationsHook={getAugmentedHook(i as 0 | 1)} activeAnnotation={activeAnnotation}/>
              {transforms && (
                <LinkMaps
                  otherMap={[map2, map1][i]}
                  setMap={[setMap1, setMap2][i]}
                  transform={transforms![i]}
                  blocked={blocked}
                  setBlocked={setBlocked}
                />
              )}
              {i == 1 && <Legend position="bottomright" />}
            </BaseImage>)
        }
    </>
}
