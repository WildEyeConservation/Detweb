import { defineFunction } from '@aws-amplify/backend';

export const runPointFinder = defineFunction({
  name: 'runPointFinder',
  timeoutSeconds: 900,
});