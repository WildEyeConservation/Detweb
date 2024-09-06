import Button from "react-bootstrap/Button";
import { useEffect, useRef } from "react";
import L from "leaflet";

/**
 *
 * NavButtons is a custom child component for react-leaflet. Like all child components it must be a descendant of a
 * MapContainer. It will add a forward and backward button to it's MapContainer ancestor.
 * @component
 * @property {string} nextText The text to render in the next button. Defaults to >
 * @property {string} prevText The text to render in the prev button. Defaults to <
 * @property {function} next Callback to call when next button is clicked. If undefined, the button is disabled.
 * @property {function} prev Callback to call when prev button is clicked. If undefined, the button is disabled.
 * @property {string} position The position of the control (one of the map corners). Possible values are 'topleft',
 * 'topright', 'bottomleft' or 'bottomright'
 *
 *
 */

interface NavButtonsProps {
  position?: keyof typeof POSITION_CLASSES;
  prevText?: string;
  nextText?: string;
  prev?: () => void;
  next?: () => void;
  prevEnabled: boolean;
  nextEnabled: boolean;
}

export const POSITION_CLASSES = {
  bottomleft: "leaflet-bottom leaflet-left",
  bottomright: "leaflet-bottom leaflet-right",
  topleft: "leaflet-top leaflet-left",
  topright: "leaflet-top leaflet-right",
};

export function NavButtons({
  position = "bottomleft",
  prevText = "<",
  nextText = ">",
  prev,
  next,
}: NavButtonsProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const positionClass =
    POSITION_CLASSES[position] || POSITION_CLASSES.bottomleft;

  useEffect(() => {
    if (divRef.current) {
      L.DomEvent.disableClickPropagation(divRef.current);
    }
  }, []);

  return (
    <div ref={divRef} className={positionClass}>
      <div className="leaflet-control leaflet-bar">
        <Button onClick={prev} disabled={!prev}>
          {prevText}
        </Button>
        <Button onClick={next} disabled={!next}>
          {nextText}
        </Button>
      </div>
    </div>
  );
}

