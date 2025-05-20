import { defineFunction,secret } from '@aws-amplify/backend';

export const processImages = defineFunction({
  // optionally specify a name for the Function (defaults to directory name)
  name: 'processImages',
  // optionally specify a path to your handler (defaults to "./handler.ts")
  entry: './handler.ts',
  environment: {
    API_KEY: secret('API_KEY'),
  }
});