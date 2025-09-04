import { useContext, useEffect, useMemo, useState } from 'react';
import { GlobalContext } from './Context';
import { MapContainer, LayersControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { StorageLayer } from './StorageLayer';
import { fetchAllPaginatedResults } from './utils';
import { CircleMarker, Popup, LayerGroup } from 'react-leaflet';
import { Spinner } from 'react-bootstrap';

type AnnotationItem = {
  id: string;
  x: number;
  y: number;
  setId: string;
  objectId: string;
  category: { id: string; name: string } | null;
};

export default function LightImageView({
  imageId,
  annotationSetId,
  categoryIds = [],
}: {
  imageId: string;
  annotationSetId: string;
  categoryIds?: string[];
}) {
  const { client } = useContext(GlobalContext)!;
  const [imageMeta, setImageMeta] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [sourceKey, setSourceKey] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [annotationsLoaded, setAnnotationsLoaded] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAnnotationsLoaded(false);
      // Load image metadata
      const { data: image } = await (client as any).models.Image.get({
        id: imageId,
        selectionSet: ['id', 'width', 'height'] as const,
      });
      if (!image || cancelled) return;
      setImageMeta({
        width: image.width as number,
        height: image.height as number,
      });

      // Load source key for slippy map tiles
      const filesResp = await (client as any).models.ImageFile.imagesByimageId({
        imageId,
        selectionSet: ['id', 'type', 'key'] as const,
      });
      const files = filesResp.data as Array<{
        id: string;
        type: string;
        key: string;
      }>;
      const jpeg = files.find((f) => f.type === 'image/jpeg') || files[0];
      setSourceKey(jpeg?.key || null);

      // Load annotations for this image and set
      const anns = (await (fetchAllPaginatedResults as any)(
        (client as any).models.Annotation.annotationsByImageIdAndSetId,
        {
          imageId,
          setId: { eq: annotationSetId },
          selectionSet: [
            'id',
            'x',
            'y',
            'setId',
            'objectId',
            'category.id',
            'category.name',
          ] as const,
          limit: 1000,
        }
      )) as AnnotationItem[];
      if (cancelled) return;
      setAnnotations(anns || []);
      setAnnotationsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [client, imageId, annotationSetId]);

  const scale = useMemo(() => {
    if (!imageMeta) return 1;
    return Math.pow(
      2,
      Math.ceil(Math.log2(Math.max(imageMeta.width, imageMeta.height))) - 8
    );
  }, [imageMeta?.width, imageMeta?.height]);

  const xy2latLng = (x: number, y: number) => L.latLng(-y / scale, x / scale);

  // Filter annotations to only show those IN the categoryIds array (the labels)
  const filteredAnnotations = useMemo(() => {
    if (categoryIds.length === 0) return annotations;
    return annotations.filter((annotation) =>
      categoryIds.includes(annotation.category?.id || '')
    );
  }, [annotations, categoryIds]);

  // Create color mapping for categories
  const categoryColors = useMemo(() => {
    const colors = [
      '#FF5733',
      '#33FF57',
      '#3357FF',
      '#F333FF',
      '#33FFF8',
      '#FFA833',
      '#8B33FF',
      '#FF3380',
      '#33FF8B',
    ];

    const uniqueCategoryIds: string[] = [];
    const seenCategories = new Set<string>();

    filteredAnnotations.forEach((annotation) => {
      const categoryId = annotation.category?.id || 'Unknown';
      if (!seenCategories.has(categoryId)) {
        seenCategories.add(categoryId);
        uniqueCategoryIds.push(categoryId);
      }
    });

    const categoryColorMap = new Map<string, string>();
    uniqueCategoryIds.forEach((categoryId, index) => {
      const colorIndex = index % colors.length;
      categoryColorMap.set(categoryId, colors[colorIndex]);
    });

    return categoryColorMap;
  }, [filteredAnnotations]);

  const bounds = useMemo(() => {
    if (!imageMeta) return undefined;
    const sw = xy2latLng(0, imageMeta.height);
    const ne = xy2latLng(imageMeta.width, 0);
    return L.latLngBounds(sw, ne);
  }, [imageMeta?.width, imageMeta?.height, scale]);

  // Component to handle map zoom events
  const MapZoomHandler: React.FC = () => {
    const map = useMap();

    const zoomToAnnotation = (latLng: L.LatLng) => {
      map.flyTo(latLng, Math.max(map.getZoom() + 2, 8), {
        duration: 0.5,
        easeLinearity: 0.1,
      });
    };

    // Expose zoom function globally for CircleMarker onClick handlers
    useEffect(() => {
      (window as any).__zoomToAnnotation = zoomToAnnotation;
      return () => {
        delete (window as any).__zoomToAnnotation;
      };
    }, [map]);

    return null;
  };

  if (!imageMeta || !sourceKey || !bounds || !annotationsLoaded)
    return (
      <div className='w-100 h-100 d-flex align-items-center justify-content-center'>
        <Spinner size='sm' />
        <span className='ms-2'>Loading...</span>
      </div>
    );

  return (
    <MapContainer
      style={{ width: '100%', height: '100%' }}
      crs={L.CRS.Simple}
      bounds={bounds}
      zoomSnap={1}
      zoomDelta={1}
      keyboardPanDelta={0}
    >
      <MapZoomHandler />
      <LayersControl position='topright'>
        <LayersControl.BaseLayer name='Image' checked>
          {/* StorageLayer understands sourceKey as the tile root identifier */}
          <StorageLayer
            source={sourceKey}
            bounds={bounds as any}
            maxNativeZoom={5}
            noWrap={true}
          />
        </LayersControl.BaseLayer>
        <LayersControl.Overlay name='Annotations' checked>
          <LayerGroup>
            {filteredAnnotations.map((a) => {
              const categoryId = a.category?.id || 'Unknown';
              const color = categoryColors.get(categoryId) || '#999999';
              const isPrimary = a.id === a.objectId;
              const sightingType = isPrimary ? 'Primary' : 'Secondary';

              return (
                <CircleMarker
                  key={a.id}
                  center={xy2latLng(a.x as any, a.y as any)}
                  radius={7}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    weight: 2,
                    fillOpacity: isPrimary ? 0.8 : 0,
                  }}
                  eventHandlers={{
                    click: () => {
                      const latLng = xy2latLng(a.x as any, a.y as any);
                      if ((window as any).__zoomToAnnotation) {
                        (window as any).__zoomToAnnotation(latLng);
                      }
                    },
                  }}
                >
                  <Popup>
                    <div>
                      <div><strong>Label:</strong> {a.category?.name || 'Unknown'}</div>
                      <div><strong>Sighting:</strong> {sightingType}</div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </LayerGroup>
        </LayersControl.Overlay>
      </LayersControl>
    </MapContainer>
  );
}
