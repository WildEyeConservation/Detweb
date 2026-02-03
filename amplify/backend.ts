import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { addUserToGroup } from './functions/add-user-to-group/resource';
import { Stack, Fn } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { outputBucket, inputBucket } from './storage/resource';
import { handleS3Upload } from './storage/handleS3Upload/resource';
//import * as sts from '@aws-sdk/client-sts';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { AutoProcessor } from './autoProcessor';
import { EC2QueueProcessor } from './ec2QueueProcessor';
import { processImages } from './functions/processImages/resource';
import { postDeploy } from './functions/postDeploy/resource';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { updateUserStats } from './functions/updateUserStats/resource';
import { Policy, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { StartingPosition, EventSourceMapping } from 'aws-cdk-lib/aws-lambda';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { monitorModelProgress } from './functions/monitorModelProgress/resource';
import { cleanupJobs } from './functions/cleanupJobs/resource';
import { runHeatmapper } from './functions/runHeatmapper/resource';
import { runPointFinder } from './functions/runPointFinder/resource';
import { runImageRegistration } from './functions/runImageRegistration/resource';
import { runScoutbot } from './functions/runScoutbot/resource';
import { runMadDetector } from './functions/runMadDetector/resource';
import { launchAnnotationSet } from './functions/launchAnnotationSet/resource';
import { launchFalseNegatives } from './functions/launchFalseNegatives/resource';
import { requeueProjectQueues } from './functions/requeueProjectQueues/resource';
import { monitorScoutbotDlq } from './functions/monitorScoutbotDlq/resource';
import { processTilingBatch } from './functions/processTilingBatch/resource';
import { monitorTilingTasks } from './functions/monitorTilingTasks/resource';
import { findAndRequeueMissingLocations } from './functions/findAndRequeueMissingLocations/resource';
import * as ssm from 'aws-cdk-lib/aws-ssm';

// Register all Amplify-managed resources in a single backend definition.
const backend = defineBackend({
  auth,
  data,
  addUserToGroup,
  outputBucket,
  inputBucket,
  handleS3Upload,
  processImages,
  postDeploy,
  updateUserStats,
  monitorModelProgress,
  runHeatmapper,
  runPointFinder,
  runImageRegistration,
  runScoutbot,
  runMadDetector,
  cleanupJobs,
  launchAnnotationSet,
  launchFalseNegatives,
  requeueProjectQueues,
  monitorScoutbotDlq,
  processTilingBatch,
  monitorTilingTasks,
  findAndRequeueMissingLocations,
});

const observationTable = backend.data.resources.tables['Observation'];
const annotationTable = backend.data.resources.tables['Annotation'];
// Allow the updateUserStats Lambda to read Observation DynamoDB streams.
const policy = new Policy(
  Stack.of(observationTable),
  'MyDynamoDBFunctionStreamingPolicy',
  {
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'dynamodb:DescribeStream',
          'dynamodb:GetRecords',
          'dynamodb:GetShardIterator',
          'dynamodb:ListStreams',
        ],
        resources: ['*'],
      }),
    ],
  }
);
backend.updateUserStats.resources.lambda.role?.attachInlinePolicy(policy);

// Pipe Observation table stream records into the stats updater Lambda.
const mapping1 = new EventSourceMapping(
  Stack.of(observationTable),
  'ObservationEventStreamMapping',
  {
    target: backend.updateUserStats.resources.lambda,
    eventSourceArn: observationTable.tableStreamArn,
    startingPosition: StartingPosition.LATEST,
  }
);
mapping1.node.addDependency(policy);

// Expand the default authenticated Cognito role with data-plane permissions.
const authenticatedRole = backend.auth.resources.authenticatedUserIamRole;
const dynamoDbPolicy = new iam.PolicyStatement({
  actions: ['dynamodb:Query', 'dynamodb:Scan', 'dynamodb:BatchGetItem'],
  resources: ['*'],
});

//Attach the dynamoDbPolicy to the authenticatedRole
authenticatedRole.addToPrincipalPolicy(dynamoDbPolicy);

