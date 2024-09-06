import { useMapEvents } from "react-leaflet";
import { useContext } from "react";
import { ImageContext } from "./BaseImage";
import { AnnotationsContext } from "./AnnotationsContext";
import {Annotation} from "./useGqlCached"
import { UseMutateFunction } from "@tanstack/react-query";
import { UserContext } from "./UserContext";
import { useCategory } from "./useGqlCached";

interface Location {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CreateAnnotationOnClickProps {
  setId: string;
  image: any;
  location: Location;
  annotationsHook?: {
    annotations: Annotation[] | undefined;
    createAnnotation: (newAnnotation: Annotation) => void;
    deleteAnnotation: UseMutateFunction<any, any, any, any>;
    updateAnnotation: (anno: Annotation & { id: string }) => void;
  };
}

export default function CreateAnnotationOnClick({
  setId,
  image,
  location,
}: CreateAnnotationOnClickProps) {
  const { latLng2xy } = useContext(ImageContext)!;

  const context = useContext(AnnotationsContext);
  const createAnnotation = context?.createAnnotation;
  const {currentProject} = useContext(UserContext)!;
  const {currentCategory} = useCategory(currentProject)

  useMapEvents({
    click: (e: { latlng: any; }) => {
      const xyResult = latLng2xy(e.latlng);
      const xy = Array.isArray(xyResult) ? xyResult[0] : xyResult;

      if (
        !location ||
        (Math.abs(xy.x - location.x) < location.width / 2 &&
          Math.abs(xy.y - location.y) < location.height / 2)
      ) {
        createAnnotation?.({
          imageKey: image.key,
          annotationSetId: setId,
          x: Math.round(xy.x),
          y: Math.round(xy.y),
          categoryId: currentCategory,
        });
      }
    },
  });

  return null; // Return null or a JSX element if needed
}
