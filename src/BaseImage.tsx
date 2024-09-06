// @flow
import React, { useRef, useContext, memo, createContext, ReactNode } from "react";
import { MapContainer, LayersControl, useMapEvents } from "react-leaflet";
import { NavButtons } from "./NavButtons";
import * as L from "leaflet";
import "leaflet-contextmenu";
import "leaflet-contextmenu/dist/leaflet.contextmenu.css";
import { UserContext } from "./UserContext";
import { S3Layer } from "./S3Layer";
//import AllLocations from "./AllLocations";
import { useHotkeys } from "react-hotkeys-hook";
import { S3ImageOverlay } from "./S3ImageOverlay";
import { S3 } from 'aws-sdk';

export interface BaseImageProps {
  width: number;
  height: number;
  x: number;
  y: number;
  img: {
    key: string;
    width: number;
    height: number;
  };
  next?: () => void;
  prev?: () => void;
  children: ReactNode;
  fullImage?: boolean;
  containerheight: string;
  containerwidth: string;
  visible: boolean;
  setId: string | undefined;
  boundsxy: [[number, number], [number, number]];
  center_xy?: [number, number];
}

interface ImageContextType {
  latLng2xy: (input: L.LatLng | [number, number] | Array<L.LatLng | [number, number]>) => L.Point | L.Point[];
  xy2latLng: (input: L.Point | [number, number] | Array<L.Point | [number, number]>) => L.LatLng | L.LatLng[];
}


export const ImageContext = createContext<ImageContextType | undefined>(undefined);

const s3 = new S3();

const getObject = async ({ Bucket, Key }: { Bucket: string; Key: string }) => {
  const params = { Bucket, Key };
  const data = await s3.getObject(params).promise();
  return data.Body;
};


const BaseImage: React.FC<BaseImageProps> = ({img,next,prev, children, fullImage,containerheight,containerwidth,visible, boundsxy,}) => {
  const mouseCoords = useRef({ x: 0, y: 0 });
  const { user } = useContext(UserContext)!;

  const scale = Math.pow(
    2,
    Math.ceil(Math.log2(Math.max(img.width, img.height))) - 8,
  );

  function xy2latLng(input: L.Point | [number, number] | Array<L.Point | [number, number]>): L.LatLng | L.LatLng[] {
    if (Array.isArray(input)) {
      if (Array.isArray(input[0])) {
        return (input as [number, number][]).map((x) => xy2latLng(x) as L.LatLng);
      } else {
        const [lng, lat] = input as [number, number];
        return L.latLng(-lat / scale, lng / scale);
      }
    } else {
      return L.latLng(-input.y / scale, input.x / scale);
    }
  }
  
  function latLng2xy(input: L.LatLng | [number, number] | Array<L.LatLng | [number, number]>): L.Point | L.Point[] {
    if (Array.isArray(input)) {
      if (Array.isArray(input[0])) {
        return (input as Array<L.LatLng | [number, number]>).map((x) => latLng2xy(x) as L.Point);
      } else {
        return L.point((input as [number, number])[1] * scale, -(input as [number, number])[0] * scale);
      }
    } else {
      return L.point(input.lng * scale, -input.lat * scale);
    }
  }
  
  

  useHotkeys("RightArrow", next ? next : () => {}, { enabled: visible }, [
    next,
  ]);
  useHotkeys("LeftArrow", prev ? prev : () => {}, { enabled: visible }, [
    prev,
  ]);

  // categories?.forEach((cat, idx) => {
  //   keyMap[cat.name] = cat.shortcutKey
  //   keyHandlers[cat.name] = ()=>{
  //     if (create) {
  //       if (mouseCoords.current.x || mouseCoords.current.y){
  //         create(mouseCoords.current, cat.id)}
  //       else{
  //         create({x:x,y:y}, cat.id)
  //       }
  //     }
  //   }
  // });

  useMapEvents({'mousemove': (e: L.LeafletMouseEvent) => {
    mouseCoords.current = { x: e.latlng.lng, y: e.latlng.lat };
  }});

  return (
    <ImageContext.Provider value={{ latLng2xy, xy2latLng }}>
      <MapContainer
        // id={id}
        style={{
          width: containerwidth,
          height: containerheight,
          margin: "auto",
          display: "flex",
          justifyContent: "center",
          borderRadius: 10,
          alignItems: "center",
        }}
        bounds={L.latLngBounds(xy2latLng(boundsxy) as [L.LatLng, L.LatLng])}
        zoomSnap={1}
        zoomDelta={1}
        keyboardPanDelta={0}
      >
        <LayersControl position="topright">
          {img && fullImage ? (
            <LayersControl.BaseLayer
              key={2}
              name="Full resolution JPG"
              checked={true}
            >
              <S3ImageOverlay
                image={img}
                bounds={(xy2latLng([L.point(0, 0), L.point(img.width, img.height)]) as L.LatLng[]).map((latLng: L.LatLng) => [latLng.lat, latLng.lng]) as [[number, number], [number, number]]}
                source={img.key} 
                url={""} 
              />
            </LayersControl.BaseLayer>
          ) : (
            <LayersControl.BaseLayer
              key={1}
              name="Slippy Maps Layer"
              checked={true}
            >
              <S3Layer
                source={img.key}
                bounds={L.latLngBounds(xy2latLng([L.point(0, 0), L.point(img.width, img.height)]) as [L.LatLng, L.LatLng])}
                maxNativeZoom={5}
                getObject={getObject}
              />
            </LayersControl.BaseLayer>
          )}
          {/* {user?.isAdmin && <AllLocations image={img} />} */}
        </LayersControl>
        {children}
        {(next || prev) && (
          <NavButtons
            position="bottomleft"
            prev={prev}
            next={next}
            prevEnabled={prev !== undefined}
            nextEnabled={next !== undefined}
          />
        )}
      </MapContainer>
    </ImageContext.Provider>
  );
};

export default memo(BaseImage);
