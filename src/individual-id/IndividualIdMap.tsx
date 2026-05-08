import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as jdenticon from 'jdenticon';
import {
  uniqueNamesGenerator,
  adjectives,
  names,
} from 'unique-names-generator';
import { renderToStaticMarkup } from 'react-dom/server';
import { RotateCw, Layers, Copy, Check } from 'lucide-react';
import { getTileBlob } from '../StorageLayer';
import type { ImageType } from '../schemaTypes';
import type { CandidateStatus, PixelTransform } from './types';

/**
 * Deterministic two-word name (e.g. "Brave Sam") seeded by the candidate's
 * shared identity. Both sides of a linked pair share the same identityKey so
 * a hover on either side reveals the same name — making it easy to spot which
 * marker on the other image belongs to the one under your cursor.
 */
function nameFor(identityKey: string): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, names],
    seed: identityKey,
    style: 'capital',
    separator: ' ',
  });
}

/**
 * Visual classification of a marker.
 *
 *  - primary   — real annotation that owns the canonical position. Renders a
 *                jdenticon seeded by `identityKey`. (Pending unaccepted reals
 *                with no objectId yet are also rendered as primary so the
 *                proposed pair shares an identicon.)
 *  - secondary — real annotation linked to a primary on the other side
 *                (objectId points to another row). Plain coloured dot.
 *  - shadow    — Munkres-proposed position with no DB row yet. Distinctive
 *                white border + slight transparency.
 */
export type MarkerKind = 'primary' | 'secondary' | 'shadow';

export interface MapMarker {
  candidateKey: string;
  side: 'A' | 'B';
  x: number;
  y: number;
  color: string;
  status: CandidateStatus;
  kind: MarkerKind;
  /** Seed for the jdenticon (typically the candidate's pairKey / shared objectId). */
  identityKey: string;
  /** Active candidate is rendered larger with a halo. */
  active: boolean;
}

export type MapInstanceCallback = (
  map: maplibregl.Map | null,
  px2lngLat: (x: number, y: number) => [number, number],
  lngLat2px: (lng: number, lat: number) => { x: number; y: number }
) => void;

interface Props {
  image: ImageType;
  sourceKey?: string;
  markers: MapMarker[];
  onMarkerDrag: (candidateKey: string, x: number, y: number) => void;
  onMarkerClick: (candidateKey: string) => void;
  /**
   * Click on empty map area (not on a marker). Coordinates are in
   * image-space pixels and are guaranteed to lie inside `image` bounds.
   * Used by the pair component to place new annotations.
   */
  onMapClick?: (x: number, y: number) => void;
  /** Receives the map instance + coord converters once the map is ready. */
  onMapInstance?: MapInstanceCallback;
  /**
   * Show a passive popup (name only) for this candidate. Set by the parent
   * when the partner marker on the OTHER map is hovered, so the user can
   * spot the linked marker on this side without moving the cursor.
   * Local hover always wins over passive — when the cursor is on a marker
   * here, the local interactive popup (with delete button) shows instead.
   */
  passiveHoverKey?: string | null;
  /**
   * Fired when the cursor enters/leaves a marker on this map. The parent
   * uses this to drive cross-map highlighting via passiveHoverKey.
   */
  onHoverChange?: (candidateKey: string | null) => void;
  /**
   * User clicked the Delete button in the popup. Only fires for non-shadow
   * markers (the popup hides the button for shadows).
   */
  onMarkerDelete?: (candidateKey: string) => void;
  /**
   * User clicked the "Change Label" button in the popup. Only fires for
   * non-shadow markers — there's nothing to relabel on a shadow yet.
   */
  onMarkerChangeLabel?: (candidateKey: string) => void;
  /**
   * Munkres "leave unmatched" cost in image pixels. Used to render a ring
   * around the active marker so the user can see exactly the radius within
   * which a partner annotation would be paired.
   */
  leniency?: number;
  /**
   * Image-space (x, y) of the candidate the leniency ring should be drawn
   * around. Null when nothing is active on this side.
   */
  leniencyAnchor?: { x: number; y: number } | null;
  /**
   * Transform that maps a coordinate from `otherImage`'s pixel space into
   * THIS image's pixel space. Used by the homography overlay control to
   * draw the other image's bounds (corners + grid) projected onto this
   * image. Side A passes `pair.backward`; side B passes `pair.forward`.
   */
  previewTransform?: PixelTransform;
  /** The OTHER image of the pair, whose bounds the overlay traces. */
  otherImage?: ImageType;
}

