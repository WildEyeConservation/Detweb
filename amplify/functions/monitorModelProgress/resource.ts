import { defineFunction } from '@aws-amplify/backend';

export const monitorModelProgress = defineFunction({
  name: 'monitorModelProgress',
  schedule: 'every 30m',
  timeoutSeconds: 900,
  runtime: 20,
});