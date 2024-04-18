const fetch = require('node-fetch').default;
const Request = require('node-fetch').Request;

const GRAPHQL_ENDPOINT = process.env.API_DETWEB_GRAPHQLAPIENDPOINTOUTPUT;
const GRAPHQL_API_KEY = process.env.API_DETWEB_GRAPHQLAPIKEYOUTPUT;

const query = /* GraphQL */ `
mutation CREATE_USER($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      name
      email
    }
  }
`;


/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
  console.log(`EVENT: ${JSON.stringify(event)}`);
  const variables = {
    input: {
      id: event.userName,
      name: event.request.userAttributes.name,
      email: event.request.userAttributes.email, 
    }
  }; 

  /** @type {import('node-fetch').RequestInit} */
  const options = {
    method: 'POST',
    headers: {
      'x-api-key': GRAPHQL_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
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
          stack: error.stack
        }
      ]
    };
  }

  return {
    statusCode,
    body: JSON.stringify(body)
  };
};
