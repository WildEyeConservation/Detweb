import React, { useCallback, useContext, useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useMapEvents } from 'react-leaflet';
import { ImageContext, ProjectContext } from './Context';

export default function CreateAnnotationOnHotKey({
  hotkey,
  category,
  setId,
  imageId,
  source,
  isTest: _isTest = false,
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
  const [isMouseOverMap, setIsMouseOverMap] = React.useState(false);
  const { latLng2xy } = useContext(ImageContext)!;
  const { project, setCurrentCategory } = useContext(ProjectContext)!;
  const keyHeldRef = useRef(false);

  useMapEvents({
    mousemove: (e) => {
      setCurrentPosition(latLng2xy(e.latlng) as { x: number; y: number });
    },
    mouseover: () => setIsMouseOverMap(true),
    mouseout: () => setIsMouseOverMap(false),
  });

  const handleHotkey = useCallback(() => {
    // Skip if cursor is not over the map
    if (!isMouseOverMap) return;
    // Skip if key is already held down (prevent repeat keydown events)
    if (keyHeldRef.current) return;
    keyHeldRef.current = true;
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
    isMouseOverMap,
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

  useHotkeys(
    hotkey,
    () => {
      keyHeldRef.current = false;
    },
    { keydown: false, keyup: true },
    []
  );

  return null;
}
