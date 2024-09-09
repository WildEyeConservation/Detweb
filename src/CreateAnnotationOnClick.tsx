import { useMapEvents } from "react-leaflet";
import { useContext } from "react";
import { ImageContext } from "./BaseImage";
import { UserContext } from "./UserContext";
import { useAnnotations, useCategory } from "./useGqlCached";
import type { LocationType, AnnotationSetType, ImageMetaType } from "./schemaTypes";

export interface CreateAnnotationOnClickProps {
  location?: LocationType;
  imageMeta: ImageMetaType;
  annotationsHook: ReturnType<typeof useAnnotations>;
  annotationSet: AnnotationSetType;
  source: string;
}

export default function CreateAnnotationOnClick(props: CreateAnnotationOnClickProps) {
  const {annotationSet,location,annotationsHook: {createAnnotation},source, imageMeta} = props;
  const { latLng2xy } = useContext(ImageContext)!;
  const {currentProject} = useContext(UserContext)!;
  const {currentCategory} = useCategory(currentProject)

  useMapEvents({
    click: (e: { latlng: any; }) => {
      const xyResult = latLng2xy(e.latlng);
      const xy = Array.isArray(xyResult) ? xyResult[0] : xyResult;

      if (
        !(location?.width && location?.height ) ||
        (Math.abs(xy.x - location.x) < location.width! / 2 &&
          Math.abs(xy.y - location.y) < location.height! / 2)
      ) {currentCategory && source && currentProject &&
        createAnnotation?.({
          metaId: imageMeta.id,
          setId: annotationSet.id!,
          projectId: currentProject.id,
          x: Math.round(xy.x),
          y: Math.round(xy.y),
          categoryId: currentCategory.id,
          source: source,
          obscured: false,
          objectId: null,
        });
      }
    },
  });

  return null; // Return null or a JSX element if needed
}
