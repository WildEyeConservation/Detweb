import { useMapEvents } from "react-leaflet";
import { useContext } from "react";
import { ImageContext } from "./Context";
import { ProjectContext } from "./Context";
import type { LocationType, ImageType } from "./schemaTypes";

export interface CreateAnnotationOnClickProps {
  location?: LocationType;
  image?: ImageType;
  source: string;
  setId: string;
  allowOutside?: boolean;
  disabled?: boolean;
}

export default function CreateAnnotationOnClick(props: CreateAnnotationOnClickProps) {
  const { location, source, image, allowOutside, setId, disabled } = props;
  const { annotationsHook: { create: createAnnotation } } = useContext(ImageContext)!;
  const { latLng2xy } = useContext(ImageContext)!;
  // Bypass lazy-loader typing for category matching logic
  const { project, currentCategory: ctxCategory, categoriesHook } = useContext(ProjectContext)!;
  const currentCategory = ctxCategory as any;
  const categories: any[] = categoriesHook.data || [];

  useMapEvents({
    click: (e: { latlng: any; }) => {
      if (disabled) return;
      const xyResult = latLng2xy(e.latlng);
      const xy = Array.isArray(xyResult) ? xyResult[0] : xyResult;

      if (
        !(location?.width && location?.height ) || (allowOutside) ||
        (Math.abs(xy.x - location.x) < location.width! / 2 &&
          Math.abs(xy.y - location.y) < location.height! / 2)
      ) {
        console.log('yay')
        if (currentCategory && source && project) {
        // Map the current category to this annotation set or fall back to 'Unknown'
        let categoryIdToUse = currentCategory.id;
        const realSetId = location?.annotationSetId as string;
        const currentCatSetId = (currentCategory as any).annotationSetId;
        if (currentCatSetId !== realSetId) {
          const sameName = categories.find(
            (c) => c.annotationSetId === realSetId && c.name === currentCategory.name
          );
          if (sameName) {
            categoryIdToUse = sameName.id;
          } else {
            const unknownCat = categories.find(
              (c) =>
                c.annotationSetId === realSetId &&
                c.name.toLowerCase() === 'unknown'
            );
            if (unknownCat) {
              categoryIdToUse = unknownCat.id;
            }
          }
        }
        createAnnotation({
          imageId: image?.id || location?.image.id,
          setId,
          projectId: project.id,
          x: Math.round(xy.x),
          y: Math.round(xy.y),
          categoryId: categoryIdToUse,
          source: source,
          obscured: false,
        });
        }
      }
    }
  });

  return null; // Return null or a JSX element if needed
}
