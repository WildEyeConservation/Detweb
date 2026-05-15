import { useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GlobalContext, ProjectContext } from '../../Context';
import { fetchAllPaginatedResults } from '../../utils';
import type {
  AnnotationType,
  CategoryType,
  ImageNeighbourType,
  ImageType,
} from '../../schemaTypes';

interface UseTransectDataInput {
  transectId: string | undefined;
  categoryId: string | undefined;
  /**
   * Annotation set the category belongs to. The harness can derive this from
   * the category record itself if it's not in the URL.
   */
  annotationSetId: string | undefined;
}

/**
 * Everything `useTransectData` returns is plain JSON. No functions, no Maps,
 * no class instances. This is required because the project persists React
 * Query state to localStorage; non-serializable values are silently dropped
 * on rehydration. Transforms are derived from `rawNeighbours` in the harness
 * via a separate `useMemo`.
 */
export interface TransectData {
  category: CategoryType | null;
  images: ImageType[];
  imagesById: Record<string, ImageType>;
  annotations: AnnotationType[];
  /** Annotations indexed by image id for fast lookup. */
  annotationsByImage: Record<string, AnnotationType[]>;
  /** Image-neighbour rows that pass the basic filter (within transect, not skipped). */
  rawNeighbours: ImageNeighbourType[];
  /** camera id → camera name, used to label the progress-bar lanes. */
  cameraNamesById: Record<string, string>;
}

/**
 * Loads everything the harness needs: the transect's images, all
 * ImageNeighbours touching those images, annotations restricted to a single
 * category, and the category record itself.
 *
 * All queries use `fetchAllPaginatedResults` with `limit: 10000`. The hook
 * does NOT subscribe to live updates — re-renders rebuild candidates from the
 * locally-held annotation list. The harness can manually invalidate when it
 * commits a match.
 */
export function useTransectData(input: UseTransectDataInput) {
  const { client } = useContext(GlobalContext)!;
  const { project } = useContext(ProjectContext)!;
  const { transectId, categoryId, annotationSetId } = input;

  const enabled = Boolean(transectId && categoryId && project?.id);

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
      // 1. Resolve the category (and annotationSetId if not supplied).
      const categoryResp = await client.models.Category.get({ id: categoryId! });
      const category = (categoryResp?.data ?? null) as CategoryType | null;
      const setId = annotationSetId ?? category?.annotationSetId ?? '';
      if (!setId) {
        throw new Error(
          `Cannot resolve annotationSetId for category ${categoryId}`
        );
      }

      // 2. Images for the transect. Uses the projectId+transectId GSI so we
      // don't pull every image in the project and filter client-side.
      const images = (await fetchAllPaginatedResults<ImageType>(
        client.models.Image.imagesByProjectIdAndTransectId,
        {
          projectId: project!.id,
          transectId: { eq: transectId },
          limit: 10000,
        }
      )) as ImageType[];

      const imagesById: Record<string, ImageType> = {};
      for (const img of images) imagesById[img.id] = img;

      // 2b. Project cameras — only id → name, for progress-bar lane labels.
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

      // 3. Neighbours touching any of those images.
      const imageIds = new Set(images.map((i) => i.id));
      const neighbourFetches = images.map(async (img) => {
        const [n1, n2] = await Promise.all([
          fetchAllPaginatedResults<ImageNeighbourType>(
            client.models.ImageNeighbour.imageNeighboursByImage1key,
            { image1Id: img.id, limit: 10000 }
          ),
          fetchAllPaginatedResults<ImageNeighbourType>(
            client.models.ImageNeighbour.imageNeighboursByImage2key,
            { image2Id: img.id, limit: 10000 }
          ),
        ]);
        return [...n1, ...n2];
      });
      const neighbourLists = await Promise.all(neighbourFetches);
      // Dedupe by composite key, keep only neighbours within the transect and
      // not skipped. We do NOT compute transforms here — that happens in the
      // harness after rehydration so we can survive JSON serialization to
      // localStorage.
      const seen = new Set<string>();
      const rawNeighbours: ImageNeighbourType[] = [];
      for (const list of neighbourLists) {
        for (const n of list) {
          if (n.skipped) continue;
          if (!imageIds.has(n.image1Id) || !imageIds.has(n.image2Id)) continue;
          const k = `${n.image1Id}__${n.image2Id}`;
          if (seen.has(k)) continue;
          seen.add(k);
          rawNeighbours.push(n);
        }
      }

      // 4. Annotations for this transect's images, restricted to one category.
      const annotationFetches = images.map((img) =>
        fetchAllPaginatedResults<AnnotationType>(
          client.models.Annotation.annotationsByImageIdAndSetId,
          {
            imageId: img.id,
            setId: { eq: setId },
            filter: { categoryId: { eq: categoryId } },
            limit: 10000,
          }
        )
      );
      const annotationsNested = await Promise.all(annotationFetches);
      const annotations = annotationsNested.flat();

      const annotationsByImage: Record<string, AnnotationType[]> = {};
      for (const a of annotations) {
        (annotationsByImage[a.imageId] ??= []).push(a);
      }

      return {
        category,
        images,
        imagesById,
        annotations,
        annotationsByImage,
        rawNeighbours,
        cameraNamesById,
      };
    },
  });

  return query;
}
