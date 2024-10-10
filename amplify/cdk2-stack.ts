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
}>) {
  
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



    // Create a Task Role
    const ecsTaskRole = new iam.Role(scope, "EcsTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    //  const adminEmail = "noone@nowhere.com";
    //  const adminTempPassword = "adminTempPassword$%3445";
    //  const adminName = "Admin";


  const vpc = new ec2.Vpc(scope, "my-cdk-vpc");
  // const sg = new ec2.SecurityGroup(scope, "instanceSg", { vpc });
  //   sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));
  //   sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3306));
  //   sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));

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
          API_ENDPOINT: backend.data.graphqlUrl,
          API_KEY: backend.data.apiKey || ""
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
          API_ENDPOINT: backend.data.graphqlUrl,
          API_KEY: backend.data.apiKey || ""
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
  
  ;
  //const devRole = iam.Role.fromRoleArn(scope, "DevRole", devUserArn);

  // Grant the devuser permission to assume the Subsample Lambda role
  // devRole.attachInlinePolicy(new iam.Policy(scope, 'AssumeRolePolicy', {
  //   statements: [new iam.PolicyStatement({
  //     actions: ['sts:AssumeRole'],
  //     resources: [subsampleLambdaRole.roleArn],
  //   })],
  // }));
  
  const processor = new EC2QueueProcessor(scope, 'MyProcessor', {
    vpc: vpc, // Your VPC
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.G4DN, ec2.InstanceSize.XLARGE), // Or any instance type you prefer
    amiId: 'ami-0d8f73689282bd592', // Your AMI ID
    keyName: 'phindulo', // Optional: Your EC2 key pair name
  });

  
  return {
    processTaskQueueUrl: processor.queue.queueUrl,
    pointFinderTaskQueueUrl: pointFinderAutoProcessor.queue.queueUrl,
    //auroraClusterEndpoint: cluster.clusterEndpoint.socketAddress,
    //auroraClusterReadEndpoint: cluster.clusterReadEndpoint.socketAddress,
    //auroraClusterSecretArn: cluster.secret?.secretArn || 'Secret not available',  
  };

}
