import { POSITION_CLASSES } from "./NavButtons";
import { useState, useEffect, useRef, useContext } from "react";
import L from "leaflet";
import { useCategory } from "./useGqlCached";
import { UserContext } from "./UserContext";

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

interface LegendProps {
  position: keyof typeof POSITION_CLASSES;
}


export function Legend({ position }: LegendProps) {
  const {currentProject} = useContext(UserContext)!;
  const {categories, setCurrentCategory} = useCategory(currentProject)
  const divRef = useRef<HTMLDivElement | null>(null);
  const positionClass =
    (position && POSITION_CLASSES[position]) || POSITION_CLASSES.bottomright;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (divRef.current) {
      L.DomEvent.disableClickPropagation(divRef.current);
    }
  });

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
              ? categories?.map((item, index) => {
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
          </div>
        </div>
      </div>
    </div>
  );
}
