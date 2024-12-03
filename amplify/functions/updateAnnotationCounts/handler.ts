import { DynamoDB } from 'aws-sdk';
import type { DynamoDBStreamHandler } from 'aws-lambda';
import { env } from '$amplify/env/updateAnnotationCounts'
import { Amplify } from "aws-amplify";

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

const dynamoDB = new DynamoDB.DocumentClient();

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
    const params = {
        TableName: tableName,
        Key: { id },
        UpdateExpression: 'SET #attrName = #attrName + :incrementValue',
        ExpressionAttributeNames: { '#attrName': 'annotationCount' },
        ExpressionAttributeValues: { ':incrementValue': incrementValue },
        ReturnValues: 'UPDATED_NEW'
    };

    try {
        const result = await dynamoDB.update(params).promise();
        console.log(`${tableName} update succeeded:`, JSON.stringify(result, null, 2));
    } catch (error) {
        console.error(`Unable to update ${tableName}. Error JSON:`, JSON.stringify(error, null, 2));
    }
}
