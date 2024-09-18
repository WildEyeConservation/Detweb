import { publish } from './graphql/mutations'
import { Amplify } from "aws-amplify";
import { env } from '$amplify/env/processImages'
import { generateClient } from "aws-amplify/data";

Amplify.configure(
    {
      API: {
        GraphQL: {
          endpoint: env.AMPLIFY_DATA_GRAPHQL_ENDPOINT,
          region: env.AWS_REGION,
                defaultAuthMode: 'apiKey',
                apiKey: env.API_KEY
        },
      },
    },
    {
      Auth: {
        credentialsProvider: {
          getCredentialsAndIdentityId: async () => ({
            credentials: {
              accessKeyId: env.AWS_ACCESS_KEY_ID,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
              sessionToken: env.AWS_SESSION_TOKEN,
            },
          }),
          clearCredentialsAndIdentityId: () => {
            /* noop */
          },
        },
      },
    }
);
  
const client = generateClient({
    authMode: "apiKey",
  });

export const handler = async (event, context) => {
    try {
        const result = await client.graphql({
            query: publish,
            variables: {
                channelName: "test",
                content: "test",
            }
        });
        console.log('Publish result:', result);
        return 'Success';
      } catch (error) {
        console.error('Error publishing:', error);
        throw error; }
};