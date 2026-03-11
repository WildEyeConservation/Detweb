import { defineFunction } from '@aws-amplify/backend';

export const launchHomographyPool = defineFunction({
  name: 'launchHomographyPool',
  entry: './handler.ts',
  timeoutSeconds: 900,
  memoryMB: 1024,
  runtime: 20,
});
