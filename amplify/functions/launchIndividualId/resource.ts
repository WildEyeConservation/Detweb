import { defineFunction } from '@aws-amplify/backend';

export const launchIndividualId = defineFunction({
  name: 'launchIndividualId',
  entry: './handler.ts',
  timeoutSeconds: 900,
  runtime: 20,
  memoryMB: 2048,
});
