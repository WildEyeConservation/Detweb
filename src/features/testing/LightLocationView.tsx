import { useEffect, useMemo, useState } from 'react';
import { client } from '../../shared/api/appClient';
import { useOptimisticUpdates } from '../../shared/data/useOptimisticUpdates';
import MapLibreLightViewer, { LightAnnotation, LightRect } from '../annotation/annotator/MapLibreLightViewer';
import { buildAnnotationFeatureProperties } from '../annotation/annotator/annotationFeatures';
import type { ExtendedAnnotationType } from '../../shared/api/schemaTypes';
import { useCategories } from '../../shared/data/project';
import { useProjectId } from '../../shared/data/projectScope';

type MinimalLocationRef = { id: string; annotationSetId: string };

type LoadedLocation = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  annotationSetId: string;
  image: { id: string; width: number; height: number };
};

export default function LightLocationView({
  location: locationRef,
  visible,
  next,
  prev,
  overlay,
}: {
  location: MinimalLocationRef;
  visible: boolean;
  next?: () => void;
  prev?: () => void;
  overlay?: {
    enabled?: boolean;
    width?: number;
    height?: number;
    offsetX?: number;
    offsetY?: number;
  };
}) {
  const projectId = useProjectId();
  const { data: categories } = useCategories(projectId);
  const [loaded, setLoaded] = useState<LoadedLocation | null>(null);
  const [sourceKey, setSourceKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!locationRef?.id) return;
      const { data: loc } = await client.models.Location.get({ id: locationRef.id }, { selectionSet: ['id', 'x', 'y', 'width', 'height', 'imageId'] as const });
      if (!loc?.imageId) return;
      const { data: image } = await client.models.Image.get({ id: loc.imageId }, { selectionSet: ['id', 'width', 'height'] as const });
      if (!image) return;
      const filesResp = await (client).models.ImageFile.imagesByimageId({ imageId: image.id }, { selectionSet: ['id', 'type', 'key'] as const });
      const files = filesResp.data as Array<{ type: string; key: string }>;
      const jpeg = files.find((f) => f.type === 'image/jpeg') || files[0];
      if (!cancelled) {
        setSourceKey(jpeg?.key || null);
        setLoaded({
          id: loc.id,
          x: loc.x,
          y: loc.y,
          width: (loc.width ?? 100) as number,
          height: (loc.height ?? 100) as number,
          annotationSetId: locationRef.annotationSetId,
          image: {
            id: image.id,
            width: image.width as number,
            height: image.height as number,
          },
        });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [locationRef?.id, locationRef?.annotationSetId]);

  const subscriptionFilter = useMemo(() => {
    if (!loaded) return undefined;
    return {
      filter: {
        and: [
          { setId: { eq: (loaded).annotationSetId } },
          { imageId: { eq: (loaded).image.id } },
        ],
      },
    };
  }, [loaded]);

  const annotationsHook = (useOptimisticUpdates)(
    'Annotation',
    async (nextToken) => {
      const imageId = (loaded)?.image?.id as string | undefined;
      const setId = (loaded)?.annotationSetId as string | undefined;
      if (!imageId || !setId) return { data: [], nextToken: undefined };
      return (client).models.Annotation.annotationsByImageIdAndSetId(
        { imageId, setId: { eq: setId } },
        { nextToken }
      );
    },
    subscriptionFilter,
    {
      enabled: Boolean(loaded?.image.id && loaded?.annotationSetId && loaded.id === locationRef.id && loaded.annotationSetId === locationRef.annotationSetId),
      subscribe: visible,
      refetchOnSubscribe: true,
    }
  );

  const annotations = useMemo<LightAnnotation[]>(
    () =>
      ((annotationsHook.data) ?? [])
        .filter((a) => a.setId === loaded?.annotationSetId)
        .map((a) => {
          const category = categories?.find((c) => c.id === a.categoryId);
          return {
            ...buildAnnotationFeatureProperties(
              a as ExtendedAnnotationType,
              () => category?.color ?? 'red'
            ),
            x: a.x,
            y: a.y,
            popupLines: [`Label: ${category?.name ?? 'Unknown'}`],
          };
        }),
    [annotationsHook.data, categories, loaded?.annotationSetId]
  );

  const rects = useMemo<LightRect[]>(() => {
    if (!loaded) return [];
    const result: LightRect[] = [
      {
        x: loaded.x,
        y: loaded.y,
        width: loaded.width,
        height: loaded.height,
        color: 'blue',
      },
    ];
    if (overlay?.enabled) {
      result.push({
        x: loaded.x + (overlay.offsetX ?? 0),
        y: loaded.y + (overlay.offsetY ?? 0),
        width: overlay.width ?? loaded.width,
        height: overlay.height ?? loaded.height,
        color: 'red',
      });
    }
    return result;
  }, [loaded, overlay]);

  return (
    <div className='d-flex flex-md-row flex-column justify-content-center w-100 h-100 gap-3 overflow-auto'>
      {/* Center image */}
      <div
        className='d-flex flex-column align-items-center w-100 h-100 gap-3'
        style={{ maxWidth: '1024px' }}
      >
        {loaded && sourceKey && (
          <MapLibreLightViewer
            image={loaded.image}
            sourceKey={sourceKey}
            annotations={annotations}
            rects={rects}
            fitRect={loaded}
            visible={visible}
            next={next}
            prev={prev}
          />
        )}
      </div>
    </div>
  );
}
