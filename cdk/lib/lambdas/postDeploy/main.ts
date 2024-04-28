import {
  LambdaClient,
  UpdateFunctionConfigurationCommand,
} from "@aws-sdk/client-lambda"; // ES Modules import
/**
 *
 * @param {LambdaEvent} event
 */
exports.handler = async (event) => {
  const client = new LambdaClient({ region: process.env.COGNITO_REGION });
  const response = await client.send(
    new UpdateFunctionConfigurationCommand({
      FunctionName: process.env.LAMBDANAME,
      Environment: {
        Variables: {
          GROUP: "annotator",
          API_DETWEB_GRAPHQLAPIENDPOINTOUTPUT:
            process.env.API_DETWEB_GRAPHQLAPIENDPOINTOUTPUT,
          API_DETWEB_GRAPHQLAPIKEYOUTPUT:
            process.env.API_DETWEB_GRAPHQLAPIKEYOUTPUT,
        },
      },
    }),
  );
};