// Shared SQS permissions for Lambdas and groups that spin up task queues.
const sqsCreateQueueStatement = new iam.PolicyStatement({
  actions: [
    'sqs:CreateQueue',
    'sqs:PurgeQueue',
    'sqs:SendMessage',
    'sqs:DeleteQueue',
    'sqs:GetQueueAttributes',
    'sqs:GetQueueUrl',
  ],
  resources: ['*'],
});
const sqsConsumeQueueStatement = new iam.PolicyStatement({
  actions: [
    'sqs:ReceiveMessage',
    'sqs:DeleteMessage',
    'sqs:GetQueueAttributes',
    'sqs:GetQueueUrl',
    'sqs:ChangeMessageVisibility',
  ],
  resources: ['*'],
});
const cognitoAdmin = new iam.PolicyStatement({
  actions: [
    'cognito-idp:AdminRemoveUserFromGroup',
    'cognito-idp:AdminAddUserToGroup',
  ],
  resources: ['*'],
});
const lambdaInvoke = new iam.PolicyStatement({
  actions: ['lambda:InvokeFunction'],
  resources: ['*'],
});

// Direct access to the legacy surveyscope bucket outside Amplify storage.
const generalBucketArn = 'arn:aws:s3:::surveyscope';
const generalBucketArn2 = 'arn:aws:s3:::surveyscope/*';
const generalBucketPolicy = new iam.PolicyStatement({
  actions: ['s3:ListBucket', 's3:GetObject'],
  resources: [generalBucketArn, generalBucketArn2],
});

// Grant S3 permissions to Cognito user pool group roles without referencing the storage resource
// to avoid circular dependencies between stacks.
const groupS3ListPolicy = new iam.PolicyStatement({
  actions: ['s3:ListBucket'],
  resources: ['arn:aws:s3:::*'],
});

const groupS3ObjectsPolicy = new iam.PolicyStatement({
  actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
  resources: ['arn:aws:s3:::*/images/*'],
});

// Allow reading tiles and results from the outputs bucket prefixes
const groupS3OutputsReadPolicy = new iam.PolicyStatement({
  actions: ['s3:GetObject'],
  resources: ['arn:aws:s3:::*/slippymaps/*', 'arn:aws:s3:::*/heatmaps/*'],
});

// Allow writing launch payloads to the outputs bucket
const groupS3LaunchPayloadsPolicy = new iam.PolicyStatement({
  actions: ['s3:PutObject'],
  resources: ['arn:aws:s3:::*/launch-payloads/*'],
});

// Allow writing queue manifests to the outputs bucket
const groupS3QueueManifestsPolicy = new iam.PolicyStatement({
  actions: ['s3:PutObject'],
  resources: ['arn:aws:s3:::*/queue-manifests/*'],
});

// Allow Cognito group roles to query DynamoDB tables and GSIs without
// referencing specific data resources to avoid circular dependencies.
const groupDynamoDbQueryPolicy = new iam.PolicyStatement({
  actions: ['dynamodb:Query', 'dynamodb:Scan', 'dynamodb:BatchGetItem'],
  resources: [
    'arn:aws:dynamodb:*:*:table/*',
    'arn:aws:dynamodb:*:*:table/*/index/*',
  ],
});

const groupEcsListPolicy = new iam.PolicyStatement({
  actions: ['ecs:ListClusters', 'ecs:DescribeClusters', 'ecs:ListServices', 'ecs:DescribeServices'],
  resources: ['*'],
});

authenticatedRole.addToPrincipalPolicy(sqsCreateQueueStatement);
authenticatedRole.addToPrincipalPolicy(sqsConsumeQueueStatement);
authenticatedRole.addToPrincipalPolicy(cognitoAdmin);
authenticatedRole.addToPrincipalPolicy(lambdaInvoke);
authenticatedRole.addToPrincipalPolicy(generalBucketPolicy);
authenticatedRole.addToPrincipalPolicy(groupEcsListPolicy);
authenticatedRole.addToPrincipalPolicy(groupS3LaunchPayloadsPolicy);
authenticatedRole.addToPrincipalPolicy(groupS3QueueManifestsPolicy);

