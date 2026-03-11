import { useCallback, useContext } from 'react';
import { Marker, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { ImageContext } from './Context';
import { POINT_COLORS } from './maplibre-viewer/MapLibreImageViewer';
import type { Point } from './homography/ManualHomographyEditor';

const MIN_POINT_DISTANCE = 20; // Minimum pixel distance between points

function useClickToAddPoint(
  onAdd: (xy: { x: number; y: number }) => void,
  existingPoints: Point[]
) {
  const { latLng2xy } = useContext(ImageContext)!;
  useMapEvents({
    click: (e) => {
      const p = latLng2xy(e.latlng) as L.Point;

      // Check if click is too close to an existing point
      const isTooClose = existingPoints.some((existing) => {
        const dx = existing.x - p.x;
        const dy = existing.y - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < MIN_POINT_DISTANCE;
      });

      if (isTooClose) {
        return; // Don't add point if too close to existing one
      }

      onAdd({ x: p.x, y: p.y });
    },
    dblclick: (e) => {
      // Prevent double-click zoom from also adding points
      L.DomEvent.stopPropagation(e);
    },
  });
  return null;
}

function createDotIcon(index: number) {
  const color = POINT_COLORS[index % POINT_COLORS.length];
  return L.divIcon({
    className: 'manual-homography-point',
    html: `<div style="width:14px;height:14px;border-radius:7px;background:${color};border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;box-shadow:0 0 2px rgba(0,0,0,0.6)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export function PointsOverlay({
  points,
  setPoints,
  onAction,
}: {
  points: Point[];
  setPoints: (pts: Point[] | ((prev: Point[]) => Point[])) => void;
  onAction?: () => void;
}) {
  const { xy2latLng, latLng2xy } = useContext(ImageContext)!;

  const handleAdd = useCallback(
    ({ x, y }: { x: number; y: number }) => {
      onAction?.();
      setPoints((prev) => prev.concat([{ id: crypto.randomUUID(), x, y }]));
    },
    [setPoints, onAction]
  );

  const handleRemovePoint = useCallback(
    (pointId: string) => {
      onAction?.();
      setPoints((prev) => prev.filter((p) => p.id !== pointId));
    },
    [setPoints, onAction]
  );

  useClickToAddPoint(handleAdd, points);

  return (
    <>
      {points.map((p, idx) => (
        <Marker
          key={p.id}
          position={xy2latLng([p.x, p.y]) as any}
          draggable={true}
          icon={createDotIcon(idx)}
          eventHandlers={{
            dragend: (e) => {
              const latlng = (e.target as L.Marker).getLatLng();
              const pt = latLng2xy(latlng) as L.Point;
              onAction?.();
              setPoints((prev) =>
                prev.map((q) =>
                  q.id === p.id ? { ...q, x: pt.x, y: pt.y } : q
                )
              );
            },
            contextmenu: (e: any) => {
              L.DomEvent.stopPropagation(e);
              L.DomEvent.preventDefault(e);
              handleRemovePoint(p.id);
            },
          }}
        >
          <Tooltip direction='top' offset={[0, -10]} opacity={0.9} permanent>
            {idx + 1}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}
