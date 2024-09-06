import { useContext, useEffect } from "react";
import { useMap } from "react-leaflet";
import { ImageContext } from "./BaseImage";

interface Annotation {
  x: number;
  y: number;
  imageKey?: string; 
  selected?: boolean;
}

interface Image {
  key: string;
}

interface GotoAnnotationProps {
  activeAnnotation: Annotation | null;
  image: Image | null;
  transform: (coords: [number, number]) => [number, number];
}

export function GotoAnnotation({ activeAnnotation, image, transform }: GotoAnnotationProps) {
  const map = useMap();
  const { xy2latLng } = useContext(ImageContext)!;

  useEffect(() => {
    if (activeAnnotation) {
      //activeAnnotation.selected = true;
      if (image?.key == activeAnnotation?.imageKey) {
        const latLng = xy2latLng([activeAnnotation.x, activeAnnotation.y]) as L.LatLng; 
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
  }, [activeAnnotation, transform, map, image]);

  return null;
}
