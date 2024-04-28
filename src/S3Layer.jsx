import { useLeafletContext } from "@react-leaflet/core";
import L from "leaflet";
import { useContext, useEffect } from "react";
import { UserContext } from "./UserContext";
import backendInfo from "./cdk-exports.json";
const backend = backendInfo["detweb-stack-develop"];

/* This is a custom Leaflet layer that uses a slippy map stored on S3 storage, accessed via the aws-sdk/aws-s3
library. Because the URLs that we use to access files stored there need to be individually signed, we cannot 
use a URL template in the way that the normal Leaflet TileLayer does. 

The amplify Storage library gives a slightly more convenient interface, but it can only support a single S3 bucket.
Having now placed our inputs and outputs in separate buckets, we find that we need to access at least one of these via raw S3.*/

let cachedUrlPromises = {};

class leafletS3Layer extends L.GridLayer {
  constructor(opts) {
    super(opts);
    this.getObject = opts.getObject;
    this.source = opts.source;
  }

  createTile(coords, done) {
    var tile = document.createElement("img");
    let key = `public/slippymaps/${this.source}/${coords.z}/${coords.y}/${coords.x}.png`;
    if (!(key in cachedUrlPromises)) {
      // Get a blob URL
      cachedUrlPromises[key] = this.getObject({
        Bucket: backend.outputsBucketOut,
        Key: key,
      })
        .then((response) => {
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
        })
        .then((blob) => URL.createObjectURL(blob))
        .catch((error) => console.error("Error:", error));
      // Stop using it after half an hour
      cachedUrlPromises[key].then(() =>
        setTimeout(() => delete cachedUrlPromises[key], 1800000),
      );
    }
    cachedUrlPromises[key].then((url) => {
      tile.src = url;
      setTimeout(function () {
        done(null, tile);
      }, 1);
    });
    return tile;
  }
}

export function S3Layer(props) {
  const context = useLeafletContext();
  const { getObject } = useContext(UserContext);

  useEffect(() => {
    if (getObject) {
      const s3layer = new leafletS3Layer({ ...props, getObject });
      const container = context.layerContainer || context.map;
      container.addLayer(s3layer);
      return () => {
        container.removeLayer(s3layer);
      };
    }
  }, [props, getObject]);
  return null;
}