const TILE_SIZE = 256;
/** Inactive marker diameter in pixels. Active markers are ~25 (125%). */
const BASE_MARKER_SIZE = 20;
const LENIENCY_SOURCE = 'individual-id-leniency';
const LENIENCY_LAYER = 'individual-id-leniency-ring';
const PREVIEW_SOURCE = 'individual-id-homography-preview';
const PREVIEW_LAYER_OUTLINE = 'individual-id-homography-outline';
const PREVIEW_LAYER_GRID = 'individual-id-homography-grid';

/**
 * Top-left button that eases the map bearing by 90°. Same pattern as the
 * homography editor's RotateControl — keeping a consistent feel between the
 * two map experiences.
 */
class RotateControl implements maplibregl.IControl {
  private container?: HTMLDivElement;
  onAdd(map: maplibregl.Map) {
    const c = document.createElement('div');
    c.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'maplibregl-ctrl-icon';
    btn.title = 'Rotate 90°';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.innerHTML = renderToStaticMarkup(
      <RotateCw size={16} color='#333' strokeWidth={2.5} />
    );
    btn.onclick = () => {
      const next = Math.round(map.getBearing() / 90) * 90 + 90;
      map.easeTo({ bearing: next, duration: 300 });
    };
    c.appendChild(btn);
    this.container = c;
    return c;
  }
  onRemove() {
    this.container?.parentNode?.removeChild(this.container);
    this.container = undefined;
  }
}

/**
 * Toggle button that shows / hides the homography preview layers (outline +
 * grid). The button only flips visibility on the layers — the GeoJSON
 * itself is computed in a React effect from `previewTransform` + `otherImage`.
 */
class HomographyControl implements maplibregl.IControl {
  private container?: HTMLDivElement;
  private visible = false;
  onAdd(map: maplibregl.Map) {
    const c = document.createElement('div');
    c.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'maplibregl-ctrl-icon';
    btn.title = 'Toggle homography overlay';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.innerHTML = renderToStaticMarkup(
      <Layers size={16} color='#333' strokeWidth={2.5} />
    );
    btn.onclick = () => {
      this.visible = !this.visible;
      btn.style.background = this.visible ? '#cce5ff' : '';
      const v = this.visible ? 'visible' : 'none';
      try {
        if (map.getLayer(PREVIEW_LAYER_OUTLINE)) {
          map.setLayoutProperty(PREVIEW_LAYER_OUTLINE, 'visibility', v);
        }
        if (map.getLayer(PREVIEW_LAYER_GRID)) {
          map.setLayoutProperty(PREVIEW_LAYER_GRID, 'visibility', v);
        }
      } catch {
        /* map removed; ignore */
      }
    };
    c.appendChild(btn);
    this.container = c;
    return c;
  }
  onRemove() {
    this.container?.parentNode?.removeChild(this.container);
    this.container = undefined;
  }
}

function getScale(width: number, height: number) {
  return 0.1 / Math.max(width, height);
}
function getPyramidInfo(image: ImageType) {
  const maxDim = Math.max(image.width, image.height);
  const maxZ = Math.ceil(Math.log2(maxDim / TILE_SIZE));
  const pyramidSize = TILE_SIZE * Math.pow(2, maxZ);
  return { maxZ, pyramidSize };
}

/**
 * Recursive check: is a tile at (z, row, col) entirely covered by tiles we've
 * already loaded at higher zoom levels? If so we can skip fetching the
 * lower-res tile when the user zooms back out — the higher-res children
 * already paint the area.
 */
