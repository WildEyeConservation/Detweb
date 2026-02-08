import { defineFunction } from '@aws-amplify/backend';

export const customAuthorizer = defineFunction({
  name: 'customAuthorizer',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 10,
});
