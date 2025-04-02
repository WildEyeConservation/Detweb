import Button from "react-bootstrap/Button";
import { useEffect, useRef } from "react";
import L from "leaflet";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 *
 * NavButtons is a custom child component for react-leaflet. Like all child components it must be a descendant of a
 * MapContainer. It will add a forward and backward button to it's MapContainer ancestor.
 * @component
 * @property {function} next Callback to call when next button is clicked. If undefined, the button is disabled.
 * @property {function} prev Callback to call when prev button is clicked. If undefined, the button is disabled.
 *
 *
 */

interface NavButtonsProps {
  prev?: () => void;
  next?: () => void;
}

export function NavButtons({ prev, next }: NavButtonsProps) {
  const divRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (divRef.current) {
      L.DomEvent.disableClickPropagation(divRef.current);
    }
  }, []);

  return (
    <div ref={divRef} className="d-flex flex-row align-items-center gap-1">
      <Button
        className="d-flex flex-row align-items-center justify-content-center"
        variant="primary"
        onClick={prev}
        disabled={!prev}
        style={{ width: "200px" }}
      >
        <ChevronLeft /> Previous Location
      </Button>
      <Button
        className="d-flex flex-row align-items-center justify-content-center"
        variant="primary"
        onClick={next}
        disabled={!next}
        style={{ width: "200px" }}
      >
        Next Location <ChevronRight />
      </Button>
    </div>
  );
}
