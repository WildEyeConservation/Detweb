import { useMapEvents, useMap } from 'react-leaflet';
import { useEffect, useContext } from 'react';
import { ImageContext } from './Context';
import { Map as LeafletMap, LatLng } from 'leaflet';

type LinkMapsProps = {
  otherMap: LeafletMap | null;
  setMap: (map: LeafletMap) => void;
  transform: (coords: [number, number]) => [number, number];
  blocked: boolean;
  setBlocked: (blocked: boolean) => void;
};

export default function LinkMaps({
  otherMap,
  setMap,
  transform,
}: LinkMapsProps) {
  const { latLng2xy, xy2latLng } = useContext(ImageContext)!;
  const map = useMap();

  useMapEvents({
    moveend: () => {
      const xy = latLng2xy(map.getCenter());
      const xy_new = transform(
        Array.isArray(xy) ? [xy[0].x, xy[0].y] : [xy.x, xy.y]
      );
      const xy_current = latLng2xy(otherMap!.getCenter());
      const xy_current_coords = Array.isArray(xy_current)
        ? [xy_current[0].x, xy_current[0].y]
        : [xy_current.x, xy_current.y];

      if (
        Math.abs(xy_current_coords[0] - xy_new[0]) +
          Math.abs(xy_current_coords[1] - xy_new[1]) >
        20
      ) {
        const ll = xy2latLng(xy_new) as LatLng;
        otherMap?.setView(ll, map.getZoom(), { animate: false });
      }
    },
    zoomend: () => {
      if (map.getZoom() !== otherMap!.getZoom()) {
        const xy = latLng2xy(map.getCenter());
        const xy2 = transform(
          Array.isArray(xy) ? [xy[0].x, xy[0].y] : [xy.x, xy.y]
        );
        const ll = xy2latLng(xy2) as LatLng;
        otherMap?.setView(ll, map.getZoom(), { animate: false });
      }
    },
  });

  useEffect(() => {
    setMap(map);
  }, [map, setMap]);

  return null;
}
