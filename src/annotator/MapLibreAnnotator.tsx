import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as jdenticon from 'jdenticon';
import {
  uniqueNamesGenerator,
  adjectives,
  names,
} from 'unique-names-generator';
import { useHotkeys, isHotkeyPressed } from 'react-hotkeys-hook';
import {
  makeProjection,
  createImageMap,
  addImageTiles,
  leafletZoom2MapZoom,
  mapZoom2LeafletZoom,
} from './imageTiles';
import {
  GlobalContext,
  ImageContext,
  ManagementContext,
  ProjectContext,
} from '../Context';
import useImageMenuItems, { ImageMenuItem } from '../useImageMenuItems';
import { isWithinLocationBounds, resolveCategoryIdForSet } from '../utils';
import { NavButtons } from '../NavButtons';
import ChangeCategoryModal from '../ChangeCategoryModal';
import type {
  AnnotationType,
  CategoryType,
  ImageFileType,
  ImageType,
} from '../schemaTypes';

/*
MapLibre-based replacement for the Leaflet stack in the species-labelling
workflow (BaseImage + StorageLayer + ShowMarkers/DetwebMarker + Location +
CreateAnnotationOnClick/OnHotkeys + ZoomTracker + MapLegend).

Tiling: the image is mapped onto the full mercator world square, so the
existing slippy pyramid (slippymaps/{key}/{z}/{row}/{col}.png) aligns exactly
with MapLibre's native tile grid. A custom `detweb://` protocol feeds tiles
from getTileBlob (S3 + on-demand Lambda generation + localforage cache), and
MapLibre handles fading, retention and overzoom natively.

Zoom parity: Leaflet CRS.Simple displayed pyramid level z natively at map
zoom z; MapLibre (256px tiles over a 512px world) displays level z natively
at map zoom z-1. Stored default zooms (Queue.zoom, localStorage) remain on
the Leaflet scale, so we convert on the way in (zoom - 1) and out (zoom + 1).
*/

const SOURCE_ANNOTATIONS = 'annotations';
const LAYER_CIRCLES = 'annotation-circles';
const LAYER_ICONS = 'annotation-icons';
const SOURCE_LOCATION = 'location-rect';
const LAYER_LOCATION = 'location-rect-line';

function objectName(seed: string) {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, names],
    seed,
    style: 'capital',
    separator: ' ',
  });
}

function isFalseNegative(annotation: { source?: string | null }) {
  return String(annotation.source || '')
    .toLowerCase()
    .includes('false-negative');
}

interface MenuState {
  x: number;
  y: number;
  items: ImageMenuItem[];
}

export interface MapLibreAnnotatorProps {
  image: ImageType;
  location: any;
  visible: boolean;
  /** Default zoom on the Leaflet scale (as stored in Queue.zoom / localStorage). */
  zoom?: number;
  viewBoundsScale?: number;
  next?: () => void;
  prev?: () => void;
  hideNavButtons?: boolean;
  stats?: Record<string, number>;
  isTest?: boolean;
  allowOutside?: boolean;
  /** Set annotations are written to (the ephemeral test set during tests). */
  setId: string;
  /** Source tag for created annotations. */
  source: string;
  /** Categories for legend, hotkeys and marker colours (already filtered to the real set). */
  categories: CategoryType[];
  hideFnAnnotations?: boolean;
  /** Force the on-map legend visible (used when the side legend is collapsed). */
  showMapLegend?: boolean;
}