// Ensure every Cognito group role has consistent S3/Dynamo/SQS capabilities.
Object.values(backend.auth.resources.groups).forEach(({ role }) => {
  role.addToPrincipalPolicy(generalBucketPolicy);
  role.addToPrincipalPolicy(groupS3ListPolicy);
  role.addToPrincipalPolicy(groupS3ObjectsPolicy);
  role.addToPrincipalPolicy(groupDynamoDbQueryPolicy);
  // Also allow group roles to create and consume SQS queues
  role.addToPrincipalPolicy(sqsCreateQueueStatement);
  role.addToPrincipalPolicy(sqsConsumeQueueStatement);
  role.addToPrincipalPolicy(groupS3OutputsReadPolicy);
  role.addToPrincipalPolicy(groupEcsListPolicy);
  role.addToPrincipalPolicy(groupS3LaunchPayloadsPolicy);
  role.addToPrincipalPolicy(groupS3QueueManifestsPolicy);
});

// Add the Sharp layer and throttle concurrency on the image upload Lambda.
const lambdaFunction = backend.handleS3Upload.resources
  .lambda as lambda.Function;
const layerVersion = new lambda.LayerVersion(
  Stack.of(lambdaFunction),
  'sharpLayer',
  {
    code: lambda.Code.fromAsset('./amplify/layers/sharp-ph200-x64'),
    description: 'Sharp layer for image processing (ph200-x86_64)',
    compatibleArchitectures: [lambda.Architecture.X86_64],
  }
);
lambdaFunction.addLayers(layerVersion);
backend.handleS3Upload.resources.cfnResources.cfnFunction.addPropertyOverride(
  'ReservedConcurrentExecutions',
  5
);

// Additional stack for bespoke EC2/ECS compute and shared infra.
const customStack = backend.createStack('DetwebCustom');
const enableEcs = true;
const enablePointFinder =
  (process.env.AMPLIFY_ENABLE_ECS_POINTFINDER ?? 'true').toLowerCase() ===
  'true';
const enableLightGlue =
  (process.env.AMPLIFY_ENABLE_ECS_LIGHTGLUE ?? 'true').toLowerCase() === 'true';
const enableScoutbot =
  (process.env.AMPLIFY_ENABLE_ECS_SCOUTBOT ?? 'true').toLowerCase() === 'true';
const enableMadDetector =
  (process.env.AMPLIFY_ENABLE_ECS_MAD ?? 'true').toLowerCase() === 'true';

// Base VPC that hosts the EC2 queue processor.
const vpc = new ec2.Vpc(customStack, 'my-cdk-vpc');

// Derive an environment name for parameter paths and tagging.
const envName =
  process.env.AMPLIFY_ENV ?? process.env.AWS_BRANCH ?? 'production'; // use AWS_BRANCH or default if AMPLIFY_ENV is undefined

// Collect queue URLs so they can be exposed as stack outputs.
let pointFinderQueueUrl: string | undefined;
let lightglueQueueUrl: string | undefined;
let scoutbotQueueUrl: string | undefined;
let madDetectorQueueUrl: string | undefined;

