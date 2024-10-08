"use strict";

// cdk/lib/lambdas/postDeploy/main.ts
var import_client_lambda = require("@aws-sdk/client-lambda");
exports.handler = async () => {
  const lambdaClient = new import_client_lambda.LambdaClient({ region: process.env.COGNITO_REGION });
  try {
    await lambdaClient.send(new import_client_lambda.UpdateFunctionConfigurationCommand({
      FunctionName: process.env.LAMBDANAME || "",
      Environment: {
        Variables: {
          GROUP: "annotator",
          API_DETWEB_GRAPHQLAPIENDPOINTOUTPUT: process.env.API_DETWEB_GRAPHQLAPIENDPOINTOUTPUT || "",
          API_DETWEB_GRAPHQLAPIKEYOUTPUT: process.env.API_DETWEB_GRAPHQLAPIKEYOUTPUT || ""
        }
      }
    }));
  } catch (error) {
    console.error("Error during post-deploy execution:", error);
  }
};
