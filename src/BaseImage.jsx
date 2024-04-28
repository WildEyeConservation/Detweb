// @flow
import React, { useRef, useContext, memo, createContext } from "react";
import { MapContainer, LayersControl } from "react-leaflet";
import { NavButtons } from "./NavButtons";
import * as L from "leaflet";
import "leaflet-contextmenu";
import "leaflet-contextmenu/dist/leaflet.contextmenu.css";
import { UserContext } from "./UserContext";
import { S3Layer } from "./S3Layer";
import AllLocations from "./AllLocations";
import { useHotkeys } from "react-hotkeys-hook";
import { S3ImageOverlay } from "./S3ImageOverlay";
export const ImageContext = createContext({});

const BaseImage = (props) => {
  const { image, next, prev, children, fullImage } = props;
  let boundsxy = [
    [props.x - props.width / 2, props.y - props.height / 2],
    [props.x + props.width / 2, props.y + props.height / 2],
  ];
  const mouseCoords = useRef({ x: 0, y: 0 });
  const { user } = useContext(UserContext);

  const scale = Math.pow(
    2,
    Math.ceil(Math.log2(Math.max(image.width, image.height))) - 8,
  );

  function xy2latLng(input) {
    if (Array.isArray(input)) {
      if (isNaN(input[0])) return input.map((x) => xy2latLng(x));
      else return xy2latLng(L.point(input));
    } else {
      //return L.latLng(-input.y/32.0, input.x/32.0)
      return [-input.y / scale, input.x / scale];
    }
  }

  function latLng2xy(input) {
    if (Array.isArray(input)) {
      if (isNaN(input[0])) return input.map((x) => this.latLng2xy(x));
      else return latLng2xy(L.latLng(L.point(input)));
    } else {
      return L.point(input.lng * scale, -input.lat * scale);
    }
  }

  useHotkeys("RightArrow", next ? next : () => {}, { enabled: props.visible }, [
    next,
  ]);
  useHotkeys("LeftArrow", prev ? prev : () => {}, { enabled: props.visible }, [
    prev,
  ]);

  // categories?.forEach((cat, idx) => {
  //   keyMap[cat.name] = cat.shortcutKey
  //   keyHandlers[cat.name] = ()=>{
  //     if (create) {
  //       if (mouseCoords.current.x || mouseCoords.current.y){
  //         create(mouseCoords.current, cat.id)}
  //       else{
  //         create({x:props.x,y:props.y}, cat.id)
  //       }
  //     }
  //   }
  // });

  return (
    <ImageContext.Provider value={{ latLng2xy, xy2latLng }}>
      <MapContainer
        id={props.id}
        style={{
          width: props.containerwidth,
          height: props.containerheight,
          margin: "auto",
          display: "flex",
          justifyContent: "center",
          borderRadius: 10,
          alignItems: "center",
        }}
        {...props}
        crs={L.CRS.Simple}
        zoomAnimation={false}
        fadeAnimation={false}
        markerZoomAnimation={false}
        contextmenu={true}
        whenCreated={(map) => {
          map.custom = image.key;
        }}
        contextmenuItems={[
          {
            text: `${image.key}`,
            callback: () => {
              console.log("copying");
              navigator.clipboard.writeText(image.key);
            },
          },
        ]}
        bounds={boundsxy && xy2latLng(boundsxy)}
        onMouseMove={(e) => {
          mouseCoords.current = e.xy;
        }}
        zoomSnap={1}
        zoomDelta={1}
        keyboardPanDelta={0}
      >
        <LayersControl position="topright">
          {image && fullImage ? (
            <LayersControl.BaseLayer
              key={2}
              name="Full resolution JPG"
              checked={true}
            >
              <S3ImageOverlay
                image={image}
                bounds={
                  image.width &&
                  image.height &&
                  xy2latLng([L.point(0, 0), L.point(image.width, image.height)])
                }
                noWrap={true}
                source={image.key}
              />
            </LayersControl.BaseLayer>
          ) : (
            <LayersControl.BaseLayer
              key={1}
              name="Slippy Maps Layer"
              checked={true}
            >
              <S3Layer
                source={image.key}
                bounds={
                  image.width &&
                  image.height &&
                  xy2latLng([L.point(0, 0), L.point(image.width, image.height)])
                }
                noWrap={true}
                maxNativeZoom={5}
              />
            </LayersControl.BaseLayer>
          )}
          {user.isAdmin && <AllLocations image={image} />}
        </LayersControl>
        {children}
        {(next || prev) && (
          <NavButtons
            position="bottomleft"
            prev={prev}
            next={next}
            prevEnabled={prev}
            nextEnabled={next}
          />
        )}
      </MapContainer>
    </ImageContext.Provider>
  );
};

export default memo(BaseImage);
