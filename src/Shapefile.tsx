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
        onEachFeature: function popUp(f, l) {
          var out = [];
          if (f.properties) {
            for (var key in f.properties) {
              out.push(key + ": " + f.properties[key]);
            }
            l.bindPopup(out.join("<br />"));
          }
        }
      }
    ).addTo(map);

    shp(buffer).then(function (data) {
      geo.addData(data);
    });
  }, []);

  return null;
}

export default Shapefile;
