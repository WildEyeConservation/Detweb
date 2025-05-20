const { DynamoDBClient, ScanCommand, BatchWriteItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const fs = require('fs');

// Read the configuration files
const prodConfig = JSON.parse(fs.readFileSync('amplify_outputs.prod.json', 'utf8'));
const targetConfig = JSON.parse(fs.readFileSync('amplify_outputs.json', 'utf8'));

// Set up DynamoDB clients for source and target
const sourceDynamoDB = new DynamoDBClient({ region: prodConfig.data.aws_region });
const targetDynamoDB = new DynamoDBClient({ region: targetConfig.data.aws_region });

// Get the list of tables from the data schema
const tables = Object.keys(prodConfig.data.model_introspection.models);

async function copyTable(tableName) {
  console.log(`Copying table: ${tableName}`);

  let items = [];
  let lastEvaluatedKey = undefined;

  do {
    const scanParams = {
      TableName: `${tableName}-${prodConfig.data.api_key.slice(0, 13)}-${prodConfig.data.default_authorization_type}`,
      ExclusiveStartKey: lastEvaluatedKey
    };

    const scanCommand = new ScanCommand(scanParams);
    const scanResponse = await sourceDynamoDB.send(scanCommand);

    items = items.concat(scanResponse.Items.map(item => unmarshall(item)));
    lastEvaluatedKey = scanResponse.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  // Write items to target table
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    const writeParams = {
      RequestItems: {
        [`${tableName}-${targetConfig.data.api_key.slice(0, 13)}-${targetConfig.data.default_authorization_type}`]: batch.map(item => ({
          PutRequest: {
            Item: marshall(item)
          }
        }))
      }
    };

    const batchWriteCommand = new BatchWriteItemCommand(writeParams);
    await targetDynamoDB.send(batchWriteCommand);
  }

  console.log(`Finished copying table: ${tableName}`);
}

async function copyAllTables() {
  for (const table of tables) {
    await copyTable(table);
  }
  console.log("All tables copied successfully!");
}

copyAllTables().catch(console.error);