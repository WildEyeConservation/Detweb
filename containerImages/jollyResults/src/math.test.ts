import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraFootprintWidth, trimmedMean } from './math.js';

test('cameraFootprintWidth matches the nadir strip formula', () => {
  const fieldOfView = 2 * Math.atan(36 / (2 * 50));
  const expected = 100 * 2 * Math.tan(fieldOfView / 2);
  assert.ok(
    Math.abs(cameraFootprintWidth(100, 36, 50, 0) - expected) < 1e-9
  );
});

test('cameraFootprintWidth is independent of tilt sign', () => {
  const port = cameraFootprintWidth(100, 36, 50, -20);
  const starboard = cameraFootprintWidth(100, 36, 50, 20);
  assert.ok(Math.abs(port - starboard) < 1e-9);
  assert.ok(port > 0);
});

test('tilted strips are wider than nadir strips', () => {
  const nadir = cameraFootprintWidth(100, 36, 50, 0);
  const tilted = cameraFootprintWidth(100, 36, 50, 20);
  assert.ok(tilted > nadir);
});

test('cameraFootprintWidth rejects footprints that cross the horizon', () => {
  assert.throws(
    () => cameraFootprintWidth(100, 36, 50, 80),
    /crosses the horizon/
  );
});

test('trimmedMean handles empty and short samples', () => {
  assert.equal(trimmedMean([]), 0);
  assert.equal(trimmedMean([5]), 5);
  assert.equal(trimmedMean([1, 2, 3, 100], 0.25), 2.5);
});
