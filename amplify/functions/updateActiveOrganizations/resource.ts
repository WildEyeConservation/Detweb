import { defineFunction } from '@aws-amplify/backend';

export const updateActiveOrganizations = defineFunction({
  name: 'updateActiveOrganizations',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 60,
});
