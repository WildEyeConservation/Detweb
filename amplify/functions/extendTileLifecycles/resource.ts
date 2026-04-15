import { defineFunction } from '@aws-amplify/backend';

export const extendTileLifecycles = defineFunction({
  name: 'extendTileLifecycles',
  entry: './handler.ts',
  runtime: 20,
  schedule: 'every day',
  timeoutSeconds: 900,
  memoryMB: 512,
});
