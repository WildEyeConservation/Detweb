import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as rds from 'aws-cdk-lib/aws-rds';
import { AutoProcessor } from "./autoProcessor";
import { EC2QueueProcessor } from './ec2QueueProcessor';
import * as cdk from 'aws-cdk-lib';

import { Construct } from "constructs";
import { AmplifyGraphqlApi } from "@aws-amplify/graphql-api-construct";
import * as sts from "@aws-sdk/client-sts";
import { BackendAuth } from "@aws-amplify/backend-auth";
import { Backend } from "@aws-amplify/backend";
import { ConstructFactory, FunctionResources, ResourceAccessAcceptorFactory, ResourceProvider, BackendSecret } from '@aws-amplify/plugin-types';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

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
    amiId: 'ami-05eb7fc2a936daecb', // Your AMI ID
    keyName: 'phindulo', // Optional: Your EC2 key pair name
  });

  const userInterfaceTaskRole = new iam.Role(scope, "UserInterfaceTaskRole", {
    assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
  });

  userInterfaceTaskRole.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSQSFullAccess")
  );
  userInterfaceTaskRole.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2FullAccess")
  );

  const userInterfaceAutoProcessor = new AutoProcessor(scope, "UserInterfaceProcessor", {
    vpc,
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
    ecsImage: ecs.ContainerImage.fromAsset("containerImages/user_interface"),
    ecsTaskRole: userInterfaceTaskRole,
    environment: {
      API_ENDPOINT: backend.data.graphqlUrl,
      API_KEY: backend.data.apiKey || "",
    },
    machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
  });

  const userInterfaceSG = new ec2.SecurityGroup(scope, "UserInterfaceSG", {
    vpc,
    description: "Allow HTTP traffic to User Interface",
    allowAllOutbound: true,
  });
  userInterfaceSG.addIngressRule(
    ec2.Peer.anyIpv4(),
    ec2.Port.tcp(7861),
    "Allow HTTP traffic on port 7861"
  );

  userInterfaceAutoProcessor.asg.addSecurityGroup(userInterfaceSG);

  const userInterfaceALB = new elbv2.ApplicationLoadBalancer(scope, 'UserInterfaceALB', {
    vpc,
    internetFacing: true,
  });

  const listener = userInterfaceALB.addListener('Listener', {
    port: 80,
    open: true,
  });

  listener.addTargets('UserInterfaceTargets', {
    port: 7861,
    targets: [userInterfaceAutoProcessor.service],
    healthCheck: {
      path: "/health",
      interval: cdk.Duration.seconds(30),
    },
  });

  const scoutbotTaskRole = new iam.Role(scope, "ScoutBotTaskRole", {
    assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
  });

  scoutbotTaskRole.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSQSFullAccess")
  );
  scoutbotTaskRole.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2FullAccess")
  );

  const scoutbotAutoProcessor = new AutoProcessor(scope, "ScoutBotProcessor", {
    vpc,
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
    ecsImage: ecs.ContainerImage.fromAsset("containerImages/scoutbot"),
    ecsTaskRole: scoutbotTaskRole,
    environment: {
      API_ENDPOINT: backend.data.graphqlUrl,
      API_KEY: backend.data.apiKey || ""
    },
    machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
  });

  const scoutbotSG = new ec2.SecurityGroup(scope, "ScoutBotSG", {
    vpc,
    description: "Allow HTTP traffic to ScoutBot",
    allowAllOutbound: true,
  });
  scoutbotSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8080), "Allow HTTP traffic on port 8080");

  scoutbotAutoProcessor.asg.addSecurityGroup(scoutbotSG);

  return {
    processTaskQueueUrl: processor.queue.queueUrl,
    pointFinderTaskQueueUrl: pointFinderAutoProcessor.queue.queueUrl,
    userInterfaceUrl: userInterfaceALB.loadBalancerDnsName,
    //scoutBotUrl: scoutbotAutoProcessor.asg.loadBalancerDnsName,
    // auroraClusterEndpoint: cluster.clusterEndpoint.socketAddress,
    // auroraClusterReadEndpoint: cluster.clusterReadEndpoint.socketAddress,
    // auroraClusterSecretArn: cluster.secret?.secretArn || 'Secret not available',
  };

}
