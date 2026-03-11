import { defineFunction } from '@aws-amplify/backend';

export const assignHomographyBatch = defineFunction({
  name: 'assignHomographyBatch',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 256,
  runtime: 20,
});
