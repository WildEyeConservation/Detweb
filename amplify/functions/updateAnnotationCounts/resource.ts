import { defineFunction } from '@aws-amplify/backend';

export const updateAnnotationCounts = defineFunction({
  name: 'updateAnnotationCounts',
  entry: './handler.ts',
  runtime: 20,
});