// addToDb from './add-to-db'
import fetch, { Request } from "node-fetch";
import { PostConfirmationConfirmSignUpTriggerEvent } from "aws-lambda";
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const addToGroup = async (event: PostConfirmationConfirmSignUpTriggerEvent) => {
  const cognitoIdentityServiceProvider = new CognitoIdentityProviderClient({});
  const addUserParams = {
    GroupName: process.env.GROUP,
    UserPoolId: event.userPoolId,
    Username: event.userName,
  };
  await cognitoIdentityServiceProvider.send(
    new AdminAddUserToGroupCommand(addUserParams),
  );
  return event;
};

const GRAPHQL_ENDPOINT = process.env.API_DETWEB_GRAPHQLAPIENDPOINTOUTPUT;
const GRAPHQL_API_KEY = process.env.API_DETWEB_GRAPHQLAPIKEYOUTPUT;

const addToDb = async (event: PostConfirmationConfirmSignUpTriggerEvent) => {
  console.log(`EVENT: ${JSON.stringify(event)}`);
  const query = /* GraphQL */ `
    mutation CREATE_USER($input: CreateUserInput!) {
      createUser(input: $input) {
        id
        name
        email
      }
    }
  `;
  const variables = {
    input: {
      id: event.userName,
      name: event.request.userAttributes.name,
      email: event.request.userAttributes.email,
    },
  };

  /** @type {import('node-fetch').RequestInit} */

  const options = {
    method: "POST",
    headers: {
      "x-api-key": GRAPHQL_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  };
  const request = new Request(GRAPHQL_ENDPOINT, options);

  let statusCode = 200;
  let body;
  let response;
  try {
    response = await fetch(request);
    body = await response.json();
    if (body.errors) statusCode = 400;
  } catch (error) {
    statusCode = 400;
    body = {
      errors: [
        {
          status: response.status,
          message: error.message,
          stack: error.stack,
        },
      ],
    };
  }

  return {
    statusCode,
    body: JSON.stringify(body),
  };
};

exports.handler = async (event: PostConfirmationConfirmSignUpTriggerEvent) => {
  await addToGroup(event);
  console.log(await addToDb(event));
  return event;
};
