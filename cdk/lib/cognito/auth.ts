import { Construct } from 'constructs'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import {createAddUserPostConfirmation} from '../lambdas/postConfirmation/construct'
import { envNameContext } from '../../cdk.context'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as cdk from 'aws-cdk-lib'
import { RemovalPolicy } from 'aws-cdk-lib'

import {
  IdentityPool,
  UserPoolAuthenticationProvider,
  } from "@aws-cdk/aws-cognito-identitypool-alpha";

type UserPoolProps = {
    appName: string
    env: envNameContext
//    addUserPostConfirmation: NodejsFunction
}


export function createUserPool(
    scope: Construct,
    props: UserPoolProps
) {
  const stackName = `${props.appName}-cognitostack-${props.env}`
  const cognitoStack = new cdk.Stack(scope,stackName,{
    crossRegionReferences:true,
    env:{region:'eu-west-2'}})

  let addUserFunc = createAddUserPostConfirmation(cognitoStack, {
    appName: props.appName,
    env: props.env})    
  
// the L2 Construct for a userpool
  const userPool = new cognito.UserPool(cognitoStack, `${props.appName}-${props.env}-userpool`, {
  userPoolName: `${props.appName}-${props.env}-userpool`,
  removalPolicy: props.env === 'develop' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
  selfSignUpEnabled: true,
  autoVerify:{
    email: true
  },
  accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
  userVerification: {
    emailStyle: cognito.VerificationEmailStyle.CODE,
  },
  standardAttributes: {
    email: {
      required: true,
      mutable: true,
    },
  },
  lambdaTriggers:{
    postConfirmation:addUserFunc
  }
})

addUserFunc.addPermission('PermitCognitoInvocation', {
  principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com',{region:userPool.env.region}),
  sourceArn: userPool.userPoolArn
});


const userPoolClient = new cognito.UserPoolClient(
  cognitoStack,
  `${props.appName}-${props.env}-userpoolClient`,
  { userPool }
)

// const authRole = new iam.Role(cognitoStack, 'AuthRole', {
//   roleName: 'authRole',
//   assumedBy: new iam.ServicePrincipal('cognito-idp.amazonaws.com')
// });    

// const unauthRole = new iam.Role(cognitoStack, 'UnAuthRole', {
//   roleName: 'unauthRole',
//   assumedBy: new iam.ServicePrincipal('cognito-idp.amazonaws.com')
// });    

const identityPool = new IdentityPool(
  cognitoStack,
  `${props.appName}-${props.env}-identityPool`,
  {
    identityPoolName: `${props.appName}-${props.env}-IdentityPool`,
    allowUnauthenticatedIdentities: false,
    authenticationProviders: {
      userPools: [
        new UserPoolAuthenticationProvider({
          userPool: userPool,
          userPoolClient: userPoolClient,
        }),
      ],
    },
  }
)

/* Create roles for members of the Admin and annotator groups respectively */

// const adminRole = new iam.Role(cognitoStack, 'AdminRole', {
//   roleName: cdk.PhysicalName.GENERATE_IF_NEEDED,
//   assumedBy: new iam.ServicePrincipal('cognito-idp.amazonaws.com')
// });    

// const annotatorRole = new iam.Role(cognitoStack, 'AnnotatorRole', {
//   roleName: cdk.PhysicalName.GENERATE_IF_NEEDED,
//   assumedBy: new iam.ServicePrincipal('cognito-idp.amazonaws.com')
// });    

const adminGroup = new cognito.CfnUserPoolGroup(cognitoStack, "AdminsGroup", {
  groupName: "admin",
  userPoolId: userPool.userPoolId,
  precedence: 10,
  //roleArn: adminRole.roleArn
});

const annotatorsGroup = new cognito.CfnUserPoolGroup(cognitoStack, "AnnotatorsGroup", {
  groupName: "annotator",
  userPoolId: userPool.userPoolId,
  precedence: 20,
  //roleArn: annotatorRole.roleArn
});

userPool.grant(identityPool.authenticatedRole,'cognito-idp:AdminAddUserToGroup')
userPool.grant(identityPool.authenticatedRole,'cognito-idp:AdminRemoveUserFromGroup')
// const cfnUserPoolUser = new cognito.CfnUserPoolUser(cognitoStack, 'MyCfnUserPoolUser', {
//   userPoolId: userPool.userPoolId,
//   userAttributes: [      
//   { name: 'email', value: 'naude.jj@gmail.com' },
//   { name: 'email_verified', value: 'true' },
//   { name: 'name', value: 'Hannes Naudé' },
// ],
//   username: 'admin'
// });

new cdk.CfnOutput(cognitoStack, "UserPoolId", {
  value: userPool.userPoolId,
});
new cdk.CfnOutput(cognitoStack, "Cognitoregion", {
  value: userPool.env.region,
});
new cdk.CfnOutput(cognitoStack, "UserPoolClientId", {
  value: userPoolClient.userPoolClientId,
});
new cdk.CfnOutput(cognitoStack, "IdentityPoolId", {
  value: identityPool.identityPoolId,
});    


return {userPool, userPoolClient, identityPool,addUserFunc}
}