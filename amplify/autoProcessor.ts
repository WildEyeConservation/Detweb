import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import { Construct } from 'constructs';

function createUserData(inputqueue: any,outputqueue: any) {
  const multipartUserData = new ec2.MultipartUserData();
  const commandsUserData = ec2.UserData.forLinux();
  multipartUserData.addUserDataPart(
    commandsUserData,
    ec2.MultipartBody.SHELL_SCRIPT,
    true,
  );
  multipartUserData.addCommands(`#!/bin/bash`);
  multipartUserData.addCommands(
    `echo export INPUT_QUEUE_URL=${inputqueue.queueUrl} >> /etc/profile`,
  );
  multipartUserData.addCommands(
    `echo export OUTPUT_QUEUE_URL=${outputqueue.queueUrl} >> /etc/profile`,
  );
  multipartUserData.addCommands(
    `echo export AWS_REGION=${inputqueue.env.region} >> /etc/profile`,
  );
  multipartUserData.addCommands(
    `./docker compose up`,
  );
  // multipartUserData.addCommands(
  //   `shutdown -h now`,
  // );
  return multipartUserData;
}

type AutoProcessorProps={
  vpc: ec2.Vpc;
  ecsImage: ecs.ContainerImage;
  instanceType: ec2.InstanceType;
  environment: { [key: string]: string };
  ecsTaskRole: iam.Role;
  machineImage: cdk.aws_ec2.IMachineImage;
  memoryLimitMiB?: number;
  gpuCount?: number;
  rootVolumeSize?: number;
}

export class AutoProcessor extends Construct {
  queue: sqs.Queue;
  asg: autoscaling.AutoScalingGroup;
  constructor(scope: Construct, id: string, props: AutoProcessorProps) {
    super(scope, id);

    const { vpc, ecsImage,instanceType,ecsTaskRole,memoryLimitMiB,gpuCount,machineImage } = props;

    // Create SQS Queue
    this.queue = new sqs.Queue(this, 'ProcessingQueue');

    // Create ECS Cluster
    const cluster = new ecs.Cluster(this, 'ProcessorCluster', {
      vpc: vpc,
    });

    const sg = new ec2.SecurityGroup(this, "instanceSg", { vpc });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));
    // Create Auto Scaling Group
    this.asg = new autoscaling.AutoScalingGroup(this, 'ProcessorASG', {
      vpc,
      instanceType, // GPU instance
      machineImage,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      minCapacity: 0,
      securityGroup: sg,
      maxCapacity: 1,
      desiredCapacity: 0,
      keyName: "wildcru2",
      associatePublicIpAddress: true, // Ensure instances get a public IP
      blockDevices: props.rootVolumeSize ? [
        {
          deviceName: '/dev/xvda',
          volume: autoscaling.BlockDeviceVolume.ebs(props.rootVolumeSize || 100, {
            volumeType: autoscaling.EbsDeviceVolumeType.GP3,
            deleteOnTermination: true,
          }),
        },
      ] : undefined,
    });


    // Add ASG to ECS Cluster
    const capacityProvider = new ecs.AsgCapacityProvider(this, 'AsgCapacityProvider', {
      autoScalingGroup: this.asg,
    });
    cluster.addAsgCapacityProvider(capacityProvider);

    // Create ECS Task Definition
    const taskDefinition = new ecs.Ec2TaskDefinition(this, 'ProcessorTaskDef',{ taskRole: ecsTaskRole });

    // Add container to task definition
    const container = taskDefinition.addContainer('ProcessorContainer', {
      image: ecsImage,
      memoryLimitMiB : memoryLimitMiB || 1024,
      gpuCount,
      cpu: 1024,
      logging: new ecs.AwsLogDriver({ streamPrefix: 'processor' }),
      environment: {
        QUEUE_URL: this.queue.queueUrl,
        REGION: cdk.Stack.of(this).region,
        ...props.environment
      },
    });

    // Create ECS Service
    const service = new ecs.Ec2Service(this, 'ProcessorService', {
      cluster: cluster,
      taskDefinition: taskDefinition,
      desiredCount: 0,
      capacityProviderStrategies: [
        {
          capacityProvider: capacityProvider.capacityProviderName,
          weight: 1,
        },
      ],
    });

    // Grant permissions to the ECS task to access the SQS queue
    this.queue.grantConsumeMessages(taskDefinition.taskRole);

    // Set up scaling based on SQS queue
    const scaling = service.autoScaleTaskCount({
      minCapacity: 0,
      maxCapacity: 1,
    });

    scaling.scaleOnMetric('ScaleOnSQSMessages', {
      metric: this.queue.metricApproximateNumberOfMessagesVisible(),
      scalingSteps: [
        { upper: 0, change: -1 },
        { lower: 1, change: +1 },
      ],
      adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
    });
  }
}

export interface AutoProcessorEC2Props extends cdk.StackProps {
  vpc: ec2.Vpc;
  inputqueue: sqs.Queue;
  outputqueue: sqs.Queue;
  amiArn: string;
}

export class AutoProcessorEC2 extends Construct {
  constructor(scope: Construct, id: string, props: AutoProcessorEC2Props) {
    super(scope, id);

    const { vpc, inputqueue,outputqueue, amiArn } = props;

    // Create Security Group for EC2 instance
    const securityGroup = new ec2.SecurityGroup(this, 'ProcessorInstanceSG', {
      vpc,
      description: 'Allow ssh access to ec2 instances',
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'allow ssh access from the world');

    // Create IAM Role for EC2 instance
    const role = new iam.Role(this, 'ProcessorInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    // Attach policies to the role
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSQSFullAccess'));
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2FullAccess'));

    // Grant permissions to the EC2 instance to access the SQS queue
    inputqueue.grantConsumeMessages(role);
    outputqueue.grantSendMessages(role);

    // Set up scaling based on SQS queue
    const scaling = new autoscaling.AutoScalingGroup(this, 'ProcessorASG', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.G4DN, ec2.InstanceSize.XLARGE),
      machineImage: ec2.MachineImage.genericLinux({ [cdk.Stack.of(this).region]: amiArn }),
      minCapacity: 0,
      maxCapacity: 1,
      desiredCapacity: 0,
      securityGroup,
      role,
      keyName: "wildcru2",
      userData: createUserData(inputqueue,outputqueue),
    });

    scaling.scaleOnMetric('ScaleOnSQSMessages', {
      metric: inputqueue.metricApproximateNumberOfMessagesVisible(),
      scalingSteps: [
        { upper: 0, change: -1 },
        { lower: 1, change: +1 },
      ],
      adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
    });
  }
}
