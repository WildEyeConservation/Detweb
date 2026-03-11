import { defineFunction } from '@aws-amplify/backend';

export const heartbeatHomographyBatch = defineFunction({
  name: 'heartbeatHomographyBatch',
  entry: './handler.ts',
  timeoutSeconds: 10,
  memoryMB: 128,
  runtime: 20,
});
