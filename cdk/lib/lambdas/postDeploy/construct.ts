import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import path = require('path')
import { envNameContext } from '../../../cdk.context'
import * as triggers from 'aws-cdk-lib/triggers';
import * as iam from 'aws-cdk-lib/aws-iam';
import {UserPool} from 'aws-cdk-lib/aws-cognito';

type postDeployProps = {
    appName: string
    env: envNameContext
    lambdaName: string
    graphqlEndpoint: string
    graphqlApiKey: string
    cognitoRegion: string
}
 

export const createPostDeployLambda = (
    scope: Construct,
    props: postDeployProps
) => {
    const postDeployLambda = new NodejsFunction(scope, 'postDeployFunc', {
        functionName: `${props.appName}-${props.env}-postDeployFunc`,
        runtime: Runtime.NODEJS_18_X,
        handler: 'handler',
        entry: path.join(__dirname, `./main.ts`),
        environment: {
            COGNITO_REGION: props.cognitoRegion,
            LAMBDANAME : props.lambdaName,
            API_DETWEB_GRAPHQLAPIENDPOINTOUTPUT:props.graphqlEndpoint,
            API_DETWEB_GRAPHQLAPIKEYOUTPUT:props.graphqlApiKey
          },
      })
    const postDeployPermissionPolicy = new iam.PolicyStatement({
     actions: ["lambda:UpdateFunctionConfiguration"],
     resources: [props.lambdaName]});
    postDeployLambda.addToRolePolicy(postDeployPermissionPolicy)      
    new triggers.Trigger(scope, 'triggerPostDeploy', {
        handler: postDeployLambda,
        invocationType: triggers.InvocationType.EVENT,
      });
    return postDeployLambda
}