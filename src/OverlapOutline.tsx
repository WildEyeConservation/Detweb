import { Polygon } from "react-leaflet";
import { isHotkeyPressed, useHotkeys } from "react-hotkeys-hook";
import { useContext, useState } from "react";
import { ImageContext } from "./Context";


interface OverlapOutlineProps {
  transform: (coords: [number, number]) => [number, number];
  image: {
    width: number;
    height: number;
  } | null;
}


export default function OverlapOutline({ transform, image }: OverlapOutlineProps) {
  const { xy2latLng } = useContext(ImageContext)!;
  const [enabled, setEnabled] = useState(true);

  useHotkeys(
    "Shift",
    () => {
      setEnabled(!isHotkeyPressed("Shift"));
    },
    { keyup: true, keydown: true }
  );

  if (transform && image && enabled) {
    const polygon: [number, number][] = [
      [0, 0],
      [image.width, 0],
      [image.width, image.height],
      [0, image.height],
    ];

    return (
      <Polygon
        pathOptions={{ color: "purple", fillOpacity: 0.1 }}
        positions={xy2latLng(polygon.map(transform)) as L.LatLng[]}
      />
    );
  } else {
    return null;
  }
}
