import { defineFunction } from '@aws-amplify/backend';

export const updateOrganizationMemberAdmin = defineFunction({
  name: 'updateOrganizationMemberAdmin',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 60,
});
