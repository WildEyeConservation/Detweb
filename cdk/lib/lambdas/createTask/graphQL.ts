const query = /* GraphQL */ `
  mutation CREATE_TODO($input: CreateTodoInput!) {
    createTodo(input: $input) {
      id
      name
      createdAt
    }
  }
`;


/**

 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}

 */

export const handler = async (event) => {

  console.log(`EVENT: ${JSON.stringify(event)}`);


  const variables = {

    input: {

      name: 'Hello, Todo!'

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