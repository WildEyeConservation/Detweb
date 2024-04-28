import { useMapEvents, useMap } from "react-leaflet";
import { useEffect, useContext } from "react";
import { ImageContext } from "./BaseImage";

export default function LinkMaps({ otherMap, setMap, transform }) {
  const { latLng2xy, xy2latLng } = useContext(ImageContext);
  const map = useMap();
  useMapEvents(
    {
      moveend: () => {
        const xy = latLng2xy(map.getCenter());
        const xy_new = transform([xy.x, xy.y]);
        const xy_current = latLng2xy(otherMap.getCenter());
        if (
          Math.abs(xy_current.x - xy_new.x) +
            Math.abs(xy_current.y - xy_new.y) >
          20
        ) {
          console.log(xy_new);
          console.log(xy_current);
          const ll = xy2latLng(xy_new);
          otherMap?.setView(ll, map.getZoom(), { animate: false });
        }
      },
      // mouseover:(e)=>{
      //     setActiveMap(map)
      // },
      // mouseout:(e)=>{
      //     setActiveMap(map)
      // },
      zoomend: () => {
        if (map.getZoom() != otherMap.getZoom()) {
          const xy = latLng2xy(map.getCenter());
          const xy2 = transform([xy.x, xy.y]);
          const ll = xy2latLng(xy2);
          otherMap?.setView(ll, map.getZoom(), { animate: false });
        }
      },
    },
    [otherMap, map],
  );
  useEffect(() => {
    setMap(map);
  }, [map]);
  return null;
}