if (enableEcs) {
  // Provision ECS auto-processors when the feature flags are enabled.
  const ecsStack = backend.createStack('DetwebECS');
  //const custom = createDetwebResources(customStack, backend)
  const ecsTaskRole = new iam.Role(ecsStack, 'EcsTaskRole', {
    assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
  });

  const ecsvpc = new ec2.Vpc(ecsStack, 'my-cdk-vpc');
  ecsTaskRole.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName('AWSAppSyncInvokeFullAccess')
  );
  // Common S3 access for tasks
  ecsTaskRole.addToPrincipalPolicy(
    new iam.PolicyStatement({
      actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject'],
      resources: ['arn:aws:s3:::*'],
    })
  );

  if (enablePointFinder) {
    // CPU-backed auto processor for Point Finder jobs.
    const pointFinderAutoProcessor = new AutoProcessor(
      ecsStack,
      'CpuAutoProcessor',
      {
        vpc: ecsvpc,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.SMALL
        ),
        ecsImage: ecs.ContainerImage.fromAsset(
          'containerImages/pointFinderImage'
        ),
        ecsTaskRole,
        environment: {
          API_ENDPOINT: backend.data.graphqlUrl,
          API_KEY: backend.data.apiKey || '',
        },
        machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
      }
    );

    new ssm.StringParameter(ecsStack, 'PointFinderQueueUrlParameter', {
      parameterName: `/${envName}/runPointFinder/QueueUrl`,
      stringValue: pointFinderAutoProcessor.queue.queueUrl,
    });

    pointFinderAutoProcessor.asg.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AWSAppSyncInvokeFullAccess')
    );

    pointFinderQueueUrl = pointFinderAutoProcessor.queue.queueUrl;
  }

  if (enableLightGlue) {
    // GPU-backed auto processor tailored for LightGlue workloads.
    const lightGlueAutoProcessor = new AutoProcessor(
      ecsStack,
      'GpuAutoProcessor',
      {
        vpc: ecsvpc,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.G4DN,
          ec2.InstanceSize.XLARGE
        ),
        ecsImage: ecs.ContainerImage.fromAsset(
          'containerImages/lightGlueImage'
        ),
        ecsTaskRole,
        memoryLimitMiB: 1024 * 12,
        gpuCount: 1,
        environment: {
          API_ENDPOINT: backend.data.graphqlUrl,
          API_KEY: backend.data.apiKey || '',
          BUCKET: backend.inputBucket.resources.bucket.bucketName,
        },
        machineImage: ecs.EcsOptimizedImage.amazonLinux2(
          ecs.AmiHardwareType.GPU
        ),
      }
    );

    lightGlueAutoProcessor.asg.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AWSAppSyncInvokeFullAccess')
    );

    lightglueQueueUrl = lightGlueAutoProcessor.queue.queueUrl;
  }

  if (enableScoutbot) {
    // ECR repo reference required by Scoutbot image
    Repository.fromRepositoryArn(
      ecsStack,
      'ScoutbotRepo',
      'arn:aws:ecr:eu-west-2:275736403632:repository/cdk-hnb659fds-container-assets-275736403632-eu-west-2'
    );

    // GPU-backed auto processor for Scoutbot inference.
    const scoutbotAutoProcessor = new AutoProcessor(
      ecsStack,
      'ScoutbotAutoProcessor',
      {
        vpc: ecsvpc,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.G4DN,
          ec2.InstanceSize.XLARGE
        ),
        ecsImage: ecs.ContainerImage.fromAsset('containerImages/scoutbot'),
        ecsTaskRole,
        memoryLimitMiB: 1024 * 12,
        gpuCount: 1,
        environment: {
          API_ENDPOINT: backend.data.graphqlUrl,
          API_KEY: backend.data.apiKey || '',
          BUCKET: backend.inputBucket.resources.bucket.bucketName,
        },
        machineImage: ecs.EcsOptimizedImage.amazonLinux2(
          ecs.AmiHardwareType.GPU
        ),
        rootVolumeSize: 100,
      }
    );

    scoutbotAutoProcessor.asg.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AWSAppSyncInvokeFullAccess')
    );

    scoutbotQueueUrl = scoutbotAutoProcessor.queue.queueUrl;

    new ssm.StringParameter(ecsStack, 'ScoutbotQueueUrlParameter', {
      parameterName: `/${envName}/monitorScoutbotDlq/QueueUrl`,
      stringValue: scoutbotAutoProcessor.queue.queueUrl,
    });
  }

  if (enableMadDetector) {
    // MAD Detector AutoProcessor (GPU)
    const madDetectorAutoProcessor = new AutoProcessor(
      ecsStack,
      'MadDetectorAutoProcessor',
      {
        vpc: ecsvpc,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.G4DN,
          ec2.InstanceSize.XLARGE
        ),
        ecsImage: ecs.ContainerImage.fromAsset('containerImages/madDetector'),
        ecsTaskRole,
        memoryLimitMiB: 1024 * 12,
        gpuCount: 1,
        environment: {
          API_ENDPOINT: backend.data.graphqlUrl,
          API_KEY: backend.data.apiKey || '',
          BUCKET: backend.inputBucket.resources.bucket.bucketName,
          MAD_CHECKPOINT_S3: 's3://surveyscope/2024-mad-v2/checkpoint.pth',
        },
        machineImage: ecs.EcsOptimizedImage.amazonLinux2(
          ecs.AmiHardwareType.GPU
        ),
        rootVolumeSize: 200,
      }
    );

    madDetectorAutoProcessor.asg.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AWSAppSyncInvokeFullAccess')
    );

    madDetectorQueueUrl = madDetectorAutoProcessor.queue.queueUrl;
  }
}

