import { defineFunction } from '@aws-amplify/backend';

export const runPointFinder = defineFunction({
  name: 'runPointFinder',
  timeoutSeconds: 900,
  memoryMB: 1024,
  runtime: 20,
});
