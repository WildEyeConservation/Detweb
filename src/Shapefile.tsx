import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import shp from "shpjs";

function Shapefile({ buffer }: { buffer: ArrayBuffer }) {
  const map = useMap();

  useEffect(() => {
    const geo = L.geoJson(
      { features: [] },
      {
        style: { color: "orange", opacity: 0.2 },
        interactive: false,
      }
    ).addTo(map);

    shp(buffer).then(function (data) {
      geo.addData(data);
    });
  }, []);

  return null;
}

export default Shapefile;