//const devRole = iam.Role.fromRoleArn(scope, "DevRole", devUserArn);

// Grant the devuser permission to assume the Subsample Lambda role
// devRole.attachInlinePolicy(new iam.Policy(scope, 'AssumeRolePolicy', {
//   statements: [new iam.PolicyStatement({
//     actions: ['sts:AssumeRole'],
//     resources: [subsampleLambdaRole.roleArn],
//   })],
// }));

// Legacy EC2 queue processor that feeds the general image pipeline.
const processor = new EC2QueueProcessor(customStack, 'MyProcessor', {
  vpc: vpc, // Your VPC
  instanceType: ec2.InstanceType.of(
    ec2.InstanceClass.G4DN,
    ec2.InstanceSize.XLARGE
  ), // Or any instance type you prefer
  amiId: 'ami-0d0e015cd8fe6c8c1', // Your AMI ID
  keyName: 'surveyscope', // Optional: Your EC2 key pair name
});

// Inject queue URLs and function names into the runtime environment.
backend.processImages.addEnvironment(
  'PROCESS_QUEUE_URL',
  processor.queue.queueUrl
);

backend.monitorModelProgress.addEnvironment(
  'RUN_POINT_FINDER_FUNCTION_NAME',
  backend.runPointFinder.resources.lambda.functionName
);

backend.runHeatmapper.addEnvironment(
  'PROCESS_QUEUE_URL',
  processor.queue.queueUrl
);

backend.runPointFinder.addEnvironment(
  'POINT_FINDER_QUEUE_URL_PARAM',
  `/${envName}/runPointFinder/QueueUrl`
);

// Inject tiling batch lambda function name for orchestrating lambdas
backend.launchAnnotationSet.addEnvironment(
  'PROCESS_TILING_BATCH_FUNCTION_NAME',
  backend.processTilingBatch.resources.lambda.functionName
);
backend.launchFalseNegatives.addEnvironment(
  'PROCESS_TILING_BATCH_FUNCTION_NAME',
  backend.processTilingBatch.resources.lambda.functionName
);
// processTilingBatch needs to invoke itself for sequential chaining
backend.processTilingBatch.addEnvironment(
  'PROCESS_TILING_BATCH_FUNCTION_NAME',
  backend.processTilingBatch.resources.lambda.functionName
);

// Allow processImages to publish Digests into SQS.
const statement = new iam.PolicyStatement({
  sid: 'AllowPublishToDigest',
  actions: ['sqs:SendMessage'],
  resources: ['*'],
});
backend.processImages.resources.lambda.addToRolePolicy(statement);

