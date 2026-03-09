import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getTileBlob } from '../StorageLayer';
import type { ImageType } from '../schemaTypes';
import type { Point } from '../ManualHomographyEditor';

mapboxgl.accessToken = (import.meta as any).env.VITE_MAPBOX_ACCESS_TOKEN ?? '';

export const POINT_COLORS = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4',
  '#469990', '#dcbeff',
];

const TILE_SIZE = 256;
const SOURCE_POINTS = 'points';
const LAYER_CIRCLES = 'points-circle';
const LAYER_LABELS = 'points-label';

/**
 * Higher-resolution scale to keep coordinates very close to the equator (e.g. within 0.1 deg).
 * Mapbox Use Web Mercator, which is linear near the equator. At 45 deg lat, vertical distortion
 * is ~40%, but at 0.1 deg lat, it is < 0.0001%.
 */
function getScale(width: number, height: number) {
  return 0.1 / Math.max(width, height);
}

function getPointFeaturesAt(map: mapboxgl.Map, point: mapboxgl.Point) {
  return map.queryRenderedFeatures(point, { layers: [LAYER_CIRCLES] });
}

type Props = {
  image: ImageType;
  sourceKey: string | undefined;
  points: Point[];
  setPoints: (updater: Point[] | ((prev: Point[]) => Point[])) => void;
  highlightedIndex: number | null;
  onHoverPoint: (index: number | null) => void;
  onContextMenu?: (pointIndex: number, screenPos: { x: number; y: number }) => void;
  onAction?: () => void;
  maxPoints?: number;
  previewTransform?: (c: [number, number]) => [number, number];
  otherImage?: ImageType;
  onMapInstance?: (map: mapboxgl.Map | null, px2lngLat: (x: number, y: number) => [number, number], lngLat2px: (lng: number, lat: number) => { x: number; y: number }) => void;
};

const SOURCE_PREVIEW = 'preview';
const LAYER_OUTLINE = 'preview-outline';
const LAYER_GRID = 'preview-grid';

