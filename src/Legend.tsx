import { useState, useEffect, useRef, useContext } from "react";
import L from "leaflet";
import { ProjectContext, UserContext } from "./Context";
import { Card, Button } from "react-bootstrap";
import { PanelLeft } from "lucide-react";

/**
 *
 * Legend is a custom child component for react-leaflet. Like all child components it must be a descendant of a
 * MapContainer. It will add legend to the map. The legend will be minified by default will expand when one hovers over
 * it. It then shows which classes correspond to which colour markers in the Detweb GUI. One can also click on a legend
 * entry to select that class as the currently active class. Then the next click on the image itself will result in a
 * marker of the selected class being placed.
 * @component
 * @property {string} position The position of the control (one of the map corners). Possible values are 'topleft',
 * 'topright', 'bottomleft' or 'bottomright'
 * @property {function} onUpdateCategory A callback that is called when one of the legend entries is clicked. The index
 * of the category is supplied as a parameter to the function call. Typically used to select the clicked category.
 */

const POSITION_CLASSES = {
  bottomleft: "leaflet-bottom leaflet-left",
  bottomright: "leaflet-bottom leaflet-right",
  topleft: "leaflet-top leaflet-left",
  topright: "leaflet-top leaflet-right",
};

interface LegendProps {
  position?: keyof typeof POSITION_CLASSES;
  hideLegend?: boolean;
  setHideLegend?: VoidFunction;
  annotationSetId?: string;
}

export function SideLegend({
  hideLegend,
  setHideLegend,
  annotationSetId,
}: LegendProps) {
  const {
    categoriesHook: { data: categories },
    currentCategory,
    setCurrentCategory,
  } = useContext(ProjectContext)!;

  if (hideLegend) {
    return null;
  }

  return (
    <Card className="d-flex flex-column h-100 overflow-hidden">
      <Card.Header>
        <Card.Title className="d-flex flex-row align-items-center gap-2 mb-2">
          <Button
            className="p-0"
            variant="link"
            onClick={setHideLegend}
          >
            <PanelLeft />
          </Button>
          <span>Legend</span>
        </Card.Title>
        <span className="text-muted" style={{ fontSize: "14px" }}>
          Select a label to annotate with or use the shortcut key
        </span>
      </Card.Header>
      <Card.Body className="d-flex flex-column gap-2 overflow-auto">
        {categories
          ?.filter((c) => c.annotationSetId === annotationSetId)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((category) => (
            <Button
              variant={currentCategory?.id === category.id ? "info" : "primary"}
              key={category.id}
              className="d-flex flex-row align-items-center justify-content-between gap-2"
              onClick={() => setCurrentCategory(category)}
            >
              <div className="d-flex flex-row align-items-center gap-2">
                <div
                  style={{ backgroundColor: category.color || "#000" }}
                  className="rounded-circle p-2"
                ></div>
                <div>{category.name}</div>
              </div>
              <div>({category.shortcutKey})</div>
            </Button>
          ))}
      </Card.Body>
    </Card>
  );
}

export function MapLegend({
  position,
  hideLegend = false,
  setHideLegend,
  annotationSetId,
}: LegendProps) {
  const {
    categoriesHook: { data: categories },
    setCurrentCategory,
  } = useContext(ProjectContext)!;
  const divRef = useRef<HTMLDivElement | null>(null);
  const positionClass =
    (position && POSITION_CLASSES[position]) || POSITION_CLASSES.bottomright;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (divRef.current) {
      L.DomEvent.disableClickPropagation(divRef.current);
    }
  });

  if (hideLegend) {
    return null;
  }

  return (
    <div ref={divRef} className={positionClass}>
      <div className="leaflet-control leaflet-bar">
        <div
          className="info legend"
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
        >
          <div>
            {expanded
              ? categories
                  ?.filter((c) => c.annotationSetId === annotationSetId)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((item, index) => {
                    return (
                      <div
                        key={index}
                        onClick={() => setCurrentCategory(item)}
                        style={{ display: "flex", flexDirection: "row" }}
                      >
                        <i style={{ background: item.color || "#000" }}></i>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            width: "100%",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>{item.name}</div>
                          <div>({item.shortcutKey})</div>
                        </div>
                      </div>
                    );
                  })
              : "Legend"}
            {expanded && setHideLegend && (
              <div className="d-flex flex-row align-items-center gap-2">
                <Button
                  variant="primary"
                  className="mt-2"
                  size="sm"
                  onClick={() => {
                    setHideLegend();
                    setExpanded(false);
                  }}
                >
                  Pop out legend
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
