import { defineFunction } from '@aws-amplify/backend';

export const runHeatmapper = defineFunction({
  name: 'runHeatmapper',
  timeoutSeconds: 900,
  runtime: 20,
});