export function MapboxImageViewer({
  image,
  sourceKey,
  points,
  setPoints,
  highlightedIndex,
  onHoverPoint,
  onContextMenu,
  onAction,
  maxPoints = 12,
  previewTransform,
  otherImage,
  onMapInstance,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const dragPointRef = useRef<{ index: number } | null>(null);
  const cancelledRef = useRef(false);
  const loadedTilesRef = useRef<Set<string>>(new Set());
  const blobUrlsRef = useRef<string[]>([]);

  const scale = useMemo(() => getScale(image.width, image.height), [image.width, image.height]);

  const px2lngLat = useCallback(
    (x: number, y: number): [number, number] => [x * scale, -y * scale],
    [scale]
  );
  const lngLat2px = useCallback(
    (lng: number, lat: number): { x: number; y: number } => ({
      x: lng / scale,
      y: -lat / scale,
    }),
    [scale]
  );

  // Load only visible tiles at a suitable zoom level
  const updateVisibleTiles = useCallback(async (m: mapboxgl.Map | null) => {
    if (!m || !sourceKey || cancelledRef.current) return;

    const { maxZ, pyramidSize } = getPyramidInfo(image);

    // Choose tile zoom z based on current map zoom.
    // We want the tiles to be sharp but not excessively high-res.
    const mapZoom = m.getZoom();
    const degPerPxAtZoom0 = 360 / 256;
    const currentDegPerPx = degPerPxAtZoom0 / Math.pow(2, mapZoom);
    const targetTilePxPerDeg = 1 / (currentDegPerPx * 0.75); // slight oversampling for sharpness

    // Tile resolution at tileZ z: (TILE_SIZE * 2^z) / (pyramidSize * scale) px/deg
    const target2z = (targetTilePxPerDeg * pyramidSize * scale) / TILE_SIZE;
    const z = Math.max(0, Math.min(maxZ, Math.round(Math.log2(target2z))));

    const tileCoverage = pyramidSize / Math.pow(2, z);
    const cols = Math.ceil(image.width / tileCoverage);
    const rows = Math.ceil(image.height / tileCoverage);

    const bounds = m.getBounds();

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const sourceId = `tile-${z}-${row}-${col}`;
        if (loadedTilesRef.current.has(sourceId)) continue;

        const x0 = col * tileCoverage;
        const y0 = row * tileCoverage;
        const x1 = (col + 1) * tileCoverage;
        const y1 = (row + 1) * tileCoverage;

        const c1 = px2lngLat(x0, y0);
        const c2 = px2lngLat(x1, y1);
        const tileBounds = new mapboxgl.LngLatBounds(
          [Math.min(c1[0], c2[0]), Math.min(c1[1], c2[1])],
          [Math.max(c1[0], c2[0]), Math.max(c1[1], c2[1])]
        );

        const isVisible = bounds && (
          bounds.getWest() <= tileBounds.getEast() &&
          bounds.getEast() >= tileBounds.getWest() &&
          bounds.getSouth() <= tileBounds.getNorth() &&
          bounds.getNorth() >= tileBounds.getSouth()
        );

        if (isVisible) {
          loadedTilesRef.current.add(sourceId);
          const path = `slippymaps/${sourceKey}/${z}/${row}/${col}.png`;
          getTileBlob(path).then((blob) => {
            if (cancelledRef.current) return;
            const url = URL.createObjectURL(blob);
            blobUrlsRef.current.push(url);
            addTileToMap(m, url, z, row, col, tileCoverage, px2lngLat);
          }).catch(() => {
            // Silently fail, tile will remain in 'visible' check for later
            loadedTilesRef.current.delete(sourceId);
          });
        }
      }
    }
  }, [sourceKey, image, px2lngLat, scale]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;
    cancelledRef.current = false;
    loadedTilesRef.current = new Set();
    blobUrlsRef.current = [];

    const m = new mapboxgl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
        sources: {},
        layers: [],
      },
      center: px2lngLat(image.width / 2, image.height / 2),
      zoom: 1,
      minZoom: -20,
      maxZoom: 22,
      renderWorldCopies: false,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchZoomRotate: true,
    });

    m.touchZoomRotate.disableRotation();

    m.on('load', () => {
      m.addSource(SOURCE_POINTS, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      m.addLayer({
        id: LAYER_CIRCLES,
        type: 'circle',
        source: SOURCE_POINTS,
        paint: {
          'circle-radius': [
            'case',
            ['boolean', ['get', 'highlighted'], false],
            10, 7,
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        },
      });

      m.addLayer({
        id: LAYER_LABELS,
        type: 'symbol',
        source: SOURCE_POINTS,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 12,
          'text-offset': [0, -1.5],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.7)',
          'text-halo-width': 1.5,
        },
      });

      // Homography preview layers
      m.addSource(SOURCE_PREVIEW, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      m.addLayer({
        id: LAYER_GRID,
        type: 'line',
        source: SOURCE_PREVIEW,
        filter: ['==', ['get', 'type'], 'grid'],
        paint: {
          'line-color': '#00e5ff',
          'line-width': 1,
          'line-opacity': 0.4,
        },
      });

      m.addLayer({
        id: LAYER_OUTLINE,
        type: 'line',
        source: SOURCE_PREVIEW,
        filter: ['==', ['get', 'type'], 'outline'],
        paint: {
          'line-color': '#00e5ff',
          'line-width': 3,
          'line-dasharray': [2, 1],
        },
      });

      m.fitBounds(
        [px2lngLat(0, image.height), px2lngLat(image.width, 0)],
        { padding: 20, animate: false }
      );

      updateVisibleTiles(m);
      setMap(m);
    });

    const onMoveEnd = () => updateVisibleTiles(m);
    m.on('moveend', onMoveEnd);

    return () => {
      cancelledRef.current = true;
      m.remove();
      setMap(null);
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [image.id, sourceKey, px2lngLat, updateVisibleTiles, image.width, image.height]);

  useEffect(() => {
    onMapInstance?.(map, px2lngLat, lngLat2px);
  }, [map, px2lngLat, lngLat2px, onMapInstance]);

  // Update points GeoJSON
  useEffect(() => {
    if (!map) return;
    const source = map.getSource(SOURCE_POINTS) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    const features = points.map((p, i) => ({
      type: 'Feature' as const,
      properties: {
        index: i,
        label: `${i + 1}`,
        color: POINT_COLORS[i % POINT_COLORS.length],
        highlighted: i === highlightedIndex,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: px2lngLat(p.x, p.y),
      },
    }));

    source.setData({ type: 'FeatureCollection', features });
  }, [map, points, highlightedIndex, px2lngLat]);

  // Update homography preview GeoJSON
  useEffect(() => {
    if (!map) return;
    const source = map.getSource(SOURCE_PREVIEW) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    if (!previewTransform || !otherImage) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const w = otherImage.width;
    const h = otherImage.height;
    const GRID_DIVISIONS = 8;
    const GRID_SAMPLES = 30;

    const features: any[] = [];

    // Outline
    const corners: [number, number][] = [[0, 0], [w, 0], [w, h], [0, h], [0, 0]];
    features.push({
      type: 'Feature',
      properties: { type: 'outline' },
      geometry: {
        type: 'LineString',
        coordinates: corners.map((c) => px2lngLat(...previewTransform(c))),
      },
    });

    // Grid lines
    for (let i = 0; i <= GRID_DIVISIONS; i++) {
      // Vertical
      const x = (w * i) / GRID_DIVISIONS;
      const vLine: [number, number][] = [];
      for (let j = 0; j <= GRID_SAMPLES; j++) {
        vLine.push(previewTransform([x, (h * j) / GRID_SAMPLES]));
      }
      features.push({
        type: 'Feature',
        properties: { type: 'grid' },
        geometry: {
          type: 'LineString',
          coordinates: vLine.map((c) => px2lngLat(...c)),
        },
      });

      // Horizontal
      const y = (h * i) / GRID_DIVISIONS;
      const hLine: [number, number][] = [];
      for (let j = 0; j <= GRID_SAMPLES; j++) {
        hLine.push(previewTransform([(w * j) / GRID_SAMPLES, y]));
      }
      features.push({
        type: 'Feature',
        properties: { type: 'grid' },
        geometry: {
          type: 'LineString',
          coordinates: hLine.map((c) => px2lngLat(...c)),
        },
      });
    }

    source.setData({ type: 'FeatureCollection', features });
  }, [map, previewTransform, otherImage, px2lngLat]);

  // Click to add points
  useEffect(() => {
    if (!map) return;

    const MIN_POINT_DISTANCE = 20;

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      if (getPointFeaturesAt(map, e.point).length > 0) return;

      const { x, y } = lngLat2px(e.lngLat.lng, e.lngLat.lat);
      if (x < 0 || x > image.width || y < 0 || y > image.height) return;
      if (points.length >= maxPoints) return;

      const tooClose = points.some((p) => {
        const dx = p.x - x;
        const dy = p.y - y;
        return Math.sqrt(dx * dx + dy * dy) < MIN_POINT_DISTANCE;
      });
      if (tooClose) return;

      onAction?.();
      setPoints((prev) => [...prev, { id: crypto.randomUUID(), x, y }]);
    };

    map.on('click', handleClick);
    return () => { map.off('click', handleClick); };
  }, [map, points, maxPoints, lngLat2px, setPoints, image.width, image.height]);

  // Hover highlights
  useEffect(() => {
    if (!map) return;

    const handleMouseMove = (e: mapboxgl.MapMouseEvent) => {
      if (dragPointRef.current) return;
      const features = getPointFeaturesAt(map, e.point);
      if (features.length > 0) {
        map.getCanvas().style.cursor = 'pointer';
        onHoverPoint(features[0].properties?.index ?? null);
      } else {
        map.getCanvas().style.cursor = 'crosshair';
        onHoverPoint(null);
      }
    };

    const handleMouseLeave = () => onHoverPoint(null);

    map.on('mousemove', handleMouseMove);
    const canvas = map.getCanvas();
    canvas.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      map.off('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [map, onHoverPoint]);

  // Drag points
  useEffect(() => {
    if (!map) return;

    const handleMouseDown = (e: mapboxgl.MapMouseEvent) => {
      // Only allow dragging with left mouse button
      if (e.originalEvent.button !== 0) return;

      const features = getPointFeaturesAt(map, e.point);
      if (features.length === 0) return;
      const index = features[0].properties?.index;
      if (index == null) return;

      e.preventDefault();
      onAction?.();
      dragPointRef.current = { index };
      map.getCanvas().style.cursor = 'grabbing';
      map.dragPan.disable();
    };

    const handleMouseMoveForDrag = (e: mapboxgl.MapMouseEvent) => {
      if (!dragPointRef.current) return;
      const { x, y } = lngLat2px(e.lngLat.lng, e.lngLat.lat);
      const idx = dragPointRef.current.index;
      setPoints((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, x, y } : p))
      );
    };

    const handleMouseUp = () => {
      if (!dragPointRef.current) return;
      dragPointRef.current = null;
      map.getCanvas().style.cursor = 'crosshair';
      map.dragPan.enable();
    };

    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMoveForDrag);
    map.on('mouseup', handleMouseUp);
    const canvas = map.getCanvas();
    canvas.addEventListener('mouseleave', handleMouseUp);

    return () => {
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMoveForDrag);
      map.off('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [map, lngLat2px, setPoints]);

  // Right-click context menu
  useEffect(() => {
    if (!map) return;

    const handleContextMenu = (e: mapboxgl.MapMouseEvent) => {
      const features = getPointFeaturesAt(map, e.point);
      if (features.length === 0) return;
      e.preventDefault();
      const index = features[0].properties?.index;
      if (index == null) return;
      onContextMenu?.(index, { x: e.point.x, y: e.point.y });
    };

    map.on('contextmenu', handleContextMenu);
    return () => { map.off('contextmenu', handleContextMenu); };
  }, [map, onContextMenu]);

  return (
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
  );
}

function getPyramidInfo(image: ImageType) {
  const maxDim = Math.max(image.width, image.height);
  const maxZ = Math.ceil(Math.log2(maxDim / TILE_SIZE));
  const pyramidSize = TILE_SIZE * Math.pow(2, maxZ);
  return { maxZ, pyramidSize };
}

function addTileToMap(
  map: mapboxgl.Map,
  blobUrl: string,
  z: number, row: number, col: number,
  tileCoverage: number,
  px2lngLat: (x: number, y: number) => [number, number],
) {
  const sourceId = `tile-${z}-${row}-${col}`;
  if (map.getSource(sourceId)) return;

  const x0 = col * tileCoverage;
  const y0 = row * tileCoverage;
  const x1 = (col + 1) * tileCoverage;
  const y1 = (row + 1) * tileCoverage;

  map.addSource(sourceId, {
    type: 'image',
    url: blobUrl,
    coordinates: [
      px2lngLat(x0, y0),
      px2lngLat(x1, y0),
      px2lngLat(x1, y1),
      px2lngLat(x0, y1),
    ],
  });

  map.addLayer(
    {
      id: `layer-${z}-${row}-${col}`,
      type: 'raster',
      source: sourceId,
      paint: { 'raster-fade-duration': 0 },
    },
    LAYER_CIRCLES
  );
}

