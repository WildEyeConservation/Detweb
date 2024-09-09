import { useState, useCallback,useMemo} from "react";
import BaseImage from "./BaseImage";
import LinkMaps from "./LinkMaps";
import CreateAnnotationOnClick from "./CreateAnnotationOnClick";
import OverlapOutline from "./OverlapOutline";
import { useHotkeys } from "react-hotkeys-hook";
import { GotoAnnotation } from "./GotoAnnotation";
import { useOptimalAssignment } from "./useOptimalAssignment";
import { useAnnotations } from "./useGqlCached";
import { Legend } from "./Legend";
import { multiply, inv, Matrix } from "mathjs";
import useAckOnTimeout from "./useAckOnTimeout";
import { ShowMarkers } from "./ShowMarkers";
import Annotations from "./AnnotationsContext";
import { Map } from 'leaflet';
import type { ImageMetaType, AnnotationType, ExtendedAnnotationType } from "./schemaTypes";

type RegisterPairProps = {
  images: [ImageMetaType, ImageMetaType];
  selectedSet: string;
  next: () => void;
  prev: () => void; 
  homography?: Matrix;
  visible: boolean;
  ack: () => void;
};

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
  ack}: RegisterPairProps) {
  const [index, setIndex] = useState(-1);
  const [map1, setMap1] = useState<Map | null>(null);
  const [map2, setMap2] = useState<Map | null>(null);
  const [blocked, setBlocked] = useState(false);
  const annotationsHooks = [
    useAnnotations(images?.[0]?.key, selectedSet) || { annotations: [], createAnnotation: () => {}, deleteAnnotation: () => {}, updateAnnotation: () => {} },
    useAnnotations(images?.[1]?.key, selectedSet) || { annotations: [], createAnnotation: () => {}, deleteAnnotation: () => {}, updateAnnotation: () => {} },
  ].map((hook)=>({...hook,annotations:hook.annotations || []}));
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
  // const acceptMatch = ([anno1, anno2]: [Annotation, Annotation]) => {
  //   setMatch(anno1, anno2, 1);
  // };
  const transforms = homography
    ? [transform(homography), transform(inv(homography))]
    : null;
  const getMatchStatus = useCallback(
    ([anno1, anno2]: [AnnotationType, AnnotationType]): number => {
      return matchStatus[anno1.id + anno2.id];
    },
    [matchStatus],
  );
  const { matches, getAugmentedHook } = useOptimalAssignment({
    annotationsHooks,
    transforms: transforms || [],
    getMatchStatus,
    images,
  });
  // const matches=[]
  // const getAugmentedHook=(i)=>annotationsHooks[i]
  console.log("registerpair");
  const newNext = useAckOnTimeout({ next, visible, ack });

  const nextAnnotation = () => {
    if (index < matches.length - 1) {
      setIndex((i) => i + 1);
    } else {
      getAugmentedHook(0).annotations?.map((anno: AnnotationType) =>
        confirmAnnotation(anno, getAugmentedHook(0)),
      );
      getAugmentedHook(1).annotations?.map((anno: Annotation) =>
        confirmAnnotation(anno, getAugmentedHook(1)),
      );
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
      anno.objectId = anno.proposedObjectId;
    }
    anno.objectId = anno.objectId || ''; 
    if (anno.id) {
      hook.updateAnnotation(anno);
    } else {
      hook.createAnnotation(anno);
    }
  }

  useHotkeys(
    "Space",
    () => {
      console.log("Spacebar");
      if (index >= 0) {
        for (const i in matches[index]) {
          const anno = matches[index][i];
          confirmAnnotation(anno, annotationsHooks[parseInt(i, 10)]);
        }
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

  return (
    <>
      {images?.length == 2 &&
        images?.map((image, i) => (
          <Annotations key={i} annotationsHook={getAugmentedHook(i as 0 | 1)}>
            {useMemo(() => <BaseImage
              visible={visible}
              //activeAnnotation={activeAnnotation}
              setId={selectedSet}
              fullImage={false}
              key={image.key + i}
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
              {homography && (
                <GotoAnnotation
                  image={image}
                  activeAnnotation={activeAnnotation}
                  transform={transforms![1 - i]}
                />
              )}
              {homography && (
                <OverlapOutline image={image} transform={transforms![1 - i]} />
              )}
              <CreateAnnotationOnClick
                setId={selectedSet}
                image={image}
                annotationsHook={annotationsHooks[i]}
                location={{ x: image.width / 2, y: image.height / 2, width: image.width, height: image.height }}
                // Removed activeAnnotation prop
              />
              <ShowMarkers annotations={annotationsHooks[i].annotations} activeAnnotation={activeAnnotation}/>
              {homography && (
                <LinkMaps
                  otherMap={[map2, map1][i]}
                  setMap={[setMap1, setMap2][i]}
                  transform={transforms![i]}
                  blocked={blocked}
                  setBlocked={setBlocked}
                />
              )}
              {i == 1 && <Legend position="bottomright" />}
            </BaseImage>, [visible,selectedSet,image,activeAnnotation,map2,map1])}
            </Annotations>
        ))}
    </>
  );
}
