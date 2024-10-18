// @flow
import React, {ReactNode, useState, useEffect, useContext, memo, useMemo, useRef } from "react";
import { MapContainer, LayersControl} from "react-leaflet";
import { NavButtons } from "./NavButtons";
import * as L from "leaflet";
import "leaflet-contextmenu";
import "leaflet-contextmenu/dist/leaflet.contextmenu.css";
import { useHotkeys } from "react-hotkeys-hook";
import { ImageType, ImageFileType, LocationType, AnnotationSetType } from './schemaTypes';
import { GlobalContext, ImageContext } from "./Context";
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

const BaseImage: React.FC<BaseImageProps> = memo((props) =>
{
  const { client } = useContext(GlobalContext)!;
  const { xy2latLng } = useContext(ImageContext)!;
  const [imageFiles, setImageFiles] = useState<ImageFileType[]>([]);
  const { next, prev, visible, containerheight, containerwidth, children, location } = props;
  const { image } = location;
  const prevPropsRef = useRef(props);
  useEffect(() => {
    // Compare current props with previous props
    if (prevPropsRef.current) {
      Object.entries(props).forEach(([key, value]) => {
        if (prevPropsRef.current[key] !== value) {
          console.log(`Prop "${key}" changed:`, {
            from: prevPropsRef.current[key],
            to: value
          });
        }
      });
    }
    prevPropsRef.current = props;
  }, [props]);

  useEffect(() => {
    client.models.ImageFile.imagesByimageId({ imageId: image.id }).then(
      response => setImageFiles(response.data))
  }, [image]);
  
  useHotkeys("RightArrow", next ? next : () => { }, { enabled: visible }, [
    next,
  ]);
  useHotkeys("LeftArrow", prev ? prev : () => { }, { enabled: visible }, [
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
  //If a location is provided, use the location bounds, otherwise use the image bounds
  const imageBounds = useMemo(() => xy2latLng([[0, 0], [image.width, image.height]]), [image.width, image.height]);
  const style = useMemo(() => ({
    width: String(containerwidth) || "100%",
    height: String(containerheight) || "100%",
    margin: "auto",
    display: "flex",
    justifyContent: "center",
    borderRadius: 10,
    alignItems: "center",
  }), [containerwidth, containerheight]);
  const viewBounds = useMemo(() => location?.x ?
    xy2latLng([[location.x - location.width / 2, location.y - location.height / 2], [location.x + location.width / 2, location.y + location.height / 2]]) :
    imageBounds, [location.x, location.y, location.width, location.height, imageBounds]);
  return useMemo(() => (<MapContainer
    // id={id}
    style={style}
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
            source={imageFiles.find(file => file.type == 'image/jpeg').key}
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
  ), [next, prev, imageFiles, location, style, viewBounds, image])
}, (prevProps, nextProps) => {
      //Iterate over all the props except children and compare them for equality
      Object.entries(prevProps).forEach(([key, value]) => {
        if (key !== 'children' && prevProps[key] !== nextProps[key]) {
          console.log(`Prop "${key}" changed:`, {
            from: prevProps[key],
            to: nextProps[key]
          });
          return false;
        }
      }); 
      return true;
  }
);

export default BaseImage;
