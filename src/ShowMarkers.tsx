import React, { useContext, useState, useEffect, useMemo, useCallback } from "react";
import { UserContext, ImageContext } from "./Context";
import "./index.css";
import { isHotkeyPressed, useHotkeys } from "react-hotkeys-hook";
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
import { random } from "mathjs";
import DummyMarkers from "./DummyMarkers";
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

export function ShowMarkers() {
  const { user } = useContext(UserContext)!;
  const {categoriesHook:{data:categories}} = useContext(ProjectContext)!;
  const [enabled, setEnabled] = useState(true);
  const {annotationsHook, latLng2xy, xy2latLng} = useContext(ImageContext)!;
  const {data: annotations, delete: deleteAnnotation,update: updateAnnotation, create: createAnnotation}= annotationsHook;
  const activeAnnotation = undefined;
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
            key={annotation.id}
            annotation={{...annotation, proposedObjectId: annotation.id}}
            categories={categories}
            activeAnnotation={activeAnnotation}
            user={user}
            updateAnnotation={updateAnnotation}
            deleteAnnotation={deleteAnnotation}
            latLng2xy={latLng2xy}
            xy2latLng={xy2latLng}
            getType={getType}
          />
        ))} 
        {/* {Array.from({ length: 500 }, (_, i) => (
          <Marker key={i} position={[(Math.random() - 0.5) * 160, (Math.random() - 0.5) * 360]} ></Marker>))} */}
        {/* {annotations?.map((annotation) => (
          <Marker
            key={annotation.id}
            position={[-annotation.y/128, annotation.x/64]}
          />
        ))} */}
      </>
    );
  else {
    return null;
  }
}
