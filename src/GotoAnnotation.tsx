import { useContext, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { ImageContext } from './Context';
import { ExtendedAnnotationType, ImageType } from './schemaTypes';

interface GotoAnnotationProps {
  activeAnnotation?: ExtendedAnnotationType;
  image: ImageType;
  transform: (coords: [number, number]) => [number, number];
}

export function GotoAnnotation({
  activeAnnotation,
  image,
  transform,
}: GotoAnnotationProps) {
  const map = useMap();
  const { xy2latLng } = useContext(ImageContext)!;

  useEffect(() => {
    if (activeAnnotation) {
      if (image.id == activeAnnotation.imageId) {
        const latLng = xy2latLng([
          activeAnnotation.x,
          activeAnnotation.y,
        ]) as L.LatLng;
        map.setView(latLng, 6, {
          animate: false,
        });
      } else {
        const xy2 = transform([activeAnnotation.x, activeAnnotation.y]);
        const latLng = xy2latLng(xy2) as L.LatLng;
        map.setView(latLng, 6, { animate: false });
      }
      return () => {
        activeAnnotation.selected = false;
      };
    }
    //else {
    //map.fitBounds([xy2latLng([0, 0]), xy2latLng([image.width, image.height])]);
    //}
  }, [activeAnnotation, transform, map, image]);

  return null;
}
