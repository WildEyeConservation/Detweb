import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { addUserToGroup } from "./functions/add-user-to-group/resource";
import { Stack, Fn } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { outputBucket, inputBucket } from "./storage/resource";
import { handleS3Upload } from "./storage/handleS3Upload/resource";
//import * as sts from '@aws-sdk/client-sts';
import * as ecs from "aws-cdk-lib/aws-ecs";
import { AutoProcessor } from "./autoProcessor";
import { EC2QueueProcessor } from "./ec2QueueProcessor";
import { processImages } from "./functions/processImages/resource";
import { postDeploy } from "./functions/postDeploy/resource";
import { getAnnotationCounts } from "./functions/getAnnotationCounts/resource";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { updateUserStats } from "./functions/updateUserStats/resource";
import { Policy, PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";
import { StartingPosition, EventSourceMapping } from "aws-cdk-lib/aws-lambda";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { updateAnnotationCounts } from "./functions/updateAnnotationCounts/resource";
import { monitorModelProgress } from "./functions/monitorModelProgress/resource";
import { cleanupJobs } from "./functions/cleanupJobs/resource";
import { runHeatmapper } from "./functions/runHeatmapper/resource";
import { runPointFinder } from "./functions/runPointFinder/resource";
import * as ssm from "aws-cdk-lib/aws-ssm";

const backend = defineBackend({
  auth,
  data,
  addUserToGroup,
  outputBucket,
  inputBucket,
  handleS3Upload,
  processImages,
  postDeploy,
  getAnnotationCounts,
  updateUserStats,
  updateAnnotationCounts,
  monitorModelProgress,
  runHeatmapper,
  runPointFinder,
  cleanupJobs,
});

const observationTable = backend.data.resources.tables["Observation"];
const annotationTable = backend.data.resources.tables["Annotation"];
const policy = new Policy(
  Stack.of(observationTable),
  "MyDynamoDBFunctionStreamingPolicy",
  {
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "dynamodb:DescribeStream",
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:ListStreams",
        ],
        resources: ["*"],
      }),
    ],
  }
);
backend.updateUserStats.resources.lambda.role?.attachInlinePolicy(policy);

const mapping1 = new EventSourceMapping(
  Stack.of(observationTable),
  "ObservationEventStreamMapping",
  {
    target: backend.updateUserStats.resources.lambda,
    eventSourceArn: observationTable.tableStreamArn,
    startingPosition: StartingPosition.LATEST,
  }
);
mapping1.node.addDependency(policy);

const authenticatedRole = backend.auth.resources.authenticatedUserIamRole;
const dynamoDbPolicy = new iam.PolicyStatement({
  actions: ["dynamodb:Query"],
  resources: ["*"],
});

backend.getAnnotationCounts.resources.lambda.addToRolePolicy(dynamoDbPolicy);
//Attach the dynamoDbPolicy to the authenticatedRole
authenticatedRole.addToPrincipalPolicy(dynamoDbPolicy);

//backend.data.resources.tables['Annotation'].grantReadData(backend.getAnnotationCounts.resources.lambda)
//backend.getAnnotationCounts.addEnvironment('ANNOTATION_TABLE', backend.data.resources.tables['Annotation'].tableName)

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

authenticatedRole.addToPrincipalPolicy(sqsCreateQueueStatement);
authenticatedRole.addToPrincipalPolicy(sqsConsumeQueueStatement);
authenticatedRole.addToPrincipalPolicy(cognitoAdmin);
authenticatedRole.addToPrincipalPolicy(lambdaInvoke);

const lambdaFunction = backend.handleS3Upload.resources
  .lambda as lambda.Function;
const layerVersion = new lambda.LayerVersion(
  Stack.of(lambdaFunction),
  "sharpLayer",
  {
    code: lambda.Code.fromAsset("./amplify/layers/sharp-ph200-x64"),
    description: "Sharp layer for image processing (ph200-x86_64)",
    compatibleArchitectures: [lambda.Architecture.X86_64],
  }
);
lambdaFunction.addLayers(layerVersion);
backend.handleS3Upload.resources.cfnResources.cfnFunction.addPropertyOverride(
  "ReservedConcurrentExecutions",
  5
);

const customStack = backend.createStack("DetwebCustom");
const ecsStack = backend.createStack("DetwebECS");
//const custom = createDetwebResources(customStack, backend)
const ecsTaskRole = new iam.Role(ecsStack, "EcsTaskRole", {
  assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
});

const vpc = new ec2.Vpc(customStack, "my-cdk-vpc");
const ecsvpc = new ec2.Vpc(ecsStack, "my-cdk-vpc");
ecsTaskRole.addManagedPolicy(
  iam.ManagedPolicy.fromAwsManagedPolicyName("AWSAppSyncInvokeFullAccess")
);
const pointFinderAutoProcessor = new AutoProcessor(
  ecsStack,
  "CpuAutoProcessor",
  {
    vpc: ecsvpc,
    instanceType: ec2.InstanceType.of(
      ec2.InstanceClass.T3,
      ec2.InstanceSize.SMALL
    ),
    ecsImage: ecs.ContainerImage.fromAsset("containerImages/pointFinderImage"),
    ecsTaskRole,
    environment: {
      API_ENDPOINT: backend.data.graphqlUrl,
      API_KEY: backend.data.apiKey || "",
    },
    machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
  }
);

const envName = process.env.AMPLIFY_ENV ?? process.env.AWS_BRANCH ?? 'production';  // use AWS_BRANCH or default if AMPLIFY_ENV is undefined

