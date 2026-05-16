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

/**
 * The narrowed image shape we actually fetch in step 2: a handful of scalar
 * fields plus the neighbour edges embedded via the selection set. Typed
 * explicitly because the Amplify client return type doesn't reflect a custom
 * `selectionSet`. The rest of the feature only ever reads these fields.
 */
type ImageWithNeighbours = Pick<
  ImageType,
  'id' | 'width' | 'height' | 'originalPath' | 'timestamp' | 'cameraId'
> & {
  leftNeighbours?: ImageNeighbourType[] | null;
  rightNeighbours?: ImageNeighbourType[] | null;
};

/**
 * Live progress while the transect query runs, so the harness can show a
 * non-stuck loading card. Counts tick up per pagination page; `phase` tracks
 * which step is in flight. Neighbours have no phase — they ride along on the
 * images query (embedded via the selection set).
 */
export interface LoadProgress {
  phase: 'idle' | 'category' | 'images' | 'cameras' | 'annotations' | 'done';
  images: number;
  annotations: number;
}

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
      // don't pull every image in the project and filter client-side. We pull
      // the neighbour edges (left/right) in the same query via the selection
      // set — far cheaper than a per-image ImageNeighbour fan-out (see step 3).
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

      // Cast back to the full ImageType at this boundary: the feature only
      // ever reads the fields we selected, but TransectData / downstream
      // components are typed against the full model.
      const imagesById: Record<string, ImageType> = {};
      for (const img of images) {
        imagesById[img.id] = img as unknown as ImageType;
      }

      setProgress((p) => ({ ...p, phase: 'cameras' }));
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

      // 3. Neighbours are embedded on each image via step 2's selection set,
      // so there are no extra round-trips. Dedupe by composite key, keep only
      // neighbours within the transect and not skipped. We do NOT compute
      // transforms here — that happens in the harness after rehydration so we
      // can survive JSON serialization to localStorage.
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

      // 4. Annotations for this category, then narrowed to this transect's
      // images. One paginated index query instead of one query per image —
      // the old per-image fan-out was O(images) round-trips (thousands on a
      // large transect).
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
