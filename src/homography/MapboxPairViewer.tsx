import { useState, useCallback, useMemo, useRef, useContext, useEffect } from 'react';
import type { ImageType } from '../schemaTypes';
import type { Point } from './ManualHomographyEditor';
import { MapboxImageViewer, POINT_COLORS } from '../mapbox-viewer/MapboxImageViewer';
import { GlobalContext } from '../Context';

type Props = {
  images: [ImageType, ImageType];
  points: [Point[], Point[]];
  setPoints: [
    (updater: Point[] | ((prev: Point[]) => Point[])) => void,
    (updater: Point[] | ((prev: Point[]) => Point[])) => void,
  ];
  previewTransforms: [
    (c: [number, number]) => [number, number],
    (c: [number, number]) => [number, number],
  ] | null;
  onAction: () => void;
};

type ContextMenuState = {
  imageIndex: number;
  pointIndex: number;
  screenPos: { x: number; y: number };
} | null;

function PointContextMenu({
  menu,
  points,
  onClose,
  onRemove,
  onSwap,
}: {
  menu: NonNullable<ContextMenuState>;
  points: Point[];
  onClose: () => void;
  onRemove: (imageIndex: number, pointIndex: number) => void;
  onSwap: (imageIndex: number, fromIndex: number, toIndex: number) => void;
}) {
  const { pointIndex, imageIndex, screenPos } = menu;

  // Close on outside click or Esc key
  useEffect(() => {
    const handleEvents = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof MouseEvent || (e instanceof KeyboardEvent && e.key === 'Escape')) {
        onClose();
      }
    };
    window.addEventListener('click', handleEvents);
    window.addEventListener('keydown', handleEvents);
    return () => {
      window.removeEventListener('click', handleEvents);
      window.removeEventListener('keydown', handleEvents);
    };
  }, [onClose]);

  const swapTargets = points
    .map((_, i) => i)
    .filter((i) => i !== pointIndex);

  return (
    <div
      style={{
        position: 'fixed',
        left: screenPos.x,
        top: screenPos.y,
        zIndex: 9999,
        background: '#2a2a3e',
        border: '1px solid #444',
        borderRadius: 6,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        minWidth: 160,
        padding: '4px 0',
        fontSize: '0.85rem',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          padding: '4px 12px',
          color: '#aaa',
          fontSize: '0.75rem',
          borderBottom: '1px solid #444',
        }}
      >
        Point {pointIndex + 1}
      </div>
      <button
        className='btn btn-sm btn-link text-danger w-100 text-start'
        style={{ padding: '6px 12px', textDecoration: 'none' }}
        onClick={() => {
          onRemove(imageIndex, pointIndex);
          onClose();
        }}
      >
        Remove point
      </button>
      {swapTargets.length > 0 && (
        <>
          <div
            style={{
              padding: '4px 12px',
              color: '#aaa',
              fontSize: '0.75rem',
              borderTop: '1px solid #444',
            }}
          >
            Swap with...
          </div>
          {swapTargets.map((targetIdx) => (
            <button
              key={targetIdx}
              className='btn btn-sm btn-link text-light w-100 text-start'
              style={{ padding: '4px 12px', textDecoration: 'none' }}
              onClick={() => {
                onSwap(imageIndex, pointIndex, targetIdx);
                onClose();
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: POINT_COLORS[targetIdx % POINT_COLORS.length],
                  marginRight: 8,
                }}
              />
              Point {targetIdx + 1}
            </button>
          ))}
        </>
      )}
    </div>
  );
}

