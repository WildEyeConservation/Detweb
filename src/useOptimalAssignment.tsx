import computeMunkres from "munkres-js";
import { useState, useEffect } from "react";
import { square, sqrt } from "mathjs";
import { AnnotationsContextType } from "./AnnotationsContext";

interface TransformFunction {
  (coordinates: [number, number]): [number, number];
}

interface Image {
  key: string;
  width: number;
  height: number;
}

interface AnnotationsHook {
  annotations: Annotation[];
}

interface UseOptimalAssignmentProps {
  annotationsHooks: AnnotationsHook[];
  getMatchStatus: (annotations: [Annotation, Annotation]) => number;
  transforms: TransformFunction[];
  images: Image[];
}

export function useOptimalAssignment({
  annotationsHooks,
  getMatchStatus,
  transforms,
  images,
}: UseOptimalAssignmentProps) {
  const [matches, setMatches] = useState<[Annotation, Annotation][]>([]);
  const [localAnnotations, setLocalAnnotations] = useState<[Annotation[], Annotation[]]>([[], []]);
  const [proposedAnnotations, setProposedAnnotations] = useState<[Annotation[], Annotation[]]>([
    [],
    [],
  ]);

  function createNewAnnotation(
    anno: Annotation,
    tf: TransformFunction,
    image: Image
  ): Annotation {
    let projected = tf([anno.x, anno.y]);
    const obscured =
      projected[0] < 0 ||
      projected[1] < 0 ||
      projected[0] > image.width ||
      projected[1] > image.height;
    return {
      id: crypto.randomUUID(), // Generate a unique id for the new annotation
      shadow: true,
      categoryId: anno.categoryId,
      x: Math.round(projected[0]),
      y: Math.round(projected[1]),
      obscured,
      imageKey: image.key,
      annotationSetId: anno.annotationSetId,
    };
  }

  function dist(a: Annotation, b: Annotation): number {
    return sqrt(square(a.x - b.x) + square(a.y - b.y)) as number;
  }

  useEffect(() => {
    if (transforms) {
      console.log("calcCostMatrix triggered");
      const N = localAnnotations[0]?.length + localAnnotations[1]?.length;
      if (N) {
        // Create an NxN matrix filled with 400
        let distMatrix = Array(N)
          .fill(0)
          .map(() => Array(N).fill(400));
        for (const [i, annoI] of localAnnotations[0].entries()) {
          let projected = transforms[0]([annoI.x, annoI.y]);
          for (const [j, annoJ] of localAnnotations[1].entries()) {
            if (annoI.objectId && annoJ.objectId) {
              distMatrix[i][j] =
                annoI.objectId === annoJ.objectId ? -100000 : 100000;
            } else {
              switch (getMatchStatus([annoI, annoJ])) {
                case -1:
                  distMatrix[i][j] = 10000;
                  break;
                case 1:
                  distMatrix[i][j] = -10000;
                  break;
                default:
                  distMatrix[i][j] =
                    annoI.categoryId === annoJ.categoryId
                      ? dist({ ...annoI,x: projected[0], y: projected[1] }, annoJ)
                      : 10000;
                  break;
              }
            }
          }
        }
        const proposed: [Annotation[], Annotation[]] = [[], []];
        const matches = computeMunkres(distMatrix)
          .map(([matchI, matchJ]: [number, number]):[Annotation, Annotation] => [
            localAnnotations[0]?.[matchI],
            localAnnotations[1]?.[matchJ],
          ])
          .map(([a, b]: [Annotation , Annotation ]) => {
            if (a && b) {
              return [a, b];
            }
            if (a && !a.obscured) {
              const temp = createNewAnnotation(a, transforms[0], images[1]);
              proposed[1].push(temp);
              return [a, temp];
            }
            if (b && !b.obscured) {
              const temp = createNewAnnotation(b, transforms[1], images[0]);
              proposed[0].push(temp);
              return [temp, b];
            } else {
              return [null, null];
            }
          })
          .filter(
            (pair): pair is [Annotation, Annotation] =>
              pair[0] !== null && pair[1] !== null
          )
          .filter(
            ([a, b]) => !(a.objectId && b.objectId)
          )
          .map(([entryA, entryB]: [Annotation, Annotation]):[Annotation, Annotation] => {
            // Add proposedIds
            const id =
              entryA?.objectId || entryB?.objectId || entryA.id || entryB.id;
            if (!entryA?.objectId && entryA) entryA.proposedObjectId = id;
            if (!entryB?.objectId && entryB) entryB.proposedObjectId = id;
            return [entryA, entryB];
          })
          .filter(([a, b]: [Annotation, Annotation]) => !(a.obscured || b.obscured));
        matches.sort((a, b) => (a[0].x + a[0].y > b[0].x + b[0].y ? 1 : -1));
        setProposedAnnotations(proposed);
        setMatches(matches);
      }
    }
  }, [localAnnotations, getMatchStatus, transforms, images]);

  useEffect(() => {
    setProposedAnnotations([[], []]);
    setLocalAnnotations(
      annotationsHooks.map(({ annotations }) =>
        annotations?.map((annotation) => {
          return { ...annotation };
        })
      ) as [Annotation[], Annotation[]]
    );
  }, [annotationsHooks]);

  function getAugmentedHook(i: number):AnnotationsContextType {
    return {
      ...(annotationsHooks[i]),
      annotations: localAnnotations[i]?.concat(proposedAnnotations[i]),
    };
  }

  return { getAugmentedHook, matches };
}
