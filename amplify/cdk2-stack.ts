// import { CDKContext } from "./../cdk.context.d";
import * as triggers from "aws-cdk-lib/triggers";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as autoscaling from "aws-cdk-lib/aws-autoscaling";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

import { Construct } from "constructs";
// import { createUserPool } from "./cognito/auth";
import { createBucket } from "./bucket";
import {  AmplifyGraphqlApi} from "@aws-amplify/graphql-api-construct";

import { BackendAuth } from "@aws-amplify/backend-auth";
import { Lambda } from "aws-cdk-lib/aws-ses-actions";
import { Backend } from "@aws-amplify/backend";
import { ConstructFactory, FunctionResources, ResourceAccessAcceptorFactory, ResourceProvider, BackendSecret } from '@aws-amplify/plugin-types';
export type AddEnvironmentFactory = {
  addEnvironment: (key: string, value: string | BackendSecret) => void;
};


export const createDetwebResources=function(scope: Construct, backend : Backend<{
  auth: ConstructFactory<BackendAuth>;
  data: ConstructFactory<AmplifyGraphqlApi>;
  addUser: ConstructFactory<ResourceProvider<FunctionResources> & ResourceAccessAcceptorFactory & AddEnvironmentFactory>;
}>) {
  const authenticatedRole = backend.auth.resources.authenticatedUserIamRole
  const gqlAPI = backend.data
  const auth = backend.auth
  
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


  auth.resources.userPool.grant(
    authenticatedRole,
    "cognito-idp:AdminAddUserToGroup",
  );
  auth.resources.userPool.grant(
    authenticatedRole,
    "cognito-idp:AdminRemoveUserFromGroup",
  );

    // Create a Role for the hanlde upload Lambda to use.
    const uploadLambdaRole = new iam.Role(scope, "LambdaRole", {
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

     const adminEmail = "noone@nowhere.com";
     const adminTempPassword = "adminTempPassword$%3445";
     const adminName = "Admin";


    const vpc = new ec2.Vpc(scope, "my-cdk-vpc");
    // Some ECS tasks need to be done on machines with GPUs and some don't require GPUs. Thus we have to separate task queues for ECS
    const gpuQueue = new sqs.Queue(scope, "gpuQueue", { fifo: true });
    const cpuQueue = new sqs.Queue(scope, "cpuQueue", { fifo: true });

    const sg = new ec2.SecurityGroup(scope, "instanceSg", { vpc });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));

    // Create ECS Clusters
    const gpuCluster = new ecs.Cluster(scope, "GpuCluster", { vpc });
    const cpuCluster = new ecs.Cluster(scope, "CpuCluster", { vpc });

    // Create an EC2 Auto Scaling Group for the ECS GPU Cluster
    const gpuAutoScalingGroup = new autoscaling.AutoScalingGroup(
      scope,
      "GPU_ASG",
      {
        vpc,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.G4DN,
          ec2.InstanceSize.XLARGE,
        ),
        machineImage: ecs.EcsOptimizedImage.amazonLinux2(
          ecs.AmiHardwareType.GPU,
        ),
        securityGroup: sg,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PUBLIC,
          availabilityZones: [vpc.availabilityZones[1]],
          /*TODO: scope is an ugly hack. If I do not specify an availability zone and deploy to af-south-1, CDK consistently chooses to place the instance in af-south-1a
            which does not support g4dn.*/
        },
        userData: createUserData(gpuQueue),
        minCapacity: 0,
        desiredCapacity: 0,
        maxCapacity: 2,
        //keyName: "cvat_africa",
      },
    );

    gpuAutoScalingGroup.scaleOnMetric("ScaleOnQueueLength", {
      metric: gpuQueue.metricApproximateNumberOfMessagesVisible(),
      scalingSteps: [
        { lower: 1, change: +1 }, // Scale out when queue is not empty
        { upper: 0, change: -1 }, // Scale in when queue is empty
      ],
      adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      // cooldown: cdk.Duration.minutes(1),
    });

    // Create an EC2 Auto Scaling Group for the ECS CPU Cluster
    const cpuAutoScalingGroup = new autoscaling.AutoScalingGroup(
      scope,
      "CPU_ASG",
      {
        vpc,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.SMALL,
        ),
        machineImage: ecs.EcsOptimizedImage.amazonLinux2(
          ecs.AmiHardwareType.STANDARD,
        ),
        securityGroup: sg,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PUBLIC,
          availabilityZones: vpc.availabilityZones,
        },
        userData: createUserData(gpuQueue),
        minCapacity: 0,
        maxCapacity: 1,
        //keyName: "cvat_africa",
      },
    );

    //Grant my ECS containers access to my Appsync API
    gpuAutoScalingGroup.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSAppSyncInvokeFullAccess"),
    );
    cpuAutoScalingGroup.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSAppSyncInvokeFullAccess"),
    );
    ecsTaskRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSAppSyncInvokeFullAccess"),
    );

    const postDeployLambda = new NodejsFunction(scope, "postDeployFunc", {
      runtime: Runtime.NODEJS_18_X,
      handler: "handler",
      entry: './cdk/lib/lambdas/postDeploy/main.ts',
      environment: {
        //LAMBDANAME: backend.addUser.resources.lambda.functionArn,
        API_DETWEB_GRAPHQLAPIENDPOINTOUTPUT: gqlAPI.graphqlUrl,
        API_DETWEB_GRAPHQLAPIKEYOUTPUT: gqlAPI.apiKey || "none",
        USER_POOL_ID: auth.resources.userPool.userPoolId,
        ADMIN_NAME: adminName,
        ADMIN_EMAIL: adminEmail,
        ADMIN_TEMP_PASSWORD: adminTempPassword,
        API_ID: gqlAPI.apiId,
        FORCE_DEPLOY: "true",
        DEPLOYMENT_TIMESTAMP: new Date().toISOString(),
      },
    });

    postDeployLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:UpdateFunctionConfiguration"],
        resources: [backend.addUser.resources.lambda.functionArn],
      })
    );    
  
    postDeployLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminGetUser",
        ],
        resources: [backend.auth.resources.userPool.userPoolArn],
      })
    );
  
    new triggers.Trigger(scope, "triggerPostDeploy", {
      handler: postDeployLambda,
      invocationType: triggers.InvocationType.EVENT,
      executeOnHandlerChange: true,
    });
  
    // Define a Task Definition
    const gpuTaskDefinition = new ecs.Ec2TaskDefinition(
      scope,
      "GpuTaskDefinition",
      { taskRole: ecsTaskRole },
    );
    const cpuTaskDefinition = new ecs.Ec2TaskDefinition(
      scope,
      "CpuTaskDefinition",
      { taskRole: ecsTaskRole },
    );

    gpuTaskDefinition.addContainer("LightGlueContainer", {
      image: ecs.ContainerImage.fromAsset("containerImages/lightGlueImage"),
      memoryReservationMiB: 1024 * 12,
      gpuCount: 1,
      environment: {
        SQS_QUEUE_URL: gpuQueue.queueUrl,
        SQS_REGION: gpuQueue.env.region,
        API_ENDPOINT: gqlAPI.graphqlUrl,// TODO detwebAPI.graphqlUrl,
      },
    });

    cpuTaskDefinition.addContainer("PointFinderContainer", {
      image: ecs.ContainerImage.fromAsset("containerImages/pointFinderImage"),
      memoryReservationMiB: 1024,
      gpuCount: 0,
      environment: {
        SQS_QUEUE_URL: cpuQueue.queueUrl,
        SQS_REGION: cpuQueue.env.region,
        API_ENDPOINT: gqlAPI.graphqlUrl,//detwebAPI.graphqlUrl,
      },
    });

    // Create ECS Services
    const cpuService = new ecs.Ec2Service(scope, "CpuService", {
      cluster: cpuCluster,
      taskDefinition: cpuTaskDefinition,
      enableExecuteCommand: true,
      desiredCount: 0,
    });

    const gpuService = new ecs.Ec2Service(scope, "GpuService", {
      cluster: gpuCluster,
      taskDefinition: gpuTaskDefinition,
      enableExecuteCommand: true,
      desiredCount: 0,
    });

    const cpuscaling = cpuService.autoScaleTaskCount({
      minCapacity: 0,
      maxCapacity: 1,
    });
    const gpuscaling = gpuService.autoScaleTaskCount({
      minCapacity: 0,
      maxCapacity: 1,
    });

    cpuscaling.scaleOnMetric("ScaleOnQueueLength", {
      metric: cpuQueue.metricApproximateNumberOfMessagesVisible(),
      scalingSteps: [
        { lower: 1, change: +1 }, // Scale out when queue is not empty
        { upper: 0, change: -1 }, // Scale in when queue is empty
      ],
      adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      //cooldown: cdk.Duration.minutes(1),
    });

    gpuscaling.scaleOnMetric("ScaleOnQueueLength", {
      metric: gpuQueue.metricApproximateNumberOfMessagesVisible(),
      scalingSteps: [
        { lower: 1, change: +1 }, // Scale out when queue is not empty
        { upper: 0, change: -1 }, // Scale in when queue is empty
      ],
      adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      //cooldown: cdk.Duration.minutes(1),
    });

    // Create an ECS Capacity Provider
    const cpuCapacityProvider = new ecs.AsgCapacityProvider(
      scope,
      "CpuAsgCapacityProvider",
      {
        autoScalingGroup: cpuAutoScalingGroup,
        enableManagedScaling: true,
        targetCapacityPercent: 100,
      },
    );
    const gpuCapacityProvider = new ecs.AsgCapacityProvider(
      scope,
      "GpuAsgCapacityProvider",
      {
        autoScalingGroup: gpuAutoScalingGroup,
        enableManagedScaling: false,
        enableManagedTerminationProtection: false,
        targetCapacityPercent: 100,
      },
    );

    cpuCluster.addAsgCapacityProvider(cpuCapacityProvider);
    gpuCluster.addAsgCapacityProvider(gpuCapacityProvider);

    // Add permissions for the ASG to interact with the SQS queue
    gpuQueue.grantSendMessages(ecsTaskRole);
    gpuQueue.grantConsumeMessages(ecsTaskRole);
    cpuQueue.grantSendMessages(ecsTaskRole);
    cpuQueue.grantConsumeMessages(ecsTaskRole);

    const inputsBucket = createBucket(scope, {
      name: "inputs",
      actions: ["s3:*"],
      allowedOrigins: ['*'],
      roles: [authenticatedRole],
    });

    inputsBucket.grantRead(ecsTaskRole);

    const outputsBucket = createBucket(scope, {
      name: "outputs",
      actions: ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      allowedOrigins: ['*'],
      roles: [authenticatedRole],
    });

    outputsBucket.grantReadWrite(ecsTaskRole);

    const sharpLayer = new lambda.LayerVersion(scope, "sharpLayer", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      code: lambda.Code.fromAsset("./cdk/lib/lambdas/sharp-layer"),
      compatibleArchitectures: [
        lambda.Architecture.X86_64,
        lambda.Architecture.ARM_64,
      ],
    });

    const luxonLayer = new lambda.LayerVersion(scope, "luxonLayer", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      code: lambda.Code.fromAsset("./cdk/lib/lambdas/luxonLayer"),
      compatibleArchitectures: [
        lambda.Architecture.X86_64,
        lambda.Architecture.ARM_64,
      ],
    });

    const exifreaderLayer = new lambda.LayerVersion(scope, "exifreaderLayer", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      code: lambda.Code.fromAsset("./cdk/lib/lambdas/exifreaderLayer"),
      compatibleArchitectures: [
        lambda.Architecture.X86_64,
        lambda.Architecture.ARM_64,
      ],
    });

  
    const handleUploadFunc = new lambda.Function(scope, "s3TriggerLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      role: uploadLambdaRole,
      code: lambda.Code.fromAsset("./cdk/lib/lambdas/handleS3Upload"),
      layers: [sharpLayer, luxonLayer, exifreaderLayer],
      handler: "main.handler",
      timeout: cdk.Duration.seconds(30),
      memorySize: 2048,
      environment: {
        OUTPUTBUCKET: outputsBucket.bucketName,
        API_DETWEB_GRAPHQLAPIENDPOINTOUTPUT: gqlAPI.graphqlUrl,
        API_DETWEB_GRAPHQLAPIKEYOUTPUT: gqlAPI.apiKey || 'none',
      },
    });

    inputsBucket.grantRead(handleUploadFunc);
    outputsBucket.grantReadWrite(handleUploadFunc);
  
    const myPutEventSource = new lambdaEventSources.S3EventSource(
      inputsBucket,
      {
        events: [s3.EventType.OBJECT_CREATED],
      },
    );
    handleUploadFunc.addEventSource(myPutEventSource);
  
    const sqsCreateQueueStatement = new iam.PolicyStatement({
      actions: [
        "sqs:CreateQueue",
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
    return {gpuTaskQueueUrl : gpuQueue.queueUrl,
    cpuTaskQueueUrl : cpuQueue.queueUrl,
    inputsBucket : inputsBucket.bucketName,
    outputBucket : outputsBucket.bucketName,
  };


    function createUserData(queue: any) {
      const multipartUserData = new ec2.MultipartUserData();
      const commandsUserData = ec2.UserData.forLinux();
      multipartUserData.addUserDataPart(
        commandsUserData,
        ec2.MultipartBody.SHELL_SCRIPT,
        true,
      );
      /* I don't think these are needed anymore. I set environment variables in a different way for ECS containers that allows me to set different 
             values for the same variable for different containers running on the same host (taskDefinition.addContainer call). I'll comment these lines at 
             some point and check if everything still works, but I think having an example of how to set environment variables (or execute arbitrary commands) 
             at startup on the host itself is usefull to have close at hand.*/
      multipartUserData.addCommands(`#!/bin/bash`);
      multipartUserData.addCommands(
        `echo export SQS_QUEUE_URL=${queue.queueUrl} >> /etc/profile`,
      );
      multipartUserData.addCommands(
        `echo export SQS_REGION=${queue.env.region} >> /etc/profile`,
      );
      return multipartUserData;
    }
  }
