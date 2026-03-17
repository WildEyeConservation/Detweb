import React, { useCallback, useContext } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useMapEvents } from 'react-leaflet';
import { ImageContext, ProjectContext } from './Context';

export default function CreateAnnotationOnHotKey({
  hotkey,
  category,
  setId,
  imageId,
  source,
  isTest = false,
  location,
  allowOutside,
}: {
  hotkey: string;
  category: any;
  setId: string;
  imageId: string;
  source: string;
  isTest?: boolean;
  location?: { x: number; y: number; width?: number; height?: number };
  allowOutside?: boolean;
}) {
  const {
    annotationsHook: { create: createAnnotation },
  } = useContext(ImageContext)!;
  const [currentPosition, setCurrentPosition] = React.useState({ x: 0, y: 0 });
  const { latLng2xy } = useContext(ImageContext);
  const { project, setCurrentCategory } = useContext(ProjectContext)!;

  useMapEvents({
    mousemove: (e) => {
      setCurrentPosition(latLng2xy(e.latlng));
    },
  });

  const handleHotkey = useCallback(() => {
    const x = Math.round(currentPosition.x);
    const y = Math.round(currentPosition.y);
    // Boundary check: skip if outside location bounds (same logic as CreateAnnotationOnClick)
    if (
      location?.width && location?.height &&
      !allowOutside &&
      !(Math.abs(x - location.x) < location.width / 2 &&
        Math.abs(y - location.y) < location.height / 2)
    ) {
      return;
    }
    createAnnotation({
      categoryId: category.id,
      setId,
      imageId,
      x,
      y,
      projectId: project.id,
      source: source,
      group: project.organizationId,
    });
    setCurrentCategory(category);
  }, [
    category.id,
    createAnnotation,
    currentPosition,
    imageId,
    setId,
    project.id,
    source,
    location,
    allowOutside,
  ]);

  useHotkeys(
    hotkey,
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleHotkey?.();
    },
    { keydown: true, keyup: false },
    [handleHotkey]
  );

  return null;
}
