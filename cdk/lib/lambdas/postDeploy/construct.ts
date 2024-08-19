import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import path = require("path");
import { envNameContext } from "../../../cdk.context";
import * as triggers from "aws-cdk-lib/triggers";
import * as iam from "aws-cdk-lib/aws-iam"; 
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { Stack } from "aws-cdk-lib";

type postDeployProps = {
  appName: string;
  env: envNameContext;
  lambdaName: string;
  graphqlEndpoint: string;
  graphqlApiKey: string;
  cognitoRegion: string;
  adminName: string;
  adminUsername: string; 
  adminEmail: string; 
  adminTempPassword: string;
  apiId: string;
  dynamoDbRegion: string;
};

export const createPostDeployLambda = (
  scope: Construct,
  props: postDeployProps,
  userPoolId: string,
  dynamoTableName: string,
) => {
  const timestamp = new Date().toISOString();
  const postDeployLambda = new NodejsFunction(scope, "postDeployFunc", {
    functionName: `${props.appName}-${props.env}-postDeployFunc`,
    runtime: Runtime.NODEJS_18_X,
    handler: "handler",
    entry: path.join(__dirname, `./main.ts`),
    environment: {
      COGNITO_REGION: props.cognitoRegion,
      LAMBDANAME: props.lambdaName,
      API_DETWEB_GRAPHQLAPIENDPOINTOUTPUT: props.graphqlEndpoint,
      API_DETWEB_GRAPHQLAPIKEYOUTPUT: props.graphqlApiKey,
      USER_POOL_ID: userPoolId,
      DYNAMODB_TABLE_NAME: dynamoTableName,
      ADMIN_NAME: props.adminName,
      ADMIN_USERNAME: props.adminUsername,
      ADMIN_EMAIL: props.adminEmail,
      ADMIN_TEMP_PASSWORD: props.adminTempPassword,
      DYNAMODB_REGION: props.dynamoDbRegion,
      API_ID: props.apiId,
      FORCE_DEPLOY: "true",
      DEPLOYMENT_TIMESTAMP: timestamp,
    },
  });
  const postDeployPermissionPolicy = new iam.PolicyStatement({
    actions: ["lambda:UpdateFunctionConfiguration"],
    resources: [props.lambdaName],
  });

  postDeployLambda.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [
        `arn:aws:dynamodb:${props.dynamoDbRegion}:${Stack.of(scope).account}:table/User-${props.apiId}-NONE`,
      ],
    })
  );
  

  postDeployLambda.addToRolePolicy(
    new iam.PolicyStatement({
      actions: [
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminAddUserToGroup",
        "cognito-idp:AdminGetUser",
      ],
      resources: [`arn:aws:cognito-idp:${props.cognitoRegion}:${Stack.of(scope).account}:userpool/${userPoolId}`],
    })
  );

  postDeployLambda.addToRolePolicy(postDeployPermissionPolicy);
  new triggers.Trigger(scope, "triggerPostDeploy", {
    handler: postDeployLambda,
    invocationType: triggers.InvocationType.EVENT,
    executeOnHandlerChange: true,
  });
  return postDeployLambda;
};
