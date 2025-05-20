import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: { annotationSetId: string }) => {
  const { annotationSetId } = event;
  const tableName = process.env.ANNOTATION_TABLE_NAME;

  if (!tableName) {
    throw new Error('ANNOTATION_TABLE_NAME environment variable is not set');
  }

  try {
    const categoryCounts: { [categoryId: string]: number } = {};
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
      const command = new QueryCommand({
        TableName: tableName,
        IndexName: 'annotationsByAnnotationSetId',
        KeyConditionExpression: 'setId = :setId',
        ExpressionAttributeValues: {
          ':setId': annotationSetId
        },
        ExclusiveStartKey: lastEvaluatedKey
      });

      const response = await docClient.send(command);

      response.Items?.forEach(item => {
        const categoryId = item.categoryId;
        categoryCounts[categoryId] = (categoryCounts[categoryId] || 0) + 1;
      });

      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return {
      statusCode: 200,
      body: JSON.stringify(categoryCounts)
    };
  } catch (error) {
    console.error('Error querying DynamoDB:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' })
    };
  }
};