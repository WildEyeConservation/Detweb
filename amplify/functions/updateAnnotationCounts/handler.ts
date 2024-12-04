import type { DynamoDBStreamHandler } from 'aws-lambda';
import { env } from '$amplify/env/updateAnnotationCounts'
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAnnotationSet, getCategory } from './graphql/queries';
import { updateAnnotationSet, updateCategory } from './graphql/mutations';

Amplify.configure(
    {
      API: {
        GraphQL: {
          endpoint: env.AMPLIFY_DATA_GRAPHQL_ENDPOINT,
          region: env.AWS_REGION,
          defaultAuthMode: "iam",
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
    authMode: "iam",
  });

export const handler: DynamoDBStreamHandler = async (event) => {
    for (const record of event.Records) {
        if (record.eventName === 'INSERT' || record.eventName === 'REMOVE') {
            const incrementValue = record.eventName === 'INSERT' ? 1 : -1;
            const annotationSetId = record.dynamodb?.NewImage?.setId?.S;
            const categoryId = record.dynamodb?.NewImage?.categoryId?.S;

            if (annotationSetId) {
                await updateAnnotationCount('AnnotationSet', annotationSetId, incrementValue);
            }

            if (categoryId) {
                await updateAnnotationCount('Category', categoryId, incrementValue);
            }
        }
    }
};

async function updateAnnotationCount(tableName: string, id: string, incrementValue: number) {
    try {
        let result = 0;
        if (tableName === 'AnnotationSet') {
            const getResponse = await client.graphql({
                query: getAnnotationSet,
                variables: { id }
              });
      
              const current = getResponse.data.getAnnotationSet?.annotationCount || 0;
              const newValue = current + incrementValue;
      
              const updateResponse = await client.graphql({
                query: updateAnnotationSet,
                variables: { input: { id, annotationCount: newValue } }
              });

              result = updateResponse.data.updateAnnotationSet.annotationCount || 0;
        }
        else if (tableName === 'Category') {
            const getResponse = await client.graphql({
                query: getCategory,
                variables: { id }
              });
      
              const current = getResponse.data.getCategory?.annotationCount || 0;
              const newValue = current + incrementValue;
      
              const updateResponse = await client.graphql({
                query: updateCategory,
                variables: { input: { id, annotationCount: newValue } }
              });

              result = updateResponse.data.updateCategory.annotationCount || 0;
        }
        console.log(`${tableName} update succeeded - annotation count: `, JSON.stringify(result, null, 2));
    } catch (error) {
        console.error(`Unable to update ${tableName}. Error JSON:`, JSON.stringify(error, null, 2));
    }
}
