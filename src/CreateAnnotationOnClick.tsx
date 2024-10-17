import { useMapEvents } from "react-leaflet";
import { useContext } from "react";
import { ImageContext } from "./BaseImage";
import { UserContext, ProjectContext } from "./Context";
import type { LocationType, AnnotationSetType, ImageType } from "./schemaTypes";

export interface CreateAnnotationOnClickProps {
  location?: LocationType;
  image: ImageType;
  annotationsHook: ReturnType<typeof useAnnotations>;
  annotationSet: AnnotationSetType;
  source: string;
}

export default function CreateAnnotationOnClick(props: CreateAnnotationOnClickProps) {
  const {annotationSet,location,annotationsHook: {create:createAnnotation},source, image, allowOutside} = props;
  const { latLng2xy } = useContext(ImageContext)!;
  const {project,currentCategory} = useContext(ProjectContext)!;

  useMapEvents({
    click: (e: { latlng: any; }) => {
      const xyResult = latLng2xy(e.latlng);
      const xy = Array.isArray(xyResult) ? xyResult[0] : xyResult;

      if (
        !(location?.width && location?.height ) || (allowOutside) ||
        (Math.abs(xy.x - location.x) < location.width! / 2 &&
          Math.abs(xy.y - location.y) < location.height! / 2)
      ) {
        console.log('yay')
        currentCategory && source && project &&
        createAnnotation({
          imageId: image?.id || location?.image.id,
          setId: location?.annotationSetId,
          projectId: project.id,
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
