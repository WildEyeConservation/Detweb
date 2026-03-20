import {
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Badge, Button, Modal } from 'react-bootstrap';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { GlobalContext, UserContext } from './Context';
import { getTileBlob } from './StorageLayer';
import type { Schema } from './amplify/client-schema';

// ── Constants ──

const TILE_SIZE = 256;
const SOURCE_MARKER = 'qc-marker';
const LAYER_MARKER_CIRCLE = 'qc-marker-circle';
const LAYER_MARKER_LABEL = 'qc-marker-label';

type CategoryOption = {
  id: string;
  name: string;
  shortcutKey: string | null;
};

type AnnotationData = {
  id: string;
  annotationSetId: string;
  imageId: string;
  categoryId: string;
  x: number;
  y: number;
};

type QCReviewProps = {
  // From SQS message body (spread by Preloader)
  annotation: AnnotationData;
  queueId: string;
  message_id: string;
  ack?: () => Promise<void>;
  next?: () => void;
  prev?: () => void;
  visible: boolean;
  // Passed through by Preloader from QCReviewTask
  categories: CategoryOption[];
};

export default function QCAnnotationReview({
  annotation,
  queueId,
  ack,
  next,
  prev,
  visible,
  categories,
}: QCReviewProps) {
  const { client } = useContext(GlobalContext)!;
  const { user } = useContext(UserContext)!;
  const navigate = useNavigate();

  // ── Image data ──
  const [image, setImage] = useState<Schema['Image']['type'] | null>(null);
  const [sourceKey, setSourceKey] = useState<string | undefined>(undefined);

  // ── MapLibre state ──
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const loadedTilesRef = useRef<Set<string>>(new Set());
  const blobUrlsRef = useRef<string[]>([]);
  const cancelledRef = useRef(false);

  // ── UI state ──
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [, setHideMarker] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Legend sidebar ──
  const [legendOpen, setLegendOpen] = useState(false);

  // ── Waiting state for empty queue ──
  const [waiting, setWaiting] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const waitingTimerRef = useRef<number | undefined>(undefined);
  const countdownRef = useRef<number | undefined>(undefined);

  // When next becomes available while waiting, cancel the timer.
  useEffect(() => {
    if (next && waiting) {
      if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      waitingTimerRef.current = undefined;
      countdownRef.current = undefined;
      setWaiting(false);
      setSecondsRemaining(60);
    }
  }, [next, waiting]);

  useEffect(() => {
    return () => {
      if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const currentCategory = categories.find(
    (c) => c.id === annotation.categoryId
  );

  // ── Fetch image + sourceKey ──
  useEffect(() => {
    if (!annotation.imageId) return;
    let mounted = true;

    client.models.Image.get(
      { id: annotation.imageId },
      { selectionSet: ['id', 'width', 'height'] as const }
    ).then(({ data }) => {
      if (!mounted || !data) return;
      setImage(data as any);
    });

    client.models.ImageFile.imagesByimageId({ imageId: annotation.imageId }).then(
      ({ data }) => {
        if (!mounted) return;
        const jpeg = data?.find(
          (f: any) => f.type === 'image/jpeg'
        );
        if (jpeg) setSourceKey((jpeg as any).key);
      }
    );

    return () => {
      mounted = false;
    };
  }, [annotation.imageId, client]);

  // ── MapLibre coordinate helpers ──
  const scale = useMemo(
    () =>
      image ? 0.1 / Math.max(image.width, image.height) : undefined,
    [image]
  );

  const px2lngLat = useCallback(
    (x: number, y: number): [number, number] =>
      scale ? [x * scale, -y * scale] : [0, 0],
    [scale]
  );

  // ── Tile loading ──
  const updateVisibleTiles = useCallback(
    async (m: maplibregl.Map | null) => {
      if (!m || !sourceKey || !image || cancelledRef.current || !scale) return;

      const maxDim = Math.max(image.width, image.height);
      const maxZ = Math.ceil(Math.log2(maxDim / TILE_SIZE));
      const pyramidSize = TILE_SIZE * Math.pow(2, maxZ);

      const mapZoom = m.getZoom();
      const degPerPxAtZoom0 = 360 / 256;
      const currentDegPerPx = degPerPxAtZoom0 / Math.pow(2, mapZoom);
      const targetTilePxPerDeg = 1 / (currentDegPerPx * 0.75);
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
          const tileBounds = new maplibregl.LngLatBounds(
            [Math.min(c1[0], c2[0]), Math.min(c1[1], c2[1])],
            [Math.max(c1[0], c2[0]), Math.max(c1[1], c2[1])]
          );

          const isVisible =
            bounds &&
            bounds.getWest() <= tileBounds.getEast() &&
            bounds.getEast() >= tileBounds.getWest() &&
            bounds.getSouth() <= tileBounds.getNorth() &&
            bounds.getNorth() >= tileBounds.getSouth();

          if (isVisible) {
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

                let beforeId: string = LAYER_MARKER_CIRCLE;
                const layers = m.getStyle().layers || [];
                for (const layer of layers) {
                  if (layer.id.startsWith('layer-')) {
                    const layerZ = parseInt(layer.id.split('-')[1], 10);
                    if (layerZ > z) {
                      beforeId = layer.id;
                      break;
                    }
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
      }
    },
    [sourceKey, image, px2lngLat, scale]
  );

  // ── Initialize map ──
  useEffect(() => {
    if (!containerRef.current || !image || !sourceKey || !scale) return;
    cancelledRef.current = false;
    loadedTilesRef.current = new Set();
    blobUrlsRef.current = [];

    const m = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {},
        layers: [],
      },
      center: px2lngLat(annotation.x, annotation.y),
      zoom: 3,
      minZoom: -20,
      maxZoom: 22,
      renderWorldCopies: false,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchZoomRotate: true,
    });

    m.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
        showZoom: true,
        visualizePitch: false,
      }),
      'top-left'
    );

    m.touchZoomRotate.disableRotation();

    m.on('load', () => {
      // Annotation marker source + layers
      m.addSource(SOURCE_MARKER, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {
                label: currentCategory?.name ?? 'Unknown',
              },
              geometry: {
                type: 'Point',
                coordinates: px2lngLat(annotation.x, annotation.y),
              },
            },
          ],
        },
      });

      m.addLayer({
        id: LAYER_MARKER_CIRCLE,
        type: 'circle',
        source: SOURCE_MARKER,
        paint: {
          'circle-radius': 10,
          'circle-color': '#e6194b',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        },
      });

      m.addLayer({
        id: LAYER_MARKER_LABEL,
        type: 'symbol',
        source: SOURCE_MARKER,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 14,
          'text-offset': [0, -1.8],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-font': ['Open Sans Regular'],
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 2,
        },
      });

      // Compute the zoom level that fits the whole image, then start 5 levels closer.
      const imageBounds = new maplibregl.LngLatBounds(
        px2lngLat(0, image.height),
        px2lngLat(image.width, 0)
      );
      // Temporarily fit to get the base zoom, then override.
      m.fitBounds(imageBounds, { padding: 20, animate: false });
      const baseZoom = m.getZoom();
      const targetZoom = baseZoom + 5;

      m.jumpTo({
        center: px2lngLat(annotation.x, annotation.y),
        zoom: targetZoom,
      });

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
  }, [image?.id, sourceKey, scale]);

  // ── Toggle marker visibility on Tab hold ──
  useEffect(() => {
    if (!map || !visible) return;

    const setVisibility = (vis: 'visible' | 'none') => {
      if (map.getLayer(LAYER_MARKER_CIRCLE))
        map.setLayoutProperty(LAYER_MARKER_CIRCLE, 'visibility', vis);
      if (map.getLayer(LAYER_MARKER_LABEL))
        map.setLayoutProperty(LAYER_MARKER_LABEL, 'visibility', vis);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setHideMarker(true);
        setVisibility('none');
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setHideMarker(false);
        setVisibility('visible');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [map, visible]);

  // ── Save helpers ──

  const incrementObservedCount = useCallback(async () => {
    if (!queueId) return;
    try {
      await client.mutations.incrementQueueCount({ id: queueId });
    } catch (err) {
      console.error('Failed to increment observedCount', err);
    }
  }, [client, queueId]);

  const handleApprove = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await Promise.all([
        client.models.Annotation.update({
          id: annotation.id,
          ogCategoryId: annotation.categoryId,
          reviewedBy: user.userId,
        } as any),
        incrementObservedCount(),
      ]);
      await ack?.();
      if (next) {
        next();
      } else {
        startWaiting();
      }
    } catch (err) {
      console.error('Failed to approve annotation', err);
    } finally {
      setSaving(false);
    }
  }, [annotation, client, ack, next, saving, user.userId, incrementObservedCount]);

  const handleRelabel = useCallback(
    async (newCategoryId: string) => {
      if (saving) return;
      setSaving(true);
      setShowDenyModal(false);
      try {
        await Promise.all([
          client.models.Annotation.update({
            id: annotation.id,
            ogCategoryId: annotation.categoryId, // Store the ORIGINAL (wrong) category
            categoryId: newCategoryId, // Update to the CORRECT category
            reviewedBy: user.userId,
          } as any),
          incrementObservedCount(),
        ]);
        await ack?.();
        if (next) {
          next();
        } else {
          startWaiting();
        }
      } catch (err) {
        console.error('Failed to relabel annotation', err);
      } finally {
        setSaving(false);
      }
    },
    [annotation, client, ack, next, saving, user.userId, incrementObservedCount]
  );

  const startWaiting = useCallback(() => {
    if (waiting || waitingTimerRef.current) return;
    setWaiting(true);
    setSecondsRemaining(60);
    countdownRef.current = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    waitingTimerRef.current = window.setTimeout(() => {
      setWaiting(false);
      waitingTimerRef.current = undefined;
      if (countdownRef.current) clearInterval(countdownRef.current);
      alert(
        'No new work was loaded. The job appears to be complete. Thank you for your contribution!'
      );
      navigate('/surveys');
    }, 60000);
  }, [waiting, navigate]);

  // Determine which default keys are available (not claimed by a category shortcut).
  const approveKeyAvailable = !categories.some(
    (c) => c.shortcutKey?.toLowerCase() === 'a'
  );
  const denyKeyAvailable = !categories.some(
    (c) => c.shortcutKey?.toLowerCase() === 'd'
  );

  // ── Hotkey handling ──
  useEffect(() => {
    if (!visible || showDenyModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (saving) return;
      // Don't handle if inside an input.
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const key = e.key;

      // Arrow keys for navigation — always active.
      if (key === 'ArrowLeft') {
        e.preventDefault();
        prev?.();
        return;
      }
      if (key === 'ArrowRight') {
        e.preventDefault();
        next?.();
        return;
      }

      const lowerKey = key.toLowerCase();

      // Check if key matches a category shortcutKey.
      const matchingCategory = categories.find(
        (c) => c.shortcutKey?.toLowerCase() === lowerKey
      );
      if (matchingCategory) {
        e.preventDefault();
        if (matchingCategory.id === annotation.categoryId) {
          handleApprove(); // Confirmed correct
        } else {
          handleRelabel(matchingCategory.id); // Immediately relabel
        }
        return;
      }

      // Default approve keys (each only if not claimed by a category shortcut).
      if (
        (lowerKey === 'a' && approveKeyAvailable) ||
        (lowerKey === ' ' && !categories.some((c) => c.shortcutKey === ' '))
      ) {
        e.preventDefault();
        handleApprove();
        return;
      }

      // Deny key (only if not claimed by a category shortcut).
      if (lowerKey === 'd' && denyKeyAvailable) {
        e.preventDefault();
        setShowDenyModal(true);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    visible,
    showDenyModal,
    saving,
    categories,
    annotation.categoryId,
    handleApprove,
    handleRelabel,
    approveKeyAvailable,
    denyKeyAvailable,
    prev,
    next,
  ]);

  // ── Deny modal hotkeys ──
  useEffect(() => {
    if (!showDenyModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDenyModal(false);
        return;
      }

      const key = e.key.toLowerCase();
      const matchingCategory = categories.find(
        (c) => c.shortcutKey?.toLowerCase() === key
      );
      if (matchingCategory) {
        e.preventDefault();
        if (matchingCategory.id === annotation.categoryId) {
          // Same category = approve (shouldn't normally happen from deny modal, but handle it)
          setShowDenyModal(false);
          handleApprove();
        } else {
          handleRelabel(matchingCategory.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDenyModal, categories, annotation.categoryId, handleApprove, handleRelabel]);

  // ── Render ──

  if (!image || !sourceKey) {
    return (
      <div className='d-flex justify-content-center align-items-center w-100 h-100'>
        <div className='text-muted'>Loading image...</div>
      </div>
    );
  }

  return (
    <div className='d-flex flex-column w-100 h-100'>
      {/* Header bar */}
      <div
        className='d-flex align-items-center justify-content-between py-2'
        style={{
          backgroundColor: '#2b3e50',
          flexShrink: 0,
        }}
      >
        <div className='d-flex align-items-center gap-3'>
          <Badge bg='danger'>
            {currentCategory?.name ?? 'Unknown'}
          </Badge>
          <span className='text-muted' style={{ fontSize: '12px' }}>
            Tip: Hold Tab to hide the marker
          </span>
        </div>
        <Button
          variant='outline-warning'
          style={{ width: 120 }}
          onClick={() => navigate('/jobs')}
          disabled={saving}
        >
          Save &amp; Exit
        </Button>
      </div>

      {/* Map container */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            background: '#fff',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        />
        {waiting && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1000,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              borderRadius: '12px',
              padding: '20px 32px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid rgba(255, 255, 255, 0.2)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ color: '#fff', fontSize: '14px', textAlign: 'center' }}>
              Waiting for new work... ({secondsRemaining}s remaining)
            </div>
          </div>
        )}

        {/* Collapsible legend sidebar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            height: '100%',
            display: 'flex',
            zIndex: 900,
            pointerEvents: 'none',
          }}
        >
          {/* Toggle tab */}
          <button
            onClick={() => setLegendOpen((o) => !o)}
            style={{
              alignSelf: 'center',
              pointerEvents: 'auto',
              width: '28px',
              height: '64px',
              border: 'none',
              borderRadius: '6px 0 0 6px',
              backgroundColor: 'rgba(43, 62, 80, 0.85)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
            title={legendOpen ? 'Hide legend' : 'Show legend'}
          >
            {legendOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>

          {/* Panel */}
          <div
            style={{
              pointerEvents: 'auto',
              width: legendOpen ? '220px' : '0px',
              overflow: 'hidden',
              transition: 'width 0.2s ease',
              backgroundColor: 'rgba(43, 62, 80, 0.92)',
              height: '100%',
            }}
          >
            <div style={{ width: '220px', padding: '12px' }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#adb5bd',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '10px',
                }}
              >
                Labels
              </div>
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    marginBottom: '4px',
                    backgroundColor:
                      cat.id === annotation.categoryId
                        ? 'rgba(231, 76, 60, 0.3)'
                        : 'transparent',
                    color: '#fff',
                    fontSize: '13px',
                  }}
                >
                  <span>{cat.name}</span>
                  {cat.shortcutKey && (
                    <kbd
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                      }}
                    >
                      {cat.shortcutKey.toUpperCase()}
                    </kbd>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div
        className='d-flex align-items-center justify-content-between py-2'
        style={{
          backgroundColor: '#2b3e50',
          flexShrink: 0,
        }}
      >
        <div className='d-flex align-items-center gap-2'>
          <Button
            className='d-flex align-items-center justify-content-center'
            variant='primary'
            style={{ width: 120 }}
            onClick={prev}
            disabled={saving || !prev}
          >
            <ChevronLeft />
            <span>Previous</span>
          </Button>
        </div>
        <div className='d-flex align-items-center gap-2'>
          <Button
            variant='success'
            style={{ width: 120 }}
            onClick={handleApprove}
            disabled={saving}
          >
            {approveKeyAvailable ? 'Approve (A)' : 'Approve'}
          </Button>
          <Button
            variant='danger'
            style={{ width: 120 }}
            onClick={() => setShowDenyModal(true)}
            disabled={saving}
          >
            {denyKeyAvailable ? 'Deny (D)' : 'Deny'}
          </Button>
        </div>
        <div className='d-flex align-items-center gap-2'>
          <Button
            className='d-flex align-items-center justify-content-center'
            variant='primary'
            style={{ width: 120 }}
            onClick={next}
            disabled={saving || !next}
          >
            <span>Next</span>
            <ChevronRight />
          </Button>
        </div>
      </div>

      {/* Deny modal — pick the correct category */}
      <Modal show={showDenyModal} onHide={() => setShowDenyModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Select Correct Label</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p style={{ fontSize: '14px' }} className='text-muted mb-3'>
            Current label: <strong>{currentCategory?.name}</strong>. Select the
            correct label or press its shortcut key.
          </p>
          <div className='d-flex flex-wrap gap-2'>
            {categories
              .filter((c) => c.id !== annotation.categoryId)
              .map((cat) => (
                <Button
                  key={cat.id}
                  variant='outline-primary'
                  size='sm'
                  onClick={() => handleRelabel(cat.id)}
                  disabled={saving}
                >
                  {cat.name}
                  {cat.shortcutKey && (
                    <span className='ms-1 text-muted'>
                      ({cat.shortcutKey.toUpperCase()})
                    </span>
                  )}
                </Button>
              ))}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant='secondary' onClick={() => setShowDenyModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
