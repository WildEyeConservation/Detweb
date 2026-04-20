import {
  createElementObject,
  createLayerComponent,
  extendContext,
} from '@react-leaflet/core';
import { getUrl } from 'aws-amplify/storage';
import L from 'leaflet';
import localforage from 'localforage';
import { limitedClient } from './limitedClient';

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

/**
 * Tile generation is batched client-side: concurrent Lambda calls for the same
 * source image are coalesced into a single AppSync call so the Lambda amortizes
 * one source fetch+decode across many tiles. We use setTimeout(0) rather than a
 * debounce window — any requests made in the current event-loop tick are swept
 * into the same batch, with no artificial latency.
 */

type PendingTile = {
  z: number;
  row: number;
  col: number;
  resolve: (blob: Blob) => void;
  reject: (err: Error) => void;
};

const pendingByImage = new Map<string, PendingTile[]>();
const timersByImage = new Map<string, ReturnType<typeof setTimeout>>();
const imageIdByKey = new Map<string, string>();

function base64ToBlob(b64: string): Blob {
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'image/png' });
}

async function flushBatch(imageKey: string, batch: PendingTile[]) {
  try {
    const { data, errors } = await (limitedClient as any).queries.generateTile({
      imageKey,
      imageId: imageIdByKey.get(imageKey),
      zs: batch.map((t) => t.z),
      rows: batch.map((t) => t.row),
      cols: batch.map((t) => t.col),
    });

    if (errors?.length) throw new Error(errors[0].message);
    if (!data || !Array.isArray(data)) throw new Error('No tile data returned');

    data.forEach((b64: string | null, i: number) => {
      if (!b64) {
        batch[i].reject(new Error('Tile generation returned empty result'));
        return;
      }
      batch[i].resolve(base64ToBlob(b64));
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    batch.forEach((t) => t.reject(error));
  }
}

function generateTileOnDemand(
  imageKey: string,
  z: number,
  row: number,
  col: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let queue = pendingByImage.get(imageKey);
    if (!queue) {
      queue = [];
      pendingByImage.set(imageKey, queue);
    }
    queue.push({ z, row, col, resolve, reject });

    if (!timersByImage.has(imageKey)) {
      const timer = setTimeout(() => {
        timersByImage.delete(imageKey);
        const batch = pendingByImage.get(imageKey);
        pendingByImage.delete(imageKey);
        if (batch && batch.length > 0) {
          void flushBatch(imageKey, batch);
        }
      }, 0);
      timersByImage.set(imageKey, timer);
    }
  });
}

/**
 * Parse a slippy map tile path to extract the image key, zoom, row, and col.
 * Path format: slippymaps/{sourceKey}/{z}/{row}/{col}.png
 * Returns the full images/ key needed by the Lambda.
 */
function parseTilePath(path: string): {
  imageKey: string;
  z: number;
  row: number;
  col: number;
} | null {
  const match = path.match(
    /^slippymaps\/(.+)\/(\d+)\/(\d+)\/(\d+)\.png$/
  );
  if (!match) return null;
  return {
    imageKey: `images/${match[1]}`,
    z: parseInt(match[2], 10),
    row: parseInt(match[3], 10),
    col: parseInt(match[4], 10),
  };
}

export async function getTileBlob(path: string): Promise<Blob> {
  // Try to get from persistent cache first
  const cached: Blob | null = await tileCache.getItem(path);

  if (cached) {
    return cached;
  }

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

  // Try S3 direct first — for already-tiled images this is the fast path
  // (one network hop, progressive reveal). On 404, fall through to the
  // batched Lambda call, which handles generation + write-back.
  try {
    return await attemptFetch({ path });
  } catch (_) {
    const parsed = parseTilePath(path);
    if (!parsed) throw new Error(`Cannot parse tile path: ${path}`);

    const blob = await generateTileOnDemand(
      parsed.imageKey,
      parsed.z,
      parsed.row,
      parsed.col
    );
    await tileCache.setItem(path, blob);
    return blob;
  }
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
  props: L.GridLayerOptions & { source: string; imageId?: string },
  context: any
) {
  if (props.imageId && props.source) {
    imageIdByKey.set(`images/${props.source}`, props.imageId);
  }
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
