import {
  createElementObject,
  createLayerComponent,
  extendContext,
} from '@react-leaflet/core';
import { getUrl } from 'aws-amplify/storage';
import L from 'leaflet';
import localforage from 'localforage'; // You'll need to install this
/* This is a custom Leaflet layer that uses a slippy map stored on S3 storage, accessed via the aws-sdk/aws-s3
library. Because the URLs that we use to access files stored there need to be individually signed, we cannot 
use a URL template in the way that the normal Leaflet TileLayer does. 

The amplify Storage library gives a slightly more convenient interface, but it can only support a single S3 bucket.
Having now placed our inputs and outputs in separate buckets, we find that we need to access at least one of these via raw S3.*/

// Configure a dedicated storage instance for tile URLs
const tileCache = localforage.createInstance({
  name: 'tileCache',
  storeName: 'tiles',
});

async function getTileBlob(path: string): Promise<Blob> {
  // Try to get from persistent cache first
  const cached: Blob | null = await tileCache.getItem(path);

  if (cached) {
    return cached;
  }

  const prefersTestBucket = path.toLowerCase().includes('12_06_25');

  const attemptFetch = async (getUrlArgs: any): Promise<Blob> => {
    const signedUrl = await getUrl(getUrlArgs);
    const response = await fetch(signedUrl.url.toString(), {
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch tile: ${response.status} ${response.statusText}`
      );
    }
    const blob = await response.blob();
    await tileCache.setItem(path, blob);
    return blob;
  };

  if (prefersTestBucket) {
    try {
      return await attemptFetch({
        path,
        options: {
          bucket: {
            bucketName: 'surveyscope-testbucket',
            region: 'af-south-1',
          },
        },
      });
    } catch (_) {
      // Fall back to default bucket
      return await attemptFetch({ path });
    }
  }

  // Default path (no special bucket)
  return await attemptFetch({ path });
}

// Add this type declaration before the extension
declare module 'leaflet' {
  namespace GridLayer {
    let Storage: any;
  }
}

L.GridLayer.Storage = L.GridLayer.extend({
  createTile: function (
    coords: L.Coords,
    done: (error: Error | undefined, tile: HTMLElement) => void
  ) {
    const canvas = document.createElement('canvas');
    const size = this.getTileSize();
    canvas.width = size.x;
    canvas.height = size.y;
    const context = canvas.getContext('2d');
    if (!context) {
      done(new Error('Canvas 2D context unavailable'), canvas);
      return canvas;
    }

    const source = this.options.source;
    const minZoom = this.options.minZoom ?? 0;
    const tileSize = size.x; // assume square tiles

    const drawFromBlob = (
      blob: Blob,
      sx: number,
      sy: number,
      sWidth: number,
      sHeight: number
    ) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        try {
          context.clearRect(0, 0, tileSize, tileSize);
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.drawImage(
            img,
            sx,
            sy,
            sWidth,
            sHeight,
            0,
            0,
            tileSize,
            tileSize
          );
          done(undefined, canvas);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        done(new Error('Failed to load image from blob'), canvas);
      };
      img.src = url;
    };

    const tryExactTile = async (): Promise<boolean> => {
      const path = `slippymaps/${source}/${coords.z}/${coords.y}/${coords.x}.png`;
      try {
        const blob = await getTileBlob(path);
        drawFromBlob(blob, 0, 0, tileSize, tileSize);
        return true;
      } catch (_) {
        return false;
      }
    };

    const tryAncestorTiles = async (): Promise<boolean> => {
      // Search progressively higher-level tiles until minZoom
      for (let ancestorZ = coords.z - 1; ancestorZ >= minZoom; ancestorZ--) {
        const factor = 1 << (coords.z - ancestorZ);
        const ancestorX = Math.floor(coords.x / factor);
        const ancestorY = Math.floor(coords.y / factor);
        const sx = (coords.x % factor) * (tileSize / factor);
        const sy = (coords.y % factor) * (tileSize / factor);
        const sWidth = tileSize / factor;
        const sHeight = tileSize / factor;
        const path = `slippymaps/${source}/${ancestorZ}/${ancestorY}/${ancestorX}.png`;
        try {
          const blob = await getTileBlob(path);
          drawFromBlob(blob, sx, sy, sWidth, sHeight);
          return true;
        } catch (_) {
          // continue searching higher
        }
      }
      return false;
    };

    (async () => {
      try {
        const exactOk = await tryExactTile();
        if (exactOk) return;
        const ancestorOk = await tryAncestorTiles();
        if (ancestorOk) return;
        done(new Error('No tile or ancestor tile available'), canvas);
      } catch (err: any) {
        done(err, canvas);
      }
    })();

    return canvas;
  },
});

function createStorageLayer(
  props: L.GridLayerOptions & { source: string },
  context: any
) {
  const layer = new L.GridLayer.Storage(props);
  return createElementObject(
    layer,
    extendContext(context, { layerContainer: layer })
  );
}

function updateStorageLayer() {}

export const StorageLayer = createLayerComponent(
  createStorageLayer,
  updateStorageLayer
);
