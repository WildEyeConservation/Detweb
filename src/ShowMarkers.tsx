import React, { useContext, useState, useEffect, useMemo, useCallback } from "react";
import { UserContext } from "./Context";
import "./index.css";
import { isHotkeyPressed, useHotkeys } from "react-hotkeys-hook";
import { ImageContext } from "./BaseImage";
import { Marker, Tooltip } from "react-leaflet";
import {
  uniqueNamesGenerator,
  adjectives,
  names,
} from "unique-names-generator";
import * as L from "leaflet";
import * as jdenticon from "jdenticon";
import { useMap } from "react-leaflet";
import { ProjectContext } from "./Context";
import type { AnnotationType, CategoryType, ExtendedAnnotationType } from "./schemaTypes";
import type { AnnotationsHook } from "./Context";
import DetwebMarker from './DetwebMarker';

interface ShowMarkersProps {
  activeAnnotation?: AnnotationType;
  annotationsHook: AnnotationsHook;
}



/* ShowMarkers uses a annotationHook that is passed as a parameter to display the annotations on the map and to allow for editing/deleting of annotations.
It is important that this hook is passed as a parameter and not obtained directly from context as that gives us the ability to add ephemeral properties
to certain annotations that affect their appearance, eg whether a particular annotation is currently selected, whether it is a candidate for matching etc.

This is used extensively in RegisterPair.tsx to the extent of injecting phantom or "shadow" annotations in places where the algorithm believes annotations should be.
Whether annotations are editable or read-only is controlled by the presence or absence of the update and delete functions in the annotationsHook.
*/

export function ShowMarkers({ activeAnnotation, annotationsHook }:ShowMarkersProps) {
  const {data: annotations, delete: deleteAnnotation,update: updateAnnotation, create: createAnnotation}= annotationsHook;
  const { user } = useContext(UserContext)!;
  const {categoriesHook:{data:categories}} = useContext(ProjectContext)!;
  const [enabled, setEnabled] = useState(true);

  useHotkeys(
    "Shift",
    () => {
      setEnabled(!isHotkeyPressed("Shift"));
    },
    { keyup: true, keydown: true },
  );

  const getType = useCallback((annotation) =>
    categories?.find((category) => category.id === annotation.categoryId)
      ?.name ?? "Unknown", [categories]);
  
  if (enabled)
    return (
      <>
        {annotations?.map((annotation) => (
          <DetwebMarker
            key={annotation.id || crypto.randomUUID()}
            annotation={annotation}
            categories={categories}
            activeAnnotation={activeAnnotation}
            user={user}
            updateAnnotation={updateAnnotation}
            deleteAnnotation={deleteAnnotation}
            getType={getType}
          />
        ))}
      </>
    );
  else {
    return null;
  }
}
