import { defineFunction } from '@aws-amplify/backend';

export const revokeChainShare = defineFunction({
  name: 'revokeChainShare',
  timeoutSeconds: 900,
  entry: './handler.ts',
  runtime: 20,
});
