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
    <div
      ref={divRef}
      className="d-flex flex-row align-items-center justify-content-center gap-1 w-100"
    >
      <Button
        className="d-flex flex-row align-items-center justify-content-center w-100 h-100"
        variant="primary"
        onClick={prev}
        disabled={!prev}
        style={{ maxWidth: "200px" }}
      >
        <ChevronLeft />
        <span className="d-none d-sm-block">Previous Location</span>
      </Button>
      <Button
        className="d-flex flex-row align-items-center justify-content-center w-100 h-100"
        variant="primary"
        onClick={next}
        disabled={!next}
        style={{ maxWidth: "200px" }}
      >
        <span className="d-none d-sm-block">Next Location</span>
        <ChevronRight />
      </Button>
    </div>
  );
}
