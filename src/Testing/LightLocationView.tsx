import { useContext, useEffect, useMemo, useState } from 'react';
import BaseImage from '../BaseImage';
import { ImageContextFromHook } from '../ImageContext';
import { GlobalContext } from '../Context';
import { useOptimisticUpdates } from '../useOptimisticUpdates';
// no local marker types needed here
import { ShowMarkers } from '../ShowMarkers';
import Location from '../Location';

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
  const { client } = useContext(GlobalContext)!;
  // no-op: legend uses ProjectContext internally
  const [loaded, setLoaded] = useState<LoadedLocation | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!locationRef?.id) return;
      // @ts-ignore selectionSet typing is complex in client
      const { data: loc } = await client.models.Location.get({
        id: locationRef.id,
        selectionSet: ['id', 'x', 'y', 'width', 'height', 'imageId'] as const,
      } as any);
      if (!loc) return;
      // @ts-ignore selectionSet typing is complex in client
      const { data: image } = await client.models.Image.get({
        id: loc.imageId,
        selectionSet: ['id', 'width', 'height'] as const,
      } as any);
      if (!image) return;
      if (!cancelled) {
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
          { setId: { eq: (loaded as any).annotationSetId } },
          { imageId: { eq: (loaded as any).image.id } },
        ],
      },
    } as any;
  }, [loaded?.annotationSetId, loaded?.image?.id]);

  const annotationsHook = (useOptimisticUpdates as any)(
    'Annotation',
    async (nextToken: any) => {
      const imageId = (loaded as any)?.image?.id as string | undefined;
      const setId = (loaded as any)?.annotationSetId as string | undefined;
      if (!imageId || !setId) return { data: [], nextToken: undefined } as any;
      return (client as any).models.Annotation.annotationsByImageIdAndSetId(
        { imageId, setId: { eq: setId } },
        { nextToken }
      ) as any;
    },
    subscriptionFilter
  ) as any;

  return (
    <div className='d-flex flex-md-row flex-column justify-content-center w-100 h-100 gap-3 overflow-auto'>
      {/* Center image */}
      <div
        className='d-flex flex-column align-items-center w-100 h-100 gap-3'
        style={{ maxWidth: '1024px' }}
      >
        {loaded && (
          <ImageContextFromHook
            hook={annotationsHook as any}
            locationId={loaded.id}
            image={loaded.image as any}
            taskTag={'add-locations'}
          >
            {/* @ts-ignore - BaseImageProps typing requires image, but component uses location.image */}
            <BaseImage
              visible={visible}
              location={loaded as any}
              image={loaded.image as any}
              next={next}
              prev={prev}
              annotationSet={loaded.annotationSetId as any}
              hideNavButtons={false}
              isTest={true}
            >
              <Location {...(loaded as any)} />
              {overlay?.enabled && (
                <Location
                  {...({
                    x: (loaded as any).x + (overlay?.offsetX ?? 0),
                    y: (loaded as any).y + (overlay?.offsetY ?? 0),
                    width: overlay?.width ?? (loaded as any).width,
                    height: overlay?.height ?? (loaded as any).height,
                    strokeColor: 'red',
                  } as any)}
                />
              )}
              <ShowMarkers annotationSetId={loaded.annotationSetId} />
            </BaseImage>
          </ImageContextFromHook>
        )}
      </div>
    </div>
  );
}

// no local filters; filters are applied to candidate list in parent modal