new ssm.StringParameter(ecsStack, "PointFinderQueueUrlParameter", {
  parameterName: `/${envName}/runPointFinder/QueueUrl`,
  stringValue: pointFinderAutoProcessor.queue.queueUrl,
});

ecsTaskRole.addToPrincipalPolicy(
  new iam.PolicyStatement({
    actions: ["s3:ListBucket", "s3:GetObject", "s3:PutObject"],
    resources: ["arn:aws:s3:::*"],
  })
);

pointFinderAutoProcessor.asg.role.addManagedPolicy(
  iam.ManagedPolicy.fromAwsManagedPolicyName("AWSAppSyncInvokeFullAccess")
);

const lightGlueAutoProcessor = new AutoProcessor(ecsStack, "GpuAutoProcessor", {
  vpc,
  instanceType: ec2.InstanceType.of(
    ec2.InstanceClass.G4DN,
    ec2.InstanceSize.XLARGE
  ),
  ecsImage: ecs.ContainerImage.fromAsset("containerImages/lightGlueImage"),
  ecsTaskRole,
  memoryLimitMiB: 1024 * 12,
  gpuCount: 1,
  environment: {
    API_ENDPOINT: backend.data.graphqlUrl,
    API_KEY: backend.data.apiKey || "",
    BUCKET: backend.inputBucket.resources.bucket.bucketName,
  },
  machineImage: ecs.EcsOptimizedImage.amazonLinux2(ecs.AmiHardwareType.GPU),
});

lightGlueAutoProcessor.asg.role.addManagedPolicy(
  iam.ManagedPolicy.fromAwsManagedPolicyName("AWSAppSyncInvokeFullAccess")
);

const repo = Repository.fromRepositoryArn(
  ecsStack,
  "ScoutbotRepo",
  "arn:aws:ecr:eu-west-2:275736403632:repository/cdk-hnb659fds-container-assets-275736403632-eu-west-2"
);

const scoutbotAutoProcessor = new AutoProcessor(
  ecsStack,
  "ScoutbotAutoProcessor",
  {
    vpc,
    instanceType: ec2.InstanceType.of(
      ec2.InstanceClass.G4DN,
      ec2.InstanceSize.XLARGE
    ),
    ecsImage: ecs.ContainerImage.fromAsset("containerImages/scoutbot"),
    ecsTaskRole,
    memoryLimitMiB: 1024 * 12,
    gpuCount: 1,
    environment: {
      API_ENDPOINT: backend.data.graphqlUrl,
      API_KEY: backend.data.apiKey || "",
      BUCKET: backend.inputBucket.resources.bucket.bucketName,
    },
    machineImage: ecs.EcsOptimizedImage.amazonLinux2(ecs.AmiHardwareType.GPU),
    rootVolumeSize: 100,
  }
);

scoutbotAutoProcessor.asg.role.addManagedPolicy(
  iam.ManagedPolicy.fromAwsManagedPolicyName("AWSAppSyncInvokeFullAccess")
);

//const devRole = iam.Role.fromRoleArn(scope, "DevRole", devUserArn);

// Grant the devuser permission to assume the Subsample Lambda role
// devRole.attachInlinePolicy(new iam.Policy(scope, 'AssumeRolePolicy', {
//   statements: [new iam.PolicyStatement({
//     actions: ['sts:AssumeRole'],
//     resources: [subsampleLambdaRole.roleArn],
//   })],
// }));

const processor = new EC2QueueProcessor(customStack, "MyProcessor", {
  vpc: vpc, // Your VPC
  instanceType: ec2.InstanceType.of(
    ec2.InstanceClass.G4DN,
    ec2.InstanceSize.XLARGE
  ), // Or any instance type you prefer
  amiId: "ami-0d0e015cd8fe6c8c1", // Your AMI ID
  keyName: "surveyscope", // Optional: Your EC2 key pair name
});

backend.processImages.addEnvironment(
  "PROCESS_QUEUE_URL",
  processor.queue.queueUrl
);

backend.monitorModelProgress.addEnvironment(
  "RUN_POINT_FINDER_FUNCTION_NAME",
  backend.runPointFinder.resources.lambda.functionName
);

backend.runHeatmapper.addEnvironment(
  "PROCESS_QUEUE_URL",
  processor.queue.queueUrl
);

backend.runPointFinder.addEnvironment(
  "POINT_FINDER_QUEUE_URL_PARAM",
  `/${envName}/runPointFinder/QueueUrl`
);

const statement = new iam.PolicyStatement({
  sid: "AllowPublishToDigest",
  actions: ["sqs:SendMessage"],
  resources: ["*"],
});
backend.processImages.resources.lambda.addToRolePolicy(statement);
backend.addOutput({
  custom: {
    lightglueTaskQueueUrl: lightGlueAutoProcessor.queue.queueUrl,
    scoutbotTaskQueueUrl: scoutbotAutoProcessor.queue.queueUrl,
    processTaskQueueUrl: processor.queue.queueUrl,
    pointFinderTaskQueueUrl: pointFinderAutoProcessor.queue.queueUrl,
    annotationTable: backend.data.resources.tables["Annotation"].tableName,
    locationTable: backend.data.resources.tables["Location"].tableName,
    imageTable: backend.data.resources.tables["Image"].tableName,
    imageSetTable: backend.data.resources.tables["ImageSet"].tableName,
    categoryTable: backend.data.resources.tables["Category"].tableName,
    projectTable: backend.data.resources.tables["Project"].tableName,
    imageSetMembershipsTable:
      backend.data.resources.tables["ImageSetMembership"].tableName,
    observationTable: backend.data.resources.tables["Observation"].tableName,
  },
});
