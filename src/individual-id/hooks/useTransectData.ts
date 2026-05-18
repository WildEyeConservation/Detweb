import { useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GlobalContext, ProjectContext } from '../../Context';
import { fetchAllPaginatedResults } from '../../utils';
import type {
  AnnotationType,
  CategoryType,
  ImageNeighbourType,
  ImageType,
} from '../../schemaTypes';

// Amplify's return type doesn't reflect custom selectionSets, so we type this explicitly.
type ImageWithNeighbours = Pick<
  ImageType,
  'id' | 'width' | 'height' | 'originalPath' | 'timestamp' | 'cameraId'
> & {
  leftNeighbours?: ImageNeighbourType[] | null;
  rightNeighbours?: ImageNeighbourType[] | null;
};

// Neighbours have no phase — they're embedded in the images query via selectionSet.
export interface LoadProgress {
  phase: 'idle' | 'category' | 'images' | 'cameras' | 'annotations' | 'done';
  images: number;
  annotations: number;
}

interface UseTransectDataInput {
  transectId: string | undefined;
  categoryId: string | undefined;
  annotationSetId: string | undefined;
}

// Plain JSON only — React Query persists this to localStorage; non-serializable values are silently dropped.
export interface TransectData {
  category: CategoryType | null;
  images: ImageType[];
  imagesById: Record<string, ImageType>;
  annotations: AnnotationType[];
  annotationsByImage: Record<string, AnnotationType[]>;
  rawNeighbours: ImageNeighbourType[];
  cameraNamesById: Record<string, string>;
}

export function useTransectData(input: UseTransectDataInput) {
  const { client } = useContext(GlobalContext)!;
  const { project } = useContext(ProjectContext)!;
  const { transectId, categoryId, annotationSetId } = input;

  const enabled = Boolean(transectId && categoryId && project?.id);

  const [progress, setProgress] = useState<LoadProgress>({
    phase: 'idle',
    images: 0,
    annotations: 0,
  });

  const queryKey = useMemo(
    () => [
      'individual-id-transect',
      project?.id,
      transectId,
      categoryId,
      annotationSetId,
    ],
    [project?.id, transectId, categoryId, annotationSetId]
  );

  const query = useQuery<TransectData>({
    queryKey,
    enabled,
    staleTime: Infinity,
    queryFn: async () => {
      setProgress({ phase: 'category', images: 0, annotations: 0 });
      const categoryResp = await client.models.Category.get({ id: categoryId! });
      const category = (categoryResp?.data ?? null) as CategoryType | null;
      const setId = annotationSetId ?? category?.annotationSetId ?? '';
      if (!setId) {
        throw new Error(
          `Cannot resolve annotationSetId for category ${categoryId}`
        );
      }

      setProgress((p) => ({ ...p, phase: 'images' }));
      const images = (await fetchAllPaginatedResults<ImageType>(
        client.models.Image.imagesByProjectIdAndTransectId,
        {
          projectId: project!.id,
          transectId: { eq: transectId },
          limit: 10000,
          selectionSet: [
            'id',
            'width',
            'height',
            'originalPath',
            'timestamp',
            'cameraId',
            'leftNeighbours.*',
            'rightNeighbours.*',
          ],
        },
        (n) => setProgress((p) => ({ ...p, images: n }))
      )) as unknown as ImageWithNeighbours[];

      const imagesById: Record<string, ImageType> = {};
      for (const img of images) {
        imagesById[img.id] = img as unknown as ImageType;
      }

      setProgress((p) => ({ ...p, phase: 'cameras' }));
      const cameraResp = await client.models.Camera.camerasByProjectId(
        { projectId: project!.id },
        { selectionSet: ['id', 'name'], limit: 1000 }
      );
      const cameraNamesById: Record<string, string> = {};
      for (const c of (cameraResp.data ?? []) as Array<{
        id?: string | null;
        name?: string | null;
      }>) {
        if (c?.id && c?.name) cameraNamesById[c.id] = c.name;
      }

      const imageIds = new Set(images.map((i) => i.id));
      const seen = new Set<string>();
      const rawNeighbours: ImageNeighbourType[] = [];
      for (const img of images) {
        for (const n of [
          ...(img.leftNeighbours ?? []),
          ...(img.rightNeighbours ?? []),
        ]) {
          if (n.skipped) continue;
          if (!imageIds.has(n.image1Id) || !imageIds.has(n.image2Id)) continue;
          const k = `${n.image1Id}__${n.image2Id}`;
          if (seen.has(k)) continue;
          seen.add(k);
          rawNeighbours.push(n);
        }
      }

      setProgress((p) => ({ ...p, phase: 'annotations' }));
      const categoryAnnotations =
        await fetchAllPaginatedResults<AnnotationType>(
          client.models.Annotation.annotationsByCategoryId,
          {
            categoryId: categoryId!,
            filter: { setId: { eq: setId } },
            limit: 10000,
          },
          (n) => setProgress((p) => ({ ...p, annotations: n }))
        );
      const annotations = categoryAnnotations.filter((a) =>
        imageIds.has(a.imageId)
      );

      const annotationsByImage: Record<string, AnnotationType[]> = {};
      for (const a of annotations) {
        (annotationsByImage[a.imageId] ??= []).push(a);
      }

      setProgress((p) => ({ ...p, phase: 'done' }));
      return {
        category,
        images: images as unknown as ImageType[],
        imagesById,
        annotations,
        annotationsByImage,
        rawNeighbours,
        cameraNamesById,
      };
    },
  });

  return useMemo(() => ({ ...query, progress }), [query, progress]);
}
