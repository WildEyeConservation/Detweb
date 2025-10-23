// @flow
import React, {
  ReactNode,
  useState,
  useEffect,
  useContext,
  memo,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { MapContainer, LayersControl, LayerGroup } from 'react-leaflet';
import { NavButtons } from './NavButtons';
import * as L from 'leaflet';
import 'leaflet-contextmenu';
import 'leaflet-contextmenu/dist/leaflet.contextmenu.css';
import './BaseImage.css';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  ImageType,
  ImageFileType,
  LocationType,
  AnnotationSetType,
} from './schemaTypes';
import {
  GlobalContext,
  ImageContext,
  ManagementContext,
  UserContext,
  ProjectContext,
} from './Context';
import { StorageLayer } from './StorageLayer';
import { getUrl } from 'aws-amplify/storage';
import ZoomTracker from './ZoomTracker';
import OverlapOutline from './OverlapOutline';
import { fetchAllPaginatedResults } from './utils';

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
  otherImageId?: string;
  hideNavButtons?: boolean;
  isTest?: boolean;
  // Controls how tightly we fit bounds around a location. 0.5 = exact bbox, 1.5 = padded
  viewBoundsScale?: number;
}

const BaseImage: React.FC<BaseImageProps> = memo(
  (props) => {
    const { client } = useContext(GlobalContext)!;
    const {
      xy2latLng,
      setVisibleTimestamp,
      setFullyLoadedTimestamp,
      prevImages,
      nextImages,
      queriesComplete,
    } = useContext(ImageContext)!;
    const {
      projectMembershipHook: { data: projectMemberships },
    } = useContext(ManagementContext)!;
    const { project } = useContext(ProjectContext)!;
    const { user, isAnnotatePath } = useContext(UserContext)!;
    const [fullyLoaded, setFullyLoaded] = useState(false);
    const [imageFiles, setImageFiles] = useState<ImageFileType[]>([]);
    const [canAdvance, setCanAdvance] = useState(false);
    const {
      next,
      prev,
      visible,
      containerheight,
      containerwidth,
      children,
      location,
      zoom,
      stats,
      otherImageId,
      hideNavButtons,
      isTest,
    } = props;
    const { image } = location;
    const prevPropsRef = useRef(props);
    const source = imageFiles.find((file) => file.type == 'image/jpeg')?.key;
    const belongsToCurrentProject = projectMemberships?.find(
      (pm) => pm.userId == user.userId && pm.projectId == project.id
    );

    useEffect(() => {
      if (fullyLoaded) {
        setFullyLoadedTimestamp(Date.now());
        if (visible) {
          setTimeout(() => {
            console.log('Setting can advance to true');
            setCanAdvance(true);
          }, 100);
        }
      }
    }, [fullyLoaded]);

    // Fix: If there are no image files, set fullyLoaded to true
    useEffect(() => {
      if (imageFiles.length === 0 && !fullyLoaded) {
        setFullyLoaded(true);
      }
    }, [imageFiles.length, fullyLoaded]);

    useEffect(() => {
      if (visible) {
        setVisibleTimestamp(Date.now());
        if (fullyLoaded) {
          setTimeout(() => {
            console.log('Setting can advance to true');
            setCanAdvance(true);
          }, 100);
        }
      }
    }, [visible]);

    useEffect(() => {
      // Compare current props with previous props
      if (prevPropsRef.current) {
        Object.entries(props).forEach(([key, value]) => {
          if (prevPropsRef.current[key] !== value) {
            console.log(`Prop "${key}" changed:`, {
              from: prevPropsRef.current[key],
              to: value,
            });
          }
        });
      }
      prevPropsRef.current = props;
    }, [props]);

    useEffect(() => {
      client.models.ImageFile.imagesByimageId({ imageId: image.id })
        .then((response) => {
          setImageFiles(response.data);
        })
        .catch((error) => {
          console.error('Error fetching image files:', error);
        });
    }, [image]);

    useHotkeys(
      'RightArrow',
      next ? next : () => {},
      { enabled: canAdvance && visible },
      [next]
    );
    useHotkeys('LeftArrow', prev ? prev : () => {}, { enabled: visible }, [
      prev,
    ]);

    const contextMenuItems = useMemo(() => {
      const items = [];
      if (source) {
        items.push(
          ...[
            {
              text: source,
              index: 0,
              callback: () => {
                navigator.clipboard
                  .writeText(source || '')
                  .catch((err) =>
                    console.error('Failed to copy to clipboard:', err)
                  );
              },
            },
            {
              text: 'Download this image',
              callback: () => {
                getUrl({
                  path: 'images/' + source,
                  options: {
                    bucket: 'inputs',
                    validateObjectExistence: true,
                    expiresIn: 300,
                  },
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
                });
              },
            },
          ]
        );

        if (!isTest) {
          items.push(
            ...[
              {
                text: `Open previous image`,
                callback: async () => {
                  const newUrl = window.location.href.replace(
                    /^(.*?\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}).*$/,
                    `$1/image/${prevImages?.[0]?.image?.id}/${location?.annotationSetId}`
                  );
                  window.open(newUrl, '_blank');
                },
              },
              {
                text: `Open next image`,
                callback: async () => {
                  const newUrl = window.location.href.replace(
                    /^(.*?\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}).*$/,
                    `$1/image/${nextImages?.[0]?.image?.id}/${location?.annotationSetId}`
                  );
                  window.open(newUrl, '_blank');
                },
              },
              {
                text: `Register against previous image`,
                callback: async () => {
                  const newUrl = window.location.href.replace(
                    /^(.*?\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}).*$/,
                    `$1/register/${prevImages?.[0]?.image?.id}/${image.id}/${location?.annotationSetId}`
                  );
                  window.open(newUrl, '_blank');
                },
              },
              {
                text: `Register against next image`,
                callback: async () => {
                  const newUrl = window.location.href.replace(
                    /^(.*?\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}).*$/,
                    `$1/register/${image.id}/${nextImages?.[0]?.image?.id}/${location?.annotationSetId}`
                  );
                  window.open(newUrl, '_blank');
                },
              },
              {
                text: 'Display Image Statistics',
                callback: () => {
                  alert(JSON.stringify(stats));
                },
              },
              {
                text: 'Copy permalink to this location',
                disabled: !location?.id,
                callback: () => {
                  const url = window.location.href;
                  // now replace the last part of the url with the location id
                  const newUrl = url.replace(
                    /\/[^/]+\/?$/,
                    `/location/${location?.id}/${location?.annotationSetId}`
                  );
                  navigator.clipboard
                    .writeText(newUrl)
                    .catch((err) =>
                      console.error('Failed to copy to clipboard:', err)
                    );
                },
              },
              {
                text: 'Copy permalink to this image',
                callback: () => {
                  const url = window.location.href;
                  // now replace the last part of the url with the location id
                  const newUrl = url.replace(
                    /\/[^/]+\/?$/,
                    `/image/${location.image.id}/${location?.annotationSetId}`
                  );
                  navigator.clipboard
                    .writeText(newUrl)
                    .catch((err) =>
                      console.error('Failed to copy to clipboard:', err)
                    );
                },
              },
            ]
          );
        }
      }

      return items;
    }, [
      isTest,
      belongsToCurrentProject,
      source,
      location?.id,
      client.models.ImageNeighbour,
      image.id,
      stats,
      location.annotationSetId,
      location.image.id,
      prevImages,
      nextImages,
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
    const imageBounds = useMemo(
      () =>
        xy2latLng([
          [0, 0],
          [image.width, image.height],
        ]),
      [image.width, image.height]
    );
    const style = useMemo(
      () => ({
        width: '100%',
        height: '100%',
        margin: 'auto',
        display: 'flex',
        justifyContent: 'center',
        borderRadius: 10,
        alignItems: 'center',
      }),
      [fullyLoaded]
    );
    const viewBounds = useMemo(() => {
      if (!location?.x) return imageBounds;
      const scale = props.viewBoundsScale ?? 1.5;
      // Compute desired bounds and clamp to image edges so view never goes off-image
      const left = Math.max(0, location.x - location.width * scale);
      const top = Math.max(0, location.y - location.height * scale);
      const right = Math.min(image.width, location.x + location.width * scale);
      const bottom = Math.min(
        image.height,
        location.y + location.height * scale
      );
      return xy2latLng([
        [left, top],
        [right, bottom],
      ]);
    }, [
      location.x,
      location.y,
      location.width,
      location.height,
      image.width,
      image.height,
      imageBounds,
      props.viewBoundsScale,
    ]);
    const viewCenter = useMemo(
      () =>
        location?.x
          ? xy2latLng([location.x, location.y])
          : xy2latLng([image.width / 2, image.height / 2]),
      [location.x, location.y, image.width, image.height]
    );

    return useMemo(
      () => (
        <div className="d-flex flex-column align-items-center w-100 h-100 gap-3">
          <div
            className="d-flex flex-column align-items-center w-100 h-100"
            style={{
              visibility: visible && fullyLoaded ? 'visible' : 'hidden',
              position: 'relative',
            }}
          >
            {queriesComplete ? (
              <MapContainer
                key={`${location.id}-${location.annotationSetId}-${visible}-${zoom}`}
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
                  {imageFiles.length > 0 ? (
                    imageFiles.map((image) => (
                      <LayersControl.BaseLayer
                        key={image.id}
                        name={image.type}
                        checked={true}
                      >
                        <StorageLayer
                          eventHandlers={{
                            load: () => {
                              setFullyLoaded(true);
                            },
                            error: (error) => {
                              console.error('StorageLayer error:', error);
                            },
                          }}
                          source={source}
                          bounds={imageBounds}
                          maxNativeZoom={5}
                          noWrap={true}
                        />
                      </LayersControl.BaseLayer>
                    ))
                  ) : (
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(255,255,255,0.9)',
                        padding: '20px',
                        borderRadius: '10px',
                        textAlign: 'center',
                        zIndex: 1000,
                      }}
                    >
                      <div
                        style={{
                          color: 'red',
                          fontWeight: 'bold',
                          marginBottom: '10px',
                        }}
                      >
                        ⚠️ No Image Files Found
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        Image ID: {image.id}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        This image has no associated files in the database.
                      </div>
                    </div>
                  )}
                  {!isAnnotatePath &&
                    prevImages?.toReversed()?.map((im, idx) => (
                      <LayersControl.Overlay
                        name={`Overlap ${im.image.originalPath}`}
                        key={idx}
                        checked={im.image.id == otherImageId}
                      >
                        <LayerGroup>
                          <OverlapOutline
                            transform={im.transform.bwd}
                            image={im.image}
                          />
                        </LayerGroup>
                      </LayersControl.Overlay>
                    ))}
                  {!isAnnotatePath &&
                    nextImages?.map((im, idx) => (
                      <LayersControl.Overlay
                        name={`Overlap ${im.image.originalPath}`}
                        key={idx}
                        checked={im.image.id == otherImageId}
                      >
                        <LayerGroup>
                          <OverlapOutline
                            transform={im.transform.bwd}
                            image={im.image}
                          />
                        </LayerGroup>
                      </LayersControl.Overlay>
                    ))}
                </LayersControl>
                {children}
                <ZoomTracker />
              </MapContainer>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  background: '#f0f0f0',
                  color: 'red',
                  fontSize: '14px',
                  textAlign: 'center',
                  padding: '20px',
                }}
              >
                <div>
                  <div>Loading image...</div>
                </div>
              </div>
            )}
          </div>
          {(next || prev) && fullyLoaded && !hideNavButtons && (
            <NavButtons prev={prev} next={canAdvance ? next : undefined} />
          )}
        </div>
      ),
      [
        visible,
        fullyLoaded,
        source,
        style,
        zoom,
        viewBounds,
        viewCenter,
        location?.id,
        location?.annotationSetId,
        location.image.id,
        imageFiles,
        image,
        children,
        next,
        prev,
        canAdvance,
        stats,
        client.models.ImageNeighbour,
        imageBounds,
        isTest,
        queriesComplete,
      ]
    );
  },
  (prevProps, nextProps) => {
    //Iterate over all the props except children and compare them for equality
    return (
      prevProps.visible === nextProps.visible &&
      prevProps.next === nextProps.next &&
      prevProps.prev === nextProps.prev &&
      prevProps.location === nextProps.location
    );
  }
);

export default BaseImage;
