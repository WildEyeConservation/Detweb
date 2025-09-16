import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import shp from 'shpjs';
import type { GeoJsonObject } from 'geojson';

function Shapefile({ buffer }: { buffer: ArrayBuffer }) {
  const map = useMap();

  useEffect(() => {
    const emptyArray: GeoJsonObject[] = [];

    const geo = L.geoJson(emptyArray, {
      style: { color: 'orange', opacity: 1, fill: false },
      interactive: false,
    }).addTo(map);

    shp(buffer).then(function (data: GeoJsonObject) {
      geo.addData(data);
    });
  }, []);

  return null;
}

export default Shapefile;