export function MapboxPairViewer({
  images,
  points,
  setPoints,
  previewTransforms,
  onAction,
}: Props) {
  const { client } = useContext(GlobalContext)!;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [sourceKeys, setSourceKeys] = useState<[string | undefined, string | undefined]>([
    undefined,
    undefined,
  ]);

  const mapsRef = useRef<([mapboxgl.Map, (x: number, y: number) => [number, number], (lng: number, lat: number) => { x: number; y: number }] | null)[]>([null, null]);

  // Fetch source keys for each image
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      images.map(async (img) => {
        const resp = await client.models.ImageFile.imagesByimageId({
          imageId: img.id,
        });
        const jpgFile = resp.data.find(
          (f: any) => f.type === 'image/jpeg'
        );
        return jpgFile?.key as string | undefined;
      })
    ).then((keys) => {
      if (!cancelled) {
        setSourceKeys(keys as [string | undefined, string | undefined]);
      }
    });
    return () => { cancelled = true; };
  }, [images[0].id, images[1].id, client]);

  // Map Synchronization
  useEffect(() => {
    if (!previewTransforms) return;

    let isSyncing = false;

    const syncHandler = (sourceIdx: number) => {
      if (isSyncing) return;
      const targetIdx = 1 - sourceIdx;
      const source = mapsRef.current[sourceIdx];
      const target = mapsRef.current[targetIdx];
      if (!source || !target || !previewTransforms) return;

      const [sMap, , sLngLat2px] = source;
      const [tMap, tPx2lngLat, tLngLat2px] = target;

      const centerLngLat = sMap.getCenter();
      const sPx = sLngLat2px(centerLngLat.lng, centerLngLat.lat);
      const tPx = previewTransforms[sourceIdx]([sPx.x, sPx.y]);

      const tLngLat = tPx2lngLat(tPx[0], tPx[1]);

      // Check distance to avoid unnecessary updates/jitters
      const currentTLngLat = tMap.getCenter();
      const currentTPx = tLngLat2px(currentTLngLat.lng, currentTLngLat.lat);
      const dist = Math.sqrt(Math.pow(currentTPx.x - tPx[0], 2) + Math.pow(currentTPx.y - tPx[1], 2));

      if (dist > 0.5 || Math.abs(sMap.getZoom() - tMap.getZoom()) > 0.001) {
        isSyncing = true;
        tMap.jumpTo({
          center: tLngLat,
          zoom: sMap.getZoom(),
        });
        isSyncing = false;
      }
    };

    const listeners = [0, 1].map((i) => {
      const m = mapsRef.current[i];
      if (!m) return null;
      const handler = () => syncHandler(i);
      m[0].on('move', handler);
      return { map: m[0], handler };
    });

    return () => {
      listeners.forEach((l) => l?.map.off('move', l.handler));
    };
  }, [previewTransforms]);

  const handleRemove = useCallback(
    (imageIndex: number, pointIndex: number) => {
      onAction();
      setPoints[imageIndex]((prev) => prev.filter((_, i) => i !== pointIndex));
    },
    [setPoints, onAction]
  );

  const handleSwap = useCallback(
    (imageIndex: number, fromIndex: number, toIndex: number) => {
      onAction();
      setPoints[imageIndex]((prev) => {
        const next = [...prev];
        [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
        return next;
      });
    },
    [setPoints, onAction]
  );

  const containerRefs = [useCallback((el: HTMLDivElement | null) => {
    containerEls.current[0] = el;
  }, []), useCallback((el: HTMLDivElement | null) => {
    containerEls.current[1] = el;
  }, [])];
  const containerEls = useRef<(HTMLDivElement | null)[]>([null, null]);

  const contextMenuHandlers = useMemo(() => [0, 1].map((imageIndex) =>
    (pointIndex: number, screenPos: { x: number; y: number }) => {
      const rect = containerEls.current[imageIndex]?.getBoundingClientRect();
      setContextMenu({
        imageIndex,
        pointIndex,
        screenPos: {
          x: (rect?.left ?? 0) + screenPos.x,
          y: (rect?.top ?? 0) + screenPos.y,
        },
      });
    }
  ), []);

  return (
    <div className='w-100 h-100 d-flex flex-row gap-3' style={{ position: 'relative' }}>
      {images.map((image, i) => (
        <div
          className='w-50'
          key={image.id}
          ref={containerRefs[i]}
          style={{ position: 'relative', height: '100%', minHeight: 400 }}
        >
          <MapboxImageViewer
            image={image}
            sourceKey={sourceKeys[i]}
            points={points[i]}
            setPoints={setPoints[i]}
            onAction={onAction}
            highlightedIndex={hoveredIndex}
            onHoverPoint={setHoveredIndex}
            onContextMenu={contextMenuHandlers[i]}
            previewTransform={previewTransforms?.[1 - i]}
            otherImage={images[1 - i]}
            onMapInstance={(m, px2l, l2px) => {
              if (m) {
                mapsRef.current[i] = [m, px2l, l2px];
              } else {
                mapsRef.current[i] = null;
              }
            }}
          />
        </div>
      ))}

      {contextMenu && (
        <PointContextMenu
          menu={contextMenu}
          points={points[contextMenu.imageIndex]}
          onClose={() => setContextMenu(null)}
          onRemove={handleRemove}
          onSwap={handleSwap}
        />
      )}
    </div>
  );
}
