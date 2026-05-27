import { getTileBlob } from '../../StorageLayer';

const TILE_SIZE = 256;
const CROP_SIZE = 256;

/**
 * Slippy-map pyramid info for an image, mirroring IndividualIdMap's formula:
 * `maxZ = ceil(log2(maxDim / TILE_SIZE))`. The pyramid is square with side
 * `TILE_SIZE * 2^maxZ`, but at maxZ a tile covers exactly TILE_SIZE pixels of
 * the original image so the math collapses nicely for our centered-crop case.
 */
function getMaxZ(width: number, height: number): number {
  return Math.max(0, Math.ceil(Math.log2(Math.max(width, height) / TILE_SIZE)));
}

interface CropParams {
  sourceKey: string;
  imageWidth: number;
  imageHeight: number;
  x: number;
  y: number;
}

interface CropResult {
  /** Final composed canvas, sized to CROP_SIZE x CROP_SIZE. */
  canvas: HTMLCanvasElement;
  /** Annotation x,y projected into canvas coordinates. */
  markerX: number;
  markerY: number;
}

/**
 * Build a CROP_SIZE×CROP_SIZE thumbnail centred on (x,y) at the image's
 * highest slippy zoom (1:1 with the original image). Stitches up to four
 * adjacent tiles to produce the centred crop, then exposes the annotation's
 * position in canvas-space so the caller can draw a marker on it.
 *
 * If the annotation is near an image edge the window is clamped so it stays
 * fully inside the image bounds — the marker shifts off-centre rather than
 * leaving us with a transparent border.
 */
export async function fetchCenteredCrop(params: CropParams): Promise<CropResult> {
  const { sourceKey, imageWidth, imageHeight, x, y } = params;
  const maxZ = getMaxZ(imageWidth, imageHeight);

  const half = CROP_SIZE / 2;
  let left = Math.round(x - half);
  let top = Math.round(y - half);
  // Clamp window inside image bounds when image is at least CROP_SIZE.
  if (imageWidth >= CROP_SIZE) {
    left = Math.max(0, Math.min(left, imageWidth - CROP_SIZE));
  } else {
    left = 0;
  }
  if (imageHeight >= CROP_SIZE) {
    top = Math.max(0, Math.min(top, imageHeight - CROP_SIZE));
  } else {
    top = 0;
  }

  const right = left + CROP_SIZE;
  const bottom = top + CROP_SIZE;

  const minCol = Math.floor(left / TILE_SIZE);
  const maxCol = Math.floor((right - 1) / TILE_SIZE);
  const minRow = Math.floor(top / TILE_SIZE);
  const maxRow = Math.floor((bottom - 1) / TILE_SIZE);

  const canvas = document.createElement('canvas');
  canvas.width = CROP_SIZE;
  canvas.height = CROP_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.fillStyle = '#1f2933';
  ctx.fillRect(0, 0, CROP_SIZE, CROP_SIZE);

  const tilePromises: Promise<{
    img: HTMLImageElement;
    row: number;
    col: number;
    url: string;
  }>[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const path = `slippymaps/${sourceKey}/${maxZ}/${row}/${col}.png`;
      tilePromises.push(
        getTileBlob(path).then(
          (blob) =>
            new Promise<{
              img: HTMLImageElement;
              row: number;
              col: number;
              url: string;
            }>((resolve, reject) => {
              const url = URL.createObjectURL(blob);
              const img = new Image();
              img.onload = () => resolve({ img, row, col, url });
              img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error(`Failed to decode tile ${path}`));
              };
              img.src = url;
            })
        )
      );
    }
  }

  const tiles = await Promise.all(tilePromises);
  try {
    for (const { img, row, col } of tiles) {
      const tileLeftInImage = col * TILE_SIZE;
      const tileTopInImage = row * TILE_SIZE;
      ctx.drawImage(img, tileLeftInImage - left, tileTopInImage - top);
    }
  } finally {
    tiles.forEach((t) => URL.revokeObjectURL(t.url));
  }

  return {
    canvas,
    markerX: x - left,
    markerY: y - top,
  };
}

export const CHAIN_TILE_SIZE = CROP_SIZE;
