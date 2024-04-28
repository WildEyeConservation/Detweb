import { useContext, useEffect } from "react";
import { useMap } from "react-leaflet";
import { ImageContext } from "./BaseImage";

export function GotoAnnotation({ activeAnnotation, image, transform }) {
  const map = useMap();
  const { xy2latLng } = useContext(ImageContext);

  useEffect(() => {
    if (activeAnnotation) {
      //activeAnnotation.selected = true;
      if (image?.key == activeAnnotation?.imageKey) {
        map.setView(xy2latLng([activeAnnotation.x, activeAnnotation.y]), 6, {
          animate: false,
        });
      } else {
        const xy2 = transform([activeAnnotation.x, activeAnnotation.y]);
        map.setView(xy2latLng(xy2), 6, { animate: false });
      }
      return () => {
        activeAnnotation.selected = false;
      };
    }
  }, [activeAnnotation, transform, map, image]);

  return;
}
