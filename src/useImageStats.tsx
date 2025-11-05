import { useContext, useEffect, useState } from 'react';
import { ImageContext } from './Context';
import { ProjectContext } from './Context';
import type { LocationType, AnnotationSetType, ImageType } from './schemaTypes';

export default function useImageStats(
  annotationsHook: OptimisticUpdatesHook<
    Schema['Annotation']['type'],
    'Annotation'
  >
) {
  const [stats, setStats] = useState<Record<string, number>>({});
  const { data: annotations } = annotationsHook;
  const {
    categoriesHook: { data: categories },
  } = useContext(ProjectContext)!;

  useEffect(() => {
    if (annotations.length > 0 && categories.length > 0) {
      const tempStats = annotations?.reduce((acc, annotation) => {
        const category = categories?.find(
          (c) => c.id === annotation.categoryId
        );
        acc[category?.name || 'Invalid category'] =
          (acc[category?.name || 'Invalid category'] || 0) + 1;
        return acc;
      }, {});
      setStats(tempStats);
    }
  }, [annotations, categories]);
  return stats;
}
