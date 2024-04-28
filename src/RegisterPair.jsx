import React, { useState, useCallback } from "react";
import BaseImage from "./BaseImage";
import LinkMaps from "./LinkMaps";
import CreateAnnotationOnClick from "./CreateAnnotationOnClick";
import OverlapOutline from "./OverlapOutline";
import { useHotkeys } from "react-hotkeys-hook";
import { GotoAnnotation } from "./GotoAnnotation";
import { useOptimalAssignment } from "./useOptimalAssignment";
import { useAnnotations } from "./useGqlCached";
import { Legend } from "./Legend";
import { multiply, inv } from "mathjs";
import useAckOnTimeout from "./useAckOnTimeout";

const transform = (H) => (c1) => {
  c1 = multiply(H, [c1[0], c1[1], 1]).valueOf();
  return { x: c1[0] / c1[2], y: c1[1] / c1[2] };
};

export function RegisterPair({
  images,
  selectedSet,
  next,
  prev,
  homography,
  visible,
  ack,
}) {
  const [index, setIndex] = useState(-1);
  const [map1, setMap1] = useState(undefined); // Refs to the two leaflet maps. Necessary to keep them synchronized with LinkMaps
  const [map2, setMap2] = useState(undefined);
  const [blocked, setBlocked] = useState(false);
  const annotationsHooks = [
    useAnnotations(images?.[0]?.key, selectedSet),
    useAnnotations(images?.[1]?.key, selectedSet),
  ];
  const [matchStatus, setMatchStatus] = useState({});
  const setMatch = (anno1, anno2, val) => {
    setMatchStatus((m) => {
      const mNew = { ...m };
      mNew[anno1.id + anno2.id] = val;
      return mNew;
    });
  };
  const rejectMatch = ([anno1, anno2]) => {
    setMatch(anno1, anno2, -1);
  };
  const acceptMatch = ([anno1, anno2]) => {
    setMatch(anno1, anno2, 1);
  };
  const transforms = homography
    ? [transform(homography), transform(inv(homography))]
    : null;
  const getMatchStatus = useCallback(
    ([anno1, anno2]) => {
      return matchStatus[anno1.id + anno2.id];
    },
    [matchStatus],
  );
  const { matches, getAugmentedHook } = useOptimalAssignment({
    annotationsHooks,
    transforms,
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
      getAugmentedHook(0).annotations.map((anno) =>
        confirmAnnotation(anno, getAugmentedHook(0)),
      );
      getAugmentedHook(1).annotations.map((anno) =>
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

  function confirmAnnotation(anno, hook) {
    if (!anno.objectId && anno.proposedObjectId) {
      anno.objectId = anno.proposedObjectId;
      if (anno.id) {
        hook.updateAnnotation(anno);
      } else {
        hook.createAnnotation(anno);
      }
    }
  }

  useHotkeys(
    "Space",
    () => {
      console.log("Spacebar");
      if (index >= 0) {
        for (const i in matches[index]) {
          const anno = matches[index][i];
          confirmAnnotation(anno, annotationsHooks[i]);
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
          <BaseImage
            visible={visible}
            setId={selectedSet}
            fullImage={false}
            key={image.key + i}
            boundsxy={[
              [0, 0],
              [image.width, image.height],
            ]}
            containerwidth="45vw"
            containerheight="80vh"
            image={image}
            x={image.width / 2}
            y={image.height / 2}
            width={image.width}
            height={image.height}
            next={i == 0 && nextAnnotation}
            prev={i == 0 && prevAnnotation}
          >
            {homography && (
              <GotoAnnotation
                image={image}
                activeAnnotation={activeAnnotation}
                transform={transforms[1 - i]}
              />
            )}
            {homography && (
              <OverlapOutline image={image} transform={transforms[1 - i]} />
            )}
            <CreateAnnotationOnClick
              setId={selectedSet}
              image={image}
              annotationsHook={getAugmentedHook(i)}
              activeAnnotation={matches?.[index]?.[i]}
            />
            {homography && (
              <LinkMaps
                otherMap={[map2, map1][i]}
                setMap={[setMap1, setMap2][i]}
                transform={transforms[i]}
                blocked={blocked}
                setBlocked={setBlocked}
              />
            )}
            {i == 1 && <Legend position="bottomright" />}
          </BaseImage>
        ))}
    </>
  );
}
