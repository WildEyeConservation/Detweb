import computeMunkres from "munkres-js";
import { useState, useEffect } from "react";
import { square, sqrt } from "mathjs";
import { AnnotationsContextType } from "./AnnotationsContext";
import { AnnotationType, ImageType , ExtendedAnnotationType } from "./schemaTypes";
import { CRUDhook } from "./Context";
interface TransformFunction {
  (coordinates: [number, number]): [number, number];
}

interface UseOptimalAssignmentProps {
  annotationsHooks: [CRUDhook<'Annotation'>, CRUDhook<'Annotation'>];
  getMatchStatus: (annotations: [AnnotationType, AnnotationType]) => number;
  transforms: TransformFunction[];
  images: ImageType[];
}

/* This is a custom hook that assists us with performing optimal assignment between two sets of annotations, based on the 
distances between them. It is used by the RegisterPair component. Because the annotations may be in two different coordinate 
systems (when they correspond to two different images as opposed to when we are simply consolidating two independent sets of 
annotations on the same image), we need accept a transforms parameter, which is expected to contain a pair of functions. The 
first function maps from the coordinates of image 1 to the coordinates of image 2, and the second function does the inverse.

We also accept:
- a pair of annotation hooks, which provide us with the data (a list of annotations in each image.)
- a getMatchStatus function, which is used to access externally supplied information about the status of a potential match. 
It is typically used to avoid repeatedly suggesting matches that the user has allready rejected.
- a pair of image objects, which provide us with the image dimensions as well as the image IDs. We need the dimensions to 
check whether a projected coordinate lies inside the image bounds and we may need the id in cases where the one annotations
list is empty, but we should propose a shadow annotation in the corresponding image.

*/

