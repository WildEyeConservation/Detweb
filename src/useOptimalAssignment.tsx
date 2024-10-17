import computeMunkres from "munkres-js";
import { useState, useEffect, useMemo, useCallback } from "react";
import { square, sqrt } from "mathjs";
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

const MISMATCH_TOLERANCE = 400;
/* This parameter determines the minimum distance between two annotations (in pixels), for which the algorithm will consider 
proposing a match. It may need to be adjusted in future based on resolution of input images and expected accuracy of 
annotations/regsitration.*/ 

/* This is a custom hook that assists us with performing optimal assignment between two sets of annotations, based on the 
distances between them. It is used by the RegisterPair component. Because the annotations may be in two different coordinate 
systems (when they correspond to two different images as opposed to when we are simply consolidating two independent sets of 
annotations on the same image), we need to accept a transforms parameter, which is expected to contain a pair of functions. The 
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
  const annotations = useMemo(() => [annotationsHooks[0].data, annotationsHooks[1].data],
    [annotationsHooks[0].data, annotationsHooks[1].data]);
  
  const [enhancedAnnotations, setEnhancedAnnotations] = useState<[ExtendedAnnotationType[], ExtendedAnnotationType[]]>([[], []]);
  
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
      id: 'shadow'+anno.id, // Generate a unique id for the new annotation
      projectId: anno.projectId,
      shadow: true, /* Indicates that this is a shadow annotation, in other words, it corresponds to an annotation that we think 
      should exist, but it doesn't (yet), either because an animal was missed by annotators/algorithms or because the animal in 
      question is not visible in the relevant image (outside FOV or obscured)
      */
      categoryId: anno.categoryId,
      x: Math.round(projected[0]),
      y: Math.round(projected[1]),
      source: "proposedByMunkres",
      obscured,
      imageId: image.id,
      setId: anno.setId,
    };
  }

  function dist(a: { x: number, y: number }, b: { x: number, y: number }): number {
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
      const N = annotations[0]?.length + annotations[1]?.length;
      if (N) {
        const proposedObjectIdMap: Record<string, string> = {}; // maps annotation ids to proposed object ids.
        let distMatrix = Array(N)
          .fill(0)
          .map(() => Array(N).fill(MISMATCH_TOLERANCE));
        for (const [i, annoI] of annotations[0].entries()) {
          let projected = transforms[0]([annoI.x, annoI.y]);
          for (const [j, annoJ] of annotations[1].entries()) {
            if (annoI.objectId && annoJ.objectId) {
              distMatrix[i][j] =
                annoI.objectId === annoJ.objectId ? -100000 : 100000;
              // If the annotations are assigned topo objects, we want to enforce a match if they are assigned to the same object and
              // forbid it if they are assigned to different objects..
            } else {
              switch (getMatchStatus([annoI, annoJ])) {
                case -1:
                  distMatrix[i][j] = Infinity;
                  break;
                default:
                  distMatrix[i][j] = // Alternatively, we set the cost to the distance between the annotations if they are of the same category.
                    annoI.categoryId === annoJ.categoryId
                      ? dist({ ...annoI, x: projected[0], y: projected[1] }, annoJ)
                      : Infinity; // If they are of different categories, we set the cost to a large number.
                  break;
              }
            }
          }
        }
        const proposed: [ExtendedAnnotationType[], ExtendedAnnotationType[]] = [[], []];
        computeMunkres(distMatrix)
          .map(([matchI, matchJ]: [number, number]): [AnnotationType, AnnotationType] => [
            annotations[0]?.[matchI],
            annotations[1]?.[matchJ],
          ])
          .forEach(([a, b]) => {
            // Here we add proposedObjectIds to the annotations. We use objectIds if they exist to generate unique identicons for 
            // each object, so that the user can visually identify the matches. We also want to generate identicons for proposed 
            // matches, but without assigning objectIDs (because that will make the algorithm think that these matches have been 
            // accepted). Thus we add the proposedObjectId field to the type and try to generate an id that will be somewhat stable.
            // We could also just use crypto.randomUUID(), but that causes the identicon of a proposed matched pair to change on 
            // every rerender, which is visually distracting. Thus the need for stability.
            const id =
              a?.objectId || b?.objectId || a?.id || b?.id;
            if (a && b) {
              // if both annotations exist we just add the proposedObjectId to the map under each id.
              proposedObjectIdMap[a.id] = id;
              proposedObjectIdMap[b.id] = id;
              return
            }
            if (a && !a.obscured) {
              // If the first annotation exists and is visible, but the second does not, 
              //we create a new shadow annotation for the second image.
              const shadowAnnotation = createNewAnnotation(a, transforms[0], images[1]);
              proposed[1].push(shadowAnnotation);
              proposedObjectIdMap[a.id] = id;
              proposedObjectIdMap[shadowAnnotation.id] = id;
              return
            }
            if (b && !b.obscured) {
              // If the second annotation exists and is visible, but the first does not, 
              //we create a new shadow annotation for the first image.
              const shadowAnnotation = createNewAnnotation(b, transforms[1], images[0]);
              proposed[0].push(shadowAnnotation);
              proposedObjectIdMap[b.id] = id;
              proposedObjectIdMap[shadowAnnotation.id] = id;
              return
            }
          })
        setEnhancedAnnotations([
          annotations[0].concat(proposed[0]).map(anno => ({ ...anno, proposedObjectId: proposedObjectIdMap[anno.id] })),
          annotations[1].concat(proposed[1]).map(anno => ({ ...anno, proposedObjectId: proposedObjectIdMap[anno.id] }))
        ]);
      }
    }
  }, [annotations[0],annotations[1], transforms]);

  return {
    enhancedAnnotationHooks: [0, 1].map(i => {
      return {
        data: enhancedAnnotations[i],
        create: annotationsHooks[i].create,
        update: useCallback((anno: ExtendedAnnotationType) => {
          if (anno.shadow) {
            annotationsHooks[i].create({...anno, objectId:anno.proposedObjectId, proposedObjectId:undefined, shadow:undefined});
          } else {
            annotationsHooks[i].update({id:anno.id,objectId:anno.proposedObjectId});
          }
        }, []),
        delete: annotationsHooks[i].delete,
      }
    })
  }
}