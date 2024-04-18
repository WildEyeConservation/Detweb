import {useMapEvents,useMap} from 'react-leaflet'
import React,{ useContext } from 'react';
import { CategoriesContext } from './Categories';
import { ShowMarkers } from './ShowMarkers';
import { ImageContext } from './BaseImage';

export default function CreateAnnotationOnClick({image,setId,annotationsHook,location,activeAnnotation}) {
  const map=useMap();
  const {latLng2xy}=useContext(ImageContext)
  const {annotations=undefined,createAnnotation=undefined,deleteAnnotation=undefined,updateAnnotation=undefined}=annotationsHook || {};
  const x=useContext(CategoriesContext)
  const [,[currentCategory,]]=x
    useMapEvents({
        click:(e)=>{
            const xy=latLng2xy(e.latlng);
            if (!location || ((Math.abs(xy.x-location.x)<location.width/2) && (Math.abs(xy.y-location.y)<location.height/2))){
             createAnnotation({imageKey:image.key,annotationSetId:setId,x:Math.round(xy.x),y:Math.round(xy.y),categoryId:currentCategory})
            }
          }
        },[map,image,setId]);
  return annotations && <ShowMarkers annotations={annotations} deleteAnnotation={deleteAnnotation} updateAnnotation={updateAnnotation} activeAnnotation={activeAnnotation}/>;
}