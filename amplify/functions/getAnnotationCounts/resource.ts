import { defineFunction } from '@aws-amplify/backend';

export const getAnnotationCounts = defineFunction({
  name: 'getAnnotationCounts',
  runtime: 20,
});