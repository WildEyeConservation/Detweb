import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import { Construct } from 'constructs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

interface EC2QueueProcessorProps {
  vpc: ec2.IVpc;
  instanceType: ec2.InstanceType;
  amiId: string;
  keyName?: string;
}

export class EC2QueueProcessor extends Construct {
  public readonly queue: sqs.Queue;
  public readonly autoScalingGroup: autoscaling.AutoScalingGroup;

  constructor(scope: Construct, id: string, props: EC2QueueProcessorProps) {
    super(scope, id);

    // Create SQS Queue
    this.queue = new sqs.Queue(this, 'ProcessingQueue');

    // Create Security Group for EC2 instance
    const securityGroup = new ec2.SecurityGroup(this, 'ProcessorInstanceSG', {
      vpc: props.vpc,
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
    const s3Policy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
      resources: ['*'],
    });
    role.addToPolicy(s3Policy);
    // Grant permissions to the EC2 instance to access the SQS queue
    this.queue.grantConsumeMessages(role);

    // Create user data to pass queue URL to the instance and run docker compose
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      `echo "export QUEUE_URL=${this.queue.queueUrl}" >> /etc/environment`,
      `echo "export AWS_DEFAULT_REGION=${this.queue.env.region}" >> /etc/environment`,
      'cd /home/ubuntu',
      'source /etc/environment',
      'QUEUE_URL=$QUEUE_URL AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION docker-compose up'
    );

    // Create Launch Template
    const launchTemplate = new ec2.LaunchTemplate(this, 'LaunchTemplate', {
      machineImage: ec2.MachineImage.genericLinux({ 'eu-west-3': props.amiId }),
      instanceType: props.instanceType,
      keyName: props.keyName,
      securityGroup: securityGroup,
      userData: userData,
      role: role, // Correct property to associate IAM Role
      // Optionally, you can specify additional properties here
    });

    // Create Auto Scaling Group using Launch Template
    this.autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'ProcessorASG', {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      minCapacity: 0,
      maxCapacity: 1,
      desiredCapacity: 0,
      securityGroup, // Optional, since it's already defined in the Launch Template
      launchTemplate: {
        launchTemplateId: launchTemplate.launchTemplateId,
        version: launchTemplate.latestVersionNumber,
      },
      associatePublicIpAddress: true,
    });

    // Scaling Policy
    this.autoScalingGroup.scaleOnMetric('ScaleOnSQSMessages', {
      metric: this.queue.metricApproximateNumberOfMessagesVisible({ period: cdk.Duration.minutes(1) }),
      scalingSteps: [
        { upper: 0, change: 0 },
        { lower: 1, change: +1 },
      ],
      adjustmentType: autoscaling.AdjustmentType.EXACT_CAPACITY,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
    });
  }
}
