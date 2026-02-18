import { defineFunction } from '@aws-amplify/backend';

export const removeUserFromOrganization = defineFunction({
  name: 'removeUserFromOrganization',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 60,
});
