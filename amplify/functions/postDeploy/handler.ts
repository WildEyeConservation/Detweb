import { LambdaClient, UpdateFunctionConfigurationCommand } from "@aws-sdk/client-lambda";
import { env } from '$amplify/env/postDeploy'

exports.handler = async () => {

  // const lambdaClient = new LambdaClient({ region: env.AWS_REGION });
  // try {
  //   await lambdaClient.send(new UpdateFunctionConfigurationCommand({
  //     FunctionName: env.LAMBDA_NAME || "",
  //     Environment: {
  //       Variables: {
  //         API_KEY: env.API_KEY || "",
  //         AMPLIFY_DATA_GRAPHQL_ENDPOINT: env.AMPLIFY_DATA_GRAPHQL_ENDPOINT || "",
  //       },
  //     },
  //   }));

  // } catch (error) {
  //   console.error("Error during post-deploy execution:", error);
  // }
};
