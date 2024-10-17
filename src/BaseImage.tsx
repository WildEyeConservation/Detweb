// @flow
import React, {createContext, ReactNode, useState, useEffect, useContext, useCallback, useMemo } from "react";
import { MapContainer, LayersControl} from "react-leaflet";
import { NavButtons } from "./NavButtons";
import * as L from "leaflet";
import "leaflet-contextmenu";
import "leaflet-contextmenu/dist/leaflet.contextmenu.css";
import { useHotkeys } from "react-hotkeys-hook";
import { ImageType, ImageFileType, LocationType, AnnotationSetType } from './schemaTypes';
import { GlobalContext } from "./Context";
import { StorageLayer } from "./StorageLayer";

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

const BaseImage: React.FC<BaseImageProps> = (props) => {
  const { client } = useContext(GlobalContext)!;
  const [imageFiles, setImageFiles] = useState<ImageFileType[]>([]);
  const { next, prev, visible, containerheight, containerwidth, children, location } = props;
  const { image } = location;
  const scale = Math.pow(
    2,
    Math.ceil(Math.log2(Math.max(image.width, image.height))) - 8,
  );

  useEffect(() => {
    client.models.ImageFile.imagesByimageId({imageId: image.id }).then(
      response => setImageFiles(response.data))
  }, [image]);

  const xy2latLng = useCallback((input: L.Point | [number, number] | Array<L.Point | [number, number]>): L.LatLng | L.LatLng[] => {
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
  }, [scale]);
  
  const latLng2xy = useCallback((input: L.LatLng | [number, number] | Array<L.LatLng | [number, number]>): L.Point | L.Point[] => {
    if (Array.isArray(input)) {
      if (Array.isArray(input[0])) {
        return (input as Array<L.LatLng | [number, number]>).map((x) => latLng2xy(x) as L.Point);
      } else {
        return L.point((input as [number, number])[1] * scale, -(input as [number, number])[0] * scale);
      }
    } else {
      return L.point(input.lng * scale, -input.lat * scale);
    }
  }, [scale]);
  
  

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
  const imageContextValue = useMemo(() => ({ latLng2xy, xy2latLng }), [latLng2xy, xy2latLng]);
  const fullImageTypes = ['Complete JPG', 'Complete TIFF', 'Complete PNG'];
  //If a location is provided, use the location bounds, otherwise use the image bounds
  const imageBounds=xy2latLng([[0, 0], [image.width, image.height]])
  const viewBounds = location.x ?
    xy2latLng([[location.x-location.width/2, location.y-location.height/2], [location.x + location.width/2, location.y + location.height/2]]) :
    imageBounds;
  if (imageFiles.length === 0) return null;
  return (
    <ImageContext.Provider value={imageContextValue}>
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
        crs={L.CRS.Simple}
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
              checked={true}
            >
              {/* {fullImageTypes.includes(image.type) ? 
              <S3ImageOverlay
              bounds={imageBounds}
              source={image.s3key} 
              url={""} />: */}
              <StorageLayer
              source={imageFiles.find(file=>file.type=='image/jpeg').key}
              bounds={imageBounds}
                maxNativeZoom={5}
                noWrap={true}
              //getObject={getObject}
              />
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

export default BaseImage;
