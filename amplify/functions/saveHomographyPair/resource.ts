import { defineFunction } from '@aws-amplify/backend';

export const saveHomographyPair = defineFunction({
  name: 'saveHomographyPair',
  entry: './handler.ts',
  timeoutSeconds: 120,
  memoryMB: 512,
  runtime: 20,
});
