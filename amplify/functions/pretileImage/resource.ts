import { defineFunction } from '@aws-amplify/backend';

export const pretileImage = defineFunction({
  name: 'pretileImage',
  entry: './handler.mjs',
  runtime: 20,
  timeoutSeconds: 600,
  memoryMB: 3008,
});
