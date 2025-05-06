import {
  createElementObject,
  createLayerComponent,
  extendContext,
} from '@react-leaflet/core'
import { getUrl } from 'aws-amplify/storage';
import L from 'leaflet'
import localforage from 'localforage'; // You'll need to install this
/* This is a custom Leaflet layer that uses a slippy map stored on S3 storage, accessed via the aws-sdk/aws-s3
library. Because the URLs that we use to access files stored there need to be individually signed, we cannot 
use a URL template in the way that the normal Leaflet TileLayer does. 

The amplify Storage library gives a slightly more convenient interface, but it can only support a single S3 bucket.
Having now placed our inputs and outputs in separate buckets, we find that we need to access at least one of these via raw S3.*/

// Configure a dedicated storage instance for tile URLs
const tileCache = localforage.createInstance({
  name: 'tileCache',
  storeName: 'tiles'
});


async function getTileBlob(path: string): Promise<Blob> {
    // Try to get from persistent cache first
    const cached: Blob | null = await tileCache.getItem(path);

    if (cached) {
      return cached;
    }

    // If not in cache or expired, fetch the image
  const signedUrl = await getUrl({ path }, {useAccelerateEndpoint: true});
    const response = await fetch(signedUrl.url.toString(), {
      cache: 'no-store' // Prevent browser from caching the response
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch tile: ${response.statusText}`);
    }

    const blob = await response.blob();
    
    // Store in persistent cache
    await tileCache.setItem(path, blob);
    return blob;
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

      getTileBlob(path).then(blob => {
        tile.src = URL.createObjectURL(blob);
        // Clean up the object URL when the image loads
        tile.onload = () => {
          done(undefined, tile);
          URL.revokeObjectURL(tile.src);
        };
      }).catch(error => {
        done(error, tile);
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
