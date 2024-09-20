import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as rds from 'aws-cdk-lib/aws-rds';
import { AutoProcessor } from "./autoProcessor";
import { EC2QueueProcessor } from './ec2QueueProcessor';


import { Construct } from "constructs";
import { AmplifyGraphqlApi } from "@aws-amplify/graphql-api-construct";
import * as sts from "@aws-sdk/client-sts";
import { BackendAuth } from "@aws-amplify/backend-auth";
import { Backend } from "@aws-amplify/backend";
import { ConstructFactory, FunctionResources, ResourceAccessAcceptorFactory, ResourceProvider, BackendSecret } from '@aws-amplify/plugin-types';

export type AddEnvironmentFactory = {
  addEnvironment: (key: string, value: string | BackendSecret) => void;
};


export const createDetwebResources=function(scope: Construct, backend : Backend<{
  auth: ConstructFactory<BackendAuth>;
  data: ConstructFactory<AmplifyGraphqlApi>;
  addUserToGroup: ConstructFactory<ResourceProvider<FunctionResources> & ResourceAccessAcceptorFactory & AddEnvironmentFactory>;
}>,
devUserArn: string) {
  const authenticatedRole = backend.auth.resources.authenticatedUserIamRole
  
  // // Give our function permission to add an item to a group
  // addUserFunc.addToRolePolicy(
  //   new iam.PolicyStatement({
  //     effect: iam.Effect.ALLOW,
  //     actions: ["cognito-idp:AdminAddUserToGroup"],
  //     resources: ["*"],
  //   }),
  // );

  // addUserFunc.addPermission("PermitCognitoInvocation", {
  //   principal: new iam.ServicePrincipal("cognito-idp.amazonaws.com", {
  //     region: auth.resources.userPool.env.region,
  //   }),
  //   sourceArn: auth.resources.userPool.userPoolArn,
  // });


  backend.auth.resources.userPool.grant(
    authenticatedRole,
    "cognito-idp:AdminAddUserToGroup",
  );
  backend.auth.resources.userPool.grant(
    authenticatedRole,
    "cognito-idp:AdminRemoveUserFromGroup",
  );

    // Create a Role for the hanlde upload Lambda to use.
    const uploadLambdaRole = new iam.Role(scope, "LambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });
  
    const subsampleLambdaRole = new iam.Role(scope, "SubsampleLambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    // Create a Task Role
    const ecsTaskRole = new iam.Role(scope, "EcsTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    const gpuWorkerRole = iam.Role.fromRoleArn(
      scope,
      "gpuRole",
      "arn:aws:iam::275736403632:role/gpuWorkerRole",
    );

    //  const adminEmail = "noone@nowhere.com";
    //  const adminTempPassword = "adminTempPassword$%3445";
    //  const adminName = "Admin";


  const vpc = new ec2.Vpc(scope, "my-cdk-vpc");
  const sg = new ec2.SecurityGroup(scope, "instanceSg", { vpc });
  // Create a new VPC for the Aurora cluster

  // Create the Aurora MySQL Serverless v2 cluster
// Create the serverless cluster, provide all values needed to customise the database.
const cluster = new rds.DatabaseCluster(scope, 'AuroraClusterV2', {
  engine: rds.DatabaseClusterEngine.auroraMysql({ version: rds.AuroraMysqlEngineVersion.VER_3_07_1 }),
  credentials: { username: 'clusteradmin' },
  clusterIdentifier: 'db-endpoint-test',
  writer: rds.ClusterInstance.serverlessV2('writer'),
  serverlessV2MinCapacity: 2,
  serverlessV2MaxCapacity: 10,
  vpc,
  defaultDatabaseName: 'demos',
  enableDataApi: true,  // has to be set to true to enable Data API as not enable by default
});

  // // Create outputs for the database information
  // new CfnOutput(scope, 'AuroraClusterEndpoint', {
  //   value: cluster.clusterEndpoint.socketAddress,
  //   description: 'Aurora Cluster Endpoint',
  // });

  // new CfnOutput(scope, 'AuroraClusterReadEndpoint', {
  //   value: cluster.clusterReadEndpoint.socketAddress,
  //   description: 'Aurora Cluster Read Endpoint',
  // });

  // new CfnOutput(scope, 'AuroraClusterSecretArn', {
  //   value: cluster.secret?.secretArn || 'Secret not available',
  //   description: 'Aurora Cluster Secret ARN',
  // });


    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3306));
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));

    ecsTaskRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSAppSyncInvokeFullAccess"),
    );
  
    const pointFinderAutoProcessor = new AutoProcessor(scope, "CpuAutoProcessor",
      {
        vpc,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
        ecsImage: ecs.ContainerImage.fromAsset("containerImages/pointFinderImage"),
        ecsTaskRole,
        environment: {
          //API_ENDPOINT: backend.data.resources.cfnResources.cfnGraphqlApi.attrGraphQlUrl,
          //API_KEY: backend.data.apiKey || ""
        },
        machineImage: ecs.EcsOptimizedImage.amazonLinux2()
      })

    //Grant my ECS containers access to my Appsync API
    // gpuAutoScalingGroup.role.addManagedPolicy(
    //   iam.ManagedPolicy.fromAwsManagedPolicyName("AWSAppSyncInvokeFullAccess"),
    // );
    pointFinderAutoProcessor.asg.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSAppSyncInvokeFullAccess"),
    );

    const lightGlueAutoProcessor = new AutoProcessor(scope, "GpuAutoProcessor",
      {
        vpc,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.G4DN, ec2.InstanceSize.XLARGE),
        ecsImage: ecs.ContainerImage.fromAsset("containerImages/lightGlueImage"),
        ecsTaskRole,
        memoryLimitMiB: 1024 * 12,
        gpuCount: 1,
        environment: {
          //API_ENDPOINT: backend.data.graphqlUrl,
          //API_KEY: backend.data.apiKey || ""
        },
        machineImage: ecs.EcsOptimizedImage.amazonLinux2(ecs.AmiHardwareType.GPU)
      })

    //Grant my ECS containers access to my Appsync API
    // gpuAutoScalingGroup.role.addManagedPolicy(
    //   iam.ManagedPolicy.fromAwsManagedPolicyName("AWSAppSyncInvokeFullAccess"),
    // );
    lightGlueAutoProcessor.asg.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSAppSyncInvokeFullAccess"),
    );


    pointFinderAutoProcessor.queue.grantConsumeMessages(ecsTaskRole);
    pointFinderAutoProcessor.queue.grantSendMessages(authenticatedRole);
    lightGlueAutoProcessor.queue.grantConsumeMessages(ecsTaskRole);
    lightGlueAutoProcessor.queue.grantSendMessages(authenticatedRole);
  
  
  ;
  //const devRole = iam.Role.fromRoleArn(scope, "DevRole", devUserArn);

  // Grant the devuser permission to assume the Subsample Lambda role
  // devRole.attachInlinePolicy(new iam.Policy(scope, 'AssumeRolePolicy', {
  //   statements: [new iam.PolicyStatement({
  //     actions: ['sts:AssumeRole'],
  //     resources: [subsampleLambdaRole.roleArn],
  //   })],
  // }));
  
    const sqsCreateQueueStatement = new iam.PolicyStatement({
      actions: [
        "sqs:CreateQueue",
        "sqs:PurgeQueue",
        "sqs:SendMessage",
        "sqs:DeleteQueue",
        "sqs:GetQueueAttributes",
        "sqs:GetQueueUrl",
      ],
      resources: ["*"],
    });
    const sqsConsumeQueueStatement = new iam.PolicyStatement({
      actions: [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:GetQueueUrl",
        "sqs:ChangeMessageVisibility",
      ],
      resources: ["*"],
    });
    const cognitoAdmin = new iam.PolicyStatement({
      actions: [
        "cognito-idp:AdminRemoveUserFromGroup",
        "cognito-idp:AdminAddUserToGroup",
      ],
      resources: ["*"],
    });
    const lambdaInvoke = new iam.PolicyStatement({
      actions: ["lambda:InvokeFunction"],
      resources: ["*"],
    });

    authenticatedRole.addToPrincipalPolicy(
      sqsCreateQueueStatement,
    );
    authenticatedRole.addToPrincipalPolicy(
      sqsConsumeQueueStatement,
    );
    authenticatedRole.addToPrincipalPolicy(
      cognitoAdmin,
    );
    authenticatedRole.addToPrincipalPolicy(
      lambdaInvoke,
    );
  const processor = new EC2QueueProcessor(scope, 'MyProcessor', {
    vpc: vpc, // Your VPC
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.G4DN, ec2.InstanceSize.XLARGE), // Or any instance type you prefer
    amiId: 'ami-01692ebb92628b00c', // Your AMI ID
    keyName: 'detwebTest', // Optional: Your EC2 key pair name
  });

  
  return {
    processTaskQueueUrl: processor.queue.queueUrl,
    auroraClusterEndpoint: cluster.clusterEndpoint.socketAddress,
    auroraClusterReadEndpoint: cluster.clusterReadEndpoint.socketAddress,
    auroraClusterSecretArn: cluster.secret?.secretArn || 'Secret not available',  
  };

}
