import { defineFunction } from '@aws-amplify/backend';

export const manageOrgMembership = defineFunction({
  name: 'manageOrgMembership',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 30,
});
