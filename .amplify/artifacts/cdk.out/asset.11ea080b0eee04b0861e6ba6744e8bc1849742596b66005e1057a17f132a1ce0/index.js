"use strict";

// cdk/lib/lambdas/postDeploy/main.ts
var import_client_cognito_identity_provider = require("@aws-sdk/client-cognito-identity-provider");
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_client_lambda = require("@aws-sdk/client-lambda");
exports.handler = async (event) => {
  const cognitoClient = new import_client_cognito_identity_provider.CognitoIdentityProviderClient({ region: process.env.COGNITO_REGION });
  const dynamoClient = new import_client_dynamodb.DynamoDBClient();
  const lambdaClient = new import_client_lambda.LambdaClient({ region: process.env.COGNITO_REGION });
  try {
    const userPoolId = process.env.USER_POOL_ID;
    const name = process.env.ADMIN_NAME;
    const username = process.env.ADMIN_EMAIL;
    const email = process.env.ADMIN_EMAIL;
    const temporaryPassword = process.env.ADMIN_TEMP_PASSWORD;
    const apiId = process.env.API_ID;
    if (!username || !email || !temporaryPassword) {
      throw new Error("Username, email, and temporary password must be defined");
    }
    let userExists = false;
    try {
      await cognitoClient.send(new import_client_cognito_identity_provider.AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: username
      }));
      userExists = true;
    } catch (error) {
      if (error.name === "UserNotFoundException") {
        userExists = false;
      } else {
        throw error;
      }
    }
    if (!userExists) {
      await cognitoClient.send(new import_client_cognito_identity_provider.AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: username,
        UserAttributes: [{ Name: "email", Value: email }],
        MessageAction: "SUPPRESS",
        TemporaryPassword: temporaryPassword
      }));
      await cognitoClient.send(new import_client_cognito_identity_provider.AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: username,
        GroupName: "admin"
      }));
      console.log(`User ${username} created and added to the admin group.`);
    } else {
      console.log(`User ${username} already exists. Skipping creation.`);
    }
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const key = { id: { S: username } };
    const expressionAttributeNames = {
      "#N": "name",
      "#EM": "email",
      "#A": "isAdmin",
      "#C": "createdAt",
      "#U": "updatedAt"
    };
    const expressionAttributeValues = {
      ":n": { S: name },
      ":e": { S: email },
      ":a": { BOOL: true },
      ":c": { S: createdAt }
    };
    const updateExpression = "SET #N = :n, #A = :a, #EM = :e, #U = :c, #C = :c";
    await dynamoClient.send(new import_client_dynamodb.UpdateItemCommand({
      TableName: process.env.USER_TABLE,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    }));
    await lambdaClient.send(new import_client_lambda.UpdateFunctionConfigurationCommand({
      FunctionName: process.env.LAMBDANAME,
      Environment: {
        Variables: {
          GROUP: "annotator",
          API_DETWEB_GRAPHQLAPIENDPOINTOUTPUT: process.env.API_DETWEB_GRAPHQLAPIENDPOINTOUTPUT,
          API_DETWEB_GRAPHQLAPIKEYOUTPUT: process.env.API_DETWEB_GRAPHQLAPIKEYOUTPUT
        }
      }
    }));
  } catch (error) {
    console.error("Error during post-deploy execution:", error);
  }
};
