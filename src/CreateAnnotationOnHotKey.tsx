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
    createAnnotation({
      categoryId: category.id,
      setId: isTest ? '123' : setId,
      imageId: imageId,
      x: Math.round(currentPosition.x),
      y: Math.round(currentPosition.y),
      projectId: project.id,
      source: source,
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
    isTest,
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
