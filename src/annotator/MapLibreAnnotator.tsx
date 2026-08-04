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
import { useHotkeys, isHotkeyPressed } from 'react-hotkeys-hook';
import {
  makeProjection,
  createImageMap,
  addImageTiles,
  leafletZoom2MapZoom,
  mapZoom2LeafletZoom,
} from './imageTiles';
import { ImageContext, ManagementContext, ProjectContext } from '../Context';
import useImageMenuItems from '../useImageMenuItems';
import { isWithinLocationBounds, resolveCategoryIdForSet } from '../utils';
import { NavButtons } from '../NavButtons';
import ChangeCategoryModal from '../ChangeCategoryModal';
import type { CategoryType, ExtendedAnnotationType } from '../schemaTypes';
import type { AnnotationImage, AnnotationLocation } from '../annotationTypes';
import {
  buildAnnotationFeatureCollection,
  buildAnnotationPopupLines,
  isFalseNegative,
  type AnnotationFeatureProperties,
} from './annotationFeatures';
import {
  buildAnnotationMenuItems,
  buildImageMenuItems,
} from './annotationMenus';
import {
  AnnotationLegendOverlay,
  ContextMenuOverlay,
  ImageFileStatusOverlay,
  type MenuState,
} from './AnnotatorOverlays';
import useImageFileSource from './useImageFileSource';

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
const LAYER_ACTIVE = 'annotation-active-ring';
const LAYER_OUTLINES = 'annotation-outlines';
const LAYER_CIRCLES = 'annotation-circles';
const LAYER_ICONS = 'annotation-icons';
const LAYER_STATUS_ICONS = 'annotation-status-icons';
const SOURCE_LOCATION = 'location-rect';
const LAYER_LOCATION = 'location-rect-line';

