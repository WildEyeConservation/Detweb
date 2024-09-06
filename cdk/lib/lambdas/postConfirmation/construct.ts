import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import path = require("path");
import { envNameContext } from "../../../cdk.context";

type AddUserProps = {
  appName: string;
  env: envNameContext;
};

export const createAddUserPostConfirmation = (
  scope: Construct,
  props: AddUserProps,
) => {
  const addUserFunc = new NodejsFunction(scope, "addUserFunc", {
    functionName: `${props.appName}-${props.env}-addUserFunc`,
    runtime: Runtime.NODEJS_18_X,
    handler: "handler",
    entry: path.join(__dirname, `./main.ts`),
  });

  // Give our function permission to add an item to a group
  addUserFunc.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["cognito-idp:AdminAddUserToGroup"],
      resources: ["*"],
    }),
  );

  return addUserFunc;
};
