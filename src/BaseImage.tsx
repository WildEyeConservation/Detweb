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
import { fetchAllPaginatedResults, makeTransform } from "./utils";
import OverlapsLoader from "./OverlapsLoader";
import { useQueries, useQuery } from "@tanstack/react-query";

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
  const { client } = useContext(GlobalContext)!;
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
      // imageNeighboursQueries contains a list of queries that fetch the neighbours of each image.

  const prevNeighboursQuery = useQuery({
    queryKey: ['prevNeighbours', image.id],
    queryFn: () => {
      return client.models.ImageNeighbour.imageNeighboursByImage2key({ image2Id: image.id })
    },
    staleTime: Infinity, // Data will never become stale automatically
    cacheTime: 1000 * 60 * 60, // Cache for 1 hour
  })

  const prevNeighbours = useMemo(() => {
    return prevNeighboursQuery.data?.data?.map(n => n.image1Id) || [];
  }, [prevNeighboursQuery.data])

  const nextNeighboursQuery = useQuery({
    queryKey: ['nextNeighbours', image.id],
    queryFn: () => {
       return client.models.ImageNeighbour.imageNeighboursByImage1key({image1Id:image.id});
    },
    staleTime: Infinity, // Data will never become stale automatically
    cacheTime: 1000 * 60 * 60, // Cache for 1 hour
  })  

  const nextNeighbours = useMemo(() => {
    return nextNeighboursQuery.data?.data?.map(n => n.image2Id) || [];
  }, [nextNeighboursQuery.data])

  const imageMetaDataQueries = useQueries({
    queries: [...prevNeighbours, ...nextNeighbours].map((n) => ({
        queryKey: ['imageMetaData', n],
        queryFn: () => {
            return client.models.Image.get({id: n});
        },
        staleTime: Infinity, // Data will never become stale automatically
        cacheTime: 1000 * 60 * 60, // Cache for 1 hour
    }))
  });

  const imageMetaData = useMemo(() => {
    return imageMetaDataQueries.filter(q => q.isSuccess).map(q => q.data.data);
  }, [imageMetaDataQueries])

  const prevImage = useMemo(() => {
    return imageMetaData?.filter(i => prevNeighbours?.includes(i.id)).sort((a, b) => b.timestamp - a.timestamp)[0];
  }, [imageMetaData, prevNeighbours])

  const nextImage = useMemo(() => {
    return imageMetaData?.filter(i => nextNeighbours?.includes(i.id)).sort((a, b) => a.timestamp - b.timestamp)[0];
  }, [imageMetaData, nextNeighbours])

  const queriesComplete = imageMetaDataQueries.every(q => q.isSuccess) && prevNeighboursQuery.isSuccess && nextNeighboursQuery.isSuccess && true;

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

  async function useForTestPreset() {
    const { data: [testPreset] } = await client.models.TestPreset.testPresetsByName({
      name: project.name,
    })

    const { data: testPresetLocation } = await client.models.TestPresetLocation.get({
      testPresetId: testPreset.id,
      locationId: location?.id,
      annotationSetId: location?.annotationSetId,
    });


    if (!testPresetLocation) {
      await client.models.TestPresetLocation.create({
        testPresetId: testPreset.id,
        locationId: location?.id,
        annotationSetId: location?.annotationSetId,
      });
    }

    const annotations = await fetchAllPaginatedResults(
      client.models.Annotation.annotationsByImageIdAndSetId,
      {
        imageId: location!.image.id,
        setId: { eq: location.annotationSetId },
        selectionSet: ['categoryId', 'x', 'y'],
      }
    );

    const annotationCounts: { [key: string]: number } = {};
    for (const annotation of annotations) {
      const isWithin =
        annotation.x >= boundsxy[0][0] &&
        annotation.y >= boundsxy[0][1] &&
        annotation.x <= boundsxy[1][0] &&
        annotation.y <= boundsxy[1][1];

      if (isWithin) {
        annotationCounts[annotation.categoryId] =
          (annotationCounts[annotation.categoryId] || 0) + 1;
      }
    }

    for (const [categoryId, count] of Object.entries(annotationCounts)) {
      const { data: locationAnnotationCount } =
        await client.models.LocationAnnotationCount.get({
          locationId: location?.id,
          categoryId: categoryId,
          annotationSetId: location?.annotationSetId,
        });

      if (locationAnnotationCount) {
        await client.models.LocationAnnotationCount.update({
          locationId: location?.id,
          categoryId: categoryId,
          annotationSetId: location?.annotationSetId,
          count: count,
        });
      } else {
        await client.models.LocationAnnotationCount.create({
          locationId: location?.id,
          categoryId: categoryId,
          annotationSetId: location?.annotationSetId,
          count: count,
        });
      }
    }
  }

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
          text: `Open previous image`,
        callback: async () => {
          const newUrl = window.location.href.replace(/^(.*?\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}).*$/, `$1/image/${prevImage?.id}/${location?.annotationSetId}`)
            window.open(newUrl, '_blank');
          }
        },{
          text: `Open next image`,
          callback: async () => {
            const newUrl = window.location.href.replace(/^(.*?\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}).*$/, `$1/image/${nextImage?.id}/${location?.annotationSetId}`);
            window.open(newUrl, '_blank');
          }
        },{
          text: `Register against previous image`,
        callback: async () => {
          const newUrl = window.location.href.replace(/^(.*?\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}).*$/, `$1/register/${prevImage?.id}/${image.id}/${location?.annotationSetId}`)
            window.open(newUrl, '_blank');
          }
        },{
          text: `Register against next image`,
          callback: async () => {
            const newUrl = window.location.href.replace(/^(.*?\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}).*$/, `$1/register/${image.id}/${nextImage?.id}/${location?.annotationSetId}`);
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
          text: "Use as test location",
          callback: () => useForTestPreset(),
        })
      }
    }

    return items;
  }, [isTest, belongsToCurrentProject, source, location?.id, client.models.ImageNeighbour, image.id, stats, location.annotationSetId, location.image.id, prevImage, nextImage]);

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
      {queriesComplete && <MapContainer
        // id={id}
        key={JSON.stringify(contextMenuItems)}
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
          <OverlapsLoader image={image} />
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
      </div>
  ), [visible, fullyLoaded, source, style, zoom, viewBounds, viewCenter, location?.id, location?.annotationSetId, location.image.id, imageFiles, image, children, next, prev, canAdvance, stats, client.models.ImageNeighbour, imageBounds, isTest, queriesComplete])
}, (prevProps, nextProps) => {
      //Iterate over all the props except children and compare them for equality
  return prevProps.visible === nextProps.visible &&
    prevProps.next === nextProps.next &&
    prevProps.prev === nextProps.prev &&
    prevProps.location === nextProps.location;
  }
);

export default BaseImage;