export default function MapLibreAnnotator(props: MapLibreAnnotatorProps) {
  const {
    image,
    location,
    visible,
    zoom,
    viewBoundsScale,
    next,
    prev,
    hideNavButtons,
    stats,
    isTest,
    allowOutside,
    setId,
    source,
    categories,
    hideFnAnnotations,
    showMapLegend,
  } = props;

  const { client } = useContext(GlobalContext)!;
  const {
    annotationsHook,
    setVisibleTimestamp,
    setFullyLoadedTimestamp,
    setZoom,
  } = useContext(ImageContext)!;
  const { allUsers } = useContext(ManagementContext)!;
  const {
    project,
    currentCategory,
    setCurrentCategory,
    categoriesHook: { data: projectCategories },
  } = useContext(ProjectContext)!;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [fullyLoaded, setFullyLoaded] = useState(false);
  const [canAdvance, setCanAdvance] = useState(false);
  const [markersHidden, setMarkersHidden] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [categoryModalAnnotation, setCategoryModalAnnotation] =
    useState<AnnotationType | null>(null);
  const [legendExpanded, setLegendExpanded] = useState(false);

  // Refs for values read inside imperative map handlers
  const cursorPxRef = useRef({ x: 0, y: 0 });
  const mouseOverMapRef = useRef(false);
  const hoveredIdRef = useRef<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const dragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const annotationsRef = useRef<AnnotationType[]>([]);

  const [imageFiles, setImageFiles] = useState<ImageFileType[]>([]);
  const [imageFilesLoading, setImageFilesLoading] = useState(true);
  const sourceKey = imageFiles.find((f) => f.type == 'image/jpeg')?.key;

  const projection = useMemo(
    () => makeProjection(image.width, image.height),
    [image.width, image.height]
  );
  const { px2lngLat, lngLat2px } = projection;

  const locationBounds =
    !allowOutside && location?.width && location?.height
      ? {
          x: location.x,
          y: location.y,
          width: location.width,
          height: location.height,
        }
      : undefined;

  const menuItems = useImageMenuItems({
    image,
    location,
    sourceKey,
    isTest,
    stats,
  });
  const menuItemsRef = useRef(menuItems);
  menuItemsRef.current = menuItems;
  const locationBoundsRef = useRef(locationBounds);
  locationBoundsRef.current = locationBounds;

  const annotations = useMemo(
    () =>
      (annotationsHook.data ?? [])
        .filter((a: AnnotationType) => a.setId === setId)
        .filter(
          (a: AnnotationType) => !(hideFnAnnotations && isFalseNegative(a))
        ),
    [annotationsHook.data, setId, hideFnAnnotations]
  );
  annotationsRef.current = annotations;

  const categoryColor = useCallback(
    (categoryId: string) =>
      categories?.find((c) => c.id === categoryId)?.color ?? 'red',
    [categories]
  );
  const categoryName = useCallback(
    (categoryId: string) =>
      categories?.find((c) => c.id === categoryId)?.name ?? 'Unknown',
    [categories]
  );

  // ── Image files (tile source key) ──
  useEffect(() => {
    let isMounted = true;
    setImageFiles([]);
    setImageFilesLoading(true);
    client.models.ImageFile.imagesByimageId({ imageId: image.id })
      .then((response: any) => {
        if (isMounted) setImageFiles(response.data);
      })
      .catch((error: unknown) => {
        if (isMounted) console.error('Error fetching image files:', error);
      })
      .finally(() => {
        if (isMounted) setImageFilesLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [client, image.id]);

  // No image files: nothing will ever load, so unblock the task lifecycle
  useEffect(() => {
    if (!imageFilesLoading && imageFiles.length === 0 && !fullyLoaded) {
      setFullyLoaded(true);
    }
  }, [imageFiles.length, imageFilesLoading, fullyLoaded]);

  const buildFeatureCollection = useCallback((): GeoJSON.FeatureCollection => {
    return {
      type: 'FeatureCollection',
      features: annotationsRef.current.map((a) => {
        const override =
          draggingIdRef.current === a.id ? dragPositionRef.current : null;
        const x = override?.x ?? a.x;
        const y = override?.y ?? a.y;
        const fn = isFalseNegative(a);
        const isPrimary = a.id === a.objectId;
        const readonly = locationBoundsRef.current
          ? !isWithinLocationBounds(a, locationBoundsRef.current)
          : false;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: px2lngLat(x, y) },
          properties: {
            id: a.id,
            color: categoryColor(a.categoryId),
            borderColor:
              a.objectId === a.id
                ? '#ffffff'
                : a.objectId
                  ? '#888888'
                  : '#000000',
            obscured: Boolean(a.obscured),
            readonly,
            icon: fn
              ? 'fn-marker'
              : isPrimary && a.objectId
                ? `identicon-${a.objectId}`
                : '',
          },
        };
      }),
    };
  }, [px2lngLat, categoryColor]);

  const refreshAnnotationSource = useCallback(() => {
    const src = mapRef.current?.getSource(SOURCE_ANNOTATIONS) as
      | maplibregl.GeoJSONSource
      | undefined;
    src?.setData(buildFeatureCollection() as any);
  }, [buildFeatureCollection]);

  // ── Map construction ──
  useEffect(() => {
    if (!containerRef.current || !sourceKey) return;

    const map = createImageMap(containerRef.current, projection);
    mapRef.current = map;

    // Generate marker icons on demand: identicons per objectId and the
    // false-negative "!" badge.
    map.on('styleimagemissing', (e: any) => {
      const id: string = e.id;
      if (id === 'fn-marker') {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 20;
        const ctx = canvas.getContext('2d')!;
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('!', 10, 11);
        map.addImage(
          id,
          ctx.getImageData(0, 0, 20, 20) as unknown as ImageData
        );
      } else if (id.startsWith('identicon-')) {
        const svg = jdenticon.toSvg(id.slice('identicon-'.length), 20);
        const img = new Image(20, 20);
        img.onload = () => {
          if (!map.hasImage(id)) map.addImage(id, img);
        };
        img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
      }
    });

    map.on('load', () => {
      addImageTiles(map, sourceKey, image, projection);

      // Location rectangle (task bounds)
      if (location?.width && location?.height) {
        const x0 = location.x - location.width / 2;
        const y0 = location.y - location.height / 2;
        const x1 = location.x + location.width / 2;
        const y1 = location.y + location.height / 2;
        map.addSource(SOURCE_LOCATION, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                px2lngLat(x0, y0),
                px2lngLat(x1, y0),
                px2lngLat(x1, y1),
                px2lngLat(x0, y1),
                px2lngLat(x0, y0),
              ],
            },
            properties: {},
          },
        });
        map.addLayer({
          id: LAYER_LOCATION,
          type: 'line',
          source: SOURCE_LOCATION,
          paint: { 'line-color': 'blue', 'line-width': 2 },
        });
      }

      map.addSource(SOURCE_ANNOTATIONS, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: LAYER_CIRCLES,
        type: 'circle',
        source: SOURCE_ANNOTATIONS,
        paint: {
          'circle-radius': 9,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': ['get', 'borderColor'],
          'circle-opacity': ['case', ['get', 'obscured'], 0.5, 1],
        },
      });
      map.addLayer({
        id: LAYER_ICONS,
        type: 'symbol',
        source: SOURCE_ANNOTATIONS,
        filter: ['!=', ['get', 'icon'], ''],
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });

      refreshAnnotationSource();
      setMapReady(true);
      map.once('idle', () => setFullyLoaded(true));
    });

    map.on('zoomend', () => {
      // Report on the Leaflet scale for parity with stored default zooms
      setZoom(mapZoom2LeafletZoom(map.getZoom()));
    });

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
      setFullyLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, image.id]);

  // ── Initial view ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (zoom != null) {
      map.jumpTo({
        center: px2lngLat(
          location?.x ?? image.width / 2,
          location?.y ?? image.height / 2
        ),
        zoom: leafletZoom2MapZoom(zoom),
      });
    } else {
      const scale = viewBoundsScale ?? 1.5;
      const hasBounds = location?.x && location?.width && location?.height;
      const left = hasBounds
        ? Math.max(0, location.x - location.width * scale)
        : 0;
      const top = hasBounds
        ? Math.max(0, location.y - location.height * scale)
        : 0;
      const right = hasBounds
        ? Math.min(image.width, location.x + location.width * scale)
        : image.width;
      const bottom = hasBounds
        ? Math.min(image.height, location.y + location.height * scale)
        : image.height;
      map.fitBounds(
        [px2lngLat(left, bottom), px2lngLat(right, top)],
        { duration: 0 }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  // ── Annotation data sync ──
  useEffect(() => {
    if (mapReady) refreshAnnotationSource();
  }, [annotations, mapReady, refreshAnnotationSource]);

  // ── Interactions ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const featureAt = (point: maplibregl.Point) => {
      if (!map.getLayer(LAYER_CIRCLES)) return undefined;
      return map.queryRenderedFeatures(point, { layers: [LAYER_CIRCLES] })[0];
    };
    const annotationById = (id: string) =>
      annotationsRef.current.find((a) => a.id === id);

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      const px = lngLat2px(e.lngLat.lng, e.lngLat.lat);
      cursorPxRef.current = px;

      if (draggingIdRef.current) {
        dragPositionRef.current = px;
        refreshAnnotationSource();
        return;
      }

      const feature = featureAt(e.point);
      map.getCanvas().style.cursor = feature ? 'pointer' : '';
      const id = (feature?.properties as any)?.id ?? null;
      if (id !== hoveredIdRef.current) {
        hoveredIdRef.current = id;
        popupRef.current?.remove();
        popupRef.current = null;
        const annotation = id ? annotationById(id) : undefined;
        if (annotation) {
          const div = document.createElement('div');
          const lines: string[] = [
            `Label: ${categoryName(annotation.categoryId)}`,
          ];
          if (isFalseNegative(annotation)) lines.push('False Negative');
          lines.push(
            `Created by: ${
              allUsers.find((u: any) => u.id == annotation.owner)?.name ??
              'Unknown'
            }`
          );
          if (annotation.createdAt)
            lines.push(`Created at: ${annotation.createdAt}`);
          if (annotation.objectId)
            lines.push(`Name: ${objectName(annotation.objectId)}`);
          else if ((annotation as any).proposedObjectId)
            lines.push(
              `Proposed Name: ${objectName((annotation as any).proposedObjectId)}`
            );
          lines.forEach((text) => {
            const row = document.createElement('div');
            row.textContent = text;
            div.appendChild(row);
          });
          popupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 12,
          })
            .setLngLat((feature!.geometry as any).coordinates)
            .setDOMContent(div)
            .addTo(map);
        }
      }
    };

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      if (e.originalEvent.button !== 0) return;
      const feature = featureAt(e.point);
      if (!feature || (feature.properties as any).readonly) return;
      e.preventDefault(); // keep the map from panning
      draggingIdRef.current = (feature.properties as any).id;
      dragPositionRef.current = lngLat2px(e.lngLat.lng, e.lngLat.lat);
      map.getCanvas().style.cursor = 'grabbing';
    };

    const onMouseUp = () => {
      const id = draggingIdRef.current;
      const pos = dragPositionRef.current;
      draggingIdRef.current = null;
      dragPositionRef.current = null;
      map.getCanvas().style.cursor = '';
      if (!id || !pos) return;
      const annotation = annotationById(id);
      if (!annotation) return;
      const x = Math.round(pos.x);
      const y = Math.round(pos.y);
      const bounds = locationBoundsRef.current;
      if (bounds && !isWithinLocationBounds({ x, y }, bounds)) {
        refreshAnnotationSource(); // revert
        return;
      }
      if (x !== annotation.x || y !== annotation.y) {
        annotationsHook.update({ ...annotation, x, y } as any);
      } else {
        refreshAnnotationSource();
      }
    };

    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (menu) {
        setMenu(null);
        return;
      }
      if (featureAt(e.point)) return; // clicks on markers never create
      const px = lngLat2px(e.lngLat.lng, e.lngLat.lat);
      const xy = { x: Math.round(px.x), y: Math.round(px.y) };
      const bounds = locationBoundsRef.current;
      if (bounds && !isWithinLocationBounds(xy, bounds)) return;
      if (!currentCategory || !source || !project) return;
      annotationsHook.create({
        imageId: image.id,
        setId,
        projectId: project.id,
        x: xy.x,
        y: xy.y,
        categoryId: resolveCategoryIdForSet(
          currentCategory as any,
          (projectCategories as any[]) ?? [],
          location?.annotationSetId as string
        ),
        source,
        obscured: false,
        group: project.organizationId,
      } as any);
    };

    const onContextMenu = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      const feature = featureAt(e.point);
      let items: ImageMenuItem[];
      if (feature) {
        const annotation = annotationById((feature.properties as any).id);
        if (!annotation) return;
        if ((feature.properties as any).readonly) {
          items = [{ text: 'Outside location (read-only)', disabled: true }];
        } else {
          items = [];
          if (!(annotation as any).shadow) {
            items.push({
              text: 'Delete',
              callback: () => annotationsHook.delete(annotation as any),
            });
          }
          items.push({
            text: annotation.obscured
              ? 'Mark as visible'
              : 'Mark as obscured',
            callback: () =>
              annotationsHook.update({
                ...annotation,
                obscured: !annotation.obscured,
              } as any),
          });
          if (annotation.objectId) {
            items.push({
              text: 'Remove assigned name',
              callback: () =>
                annotationsHook.update({
                  ...annotation,
                  objectId: undefined,
                } as any),
            });
          }
          items.push({
            text: 'Change Label',
            callback: () => setCategoryModalAnnotation(annotation),
          });
        }
      } else {
        items = [...menuItemsRef.current];
        if (location?.confidence != null) {
          items.unshift({
            text: `Confidence : ${location.confidence}`,
            disabled: true,
          });
        }
      }
      setMenu({ x: e.point.x, y: e.point.y, items });
    };

    const onMouseOver = () => {
      mouseOverMapRef.current = true;
    };
    const onMouseOut = () => {
      mouseOverMapRef.current = false;
      map.getCanvas().style.cursor = '';
      hoveredIdRef.current = null;
      popupRef.current?.remove();
      popupRef.current = null;
    };

    map.on('mousemove', onMouseMove);
    map.on('mousedown', onMouseDown);
    map.on('mouseup', onMouseUp);
    map.on('click', onClick);
    map.on('contextmenu', onContextMenu);
    map.on('mouseover', onMouseOver);
    map.on('mouseout', onMouseOut);
    return () => {
      map.off('mousemove', onMouseMove);
      map.off('mousedown', onMouseDown);
      map.off('mouseup', onMouseUp);
      map.off('click', onClick);
      map.off('contextmenu', onContextMenu);
      map.off('mouseover', onMouseOver);
      map.off('mouseout', onMouseOut);
    };
  }, [
    mapReady,
    menu,
    currentCategory,
    projectCategories,
    source,
    setId,
    project,
    image.id,
    location?.annotationSetId,
    location?.confidence,
    annotationsHook,
    lngLat2px,
    refreshAnnotationSource,
    categoryName,
    allUsers,
  ]);

  // ── Marker visibility (Tab to peek underneath) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const visibility = markersHidden ? 'none' : 'visible';
    [LAYER_CIRCLES, LAYER_ICONS, LAYER_LOCATION].forEach((layer) => {
      if (map.getLayer(layer)) {
        map.setLayoutProperty(layer, 'visibility', visibility);
      }
    });
  }, [markersHidden, mapReady]);

  // ── Task lifecycle: timestamps + advance gating ──
  useEffect(() => {
    if (visible) {
      setVisibleTimestamp(Date.now());
      mapRef.current?.resize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (fullyLoaded) {
      setFullyLoadedTimestamp(Date.now());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullyLoaded]);

  useEffect(() => {
    if (visible && fullyLoaded) {
      const timer = setTimeout(() => setCanAdvance(true), 100);
      return () => clearTimeout(timer);
    }
  }, [visible, fullyLoaded]);

  // ── Hotkeys ──
  useHotkeys('RightArrow', next ?? (() => {}), {
    enabled: canAdvance && visible,
  }, [next]);
  useHotkeys('LeftArrow', prev ?? (() => {}), { enabled: visible }, [prev]);

  useHotkeys(
    'Tab',
    (event) => {
      event.preventDefault();
      setMarkersHidden(isHotkeyPressed('Tab'));
    },
    { keyup: true, keydown: true, enabled: visible }
  );

  useHotkeys(
    'Backspace',
    () => {
      const id = hoveredIdRef.current;
      if (!id) return;
      const annotation = annotationsRef.current.find((a) => a.id === id);
      if (!annotation) return;
      if (
        locationBoundsRef.current &&
        !isWithinLocationBounds(annotation, locationBoundsRef.current)
      ) {
        return;
      }
      annotationsHook.delete(annotation as any);
    },
    { enabled: visible },
    [annotationsHook]
  );

  const hotkeyCategories = useMemo(
    () => (categories ?? []).filter((c) => c.shortcutKey),
    [categories]
  );
  const hotkeys = hotkeyCategories.map((c) => c.shortcutKey!).join(',');
  useHotkeys(
    hotkeys || 'f24',
    (event) => {
      if (event.repeat) return;
      if (!mouseOverMapRef.current) return;
      const category = hotkeyCategories.find(
        (c) => c.shortcutKey!.toLowerCase() === event.key?.toLowerCase()
      );
      if (!category) return;
      event.preventDefault();
      event.stopPropagation();
      const x = Math.round(cursorPxRef.current.x);
      const y = Math.round(cursorPxRef.current.y);
      const bounds = locationBoundsRef.current;
      if (bounds && !isWithinLocationBounds({ x, y }, bounds)) return;
      annotationsHook.create({
        categoryId: category.id,
        setId,
        imageId: image.id,
        x,
        y,
        projectId: project.id,
        source,
        group: project.organizationId,
      } as any);
      setCurrentCategory(category);
    },
    { keydown: true, keyup: false, enabled: visible && hotkeys.length > 0 },
    [hotkeyCategories, annotationsHook, setId, image.id, source, project]
  );

  const sortedCategories = useMemo(
    () => [...(categories ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  return (
    <div className='d-flex flex-column align-items-stretch w-100 h-100 gap-3'>
      <div
        className='d-flex flex-column align-items-stretch w-100 h-100'
        style={{
          visibility: visible && fullyLoaded ? 'visible' : 'hidden',
          position: 'relative',
        }}
      >
        <div
          ref={containerRef}
          style={{ width: '100%', height: '100%', borderRadius: 10 }}
        />

        {imageFilesLoading ? (
          <CenterNotice
            title='Loading image files...'
            titleColor='#333'
            body='Please wait while we fetch the available layers.'
          />
        ) : imageFiles.length === 0 ? (
          <CenterNotice
            title='⚠️ No Image Files Found'
            titleColor='red'
            body={`Image ID: ${image.id} — this image has no associated files in the database.`}
          />
        ) : null}

        {/* On-map legend (mobile, or when the side legend is collapsed) */}
        {sortedCategories.length > 0 && (
          <div
            className={showMapLegend ? 'd-block' : 'd-block d-md-none'}
            style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 5 }}
            onMouseEnter={() => setLegendExpanded(true)}
            onMouseLeave={() => setLegendExpanded(false)}
          >
            <div
              style={{
                background: 'white',
                color: '#333',
                borderRadius: 6,
                boxShadow: '0 1px 5px rgba(0,0,0,0.4)',
                padding: legendExpanded ? 4 : '6px 10px',
                fontSize: 14,
              }}
            >
              {legendExpanded
                ? sortedCategories.map((category) => (
                    <div
                      key={category.id}
                      onClick={() => setCurrentCategory(category)}
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        padding: 8,
                        cursor: 'pointer',
                        backgroundColor:
                          currentCategory?.id === category.id
                            ? '#bdbebf'
                            : 'transparent',
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: category.color || '#000',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flexGrow: 1 }}>{category.name}</span>
                      <span>({category.shortcutKey})</span>
                    </div>
                  ))
                : 'Legend'}
            </div>
          </div>
        )}

        {/* Context menu */}
        {menu && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 9 }}
              onClick={() => setMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu(null);
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: menu.x,
                top: menu.y,
                zIndex: 10,
                background: 'white',
                color: '#333',
                borderRadius: 4,
                boxShadow: '0 1px 5px rgba(0,0,0,0.4)',
                minWidth: 180,
                maxWidth: 320,
                overflow: 'hidden',
                fontSize: 13,
              }}
            >
              {menu.items.map((item, i) => (
                <div
                  key={i}
                  onClick={() => {
                    if (item.disabled) return;
                    setMenu(null);
                    item.callback?.();
                  }}
                  style={{
                    padding: '6px 12px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    cursor: item.disabled ? 'default' : 'pointer',
                    color: item.disabled ? '#999' : '#333',
                  }}
                  onMouseEnter={(e) => {
                    if (!item.disabled)
                      (e.target as HTMLElement).style.background = '#f0f0f0';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.background = '';
                  }}
                >
                  {item.text}
                </div>
              ))}
            </div>
          </>
        )}

        <ChangeCategoryModal
          show={categoryModalAnnotation !== null}
          onClose={() => setCategoryModalAnnotation(null)}
          categories={categories}
          currentCategoryId={categoryModalAnnotation?.categoryId}
          onSelectCategory={(categoryId: string) => {
            if (categoryModalAnnotation) {
              annotationsHook.update({
                id: categoryModalAnnotation.id,
                categoryId,
              } as any);
            }
          }}
        />
      </div>

      {(next || prev) && fullyLoaded && !hideNavButtons && (
        <NavButtons prev={prev} next={canAdvance ? next : undefined} />
      )}
    </div>
  );
}

function CenterNotice({
  title,
  titleColor,
  body,
}: {
  title: string;
  titleColor: string;
  body: string;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(255,255,255,0.9)',
        padding: '20px',
        borderRadius: '10px',
        textAlign: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{ color: titleColor, fontWeight: 'bold', marginBottom: '10px' }}
      >
        {title}
      </div>
      <div style={{ fontSize: '12px', color: '#666' }}>{body}</div>
    </div>
  );
}
