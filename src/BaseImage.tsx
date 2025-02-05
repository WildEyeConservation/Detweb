// @flow
import React, {ReactNode, useState, useEffect, useContext, memo, useMemo, useRef,useCallback } from "react";
import { MapContainer, LayersControl, LayerGroup } from "react-leaflet";
import { NavButtons } from "./NavButtons";
import * as L from "leaflet";
import "leaflet-contextmenu";
import "leaflet-contextmenu/dist/leaflet.contextmenu.css";
import "./BaseImage.css"
import { useHotkeys } from "react-hotkeys-hook";
import { ImageType, ImageFileType, LocationType, AnnotationSetType } from './schemaTypes';
import { GlobalContext, ImageContext, ManagementContext, UserContext, ProjectContext } from "./Context";
import { StorageLayer } from "./StorageLayer";
import { getUrl } from 'aws-amplify/storage';
import ZoomTracker from "./ZoomTracker";
import OverlapLoader from "./OverlapLoader";
import { inv } from "mathjs";
import { makeTransform } from "./utils";
import TestLocationModal from "./TestLocationModal";


export interface BaseImageProps {
  image: ImageType;
  location?: LocationType;
  next?: () => void;
  prev?: () => void;
  loadingComplete?: () => void;
  children: ReactNode;
  zoom?: number;
  containerheight?: number;
  containerwidth?: number;
  visible: boolean;
  annotationSet: AnnotationSetType;
}

