import { defineFunction } from '@aws-amplify/backend';

export const refreshTiles = defineFunction({
  name: 'refreshTiles',
  entry: './handler.mjs',
  runtime: 20,
  timeoutSeconds: 120,
  memoryMB: 512,
});
