import { CDKContext } from './../cdk.context.d'
import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as iam from "aws-cdk-lib/aws-iam";
import * as autoscaling from "aws-cdk-lib/aws-autoscaling";
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as sqs from "aws-cdk-lib/aws-sqs"
import * as ecs from "aws-cdk-lib/aws-ecs";

import { Construct } from 'constructs'
import { createUserPool } from './cognito/auth'
import { createBucket } from './storage/bucket'
import {createPostDeployLambda} from './lambdas/postDeploy/construct'
import {createHandleUpload} from './lambdas/handleS3Upload/construct'
import {createTileImage} from './lambdas/tileImage/construct'
import {
    AmplifyGraphqlApi,
    AmplifyGraphqlDefinition,
    } from "@aws-amplify/graphql-api-construct";

export class Cdk2Stack extends cdk.Stack {
    constructor(
        scope: Construct,
        id: string,
        props: cdk.StackProps,
        context: CDKContext
    ) {
        super(scope, id, {...props,crossRegionReferences: true})
        
        //Cognito resources
        const cognitoAuth = createUserPool(scope, {
            appName: context.appName,
            env: context.environment
            //addUserPostConfirmation: addUserFunc,
        })
        // Create a Role for the hanlde upload Lambda to use.
        const uploadLambdaRole = new iam.Role(this, 'LambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        });

        // Create a Task Role
        const ecsTaskRole = new iam.Role(this, 'EcsTaskRole', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });

        const gpuWorkerRole = iam.Role.fromRoleArn(this,'gpuRole','arn:aws:iam::275736403632:role/gpuWorkerRole')
        

        // // 👇 create VPC in which we'll launch the Cluster
        const vpc = new ec2.Vpc(this, 'my-cdk-vpc');
        // Some ECS tasks need to be done on machines with GPUs and some don't require GPUs. Thus we have to separate task queues for ECS
        const gpuQueue= new sqs.Queue(this,'gpuQueue',{fifo:true})
        const cpuQueue= new sqs.Queue(this,'cpuQueue',{fifo:true})

        const sg=new ec2.SecurityGroup(this,'instanceSg',{vpc})
        sg.addIngressRule(ec2.Peer.anyIpv4(),ec2.Port.tcp(22))

        // Create ECS Clusters
        const gpuCluster = new ecs.Cluster(this, 'GpuCluster', {vpc});
        const cpuCluster = new ecs.Cluster(this, 'CpuCluster', {vpc});

        // Create an EC2 Auto Scaling Group for the ECS GPU Cluster
        const gpuAutoScalingGroup = new autoscaling.AutoScalingGroup(this, 'GPU_ASG', {
            vpc,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.G4DN, ec2.InstanceSize.XLARGE),
            machineImage: ecs.EcsOptimizedImage.amazonLinux2(ecs.AmiHardwareType.GPU),
            securityGroup: sg,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC,
                availabilityZones: [vpc.availabilityZones[1]]
        /*TODO: This is an ugly hack. If I do not specify an availability zone and deploy to af-south-1, CDK consistently chooses to place the instance in af-south-1a
            which does not support g4dn.*/
        },
            userData: createUserData(gpuQueue),
            minCapacity: 0,
            desiredCapacity:0 ,
            maxCapacity: 2,
            keyName: "cvat_africa",
        });

        gpuAutoScalingGroup.scaleOnMetric('ScaleOnQueueLength', {
            metric: gpuQueue.metricApproximateNumberOfMessagesVisible(),
            scalingSteps: [
                { lower: 1, change: +1 }, // Scale out when queue is not empty
                { upper: 0, change: -1 } // Scale in when queue is empty
            ],
            adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
            cooldown: cdk.Duration.minutes(1),
        });



        // Create an EC2 Auto Scaling Group for the ECS CPU Cluster
        const cpuAutoScalingGroup = new autoscaling.AutoScalingGroup(this, 'CPU_ASG', {
            vpc,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
            machineImage: ecs.EcsOptimizedImage.amazonLinux2(ecs.AmiHardwareType.STANDARD),
            securityGroup: sg,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC,
                availabilityZones: vpc.availabilityZones
        },
            userData: createUserData(gpuQueue),
            minCapacity: 0,
            maxCapacity: 1,
            keyName: "cvat_africa",
        });

        //Grant my ECS containers access to my Appsync API
        gpuAutoScalingGroup.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSAppSyncInvokeFullAccess'))
        cpuAutoScalingGroup.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSAppSyncInvokeFullAccess'))
        ecsTaskRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSAppSyncInvokeFullAccess'))
        
        // AWS AppSync
        const detwebAPI = new AmplifyGraphqlApi(this, "detwebAPI", {
            apiName: "detwebAPI",
            definition: AmplifyGraphqlDefinition.fromFiles("./lib/schema.graphql"),
            authorizationModes: {
            defaultAuthorizationMode: "AMAZON_COGNITO_USER_POOLS",
            apiKeyConfig: {
                expires: cdk.Duration.days(30),
            },
            userPoolConfig: {
                userPool: cognitoAuth.userPool,
            },
            iamConfig:{identityPoolId:cognitoAuth.identityPool.identityPoolId,
                authenticatedUserRole:cognitoAuth.identityPool.authenticatedRole,
                unauthenticatedUserRole:cognitoAuth.identityPool.unauthenticatedRole,
                allowListedRoles: [ecsTaskRole, gpuAutoScalingGroup.role,cpuAutoScalingGroup.role, uploadLambdaRole,gpuWorkerRole]}
            }});

        

        const postDeployLambda = createPostDeployLambda(this,{
            appName:context.appName,
            env:context.environment,
            lambdaName: cognitoAuth.addUserFunc.functionArn,
            graphqlEndpoint: detwebAPI.graphqlUrl,
            graphqlApiKey: detwebAPI.apiKey || "none",
            cognitoRegion: cognitoAuth.addUserFunc.env.region
        })   
        
        // Define a Task Definition
        const gpuTaskDefinition = new ecs.Ec2TaskDefinition(this, 'GpuTaskDefinition',{taskRole: ecsTaskRole});
        const cpuTaskDefinition = new ecs.Ec2TaskDefinition(this, 'CpuTaskDefinition',{taskRole: ecsTaskRole});

        gpuTaskDefinition.addContainer('LightGlueContainer', {
            image: ecs.ContainerImage.fromAsset('containerImages/lightGlueImage'),
            memoryReservationMiB: 1024*12,
            gpuCount: 1,
            environment: {'SQS_QUEUE_URL':gpuQueue.queueUrl,
                          'SQS_REGION': gpuQueue.env.region,
                          'API_ENDPOINT': detwebAPI.graphqlUrl,
                          'API_REGION': detwebAPI.resources.graphqlApi.env.region,
                        }});

        cpuTaskDefinition.addContainer('PointFinderContainer', {
            image: ecs.ContainerImage.fromAsset('containerImages/pointFinderImage'),
            memoryReservationMiB: 1024,
            gpuCount: 0,
            environment: {'SQS_QUEUE_URL':cpuQueue.queueUrl,
                          'SQS_REGION': cpuQueue.env.region,
                          'API_ENDPOINT': detwebAPI.graphqlUrl,
                          'API_REGION': detwebAPI.resources.graphqlApi.env.region,
                        }});                        
        
        // Create ECS Services
        const cpuService = new ecs.Ec2Service(this, 'CpuService', {
            cluster:cpuCluster,
            taskDefinition: cpuTaskDefinition,
            enableExecuteCommand: true,
            desiredCount:0
        });

        const gpuService = new ecs.Ec2Service(this, 'GpuService', {
            cluster:gpuCluster,
            taskDefinition: gpuTaskDefinition,
            enableExecuteCommand: true,
            desiredCount:0
        });

        const cpuscaling = cpuService.autoScaleTaskCount({
            minCapacity: 0,
            maxCapacity: 1,
        });
        const gpuscaling = gpuService.autoScaleTaskCount({
            minCapacity: 0,
            maxCapacity: 1,
        });

        cpuscaling.scaleOnMetric('ScaleOnQueueLength', {
            metric: cpuQueue.metricApproximateNumberOfMessagesVisible(),
            scalingSteps: [
                { lower: 1, change: +1 }, // Scale out when queue is not empty
                { upper: 0, change: -1 } // Scale in when queue is empty
            ],
            adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
            cooldown: cdk.Duration.minutes(1),
        });

        gpuscaling.scaleOnMetric('ScaleOnQueueLength', {
            metric: gpuQueue.metricApproximateNumberOfMessagesVisible(),
            scalingSteps: [
                { lower: 1, change: +1 }, // Scale out when queue is not empty
                { upper: 0, change: -1 } // Scale in when queue is empty
            ],
            adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
            cooldown: cdk.Duration.minutes(1),
        });

        // Create an ECS Capacity Provider
        const cpuCapacityProvider = new ecs.AsgCapacityProvider(this, 'CpuAsgCapacityProvider', {
            autoScalingGroup:cpuAutoScalingGroup,
            enableManagedScaling: true,
            targetCapacityPercent: 100
        });
        const gpuCapacityProvider = new ecs.AsgCapacityProvider(this, 'GpuAsgCapacityProvider', {
            autoScalingGroup:gpuAutoScalingGroup,
            enableManagedScaling: false,
            enableManagedTerminationProtection: false,
            targetCapacityPercent: 100
        });

        cpuCluster.addAsgCapacityProvider(cpuCapacityProvider)
        gpuCluster.addAsgCapacityProvider(gpuCapacityProvider)
        
        
        // Add permissions for the ASG to interact with the SQS queue
        gpuQueue.grantSendMessages(ecsTaskRole)
        gpuQueue.grantConsumeMessages(ecsTaskRole);
        cpuQueue.grantSendMessages(ecsTaskRole)
        cpuQueue.grantConsumeMessages(ecsTaskRole);
        
        // // Create a scaling policy based on the SQS queue
        // const scalingPolicy = autoScalingGroup.scaleOnMetric('ScaleBasedOnSQS', {
        //     metric: gpuQueue.metricApproximateNumberOfMessagesVisible(),
        //     scalingSteps: [
        //         { upper: 0, change: -1 },
        //         { lower: 1, change: +1 }
        //     ],
        //     adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
        //     cooldown: cdk.Duration.minutes(5),
        // }); 
                    
        const inputsBucket=createBucket(this,{
            appName: context.appName,
            env: context.environment,
            name: "inputs",
            actions: ['s3:*'],
            allowedOrigins: context.s3AllowedOrigins,
            roles: [cognitoAuth.identityPool.authenticatedRole]
        })

        inputsBucket.grantRead(ecsTaskRole)

        const outputsBucket=createBucket(this,{
            appName: context.appName,
            env: context.environment,
            name: "outputs",
            actions: ['s3:PutObject', 's3:GetObject', 's3:DeleteObject'],
            allowedOrigins: context.s3AllowedOrigins,
            roles: [cognitoAuth.identityPool.authenticatedRole]
        })

        outputsBucket.grantReadWrite(ecsTaskRole)

        const sharpLayer = new lambda.LayerVersion(this, 'sharpLayer', {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            code: lambda.Code.fromAsset('./lib/lambdas/sharp-layer'),
            compatibleArchitectures: [lambda.Architecture.X86_64, lambda.Architecture.ARM_64],
            });

        const luxonLayer = new lambda.LayerVersion(this, 'luxonLayer', {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            code: lambda.Code.fromAsset('./lib/lambdas/luxonLayer'),
            compatibleArchitectures: [lambda.Architecture.X86_64, lambda.Architecture.ARM_64],
            });

        const exifreaderLayer = new lambda.LayerVersion(this, 'exifreaderLayer', {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            code: lambda.Code.fromAsset('./lib/lambdas/exifreaderLayer'),
            compatibleArchitectures: [lambda.Architecture.X86_64, lambda.Architecture.ARM_64],
            });

    
        const handleUploadFunc=createHandleUpload(this,{appName: context.appName,role:uploadLambdaRole,
            env: context.environment,layers:[sharpLayer,luxonLayer,exifreaderLayer],buckets:[inputsBucket,outputsBucket], graphqlEndpoint: detwebAPI.graphqlUrl,
            graphqlApiKey: detwebAPI.apiKey || "none",
        }) 

        const tileImage=createTileImage(this,{appName: context.appName,role:uploadLambdaRole,
            env: context.environment,layers:[sharpLayer,luxonLayer,exifreaderLayer],buckets:[inputsBucket,outputsBucket], graphqlEndpoint: detwebAPI.graphqlUrl,
            graphqlApiKey: detwebAPI.apiKey || "none",
        }) 

        new cdk.CfnOutput(this, "gpuTaskQueueUrl", {
            value: gpuQueue.queueUrl || "none",
        });    
        new cdk.CfnOutput(this, "cpuTaskQueueUrl", {
            value: cpuQueue.queueUrl || "none",
        });    
        new cdk.CfnOutput(this, "ProjectRegion", {
            value: props.env?.region || "none",
        });
        new cdk.CfnOutput(this, "imagesBucketOut", {
            value: inputsBucket.bucketName,
        });    
        new cdk.CfnOutput(this, "imagesBucketRegion", {
            value: inputsBucket.env.region,
        });    
        new cdk.CfnOutput(this, "outputsBucketOut", {
            value: outputsBucket.bucketName,
        });           
        
        const sqsCreateQueueStatement = new iam.PolicyStatement({
            actions: ['sqs:CreateQueue','sqs:SendMessage','sqs:DeleteQueue','sqs:GetQueueAttributes','sqs:GetQueueUrl'],
            resources: ['*']                                               
          });
        const sqsConsumeQueueStatement = new iam.PolicyStatement({
        actions: ['sqs:ReceiveMessage','sqs:DeleteMessage','sqs:GetQueueAttributes','sqs:GetQueueUrl','sqs:ChangeMessageVisibility'],
        resources: ['*']                               
        });
        const cognitoAdmin = new iam.PolicyStatement({
            actions: ['cognito-idp:AdminRemoveUserFromGroup','cognito-idp:AdminAddUserToGroup'],
            resources: ['*']                               
            });
        const lambdaInvoke = new iam.PolicyStatement({
            actions: ['lambda:InvokeFunction'],
            resources: ['*']                               
            });
        

        cognitoAuth.identityPool.authenticatedRole.addToPrincipalPolicy(sqsCreateQueueStatement);
        cognitoAuth.identityPool.authenticatedRole.addToPrincipalPolicy(sqsConsumeQueueStatement);                    
        cognitoAuth.identityPool.authenticatedRole.addToPrincipalPolicy(cognitoAdmin);                    
        cognitoAuth.identityPool.authenticatedRole.addToPrincipalPolicy(lambdaInvoke);                    


        function createUserData(queue:any) {
            const multipartUserData = new ec2.MultipartUserData();
            const commandsUserData = ec2.UserData.forLinux();
            multipartUserData.addUserDataPart(commandsUserData, ec2.MultipartBody.SHELL_SCRIPT, true);
            /* I don't think these are needed anymore. I set environment variables in a different way for ECS containers that allows me to set different 
             values for the same variable for different containers running on the same host (taskDefinition.addContainer call). I'll comment these lines at 
             some point and check if everything still works, but I think having an example of how to set environment variables (or execute arbitrary commands) 
             at startup on the host itself is usefull to have close at hand.*/ 
            multipartUserData.addCommands(`#!/bin/bash`); 
            multipartUserData.addCommands(`echo export SQS_QUEUE_URL=${queue.queueUrl} >> /etc/profile`);
            multipartUserData.addCommands(`echo export SQS_REGION=${queue.env.region} >> /etc/profile`);
            return multipartUserData;
        }
    }
}