const BaseImage: React.FC<BaseImageProps> = memo((props) =>
{
  const { client, showModal, modalToShow } = useContext(GlobalContext)!;
  const { xy2latLng, setVisibleTimestamp, setFullyLoadedTimestamp } = useContext(ImageContext)!;
  const {projectMembershipHook: {data: projectMemberships}} = useContext(ManagementContext)!;
  const {project} = useContext(ProjectContext)!
  const {user} = useContext(UserContext)!;
  const [fullyLoaded, setFullyLoaded] = useState(false);
  const [imageFiles, setImageFiles] = useState<ImageFileType[]>([]);
  const [canAdvance, setCanAdvance] = useState(false);
  const { next, prev, visible, containerheight, containerwidth, children, location, zoom, stats } = props;
  const { image } = location;
  const prevPropsRef = useRef(props);
  const source = imageFiles.find(file => file.type == 'image/jpeg')?.key
  const [isTest, setIsTest] = useState(false);

  const belongsToCurrentProject =  projectMemberships?.find(
    (pm) => pm.userId == user.userId && pm.projectId == project.id,
  );

  useEffect(() => {
    if (fullyLoaded) {
      setFullyLoadedTimestamp(Date.now())
      if (visible) {
        setTimeout(() => {
          console.log("Setting can advance to true")
          setCanAdvance(true)
        }, 100);
      }
    }
  }, [fullyLoaded])

  useEffect(() => {
    if (visible) {
      setVisibleTimestamp(Date.now())
      if (fullyLoaded) {
        setTimeout(() => {
          console.log("Setting can advance to true")
          setCanAdvance(true)
        }, 100);
      }
    }
  }, [visible])


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
  
  useHotkeys("RightArrow", next ? next : () => { }, { enabled: canAdvance && visible}, [
    next,
  ]);
  useHotkeys("LeftArrow", prev ? prev : () => { }, { enabled: visible }, [
    prev,
  ]);
  
  const testModalId = useMemo(() => {
    return crypto.randomUUID();
  }, []);

  const contextMenuItems = useMemo(() => {
    const items = [];
    if (source) {
      items.push(...[{
        text: source,
        index: 0,
        callback: () => {
          navigator.clipboard.writeText(source || '')
            .catch(err => console.error('Failed to copy to clipboard:', err));
        }
      },{
        text: "Copy permalink to this location",
        disabled: !location?.id,
        callback: () => {
          const url = window.location.href
          // now replace the last part of the url with the location id
          const newUrl = url.replace(/\/[^/]+\/?$/, `/location/${location?.id}/${location?.annotationSetId}`)
          navigator.clipboard.writeText(newUrl)
            .catch(err => console.error('Failed to copy to clipboard:', err));
        }
        },{
          text: "Copy permalink to this image",
          callback: () => {
            const url = window.location.href
            // now replace the last part of the url with the location id
            const newUrl = url.replace(/\/[^/]+\/?$/, `/image/${location.image.id}/${location?.annotationSetId}`)
            navigator.clipboard.writeText(newUrl)
              .catch(err => console.error('Failed to copy to clipboard:', err));
          }
        },{
          text: "Display Image Statistics",
          callback: () => {
            alert(JSON.stringify(stats));
          }
        },{
          text: "Open previous image in new tab",
          callback: async () => {
            const prevImage = await client.models.ImageNeighbour.imageNeighboursByImage2key({ image2Id: image.id }).then(response => response.data[0].image1Id);
            const newUrl = window.location.href.replace(/\/[^/]+\/?$/, `/image/${prevImage}/${location?.annotationSetId}`)
            window.open(newUrl, '_blank');
          }
        },{
          text: "Open next image in new tab",
          callback: async () => {
            const nextImage = await client.models.ImageNeighbour.imageNeighboursByImage1key({ image1Id: image.id }).then(response => response.data[0].image2Id);
            const newUrl = window.location.href.replace(/\/[^/]+\/?$/, `/image/${nextImage}/${location?.annotationSetId}`)
            window.open(newUrl, '_blank');
          }
        },
        {
          text: "Download this image",
          callback: () => {
            getUrl({ path: 'images/' + source, options: {
              bucket: 'inputs',
              validateObjectExistence: true,
              expiresIn: 300
              }
            }).then(async (url) => {
              navigator.clipboard.writeText(url.url.toString());
              
              // Fetch the image first
              const response = await fetch(url.url);
              const blob = await response.blob();
              
              // Create object URL from blob
              const objectUrl = window.URL.createObjectURL(blob);
              
              // Setup download link
              const a = document.createElement('a');
              a.href = objectUrl;
              a.download = source.split('/').pop() || 'image.jpg'; // Get filename from source
              
              // Trigger download
              document.body.appendChild(a);
              a.click();
              
              // Cleanup
              document.body.removeChild(a);
              window.URL.revokeObjectURL(objectUrl);
            })
          }
        }, 
      ])
      if (belongsToCurrentProject?.isAdmin) {
        items.push({
          text: "Configure for testing",
          callback: () => showModal(testModalId),
        })
      }
    }

    return items;
  }, [isTest, belongsToCurrentProject, source, location?.id, client.models.ImageNeighbour, image.id, stats, location.annotationSetId, location.image.id]);

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
  }), [containerwidth, containerheight,fullyLoaded]);
  const viewBounds = useMemo(() => location?.x ?
    xy2latLng([[location.x - location.width / 2, location.y - location.height / 2], [location.x + location.width / 2, location.y + location.height / 2]]) :
    imageBounds, [location.x, location.y, location.width, location.height, imageBounds]);
  const viewCenter = useMemo(() => location?.x ?
    xy2latLng([location.x, location.y]) :
    xy2latLng([image.width/2,image.height/2]), [location.x, location.y, image.width,image.height]);
  return useMemo(() => (
    <div style={{
      visibility: (visible && fullyLoaded) ? "visible" : "hidden",
      width: '100%',
      height: '100%'
    }}>
      {source && <MapContainer
        // id={id}
        style={style}
        crs={L.CRS.Simple}
        bounds={zoom ? undefined : viewBounds}
        center={zoom && viewCenter}
        contextmenu={true}
        contextmenuItems={contextMenuItems}
        zoom={zoom}
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
                eventHandlers={{
                  load: () => {
                    console.log("All visible tiles have loaded");
                    setFullyLoaded(true);
                  }
                }}
                source={source}
                bounds={imageBounds}
                maxNativeZoom={5}
                noWrap={true}
              //getObject={getObject}
              />
            </LayersControl.BaseLayer>
          )}
          <LayersControl.Overlay name="Overlap Previous" checked={false}>
            <LayerGroup>
              <OverlapLoader image={image} loadPrevious={true} />
            </LayerGroup>
          </LayersControl.Overlay>
          <LayersControl.Overlay name="Overlap Next" checked={false}>
            <LayerGroup>
              <OverlapLoader image={image} loadPrevious={false} />
            </LayerGroup>
          </LayersControl.Overlay>

        </LayersControl>
        {children}
        {(next || prev) && fullyLoaded &&
          <NavButtons
            position="bottomleft"
            prev={prev}
            next={canAdvance ? next : undefined}
          />}
        <ZoomTracker />
      </MapContainer>}
      {belongsToCurrentProject?.isAdmin && 
        <TestLocationModal 
          show={modalToShow === testModalId} 
          onClose={() => showModal(null)} 
          locationId={location?.id || ""}
          annotationSetId={location?.annotationSetId || ""}
        />
      }
      </div>
  ), [visible, fullyLoaded, source, style, zoom, viewBounds, viewCenter, location?.id, location?.annotationSetId, location.image.id, imageFiles, image, children, next, prev, canAdvance, stats, client.models.ImageNeighbour, imageBounds, isTest])
}, (prevProps, nextProps) => {
      //Iterate over all the props except children and compare them for equality
  return prevProps.visible === nextProps.visible &&
    prevProps.next === nextProps.next &&
    prevProps.prev === nextProps.prev &&
    prevProps.location === nextProps.location;
  }
);

export default BaseImage;