// Allow lambdas that enqueue work to SQS to send messages
backend.runImageRegistration.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['sqs:SendMessage', 'sqs:GetQueueAttributes', 'sqs:GetQueueUrl'],
    resources: ['*'],
  })
);
backend.runScoutbot.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['sqs:SendMessage', 'sqs:GetQueueAttributes', 'sqs:GetQueueUrl'],
    resources: ['*'],
  })
);
backend.runScoutbot.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['lambda:InvokeFunction'],
    resources: ['*'],
  })
);
backend.runMadDetector.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['sqs:SendMessage', 'sqs:GetQueueAttributes', 'sqs:GetQueueUrl'],
    resources: ['*'],
  })
);
backend.runMadDetector.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['lambda:InvokeFunction'],
    resources: ['*'],
  })
);
backend.cleanupJobs.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['sqs:DeleteQueue', 'sqs:GetQueueAttributes'],
    resources: ['*'],
  })
);
// cleanupJobs needs S3 permissions to delete location manifests
backend.cleanupJobs.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['s3:DeleteObject'],
    resources: ['arn:aws:s3:::*/queue-manifests/*'],
  })
);
backend.launchAnnotationSet.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: [
      'sqs:CreateQueue',
      'sqs:SendMessage',
      'sqs:GetQueueAttributes',
      'sqs:GetQueueUrl',
    ],
    resources: ['*'],
  })
);
backend.launchFalseNegatives.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: [
      'sqs:CreateQueue',
      'sqs:SendMessage',
      'sqs:GetQueueAttributes',
      'sqs:GetQueueUrl',
    ],
    resources: ['*'],
  })
);
// launchAnnotationSet and launchFalseNegatives need Lambda invoke for tiling batches
backend.launchAnnotationSet.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['lambda:InvokeFunction'],
    resources: ['*'],
  })
);
backend.launchFalseNegatives.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['lambda:InvokeFunction'],
    resources: ['*'],
  })
);
// processTilingBatch needs Lambda invoke for sequential chaining
backend.processTilingBatch.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['lambda:InvokeFunction'],
    resources: ['*'],
  })
);
// monitorTilingTasks needs SQS permissions for queue creation and messaging
backend.monitorTilingTasks.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: [
      'sqs:CreateQueue',
      'sqs:SendMessage',
      'sqs:GetQueueAttributes',
      'sqs:GetQueueUrl',
    ],
    resources: ['*'],
  })
);
backend.runPointFinder.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['sqs:SendMessage', 'sqs:GetQueueAttributes', 'sqs:GetQueueUrl'],
    resources: ['*'],
  })
);
backend.requeueProjectQueues.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: [
      'sqs:GetQueueAttributes',
      'sqs:GetQueueUrl',
      'sqs:ReceiveMessage',
      'sqs:DeleteMessage',
      'sqs:SendMessage',
      'sqs:ChangeMessageVisibility',
    ],
    resources: ['*'],
  })
);
// runPointFinder also reads the SSM parameter for its queue URL
backend.runPointFinder.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['ssm:GetParameter'],
    resources: ['arn:aws:ssm:*:*:parameter/*'],
  })
);

// monitorScoutbotDlq needs SQS permissions for queue manipulation
backend.monitorScoutbotDlq.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: [
      'sqs:GetQueueAttributes',
      'sqs:GetQueueUrl',
      'sqs:ReceiveMessage',
      'sqs:DeleteMessage',
      'sqs:SendMessage',
      'sqs:ChangeMessageVisibility',
    ],
    resources: ['*'],
  })
);
// monitorScoutbotDlq needs ECS permissions to check service status
backend.monitorScoutbotDlq.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: [
      'ecs:ListClusters',
      'ecs:DescribeClusters',
      'ecs:ListServices',
      'ecs:DescribeServices',
    ],
    resources: ['*'],
  })
);
// Set the scoutbot queue URL SSM parameter path as an environment variable
backend.monitorScoutbotDlq.addEnvironment(
  'SCOUTBOT_QUEUE_URL_PARAM',
  `/${envName}/monitorScoutbotDlq/QueueUrl`
);
// monitorScoutbotDlq needs to read the SSM parameter for the queue URL
backend.monitorScoutbotDlq.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['ssm:GetParameter'],
    resources: ['arn:aws:ssm:*:*:parameter/*'],
  })
);

// findAndRequeueMissingLocations needs SQS permissions to send requeued messages
backend.findAndRequeueMissingLocations.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: [
      'sqs:GetQueueAttributes',
      'sqs:GetQueueUrl',
      'sqs:SendMessage',
    ],
    resources: ['*'],
  })
);

const generalBucketName = 'surveyscope';

// Expose useful resource identifiers for downstream tooling.
backend.addOutput({
  custom: {
    lightglueTaskQueueUrl: lightglueQueueUrl ?? '',
    scoutbotTaskQueueUrl: scoutbotQueueUrl ?? '',
    madDetectorTaskQueueUrl: madDetectorQueueUrl ?? '',
    processTaskQueueUrl: processor.queue.queueUrl,
    pointFinderTaskQueueUrl: pointFinderQueueUrl ?? '',
    annotationTable: backend.data.resources.tables['Annotation'].tableName,
    locationTable: backend.data.resources.tables['Location'].tableName,
    imageTable: backend.data.resources.tables['Image'].tableName,
    imageSetTable: backend.data.resources.tables['ImageSet'].tableName,
    categoryTable: backend.data.resources.tables['Category'].tableName,
    projectTable: backend.data.resources.tables['Project'].tableName,
    imageSetMembershipsTable:
      backend.data.resources.tables['ImageSetMembership'].tableName,
    observationTable: backend.data.resources.tables['Observation'].tableName,
    generalBucketName: generalBucketName,
  },
});
