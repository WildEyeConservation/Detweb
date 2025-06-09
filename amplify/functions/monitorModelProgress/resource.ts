import { defineFunction } from '@aws-amplify/backend';

export const monitorModelProgress = defineFunction({
  name: 'monitorModelProgress',
  schedule: 'every 10m',
  timeoutSeconds: 600,
});