import { useState } from "react";
import { ExtendedAnnotationType } from "./schemaTypes";
import { square, sqrt } from "mathjs";

interface ExtendedAnnotationHook {
  data: ExtendedAnnotationType[];
  create: (anno: ExtendedAnnotationType) => void;
  update: (anno: ExtendedAnnotationType) => void;
}

interface UseAnnotationNavigationInput {
  annotationHooks: [ExtendedAnnotationHook, ExtendedAnnotationHook];
  create: (anno: AnnotationType) => void;
  update: (anno: AnnotationType) => void;
  next: () => void;
  prev: () => void;
  selectedCategoryIDs: string[];
}

/* This is a custom hook that aids in navigating between annotations in a RegisterPair component or similar. It is used to move the active 
annotation forward or backward, preferably in a way that doesn't give the user motion sickness (prefer moving to nearby annotations), 
but also not going back to a annotation that the user has skipped.

It keeps track of which annotations have been visited and in which order so that we can backtrack if we want.*/

export function useAnnotationNavigation(input: UseAnnotationNavigationInput) {
  const {
    next: oldNext,
    prev: oldPrev,
    annotationHooks
  } = input
  
  const annotations = annotationHooks.map(hook => hook.data).map(annos => annos.filter(anno => input.selectedCategoryIDs.includes(anno.categoryId)))
  //Calculate the seto of objectIds that appear in both images.
  const objectIds = annotations.map(annos => annos.map(anno => anno.objectId || anno.proposedObjectId))
  const pairedObjectIds = objectIds[0].filter(id => objectIds[1].includes(id))
  const pairedAnnotations = annotations.map(annos => annos.filter(anno => pairedObjectIds.includes(anno.objectId || anno.proposedObjectId)))
  
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const activeObjectId = history?.[historyIndex]

  const prev = () => {
    if (historyIndex > -1) {
      setHistoryIndex(historyIndex - 1);
    } else {
      oldPrev()
    }
  }

  //Returns a pair of coordinates corresponding to the current location of the active annotation in each of the images or [0,0] if there is no active annotation
  const currentLocation = () => {
    return annotations.map(annotations => annotations.find(anno => anno.proposedObjectId === activeObjectId)).map(anno => {return{ x : anno?.x || 0, y : anno?.y || 0 }})
  }

  function dist(a: { x: number, y: number }, b: { x: number, y: number }): number {
    return sqrt(square(a.x - b.x) + square(a.y - b.y)) as number;
  }

  const findNextAnnotation = () => {
    // Determine a target location in each of the images. This is the location of the currently active annotation or the top left corner of the image if no annotation is active.
    const target = currentLocation()
    // Find the nearest unvisited annotation to the target location in each of the images.
    const nearest = pairedAnnotations.map(
      (annotations, i) => annotations.reduce((result, anno) => {
        if (history.includes(anno.proposedObjectId) || anno.objectId) {
          return result
        } else {
          const thisDist = dist(anno, target[i])
          return thisDist < result.dist ? { dist: thisDist, objectId: anno.proposedObjectId } : result
        }
      }, { dist: Infinity, objectId: undefined }))
    // We will have found two (potentially different) objects in the two images. Go the the one that requires the least movement to get to.
    if (nearest[0].dist < nearest[1].dist) {
      return nearest[0].objectId
    }
    return nearest[1].objectId
  }
    
  const next = () => {
    if (historyIndex >= history.length - 1) {
      const annotation = findNextAnnotation()
      if (annotation) {
        setHistory(old=>[...old, annotation])
      }
      else {
        oldNext()
        return
      }
    }
    setHistoryIndex(old=>old+1)
  }

  const confirmMatch = () => {
    annotationHooks.forEach(({update, data:annotations}, i) => {
      const anno = annotations.find(anno => anno.proposedObjectId === activeObjectId)
      if (anno) {
        update(anno)
      }
    })
    next()
  }
  return {next, prev, confirmMatch, activeObjectId}
}