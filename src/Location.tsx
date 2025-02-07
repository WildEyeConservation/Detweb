import { useMap } from "react-leaflet";
import { useContext,  useEffect, useState } from "react";
import "leaflet-contextmenu/dist/leaflet.contextmenu.css";
import { ImageContext } from "./Context";
import L from "leaflet";
import "leaflet-contextmenu";
import { LocationType } from "./schemaTypes";
import { isHotkeyPressed, useHotkeys } from "react-hotkeys-hook";
export default function Location({x,y,width,height,confidence}: LocationType) {
  const { xy2latLng } = useContext(ImageContext)!;
  const [enabled, setEnabled] = useState(true);
  width ||= 100
  height ||= 100

  const boundsxy: [number, number][] = [
    [x - width / 2, y - height / 2],
    [x + width / 2, y + height / 2],
  ];

  const map = useMap();
  
  const contextMenuItems = [
    {
      text: `Confidence : ${confidence}`,
      callback: () => console.log("conf callback"),
    },
  ];

  useHotkeys(
    "tab",
    (event) => {event.preventDefault(); setEnabled(!isHotkeyPressed("tab"))},
    { keyup: true, keydown: true },
  );

  useEffect(() => {
    if (!enabled) return;
    const latLngBounds = xy2latLng(boundsxy) as unknown as L.LatLngBoundsLiteral;
    const rectangle = L.rectangle(latLngBounds, {
      // color: showTestCase && isTest ? "red" : "blue",
      color: "blue",
      fill: false,
    }).addTo(map);

    (rectangle as any).bindContextMenu({
      contextmenu: true,
      contextmenuInheritItems: false,
      contextMenuItems,
    });

    return () => {
      map.removeLayer(rectangle);
    };
  }, [map, boundsxy, contextMenuItems, enabled]);

  return null;
}
