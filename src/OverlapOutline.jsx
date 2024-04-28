import { Polygon } from "react-leaflet";
import { isHotkeyPressed, useHotkeys } from "react-hotkeys-hook";
import React, { useContext, useState } from "react";
import { ImageContext } from "./BaseImage";

export default function OverlapOutline({ transform, image }) {
  const { xy2latLng } = useContext(ImageContext);
  const [enabled, setEnabled] = useState(true);
  useHotkeys(
    "Shift",
    () => {
      setEnabled(!isHotkeyPressed("Shift"));
    },
    { keyup: true, keydown: true },
  );

  if (transform && image && enabled) {
    const polygon = [
      [0, 0],
      [image.width, 0],
      [image.width, image.height],
      [0, image.height],
    ];
    return (
      <Polygon
        pathOptions={{ color: "purple" }}
        positions={xy2latLng(polygon.map(transform))}
      />
    );
  } else {
    return null;
  }
}
