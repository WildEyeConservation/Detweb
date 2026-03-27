import { defineFunction } from '@aws-amplify/backend';

export const launchQCReview = defineFunction({
  name: 'launchQCReview',
  timeoutSeconds: 900,
  runtime: 20,
  memoryMB: 2048,
});
