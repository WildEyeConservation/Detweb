import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import exifr from 'exifr';
import {
  composedOrientation,
  normalizeCorrection,
  normalizeImageOrientation,
} from './orientation.mjs';

test('normalizes supported correction values', () => {
  assert.equal(normalizeCorrection('90'), 90);
  assert.equal(normalizeCorrection(180), 180);
  assert.equal(normalizeCorrection(270), 270);
  assert.equal(normalizeCorrection(45), 0);
  assert.equal(normalizeCorrection(undefined), 0);
});

test('composes a CCW correction after existing EXIF orientation', () => {
  assert.equal(composedOrientation(1, 90), 8);
  assert.equal(composedOrientation(6, 90), 1);
  assert.equal(composedOrientation(8, 270), 1);
  assert.equal(composedOrientation(2, 180), 4);
});

async function jpegWithOrientation(orientation) {
  return sharp({
    create: {
      width: 4,
      height: 2,
      channels: 3,
      background: { r: 120, g: 80, b: 40 },
    },
  })
    .withMetadata({ orientation })
    .jpeg()
    .toBuffer();
}

test('physically rotates pixels and resets EXIF orientation', async () => {
  const input = await jpegWithOrientation(1);
  const output = await normalizeImageOrientation(input, 90);
  const metadata = await sharp(output).metadata();
  const exif = await exifr.parse(output, {
    pick: ['ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight'],
  });

  assert.equal(metadata.width, 2);
  assert.equal(metadata.height, 4);
  assert.equal(metadata.orientation, 1);
  assert.equal(exif.ImageWidth, 2);
  assert.equal(exif.ImageHeight, 4);
  assert.equal(exif.ExifImageWidth, 2);
  assert.equal(exif.ExifImageHeight, 4);
});

test('preserves source EXIF while normalizing orientation', async () => {
  const input = await sharp({
    create: {
      width: 4,
      height: 2,
      channels: 3,
      background: { r: 120, g: 80, b: 40 },
    },
  })
    .withExif({
      IFD0: { Artist: 'Orientation test' },
      IFD3: { GPSLatitudeRef: 'S', GPSLongitudeRef: 'E' },
    })
    .withMetadata({ orientation: 1 })
    .jpeg()
    .toBuffer();

  const output = await normalizeImageOrientation(input, 90);
  const exif = await exifr.parse(output, {
    pick: ['Artist', 'GPSLatitudeRef', 'GPSLongitudeRef', 'Orientation'],
  });

  assert.equal(exif.Artist, 'Orientation test');
  assert.equal(exif.GPSLatitudeRef, 'S');
  assert.equal(exif.GPSLongitudeRef, 'E');
  assert.equal(exif.Orientation, 'Horizontal (normal)');
});

test('accounts for existing EXIF orientation before correction', async () => {
  const input = await jpegWithOrientation(6);
  const output = await normalizeImageOrientation(input, 90);
  const metadata = await sharp(output).metadata();

  assert.equal(metadata.width, 4);
  assert.equal(metadata.height, 2);
  assert.equal(metadata.orientation, 1);
});