export function useOptimalAssignment({
  annotationsHooks,
  getMatchStatus,
  transforms,
  images, 
}: UseOptimalAssignmentProps) {
  
  // The matches that we have proposed.
  const [matches, setMatches] = useState<[AnnotationType, AnnotationType][]>([]);
  // Local annotations are the annotations that we have in our local state, these have not been pushed to the backend.
  const [localAnnotations, setLocalAnnotations] = useState<[AnnotationType[], AnnotationType[]]>([[], []]);
  const [proposedAnnotations, setProposedAnnotations] = useState<[AnnotationType[], AnnotationType[]]>([
    [],
    [],
  ]);

  /* This function creates a new annotation, which is used when we are proposing new matches. It is used to create new annotations
  in the case that a match is proposed, but the corresponding annotation in the other image has not yet been annotated.
  */
  function createNewAnnotation(
    anno: ExtendedAnnotationType,
    tf: TransformFunction,
    image: ImageType
  ): ExtendedAnnotationType {
    let projected = tf([anno.x, anno.y]);
    const obscured =
      projected[0] < 0 ||
      projected[1] < 0 ||
      projected[0] > image.width ||
      projected[1] > image.height;
    return {
      id: crypto.randomUUID(), // Generate a unique id for the new annotation
      projectId: anno.projectId,
      shadow: true, /* Indicates that this is a shadow annotation, in other words, it corresponds to an annotation that we think 
      should exist, but it doesn't (yet), either because an animal was missed by annotators/algorithms or because the animal in 
      question is not visible in the relevant image (outside FOV or obscured)
      */
      categoryId: anno.categoryId,
      x: Math.round(projected[0]),
      y: Math.round(projected[1]),
      obscured,
      imageId: image.id,
      setId: anno.setId,
    };
  }

  function dist(a: {x:number, y:number}, b: {x:number, y:number}): number {
    return sqrt(square(a.x - b.x) + square(a.y - b.y)) as number;
  }

  // This effect recalculates the cost matrix whenever the transforms or the local annotations change. It is a square matrix
  // where the entry in row i and column j represents the "cost" of matching annotation[i] from set 1 to annotation[j] from
  // set 2. If the index i is within the range of valid annotation indexes in set 1, but j is outside the range of valid
  // annotation indexes in set 2, it corresponds to leaving annotation i unmatched, and vice versa. The goal of the munkres
  // algorithm is to find the optimal assignment of annotations, i.e. a bijection between sets 1 and 2 that minimizes the
  // total cost. How we define the cost matrix determines the algorithm's behavior.
  // We use the Munkres algorithm (also known as the Hungarian algorithm) to find the optimal assignment.
  // As output this effect updates the proposedAnnotations and matches state variables.
  // proposedAnnotations containe two arrays. The first contains all the shadow annotations proposed for image 1, and the second
  // contains all the shadow annotations proposed for image 2.
  // matches contains the list of matches proposed by the munkres algorithm. it is a list of pairs of annotations, 
  useEffect(() => {
    if (transforms) {
      console.log("calcCostMatrix triggered");
      const N = localAnnotations[0]?.length + localAnnotations[1]?.length;
      if (N) {
        // Create an NxN matrix filled with 400
        let distMatrix = Array(N)
          .fill(0)
          .map(() => Array(N).fill(400)); // This parameter (400)determines the maximum distance between two annotations, 
          // before the algorithm will consider proposing a match. It may need to be adjusted in future based on 
          //resolution of input images and expected accuracy of annotations/regsitration. 
        for (const [i, annoI] of localAnnotations[0].entries()) {
          let projected = transforms[0]([annoI.x, annoI.y]);
          for (const [j, annoJ] of localAnnotations[1].entries()) {
            if (annoI.objectId && annoJ.objectId) {
              distMatrix[i][j] =
                annoI.objectId === annoJ.objectId ? -100000 : 100000;
              // If the annotations are assigned topo objects, we want to enforce a match if they are assigned to the same object and
              // forbid it if they are assigned to different objects..
            } else {
              switch (getMatchStatus([annoI, annoJ])) {
                case -1:
                  distMatrix[i][j] = 10000; // If the user has rejected the proposed match, we set the cost to a large number.
                  break;
                case 1:
                  distMatrix[i][j] = -10000; // If the user has accepted the proposed match, we set the cost to a very large negative number.
                  break;
                default:
                  distMatrix[i][j] = // Alternatively, we set the cost to the distance between the annotations if they are of the same category.
                    annoI.categoryId === annoJ.categoryId
                      ? dist({ ...annoI, x: projected[0], y: projected[1] }, annoJ)
                      : 10000; // If they are of different categories, we set the cost to a large number.
                  break;
              }
            }
          }
        }
        const proposed: [ExtendedAnnotationType[], ExtendedAnnotationType[]] = [[], []];
        const matches = computeMunkres(distMatrix)
          .map(([matchI, matchJ]: [number, number]): [ExtendedAnnotationType, ExtendedAnnotationType] => [
            localAnnotations[0]?.[matchI],
            localAnnotations[1]?.[matchJ],
          ])
          .map(([a, b]: [ExtendedAnnotationType, ExtendedAnnotationType]) => {
            if (a && b) {
              return [a, b];
            } 
            if (a && !a.obscured) {
              // If the first annotation exists and is visible, but the second does not, 
              //we create a new shadow annotation for the second image.
              const temp = createNewAnnotation(a, transforms[0], images[1]);
              proposed[1].push(temp);
              return [a, temp];
            }
            if (b && !b.obscured) {
              // If the second annotation exists and is visible, but the first does not, 
              //we create a new shadow annotation for the first image.
              const temp = createNewAnnotation(b, transforms[1], images[0]);
              proposed[0].push(temp);
              return [temp, b];
            } else {
              // This just corresponds to matching a dummy row to a dummy column, so we don't need to do anything.
              return [null, null];
            }
          })
          .filter( //filter out the dummy matches
            (pair): pair is [ExtendedAnnotationType, ExtendedAnnotationType] =>
              pair[0] !== null && pair[1] !== null
          )
          .filter( // And filter out the matches that have allready been confirmed. We don't want to waste the user's time with these.
            ([a, b]) => !(a.objectId && b.objectId)
          )
          .map(([entryA, entryB]: [ExtendedAnnotationType, ExtendedAnnotationType]): [ExtendedAnnotationType, ExtendedAnnotationType] => {
            // Here we add proposedObjectIds to the annotations. We use objectIds if they exist to generate unique identicons for 
            // each object, so that the user can visually identify the matches. We also want to generate identicons for proposed 
            // matches, but without assigning objectIDs (because that will make the algorithm think that these matches have been 
            // accepted). Thus we add the proposedObjectId field to the type and try to generate an id that will be somewhat stable.
            // We could also just use crypto.randomUUID(), but that causes the identicon of a proposed matched pair to change on 
            // every rerender, which is visually distracting. Thus the need for stability.
            const id =
              entryA?.objectId || entryB?.objectId || entryA.id || entryB.id;
            if (!entryA?.objectId && entryA) entryA.proposedObjectId = id;
            if (!entryB?.objectId && entryB) entryB.proposedObjectId = id;
            return [entryA, entryB];
          })
          .filter(([a, b]: [Annotation, Annotation]) => !(a.obscured && b.obscured)); // Don't waste the user's time with matches where 
        // both annotations are obscured.
        matches.sort((a, b) => (a[0].x + a[0].y > b[0].x + b[0].y ? 1 : -1));
        // Try to sort the matches in a logical way, so that we don't pan wildly all over the image as we iterate over the proposed matches.
        // This does not work particularly well, we should implement something like a TSP solver in future.
        setProposedAnnotations(proposed);
        setMatches(matches);
      }
    }
  }, [localAnnotations]);

  // This effect just blanks the state on first load. proposedAnnotations is [[],[]] 
  // (no shadow annotations have been proposed for either image) and localAnnotations is just a
  // deep copy of the initial data from the backend. We should think about how to handle the case where the backend
  // data changes while the user is working. We could react to such an event by adding annotationsHooks to the sensitivity
  // list here, but that will probably cause a pretty disorientating reset, if it gets triggered while the user is working.
  useEffect(() => {
    if (annotationsHooks[0].meta.isSuccess && annotationsHooks[1].meta.isSuccess) {
    setProposedAnnotations([[], []]);
    setLocalAnnotations(
      annotationsHooks.map(({ data }) =>
        data?.map((annotation) => {
          return { ...annotation };
        })
      ) as [ExtendedAnnotationType[], ExtendedAnnotationType[]]
    );
  }
  }, [annotationsHooks[0].meta.isSuccess, annotationsHooks[1].meta.isSuccess]);

  // This function returns an augmented hook that contains the local annotations and the proposed annotations.
  function getAugmentedHook(i: number):AnnotationsContextType {
    return {
      ...(annotationsHooks[i]),
      data: localAnnotations[i]?.concat(proposedAnnotations[i]),
    };
  }

  return { getAugmentedHook, matches };
}
