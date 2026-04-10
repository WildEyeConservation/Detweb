import { defineFunction } from '@aws-amplify/backend';

export const generateTile = defineFunction({
  name: 'generateTile',
  entry: './handler.mjs',
  runtime: 20,
  timeoutSeconds: 30,
  memoryMB: 2048,
});
