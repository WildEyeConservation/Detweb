import { ImageOverlay } from 'react-leaflet';
import React,{ useState,useContext, useEffect } from 'react';
import { UserContext } from './UserContext';
import backendInfo from './cdk-exports.json';
const backend=backendInfo['detweb-stack-develop']

export function S3ImageOverlay({image,bounds,source,props}){
  const [url,setUrl]=useState()
  const {getObject}=useContext(UserContext);
  console.log(image)
  console.log(image.key)
  console.log(source)

  useEffect(()=>{
    getObject({ Bucket: backend.imagesBucketOut, Key: `public/images/${source}` }).then(response => {
        // Check if response.Body is already a Blob
        if (response.Body instanceof Blob) {
            return response.Body;
        }
        // If it's a ReadableStream (Web Streams API)
        else if (response.Body.getReader) {
            return new Response(response.Body).blob();
        }
        // Add other conditions if needed
        else {
            throw new Error("Unexpected response body type");
        }
    }).then(blob => URL.createObjectURL(blob)).then(url=>setUrl(url))
  }
  ,[source,getObject])

  return url && <ImageOverlay
    url={url}
    bounds={bounds}
    {...props}/>
}