export interface MapLibreAnnotatorProps {
  image: AnnotationImage;
  location: AnnotationLocation;
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
  /** Informational tag names per annotation id, shown in the hover popup. */
  infoTags?: Map<string, string[]>;
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
    infoTags,
  } = props;

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
    useState<ExtendedAnnotationType | null>(null);

  // Refs for values read inside imperative map handlers
  const cursorPxRef = useRef({ x: 0, y: 0 });
  const mouseOverMapRef = useRef(false);
  const hoveredIdRef = useRef<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const dragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const annotationsRef = useRef<ExtendedAnnotationType[]>([]);

  const {
    imageFiles,
    loading: imageFilesLoading,
    sourceKey,
  } = useImageFileSource(image.id);

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
  // Read at hover time so tags arriving later show up without rebinding the
  // map's interaction handlers.
  const infoTagsRef = useRef(infoTags);
  infoTagsRef.current = infoTags;

  const annotations = useMemo(
    () =>
      ((annotationsHook.data ?? []) as ExtendedAnnotationType[])
        .filter((annotation) => annotation.setId === setId)
        .filter(
          (annotation) => !(hideFnAnnotations && isFalseNegative(annotation))
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

  // No image files: nothing will ever load, so unblock the task lifecycle
  useEffect(() => {
    if (!imageFilesLoading && imageFiles.length === 0 && !fullyLoaded) {
      setFullyLoaded(true);
    }
  }, [imageFiles.length, imageFilesLoading, fullyLoaded]);

  const buildFeatureCollection = useCallback((): GeoJSON.FeatureCollection => {
    return buildAnnotationFeatureCollection({
      annotations: annotationsRef.current,
      draggedAnnotationId: draggingIdRef.current,
      dragPosition: dragPositionRef.current,
      locationBounds: locationBoundsRef.current,
      px2lngLat,
      categoryColor,
    });
  }, [px2lngLat, categoryColor]);

  const refreshAnnotationSource = useCallback(() => {
    const src = mapRef.current?.getSource(SOURCE_ANNOTATIONS) as
      | maplibregl.GeoJSONSource
      | undefined;
    src?.setData(buildFeatureCollection());
  }, [buildFeatureCollection]);

  // ── Map construction ──
  useEffect(() => {
    if (!containerRef.current || !sourceKey) return;

    const map = createImageMap(containerRef.current, projection);
    mapRef.current = map;

    // Generate marker icons on demand: identicons per objectId and the
    // false-negative "!" badge.
    map.on('styleimagemissing', (e: maplibregl.MapStyleImageMissingEvent) => {
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
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 14;
        const ctx = canvas.getContext('2d')!;
        jdenticon.drawIcon(ctx, id.slice('identicon-'.length), 14);
        if (!map.hasImage(id)) {
          map.addImage(id, ctx.getImageData(0, 0, 14, 14));
        }
      } else if (id === 'obscured-marker') {
        const canvas = document.createElement('canvas');
        const size = 32;
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#1f2933';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.translate(5, 5);
        ctx.scale(22 / 24, 22 / 24);
        ctx.strokeStyle = '#1f2933';
        ctx.lineWidth = 2.75;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        [
          'M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49',
          'M14.084 14.158a3 3 0 0 1-4.242-4.242',
          'M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143',
          'm2 2 20 20',
        ].forEach((path) => ctx.stroke(new Path2D(path)));
        ctx.restore();

        if (!map.hasImage(id)) {
          map.addImage(id, ctx.getImageData(0, 0, size, size), {
            pixelRatio: 2,
          });
        }
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
        id: LAYER_OUTLINES,
        type: 'circle',
        source: SOURCE_ANNOTATIONS,
        paint: {
          'circle-radius': ['+', 10, ['get', 'borderWidth']],
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(0, 0, 0, 0.45)',
          'circle-opacity': ['get', 'opacity'],
          'circle-stroke-opacity': ['get', 'opacity'],
        },
      });
      map.addLayer({
        id: LAYER_ACTIVE,
        type: 'circle',
        source: SOURCE_ANNOTATIONS,
        filter: ['==', ['get', 'active'], true],
        paint: {
          'circle-radius': ['+', 10, ['get', 'borderWidth']],
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ff8c1a',
          'circle-opacity': ['get', 'opacity'],
          'circle-stroke-opacity': ['get', 'opacity'],
        },
      });
      map.addLayer({
        id: LAYER_CIRCLES,
        type: 'circle',
        source: SOURCE_ANNOTATIONS,
        paint: {
          'circle-radius': 10,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': ['get', 'borderWidth'],
          'circle-stroke-color': ['get', 'borderColor'],
          'circle-opacity': ['get', 'opacity'],
          'circle-stroke-opacity': ['get', 'opacity'],
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
        paint: {
          'icon-opacity': ['get', 'opacity'],
        },
      });
      map.addLayer({
        id: LAYER_STATUS_ICONS,
        type: 'symbol',
        source: SOURCE_ANNOTATIONS,
        filter: ['!=', ['get', 'statusIcon'], ''],
        layout: {
          'icon-image': ['get', 'statusIcon'],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-translate': [7, -7],
          'icon-translate-anchor': 'viewport',
          'icon-opacity': ['get', 'opacity'],
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
      map.fitBounds([px2lngLat(left, bottom), px2lngLat(right, top)], {
        duration: 0,
      });
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
    const featureProperties = (
      feature?: maplibregl.MapGeoJSONFeature
    ): AnnotationFeatureProperties | undefined =>
      feature?.properties as AnnotationFeatureProperties | undefined;

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
      const id = featureProperties(feature)?.id ?? null;
      if (id !== hoveredIdRef.current) {
        hoveredIdRef.current = id;
        popupRef.current?.remove();
        popupRef.current = null;
        const annotation = id ? annotationById(id) : undefined;
        if (annotation) {
          const div = document.createElement('div');
          div.style.color = '#212529';
          div.style.fontSize = '13px';
          div.style.lineHeight = '1.5';
          div.style.whiteSpace = 'nowrap';
          const lines = buildAnnotationPopupLines(
            annotation,
            categoryName,
            allUsers,
            infoTagsRef.current?.get(annotation.id)
          );
          lines.forEach((text) => {
            const row = document.createElement('div');
            row.textContent = text;
            div.appendChild(row);
          });
          popupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            maxWidth: '360px',
            offset: 12,
          })
            .setLngLat(
              (feature!.geometry as GeoJSON.Point).coordinates as [
                number,
                number
              ]
            )
            .setDOMContent(div)
            .addTo(map);
        }
      }
    };

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      if (e.originalEvent.button !== 0) return;
      const feature = featureAt(e.point);
      const properties = featureProperties(feature);
      if (!properties || properties.readonly) return;
      e.preventDefault(); // keep the map from panning
      draggingIdRef.current = properties.id;
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
        annotationsHook.update({ ...annotation, x, y });
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
          currentCategory,
          projectCategories ?? [],
          location.annotationSetId
        ),
        source,
        obscured: false,
        group: project.organizationId,
      });
    };

    const onContextMenu = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      const feature = featureAt(e.point);
      if (feature) {
        const properties = featureProperties(feature);
        if (!properties) return;
        const annotation = annotationById(properties.id);
        if (!annotation) return;
        const items = buildAnnotationMenuItems({
          annotation,
          readonly: properties.readonly,
          onDelete: annotationsHook.delete,
          onUpdate: annotationsHook.update,
          onChangeCategory: setCategoryModalAnnotation,
        });
        setMenu({ x: e.point.x, y: e.point.y, items });
      } else {
        const items = buildImageMenuItems(
          menuItemsRef.current,
          location.confidence
        );
        setMenu({ x: e.point.x, y: e.point.y, items });
      }
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
    [
      LAYER_ACTIVE,
      LAYER_OUTLINES,
      LAYER_CIRCLES,
      LAYER_ICONS,
      LAYER_STATUS_ICONS,
      LAYER_LOCATION,
    ].forEach((layer) => {
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
  useHotkeys(
    'RightArrow',
    next ?? (() => {}),
    {
      enabled: canAdvance && visible,
    },
    [next]
  );
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
      annotationsHook.delete(annotation);
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
      });
      setCurrentCategory(category);
    },
    { keydown: true, keyup: false, enabled: visible && hotkeys.length > 0 },
    [hotkeyCategories, annotationsHook, setId, image.id, source, project]
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
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 10,
            overflow: 'hidden',
            background: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        />

        <ImageFileStatusOverlay
          loading={imageFilesLoading}
          fileCount={imageFiles.length}
          imageId={image.id}
        />

        <AnnotationLegendOverlay
          categories={categories}
          currentCategoryId={currentCategory?.id}
          forceVisible={showMapLegend}
          onSelectCategory={setCurrentCategory}
        />

        <ContextMenuOverlay menu={menu} onClose={() => setMenu(null)} />

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
              });
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
