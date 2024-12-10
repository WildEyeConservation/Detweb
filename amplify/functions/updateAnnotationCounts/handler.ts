import type { DynamoDBStreamHandler } from 'aws-lambda';
import { env } from '$amplify/env/updateAnnotationCounts'
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAnnotationCountPerCategoryPerSet, getAnnotationSet, getCategory } from './graphql/queries';
import { updateAnnotationCountPerCategoryPerSet, updateAnnotationSet, updateCategory } from './graphql/mutations';

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
            const image = record.eventName === 'INSERT' ? record.dynamodb?.NewImage : record.dynamodb?.OldImage;
            const annotationSetId = image?.setId?.S;
            const categoryId = image?.categoryId?.S;

            if (annotationSetId && categoryId) {
                await updateAnnotationCount('AnnotationSet', annotationSetId, categoryId, incrementValue);
                await updateAnnotationCount('Category', annotationSetId, categoryId, incrementValue);
            }
        }

        if (record.eventName === 'MODIFY') {
            const oldCategoryId = record.dynamodb?.OldImage?.categoryId?.S;
            const newCategoryId = record.dynamodb?.NewImage?.categoryId?.S;
            const annotationSetId = record.dynamodb?.NewImage?.setId?.S;

            if (oldCategoryId && newCategoryId && annotationSetId) {
                await swapAnnotationCategory(oldCategoryId, newCategoryId, annotationSetId);
            }
        }
    }
};

async function swapAnnotationCategory(oldCategoryId: string, newCategoryId: string, annotationSetId: string) {
    await updateAnnotationCount('Category', annotationSetId, newCategoryId, 1);
    await updateAnnotationCount('Category', annotationSetId, oldCategoryId, -1);
}

async function updateAnnotationCount(tableName: string, annotationSetId: string, categoryId: string, incrementValue: number) {
    try {
        let result = 0;
        if (tableName === 'AnnotationSet') {
            const getResponse = await client.graphql({
                query: getAnnotationSet,
                variables: { id: annotationSetId }
              });
      
              const current = Math.max(getResponse.data.getAnnotationSet?.annotationCount || 0, 0);
              const newValue = current + incrementValue;
      
              const updateResponse = await client.graphql({
                query: updateAnnotationSet,
                variables: { input: { id: annotationSetId, annotationCount: newValue } }
              });

              await updateCountPerCategoryPerSet(annotationSetId, categoryId, incrementValue);

              result = updateResponse.data.updateAnnotationSet.annotationCount || 0;
        }
        else if (tableName === 'Category') {
            const getResponse = await client.graphql({
                query: getCategory,
                variables: { id: categoryId }
              });
      
              const current = Math.max(getResponse.data.getCategory?.annotationCount || 0, 0);
              const newValue = current + incrementValue;
      
              const updateResponse = await client.graphql({
                query: updateCategory,
                variables: { input: { id: categoryId, annotationCount: newValue } }
              });

              await updateCountPerCategoryPerSet(annotationSetId, categoryId, incrementValue);

              result = updateResponse.data.updateCategory.annotationCount || 0;
        }
        console.log(`${tableName} update succeeded - annotation count: `, JSON.stringify(result, null, 2));
    } catch (error) {
        console.error(`Unable to update ${tableName}. Error JSON:`, JSON.stringify(error, null, 2));
    }
}

async function updateCountPerCategoryPerSet(annotationSetId: string, categoryId: string, incrementValue: number) {
  try {
    const getResponse = await client.graphql({
        query: getAnnotationCountPerCategoryPerSet,
        variables: { annotationSetId, categoryId }
      });

    const current = Math.max(getResponse.data.getAnnotationCountPerCategoryPerSet?.annotationCount || 0, 0);
    const newValue = current + incrementValue;

    const updateResponse = await client.graphql({
        query: updateAnnotationCountPerCategoryPerSet,
        variables: { input: { annotationSetId, categoryId, annotationCount: newValue } }
      });

    console.log(`Annotation set (${annotationSetId}) category (${categoryId}) update succeeded - annotation count: `, JSON.stringify(updateResponse.data.updateAnnotationCountPerCategoryPerSet.annotationCount, null, 2));
  } catch (error) {
    console.error(`Unable to update annotation set (${annotationSetId}) category (${categoryId}). Error JSON:`, JSON.stringify(error, null, 2));
  }
}