function isCoveredByHigherRes(
  z: number,
  row: number,
  col: number,
  maxZ: number,
  loadedTiles: Set<string>
): boolean {
  if (z >= maxZ) return false;
  const childZ = z + 1;
  for (let dr = 0; dr < 2; dr++) {
    for (let dc = 0; dc < 2; dc++) {
      const cr = row * 2 + dr;
      const cc = col * 2 + dc;
      if (
        !loadedTiles.has(`tile-${childZ}-${cr}-${cc}`) &&
        !isCoveredByHigherRes(childZ, cr, cc, maxZ, loadedTiles)
      ) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Build (or rebuild) the inner DOM of a marker element to match its props.
 * This is called both on marker creation and whenever the matching MapMarker
 * data changes.
 */
function applyMarkerStyle(el: HTMLDivElement, m: MapMarker) {
  // All markers share the same size. The orange ring (composed below as
  // the innermost box-shadow) is the sole active indicator.
  const size = BASE_MARKER_SIZE;
  // Tooltip handled by the custom popup div; no native title needed.
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = '50%';
  el.style.background = m.color;
  el.style.cursor = 'pointer';
  el.style.boxSizing = 'border-box';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.transition = 'box-shadow 80ms ease, border-color 80ms ease';
  // IMPORTANT: do NOT set `transform` here. maplibregl.Marker owns the
  // element's transform to position it on the map; overwriting it would
  // park every marker at (0,0) until the next map render tick.

  // Border varies by kind. White for shadows (so they stand apart from the
  // image), dark grey for real annotations.
  if (m.kind === 'shadow') {
    el.style.border = '2px solid #ffffff';
    el.style.opacity = '0.75';
  } else {
    el.style.border = '1px solid rgba(0, 0, 0, 0.7)';
    el.style.opacity = '1';
  }

  // Active and status are stacked as box-shadows so they compose:
  //   active           → orange ring 0-3px
  //   locked           → yellow ring (3-6px when active, else 0-3px)
  //   accepted         → green  ring (3-6px when active, else 0-3px)
  //   neither          → subtle 1px outline so the marker stays visible
  //                      against bright tiles.
  // box-shadow stacks first-on-top, so put the inner ring first.
  const shadows: string[] = [];
  if (m.active) shadows.push('0 0 0 3px #ff8c1a'); // orange
  if (m.status === 'locked') {
    shadows.push(m.active ? '0 0 0 6px #f1c40f' : '0 0 0 3px #f1c40f');
  } else if (m.status === 'accepted') {
    shadows.push(m.active ? '0 0 0 6px #27ae60' : '0 0 0 3px #27ae60');
  } else if (!m.active) {
    shadows.push('0 0 0 1px rgba(0, 0, 0, 0.45)');
  }
  el.style.boxShadow = shadows.join(', ');

  // Identicon for primary markers only.
  if (m.kind === 'primary') {
    const inner = Math.round(size * 0.7);
    el.innerHTML = jdenticon.toSvg(m.identityKey, inner);
    // jdenticon emits an <svg> as the only child; ensure it doesn't catch events.
    const svg = el.firstChild as SVGElement | null;
    if (svg) svg.setAttribute('style', 'pointer-events: none');
  } else {
    el.innerHTML = '';
  }
}

/**
 * Single image MapLibre map. Markers are HTML elements managed by maplibregl.Marker
 * (so we get real SVG jdenticons inside primary markers and free draggability).
 */
export function IndividualIdMap({
  image,
  sourceKey,
  markers,
  onMarkerDrag,
  onMarkerClick,
  onMapClick,
  onMapInstance,
  passiveHoverKey,
  onHoverChange,
  onMarkerDelete,
  onMarkerChangeLabel,
  leniency,
  leniencyAnchor,
  previewTransform,
  otherImage,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const cancelledRef = useRef(false);
  const loadedTilesRef = useRef<Set<string>>(new Set());
  const blobUrlsRef = useRef<string[]>([]);
  const markerRefs = useRef<Map<string, maplibregl.Marker>>(new Map());

  // Latest callback refs so persistent marker handlers always invoke the
  // freshest closures without needing to be re-bound.
  const dragRef = useRef(onMarkerDrag);
  const clickRef = useRef(onMarkerClick);
  const mapClickRef = useRef(onMapClick);
  const hoverChangeRef = useRef(onHoverChange);
  const deleteRef = useRef(onMarkerDelete);
  const changeLabelRef = useRef(onMarkerChangeLabel);
  useEffect(() => {
    dragRef.current = onMarkerDrag;
  }, [onMarkerDrag]);
  useEffect(() => {
    clickRef.current = onMarkerClick;
  }, [onMarkerClick]);
  useEffect(() => {
    mapClickRef.current = onMapClick;
  }, [onMapClick]);
  useEffect(() => {
    hoverChangeRef.current = onHoverChange;
  }, [onHoverChange]);
  useEffect(() => {
    deleteRef.current = onMarkerDelete;
  }, [onMarkerDelete]);
  useEffect(() => {
    changeLabelRef.current = onMarkerChangeLabel;
  }, [onMarkerChangeLabel]);

  // ---- Popup state ----
  // One popup div per map, repositioned and recontentated per hover. We use
  // refs (rather than React state) so the popup can update mid-render of the
  // marker effect without triggering React re-renders for every mouseenter.
  const popupRef = useRef<HTMLDivElement | null>(null);
  /** Local hover takes precedence over `passiveHoverKey`. */
  const localHoverKeyRef = useRef<string | null>(null);
  /** Whichever candidate the popup is currently showing. */
  const popupKeyRef = useRef<string | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  // Latest markers (read inside marker hover handlers via ref so they don't
  // need to be re-bound when the markers prop changes).
  const markersRef = useRef<MapMarker[]>(markers);
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  // ---- Popup helpers (defined inline so they close over `map` via the
  // `mapForPopupRef` we update below; markers are read via markersRef). ----
  const mapForPopupRef = useRef<maplibregl.Map | null>(null);
  const cancelHideTimer = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };
  const ensurePopupEl = (): HTMLDivElement | null => {
    if (popupRef.current) return popupRef.current;
    if (!containerRef.current) return null;
    const div = document.createElement('div');
    div.style.cssText = `
      position: absolute;
      transform: translate(-50%, -100%);
      margin-top: -14px;
      background: #ffffff;
      color: #1f2933;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-family: inherit;
      border: 1px solid rgba(0, 0, 0, 0.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
      z-index: 5;
      display: none;
      flex-direction: column;
      align-items: stretch;
      min-width: 140px;
      pointer-events: auto;
      user-select: none;
      white-space: nowrap;
    `;
    div.addEventListener('mouseenter', () => cancelHideTimer());
    div.addEventListener('mouseleave', () => startHideTimer());
    containerRef.current.appendChild(div);
    popupRef.current = div;
    return div;
  };
  const escape = (s: string) =>
    s.replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
    );
  const renderPopup = (key: string, mode: 'interactive' | 'passive') => {
    const data = markersRef.current.find((m) => m.candidateKey === key);
    const mk = markerRefs.current.get(key);
    const m = mapForPopupRef.current;
    if (!data || !mk || !m) return;
    const el = ensurePopupEl();
    if (!el) return;
    // Action buttons (Change Label, Delete) only show in interactive mode
    // for non-shadow markers — shadows don't yet exist in the DB.
    const showActions = mode === 'interactive' && data.kind !== 'shadow';
    // Friendly label for the marker kind. "Proposed" matches how users
    // already refer to shadow markers; "primary"/"secondary" match the
    // identicon convention (only primaries show one).
    const kindLabel =
      data.kind === 'primary'
        ? 'Primary'
        : data.kind === 'secondary'
        ? 'Secondary'
        : 'Proposed';
    el.innerHTML = `
      <div style="font-weight:600">${escape(nameFor(data.identityKey))}</div>
      <div style="font-size:10px;opacity:0.7;text-transform:uppercase;letter-spacing:0.4px;margin-top:2px">
        ${kindLabel}
      </div>
      ${
        showActions
          ? `<button data-action="change-label" style="
                margin-top: 6px;
                background: #5B6977;
                color: #fff;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                cursor: pointer;
                font-size: 11px;
                width: 100%;
              ">Change Label</button>
             <button data-action="delete" style="
                margin-top: 6px;
                background: #d9534f;
                color: #fff;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                cursor: pointer;
                font-size: 11px;
                width: 100%;
              ">Delete</button>`
          : ''
      }
    `;
    if (showActions) {
      const changeBtn = el.querySelector(
        'button[data-action="change-label"]'
      ) as HTMLButtonElement | null;
      if (changeBtn) {
        changeBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          changeLabelRef.current?.(key);
          hidePopup();
        });
      }
      const deleteBtn = el.querySelector('button[data-action="delete"]') as
        | HTMLButtonElement
        | null;
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          deleteRef.current?.(key);
          hidePopup();
        });
      }
    }
    // Position above the marker.
    const screen = m.project(mk.getLngLat());
    el.style.left = `${screen.x}px`;
    el.style.top = `${screen.y - BASE_MARKER_SIZE / 2}px`;
    // Passive popup is a label only — never intercept mouse events.
    el.style.pointerEvents = mode === 'interactive' ? 'auto' : 'none';
    // Flex column so the action buttons stack vertically rather than
    // flowing horizontally as inline-blocks.
    el.style.display = 'flex';
    popupKeyRef.current = key;
  };
  const hidePopup = () => {
    if (popupRef.current) popupRef.current.style.display = 'none';
    popupKeyRef.current = null;
  };
  const startHideTimer = () => {
    cancelHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      // If passive hover key is set and we just lost local hover, switch to
      // passive mode. Otherwise hide.
      if (localHoverKeyRef.current === null && passiveHoverKeyRef.current) {
        renderPopup(passiveHoverKeyRef.current, 'passive');
      } else {
        hidePopup();
      }
    }, 120);
  };

  // Track passiveHoverKey in a ref so the timer above can read its latest
  // value without needing to be re-created.
  const passiveHoverKeyRef = useRef<string | null | undefined>(passiveHoverKey);
  useEffect(() => {
    passiveHoverKeyRef.current = passiveHoverKey;
    // Local hover wins. If there's no local hover, reflect the passive prop.
    if (localHoverKeyRef.current !== null) return;
    if (!passiveHoverKey) {
      hidePopup();
    } else {
      renderPopup(passiveHoverKey, 'passive');
    }
    // We deliberately don't re-create the renderPopup helper on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passiveHoverKey]);

  const scale = useMemo(
    () => getScale(image.width, image.height),
    [image.width, image.height]
  );
  const px2lngLat = useCallback(
    (x: number, y: number): [number, number] => [x * scale, -y * scale],
    [scale]
  );
  const lngLat2px = useCallback(
    (lng: number, lat: number) => ({ x: lng / scale, y: -lat / scale }),
    [scale]
  );

  // Tile loader (same pattern as MapLibreImageViewer).
  // Important: depend on image *primitives* (width/height) rather than the
  // image object reference. Parents recompute the `image` prop on every
  // refetch even when nothing about the image changed; an unstable callback
  // would cascade into the init effect and tear down the map mid-commit.
  const imageWidth = image.width;
  const imageHeight = image.height;
  const updateVisibleTiles = useCallback(
    async (m: maplibregl.Map | null) => {
      if (!m || !sourceKey || cancelledRef.current) return;
      const { maxZ, pyramidSize } = getPyramidInfo({
        width: imageWidth,
        height: imageHeight,
      } as ImageType);
      const mapZoom = m.getZoom();
      const degPerPxAtZoom0 = 360 / 256;
      const currentDegPerPx = degPerPxAtZoom0 / Math.pow(2, mapZoom);
      const targetTilePxPerDeg = 1 / (currentDegPerPx * 0.75);
      const target2z = (targetTilePxPerDeg * pyramidSize * scale) / TILE_SIZE;
      const z = Math.max(0, Math.min(maxZ, Math.round(Math.log2(target2z))));
      const tileCoverage = pyramidSize / Math.pow(2, z);
      const cols = Math.ceil(imageWidth / tileCoverage);
      const rows = Math.ceil(imageHeight / tileCoverage);
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
          const tileBounds = new maplibregl.LngLatBounds(
            [Math.min(c1[0], c2[0]), Math.min(c1[1], c2[1])],
            [Math.max(c1[0], c2[0]), Math.max(c1[1], c2[1])]
          );
          const isVisible =
            bounds.getWest() <= tileBounds.getEast() &&
            bounds.getEast() >= tileBounds.getWest() &&
            bounds.getSouth() <= tileBounds.getNorth() &&
            bounds.getNorth() >= tileBounds.getSouth();
          if (!isVisible) continue;
          // Skip if this tile's area is already painted by higher-res
          // children we've previously loaded — saves the redundant fetch
          // when the user zooms back out.
          if (
            isCoveredByHigherRes(z, row, col, maxZ, loadedTilesRef.current)
          ) {
            continue;
          }
          loadedTilesRef.current.add(sourceId);
          const path = `slippymaps/${sourceKey}/${z}/${row}/${col}.png`;
          getTileBlob(path)
            .then((blob) => {
              if (cancelledRef.current) return;
              const url = URL.createObjectURL(blob);
              blobUrlsRef.current.push(url);
              if (m.getSource(sourceId)) return;
              m.addSource(sourceId, {
                type: 'image',
                url,
                coordinates: [
                  px2lngLat(x0, y0),
                  px2lngLat(x1, y0),
                  px2lngLat(x1, y1),
                  px2lngLat(x0, y1),
                ],
              });
              // Insert in z-order so higher-res tiles always render on top
              // of lower-res. We scan existing tile layers (named
              // `layer-${z}-...`) and insert before the first one with a
              // strictly higher z. If no higher-z tile exists, fall back to
              // the lowest non-tile overlay layer so tile rasters stay
              // below every overlay (homography, leniency, markers).
              let beforeId: string | undefined =
                (m.getLayer(PREVIEW_LAYER_GRID) && PREVIEW_LAYER_GRID) ||
                (m.getLayer(PREVIEW_LAYER_OUTLINE) && PREVIEW_LAYER_OUTLINE) ||
                (m.getLayer(LENIENCY_LAYER) && LENIENCY_LAYER) ||
                undefined;
              const layers = m.getStyle().layers || [];
              for (const layer of layers) {
                if (!layer.id.startsWith('layer-')) continue;
                const layerZ = parseInt(layer.id.split('-')[1], 10);
                if (Number.isFinite(layerZ) && layerZ > z) {
                  beforeId = layer.id;
                  break;
                }
              }
              m.addLayer(
                {
                  id: `layer-${z}-${row}-${col}`,
                  type: 'raster',
                  source: sourceId,
                  paint: { 'raster-fade-duration': 0 },
                },
                beforeId
              );
            })
            .catch(() => {
              loadedTilesRef.current.delete(sourceId);
            });
        }
      }
    },
    [sourceKey, imageWidth, imageHeight, px2lngLat, scale]
  );

  // Initialise map.
  useEffect(() => {
    if (!containerRef.current) return;
    cancelledRef.current = false;
    loadedTilesRef.current = new Set();
    blobUrlsRef.current = [];
    markerRefs.current = new Map();

    const m = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
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
    });
    m.touchZoomRotate.disableRotation();
    m.addControl(
      new maplibregl.NavigationControl({ showCompass: false, showZoom: true }),
      'top-left'
    );
    m.addControl(new RotateControl(), 'top-left');
    m.addControl(new HomographyControl(), 'top-left');

    m.on('load', () => {
      // Homography preview: outline + grid showing where the *other*
      // image's bounds project into THIS image. Layers start hidden — the
      // HomographyControl button toggles their visibility. Source data is
      // recomputed in a dedicated effect below from `previewTransform` +
      // `otherImage`.
      m.addSource(PREVIEW_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      m.addLayer({
        id: PREVIEW_LAYER_GRID,
        type: 'line',
        source: PREVIEW_SOURCE,
        filter: ['==', ['get', 'type'], 'grid'],
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#00e5ff',
          'line-width': 1,
          'line-opacity': 0.4,
        },
      });
      m.addLayer({
        id: PREVIEW_LAYER_OUTLINE,
        type: 'line',
        source: PREVIEW_SOURCE,
        filter: ['==', ['get', 'type'], 'outline'],
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#00e5ff',
          'line-width': 3,
          'line-dasharray': [2, 1],
        },
      });

      // Leniency ring: a translucent circle layer around the active marker.
      // Initial radius is 0 — the dedicated effect below recomputes it on
      // every zoom and on every leniency/anchor change.
      m.addSource(LENIENCY_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      m.addLayer({
        id: LENIENCY_LAYER,
        type: 'circle',
        source: LENIENCY_SOURCE,
        paint: {
          'circle-radius': 0,
          'circle-color': '#ff8c1a',
          'circle-opacity': 0.06,
          'circle-stroke-color': '#ff8c1a',
          'circle-stroke-width': 1.5,
          'circle-stroke-opacity': 0.7,
        },
      });

      m.fitBounds(
        [px2lngLat(0, image.height), px2lngLat(image.width, 0)],
        { padding: 20, animate: false }
      );
      updateVisibleTiles(m);
      mapForPopupRef.current = m;
      setMap(m);
    });

    const onMoveEnd = () => updateVisibleTiles(m);
    m.on('moveend', onMoveEnd);

    // Reposition the popup as the map pans/zooms so it stays glued to its
    // marker.
    const onMove = () => {
      const key = popupKeyRef.current;
      if (!key || !popupRef.current) return;
      const mk = markerRefs.current.get(key);
      if (!mk) return;
      const screen = m.project(mk.getLngLat());
      popupRef.current.style.left = `${screen.x}px`;
      popupRef.current.style.top = `${screen.y - BASE_MARKER_SIZE / 2}px`;
    };
    m.on('move', onMove);

    // Background click — fires only when the click missed every Marker
    // element (since maplibregl.Marker DOM nodes don't bubble to the canvas).
    // Click on the map (not on a marker — those are sibling DOM nodes that
    // don't bubble to the canvas). Convert to image-space and clamp to bounds
    // before firing onMapClick.
    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      const { x, y } = lngLat2px(e.lngLat.lng, e.lngLat.lat);
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
      mapClickRef.current?.(x, y);
    };
    m.on('click', handleMapClick);

    return () => {
      cancelledRef.current = true;
      for (const mk of markerRefs.current.values()) mk.remove();
      markerRefs.current.clear();
      // Tear down popup state too.
      cancelHideTimer();
      if (popupRef.current?.parentNode) {
        popupRef.current.parentNode.removeChild(popupRef.current);
      }
      popupRef.current = null;
      popupKeyRef.current = null;
      localHoverKeyRef.current = null;
      mapForPopupRef.current = null;
      m.remove();
      setMap(null);
      blobUrlsRef.current.forEach(URL.revokeObjectURL);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image.id, sourceKey, px2lngLat, updateVisibleTiles, image.width, image.height]);

  // Notify parent of map instance / converters.
  useEffect(() => {
    onMapInstance?.(map, px2lngLat, lngLat2px);
  }, [map, px2lngLat, lngLat2px, onMapInstance]);

  // ---- Homography preview ----
  // Compute the GeoJSON for the outline + grid that traces the OTHER
  // image's bounds projected onto this image via `previewTransform`. The
  // HomographyControl button toggles layer visibility; this effect just
  // keeps the data fresh. We sample 30 points along each grid line so the
  // curve is smooth even when the homography is non-affine.
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    const apply = () => {
      if (cancelled) return;
      try {
        const src = map.getSource(PREVIEW_SOURCE) as
          | maplibregl.GeoJSONSource
          | undefined;
        if (!src) return;
        if (!previewTransform || !otherImage) {
          src.setData({ type: 'FeatureCollection', features: [] });
          return;
        }
        const w = otherImage.width;
        const h = otherImage.height;
        const GRID_DIVISIONS = 8;
        const GRID_SAMPLES = 30;
        const features: any[] = [];
        // Outline (closed polygon).
        const corners: [number, number][] = [
          [0, 0],
          [w, 0],
          [w, h],
          [0, h],
          [0, 0],
        ];
        features.push({
          type: 'Feature',
          properties: { type: 'outline' },
          geometry: {
            type: 'LineString',
            coordinates: corners.map((c) =>
              px2lngLat(...previewTransform(c))
            ),
          },
        });
        // Grid lines, sampled densely for smoothness.
        for (let i = 0; i <= GRID_DIVISIONS; i++) {
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
        src.setData({ type: 'FeatureCollection', features });
      } catch {
        /* map removed; ignore */
      }
    };
    apply();
    return () => {
      cancelled = true;
    };
  }, [map, previewTransform, otherImage, px2lngLat]);

  // ---- Leniency ring ----
  // Update the ring's GeoJSON whenever the anchor changes, and recompute the
  // pixel radius whenever the leniency or zoom changes. The ring auto-hides
  // when there is no anchor (empty FeatureCollection).
  //
  // The try/catch guards against a removed map briefly being held in state
  // (state updates are async, so cleanup may have already torn down the
  // map's `style` before this effect re-runs). Without it, calls into
  // maplibre throw `Cannot read properties of undefined (reading ...)`.
  useEffect(() => {
    if (!map) return;
    try {
      const src = map.getSource(LENIENCY_SOURCE) as
        | maplibregl.GeoJSONSource
        | undefined;
      if (!src) return;
      if (!leniencyAnchor) {
        src.setData({ type: 'FeatureCollection', features: [] });
        return;
      }
      src.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: px2lngLat(leniencyAnchor.x, leniencyAnchor.y),
            },
          },
        ],
      });
    } catch {
      // Map was removed mid-commit — the next render with map=null will
      // skip the effect entirely.
    }
  }, [map, leniencyAnchor, px2lngLat]);

  useEffect(() => {
    if (!map) return;
    let detachZoom: (() => void) | null = null;
    try {
      if (!map.getLayer(LENIENCY_LAYER)) return;
      // 1 image-pixel → screen-pixels at zoom z is `scale * 256/360 * 2^z`.
      // Multiply by leniency to get the screen-radius of the ring at any
      // zoom. We update `circle-radius` on every zoom event (rather than
      // express it via maplibre's interpolate) so changing `leniency` at
      // runtime takes effect immediately without re-creating the layer.
      const recompute = () => {
        try {
          const r =
            (leniency ?? 0) *
            scale *
            (256 / 360) *
            Math.pow(2, map.getZoom());
          map.setPaintProperty(LENIENCY_LAYER, 'circle-radius', r);
        } catch {
          /* map removed; ignore */
        }
      };
      recompute();
      map.on('zoom', recompute);
      detachZoom = () => map.off('zoom', recompute);
    } catch {
      /* map removed; ignore */
    }
    return () => {
      try {
        detachZoom?.();
      } catch {
        /* map removed; ignore */
      }
    };
  }, [map, leniency, scale]);

  // Sync markers prop → maplibregl.Marker instances.
  useEffect(() => {
    if (!map) return;
    const seen = new Set<string>();
    for (const data of markers) {
      seen.add(data.candidateKey);
      let mk = markerRefs.current.get(data.candidateKey);
      if (!mk) {
        const el = document.createElement('div');
        applyMarkerStyle(el, data);
        // Click → activate. We deliberately do NOT call stopPropagation on
        // mousedown — maplibregl needs to see the pointer-down to decide
        // whether the gesture is a drag. (The mousedown wouldn't bubble to
        // the canvas anyway since the marker DOM is a sibling.)
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          clickRef.current(data.candidateKey);
        });
        // Hover → show interactive popup with name + (optional) Delete.
        el.addEventListener('mouseenter', () => {
          cancelHideTimer();
          if (localHoverKeyRef.current === data.candidateKey) return;
          localHoverKeyRef.current = data.candidateKey;
          hoverChangeRef.current?.(data.candidateKey);
          renderPopup(data.candidateKey, 'interactive');
        });
        // Mouseleave starts a short hide timer. The popup itself has
        // mouseenter/leave handlers (set in ensurePopupEl) that cancel and
        // restart the same timer, so the user can move the cursor onto the
        // popup to click Delete.
        el.addEventListener('mouseleave', () => {
          if (localHoverKeyRef.current === data.candidateKey) {
            localHoverKeyRef.current = null;
            hoverChangeRef.current?.(null);
          }
          startHideTimer();
        });
        mk = new maplibregl.Marker({
          element: el,
          draggable: true,
          // Anchor the centre of `el` on the lng/lat — maplibregl computes
          // and sets the `transform` accordingly. Don't overwrite it.
          anchor: 'center',
        });
        mk.setLngLat(px2lngLat(data.x, data.y));
        mk.addTo(map);
        mk.on('dragend', () => {
          const ll = mk!.getLngLat();
          const px = lngLat2px(ll.lng, ll.lat);
          // Annotation x/y are integers in the schema. Round at the drag
          // boundary so working-state, accept payloads and subsequent
          // renders never carry fractional pixels.
          dragRef.current(
            data.candidateKey,
            Math.round(px.x),
            Math.round(px.y)
          );
        });
        markerRefs.current.set(data.candidateKey, mk);
      } else {
        mk.setLngLat(px2lngLat(data.x, data.y));
        applyMarkerStyle(mk.getElement() as HTMLDivElement, data);
      }
    }
    // Remove markers that no longer exist.
    for (const [key, mk] of markerRefs.current) {
      if (!seen.has(key)) {
        mk.remove();
        markerRefs.current.delete(key);
      }
    }
  }, [map, markers, px2lngLat, lngLat2px]);

  // Image filename pill — top-centered, click-to-copy. Mirrors the pattern
  // in MapLibreImageViewer so the two map experiences feel the same.
  const imageName = (image as any).originalPath ?? image.id;
  const [copied, setCopied] = useState(false);
  const handleCopyName = useCallback(() => {
    navigator.clipboard.writeText(imageName);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [imageName]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 8,
          overflow: 'hidden',
          // Match the colour of the empty (un-tiled) image regions so the
          // background and unloaded tiles blend rather than producing dark
          // letterboxes around the photo.
          background: '#ffffff',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          width: 200,
        }}
        className='maplibregl-ctrl maplibregl-ctrl-group'
      >
        <button
          className='maplibregl-ctrl-icon'
          title={copied ? 'Copied!' : `Click to copy: ${imageName}`}
          onClick={handleCopyName}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '0 8px',
            fontSize: '0.75rem',
            color: copied ? '#2e7d32' : '#333',
            width: '100%',
            cursor: 'pointer',
            height: 29,
            transition: 'color 0.2s',
          }}
        >
          {copied ? (
            <Check size={12} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          ) : (
            <Copy size={12} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          )}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {copied ? 'Copied!' : imageName}
          </span>
        </button>
      </div>
    </div>
  );
}
