// @flow
import React, {memo, createContext, ReactNode, useState, useEffect, useContext } from "react";
import { MapContainer, LayersControl} from "react-leaflet";
import { NavButtons } from "./NavButtons";
import * as L from "leaflet";
import "leaflet-contextmenu";
import "leaflet-contextmenu/dist/leaflet.contextmenu.css";
import { S3Layer } from "./S3Layer";
import { useHotkeys } from "react-hotkeys-hook";
import { S3ImageOverlay } from "./S3ImageOverlay";
import { S3 } from 'aws-sdk';
import { ImageType, ImageFileType, LocationType, AnnotationSetType } from './schemaTypes';
import { GlobalContext } from "./Context";

const DEFAULT_WIDTH = 100;
const DEFAULT_HEIGHT = 100;

export interface BaseImageProps {
  image: ImageType;
  location?: LocationType;
  next?: () => void;
  prev?: () => void;
  children: ReactNode;
  containerheight?: number;
  containerwidth?: number;
  visible: boolean;
  annotationSet: AnnotationSetType;
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

const BaseImage: React.FC<BaseImageProps> = (props) => {
  const { client } = useContext(GlobalContext)!;
  const [imageFiles, setImageFiles] = useState<ImageFileType[]>([]);
  const { image, next, prev, visible, containerheight, containerwidth, children, location } = props;
  const scale = Math.pow(
    2,
    Math.ceil(Math.log2(Math.max(image.width, image.height))) - 8,
  );

  useEffect(() => {
    client.models.ImageFile.list({filter: {imageId: {eq: image.id}}}).then(response => setImageFiles(response.data))
  }, [image]);

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
  const fullImageTypes = ['Complete JPG', 'Complete TIFF', 'Complete PNG'];
  const imageBounds = (xy2latLng([L.point(0, 0), L.point(image.width, image.height)]) as L.LatLng[]).map((latLng: L.LatLng) => [latLng.lat, latLng.lng]) as [[number, number], [number, number]]
  //If a location is provided, use the location bounds, otherwise use the image bounds
  const viewBounds = location ?
    L.latLngBounds(xy2latLng([[location.x, location.y], [location.x + (location.width ?? DEFAULT_WIDTH), location.y + (location.height ?? DEFAULT_HEIGHT)]]) as [L.LatLng, L.LatLng]) : imageBounds;
  return (
    <ImageContext.Provider value={{ latLng2xy, xy2latLng }}>
      <MapContainer
        // id={id}
        style={{
          width: String(containerwidth) || "100%",
          height: String(containerheight) || "100%",
          margin: "auto",
          display: "flex",
          justifyContent: "center",
          borderRadius: 10,
          alignItems: "center",
        }}
        bounds={viewBounds}
        zoomSnap={1}
        zoomDelta={1}
        keyboardPanDelta={0}
      >
        <LayersControl position="topright">
          {imageFiles.map(image => 
            <LayersControl.BaseLayer
            key={image.id}
            name={image.type}
            >
              {fullImageTypes.includes(image.type) ? 
              <S3ImageOverlay
              bounds={imageBounds}
              source={image.s3key} 
              url={""} />:
              <S3Layer
              source={image.s3key}
              bounds={imageBounds}
              maxNativeZoom={5}
              getObject={getObject}
              />}
            </LayersControl.BaseLayer>
          )}
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
