import { defineFunction } from '@aws-amplify/backend';

export const releaseAbandonedHomographyBatches = defineFunction({
  name: 'releaseAbandonedHomographyBatches',
  entry: './handler.ts',
  timeoutSeconds: 120,
  memoryMB: 256,
  runtime: 20,
});
