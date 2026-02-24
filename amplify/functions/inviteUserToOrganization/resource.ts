import { defineFunction } from '@aws-amplify/backend';

export const inviteUserToOrganization = defineFunction({
  name: 'inviteUserToOrganization',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 60,
});
