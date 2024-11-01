import {
  createElementObject,
  createLayerComponent,
  extendContext,
} from '@react-leaflet/core'
import { getUrl } from 'aws-amplify/storage';
import L from 'leaflet'
/* This is a custom Leaflet layer that uses a slippy map stored on S3 storage, accessed via the aws-sdk/aws-s3
library. Because the URLs that we use to access files stored there need to be individually signed, we cannot 
use a URL template in the way that the normal Leaflet TileLayer does. 

The amplify Storage library gives a slightly more convenient interface, but it can only support a single S3 bucket.
Having now placed our inputs and outputs in separate buckets, we find that we need to access at least one of these via raw S3.*/

let cachedUrlPromises: { [key: string]: Promise<{url:URL,expiresAt:Date}> } = {};

interface leafletS3LayerOptions extends L.GridLayerOptions {
  getObject: (params: { Bucket: string; Key: string }) => Promise<any>;
  source: string;
}

async function getValidUrl(path: string):Promise<URL> {
  if (!(path in cachedUrlPromises)) {
    cachedUrlPromises[path] = getUrl({ path })
  }
  const result = await cachedUrlPromises[path]
  const thirtySecondsFromNow = Date.now() + 30000; // 30 seconds in milliseconds
  if (result.expiresAt.getTime() < thirtySecondsFromNow) {
    delete cachedUrlPromises[path];
    return getValidUrl(path);
  }
  return result.url;
}

// Add this type declaration before the extension
declare module 'leaflet' {
  namespace GridLayer {
    let Storage: any;
  }
}

L.GridLayer.Storage = L.GridLayer.extend({
    createTile: function (coords: L.Coords, done: (error: Error | undefined, tile: HTMLElement) => void) {
      let tile = document.createElement("img");
      const path = `slippymaps/${this.options.source}/${coords.z}/${coords.y}/${coords.x}.png`
      
      tile.onload = () => {
        done(undefined, tile);
      };

      tile.onerror = () => {
        done(new Error(`Failed to load tile at ${path}`), tile);
      };

      getValidUrl(path).then(url => {
        tile.src = url.toString();
      });

      return tile;
    }
});

function createStorageLayer(props, context) {
  const layer = new L.GridLayer.Storage(props);
  return createElementObject(layer, extendContext(context, {layerContainer: layer}));
}

function updateStorageLayer() {
} 

export const StorageLayer = createLayerComponent(createStorageLayer, updateStorageLayer);
