import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { addUserToGroup } from './functions/add-user-to-group/resource';
import { Stack, Fn } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { outputBucket, inputBucket } from './storage/resource';
import { generateTile } from './storage/generateTile/resource';
import { handleS3Upload } from './storage/handleS3Upload/resource';
//import * as sts from '@aws-sdk/client-sts';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { AutoProcessor } from './autoProcessor';
import { postDeploy } from './functions/postDeploy/resource';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { updateUserStats } from './functions/updateUserStats/resource';
import { Policy, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { StartingPosition, EventSourceMapping } from 'aws-cdk-lib/aws-lambda';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { monitorModelProgress } from './functions/monitorModelProgress/resource';
import { cleanupJobs } from './functions/cleanupJobs/resource';
import { runImageRegistration } from './functions/runImageRegistration/resource';
import { runScoutbot } from './functions/runScoutbot/resource';
import { runMadDetector } from './functions/runMadDetector/resource';
import { runStormflyDetector } from './functions/runStormflyDetector/resource';
import { runElephantDetector } from './functions/runElephantDetector/resource';
import { launchAnnotationSet } from './functions/launchAnnotationSet/resource';
import { launchFalseNegatives } from './functions/launchFalseNegatives/resource';
import { requeueProjectQueues } from './functions/requeueProjectQueues/resource';
import { monitorScoutbotDlq } from './functions/monitorScoutbotDlq/resource';
import { processTilingBatch } from './functions/processTilingBatch/resource';
import { monitorTilingTasks } from './functions/monitorTilingTasks/resource';
import { findAndRequeueMissingLocations } from './functions/findAndRequeueMissingLocations/resource';
import { reconcileFalseNegatives } from './functions/reconcileFalseNegatives/resource';
import { createOrganization } from './functions/createOrganization/resource';
import { inviteUserToOrganization } from './functions/inviteUserToOrganization/resource';
import { respondToInvite } from './functions/respondToInvite/resource';
import { removeUserFromOrganization } from './functions/removeUserFromOrganization/resource';
import { updateOrganizationMemberAdmin } from './functions/updateOrganizationMemberAdmin/resource';
import { deleteQueue } from './functions/deleteQueue/resource';
import { updateActiveOrganizations } from './functions/updateActiveOrganizations/resource';
import { launchQCReview } from './functions/launchQCReview/resource';
import { launchHomography } from './functions/launchHomography/resource';
import { reconcileHomographies } from './functions/reconcileHomographies/resource';
import { registrationBucketCleanup } from './functions/registrationBucketCleanup/resource';
import { deleteRegistrationNeighbour } from './functions/deleteRegistrationNeighbour/resource';
import { processRegistrationStream } from './functions/processRegistrationStream/resource';
import { pretileImage } from './functions/pretileImage/resource';
import { refreshTiles } from './functions/refreshTiles/resource';
import { reconcilePretileLaunches } from './functions/reconcilePretileLaunches/resource';
import { extendTileLifecycles } from './functions/extendTileLifecycles/resource';
import { launchIndividualId } from './functions/launchIndividualId/resource';
import { updateImageTransect } from './functions/updateImageTransect/resource';
import { claimIndividualIdTransect } from './functions/claimIndividualIdTransect/resource';
import { completeIndividualIdTransect } from './functions/completeIndividualIdTransect/resource';
import { reconcileIndividualId } from './functions/reconcileIndividualId/resource';
import { releaseIndividualIdTransects } from './functions/releaseIndividualIdTransects/resource';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Duration } from 'aws-cdk-lib';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

// Register all Amplify-managed resources in a single backend definition.
const backend = defineBackend({
  auth,
  data,
  addUserToGroup,
  outputBucket,
  inputBucket,
  generateTile,
  handleS3Upload,
  postDeploy,
  updateUserStats,
  monitorModelProgress,
  runImageRegistration,
  runScoutbot,
  runMadDetector,
  runStormflyDetector,
  runElephantDetector,
  cleanupJobs,
  launchAnnotationSet,
  launchFalseNegatives,
  requeueProjectQueues,
  monitorScoutbotDlq,
  processTilingBatch,
  monitorTilingTasks,
  findAndRequeueMissingLocations,
  reconcileFalseNegatives,
  createOrganization,
  inviteUserToOrganization,
  respondToInvite,
  removeUserFromOrganization,
  updateOrganizationMemberAdmin,
  deleteQueue,
  updateActiveOrganizations,
  launchQCReview,
  launchHomography,
  reconcileHomographies,
  registrationBucketCleanup,
  deleteRegistrationNeighbour,
  processRegistrationStream,
  pretileImage,
  refreshTiles,
  reconcilePretileLaunches,
  extendTileLifecycles,
  launchIndividualId,
  updateImageTransect,
  claimIndividualIdTransect,
  completeIndividualIdTransect,
  reconcileIndividualId,
  releaseIndividualIdTransects,
});

const userPoolClient = backend.auth.resources.cfnResources.cfnUserPoolClient;
userPoolClient.accessTokenValidity = 24 * 60;
userPoolClient.idTokenValidity = 24 * 60;
userPoolClient.tokenValidityUnits = {
  accessToken: 'minutes',
  idToken: 'minutes',
  refreshToken: 'days',
};

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

// Backfill Location.group from the project's organizationId on INSERT
const backfillStack = backend.createStack('BackfillLocationGroup');
const locationTable = backend.data.resources.tables['Location'];
const projectTable = backend.data.resources.tables['Project'];

const backfillFn = new NodejsFunction(backfillStack, 'BackfillLocationGroupFn', {
  entry: path.join(__dirname, 'functions/backfillLocationGroup/handler.ts'),
  handler: 'handler',
  runtime: lambda.Runtime.NODEJS_20_X,
  environment: {
    LOCATION_TABLE_NAME: locationTable.tableName,
    PROJECT_TABLE_NAME: projectTable.tableName,
  },
});

backfillFn.addToRolePolicy(
  new iam.PolicyStatement({
    actions: [
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:UpdateItem',
      'dynamodb:Query',
    ],
    resources: [locationTable.tableArn, `${locationTable.tableArn}/index/*`],
  })
);
backfillFn.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['dynamodb:GetItem', 'dynamodb:Query'],
    resources: [projectTable.tableArn, `${projectTable.tableArn}/index/*`],
  })
);
backfillFn.addToRolePolicy(
  new iam.PolicyStatement({
    actions: [
      'dynamodb:DescribeStream',
      'dynamodb:GetRecords',
      'dynamodb:GetShardIterator',
      'dynamodb:ListStreams',
    ],
    resources: ['*'],
  })
);

new EventSourceMapping(backfillStack, 'LocationEventStreamMapping', {
  target: backfillFn,
  eventSourceArn: locationTable.tableStreamArn,
  startingPosition: StartingPosition.LATEST,
});

// Expand the default authenticated Cognito role with data-plane permissions.
const authenticatedRole = backend.auth.resources.authenticatedUserIamRole;

// Minimal SQS permissions for annotators (authenticated role).
const sqsAnnotatorStatement = new iam.PolicyStatement({
  actions: [
    'sqs:ReceiveMessage',
    'sqs:DeleteMessage',
    'sqs:GetQueueAttributes',
  ],
  resources: ['*'],
});

// Elevated SQS permissions for sysadmin (DLQ replay, health page, etc.).
const sqsSysadminStatement = new iam.PolicyStatement({
  actions: [
    'sqs:GetQueueUrl',
    'sqs:SendMessage',
    'sqs:SendMessageBatch',
    'sqs:DeleteMessageBatch',
    'sqs:ReceiveMessage',
    'sqs:ChangeMessageVisibility',
  ],
  resources: ['*'],
});
// Direct access to the surveyscope bucket (stores SRTM tiles and checkpoint files) outside Amplify storage.
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
  actions: ['s3:GetObject', 's3:DeleteObject'],
  resources: [
    'arn:aws:s3:::*/slippymaps/*',
    'arn:aws:s3:::*/heatmaps/*',
    'arn:aws:s3:::*/false-negative-manifests/*',
    'arn:aws:s3:::*/false-negative-pools/*',
    'arn:aws:s3:::*/false-negative-history/*',
    'arn:aws:s3:::*/qc-review-manifests/*',
  ],
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

authenticatedRole.addToPrincipalPolicy(sqsAnnotatorStatement);
authenticatedRole.addToPrincipalPolicy(generalBucketPolicy);

// Grant group roles (sysadmin, orgadmin) S3 + base SQS capabilities.
// Group roles REPLACE the authenticated role in Cognito Identity Pools,
// so they need the annotator SQS permissions too.
Object.values(backend.auth.resources.groups).forEach(({ role }) => {
  role.addToPrincipalPolicy(generalBucketPolicy);
  role.addToPrincipalPolicy(groupS3ListPolicy);
  role.addToPrincipalPolicy(groupS3ObjectsPolicy);
  role.addToPrincipalPolicy(groupDynamoDbQueryPolicy);
  role.addToPrincipalPolicy(sqsAnnotatorStatement);
  role.addToPrincipalPolicy(groupS3OutputsReadPolicy);
  role.addToPrincipalPolicy(groupS3LaunchPayloadsPolicy);
  role.addToPrincipalPolicy(groupS3QueueManifestsPolicy);
});

// Only sysadmin gets elevated SQS and ECS permissions.
backend.auth.resources.groups['sysadmin'].role.addToPrincipalPolicy(sqsSysadminStatement);
backend.auth.resources.groups['sysadmin'].role.addToPrincipalPolicy(groupEcsListPolicy);

// Add the Sharp layer to the on-demand tile generation Lambda.
const generateTileLambda = backend.generateTile.resources.lambda as lambda.Function;
const sharpLayer = new lambda.LayerVersion(
  Stack.of(generateTileLambda),
  'sharpLayer',
  {
    code: lambda.Code.fromAsset('./amplify/layers/sharp-ph200-x64'),
    description: 'Sharp layer for image processing (ph200-x86_64)',
    compatibleArchitectures: [lambda.Architecture.X86_64],
  }
);
generateTileLambda.addLayers(sharpLayer);

// Also attach the Sharp layer to the eager on-upload tiler, and throttle
// its concurrency so a bulk upload doesn't spawn thousands of parallel invocations.
const handleS3UploadLambda = backend.handleS3Upload.resources.lambda as lambda.Function;
handleS3UploadLambda.addLayers(sharpLayer);
backend.handleS3Upload.resources.cfnResources.cfnFunction.addPropertyOverride(
  'ReservedConcurrentExecutions',
  50
);

const enableEcs = true;
const enableLightGlue =
  (process.env.AMPLIFY_ENABLE_ECS_LIGHTGLUE ?? 'true').toLowerCase() === 'true';
const enableScoutbot =
  (process.env.AMPLIFY_ENABLE_ECS_SCOUTBOT ?? 'true').toLowerCase() === 'true';
const enableMadDetector =
  (process.env.AMPLIFY_ENABLE_ECS_MAD ?? 'true').toLowerCase() === 'true';
const enableStormflyDetector =
  (process.env.AMPLIFY_ENABLE_ECS_STORMFLY ?? 'true').toLowerCase() === 'true';
const enableElephantDetector =
  (process.env.AMPLIFY_ENABLE_ECS_ELEPHANT ?? 'true').toLowerCase() === 'true';

// Derive an environment name for parameter paths and tagging.
const envName =
  process.env.AMPLIFY_ENV ?? process.env.AWS_BRANCH ?? 'production'; // use AWS_BRANCH or default if AMPLIFY_ENV is undefined

// Collect queue URLs so they can be exposed as stack outputs.
let lightglueQueueUrl: string | undefined;
let scoutbotQueueUrl: string | undefined;
let madDetectorQueueUrl: string | undefined;
let stormflyDetectorQueueUrl: string | undefined;
let elephantDetectorQueueUrl: string | undefined;

if (enableEcs) {
  // Provision ECS auto-processors when the feature flags are enabled.
  const ecsStack = backend.createStack('DetwebECS');
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
          BUCKET: backend.inputBucket.resources.bucket.bucketName,
          SINGLE_IMAGE_FAILURE_VISIBILITY_SECONDS:
            process.env.SCOUTBOT_SINGLE_IMAGE_FAILURE_VISIBILITY_SECONDS ?? '1800',
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
          BUCKET: backend.inputBucket.resources.bucket.bucketName,
        },
        machineImage: ecs.EcsOptimizedImage.amazonLinux2(
          ecs.AmiHardwareType.GPU
        ),
        rootVolumeSize: 100,
        allowSelfRequeue: true,
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

  if (enableStormflyDetector) {
    const stormflyDetectorAutoProcessor = new AutoProcessor(
      ecsStack,
      'StormflyDetectorAutoProcessor',
      {
        vpc: ecsvpc,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.G4DN,
          ec2.InstanceSize.XLARGE
        ),
        ecsImage: ecs.ContainerImage.fromAsset('containerImages/stormflyDetector'),
        ecsTaskRole,
        memoryLimitMiB: 1024 * 12,
        gpuCount: 1,
        environment: {
          API_ENDPOINT: backend.data.graphqlUrl,
          STORMFLY_MODEL_S3:
            process.env.STORMFLY_MODEL_S3 ?? 's3://surveyscope/testing/stormfly.onnx',
          STORMFLY_THRESHOLD: process.env.STORMFLY_THRESHOLD ?? '0.00',
          // Stormfly emits points, while Detweb annotation tasks use rectangular
          // location bounds. Wrap each point in a testing-only fixed-size box.
          STORMFLY_BOX_SIZE: process.env.STORMFLY_BOX_SIZE ?? '64',
          // Inference tuning. STORMFLY_FP16 runs convolutions in half precision.
          // Keep it off by default until fp16/fp32 parity is confirmed.
          // STORMFLY_BATCH is the number of tiles per ONNX call. The current
          // exported model bakes batch=1 into its Swin window reshapes, so any
          // batch > 1 fails with a broadcast error. Keep this at 1 until the
          // model is re-exported / patched for batched inference.
          STORMFLY_FP16: process.env.STORMFLY_FP16 ?? '0',
          STORMFLY_BATCH: process.env.STORMFLY_BATCH ?? '1',
        },
        machineImage: ecs.EcsOptimizedImage.amazonLinux2(
          ecs.AmiHardwareType.GPU
        ),
        rootVolumeSize: 100,
        // Stormfly processes large aerial images sequentially within each message,
        // so scale more aggressively than the shared detector default. Cap at 20
        // tasks to match the other detectors; the low messagesPerTask means the
        // fleet ramps to full width after only ~400 images.
        messagesPerTask: 10,
        maxTasks: 20,
      }
    );

    stormflyDetectorAutoProcessor.asg.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AWSAppSyncInvokeFullAccess')
    );
    stormflyDetectorQueueUrl = stormflyDetectorAutoProcessor.queue.queueUrl;
  }

  if (enableElephantDetector) {
    const elephantDetectorAutoProcessor = new AutoProcessor(
      ecsStack,
      'ElephantDetectorAutoProcessor',
      {
        vpc: ecsvpc,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.G4DN,
          ec2.InstanceSize.XLARGE
        ),
        ecsImage: ecs.ContainerImage.fromAsset('containerImages/heatmapperImage'),
        ecsTaskRole,
        memoryLimitMiB: 1024 * 12,
        gpuCount: 1,
        environment: {
          API_ENDPOINT: backend.data.graphqlUrl,
          BUCKET: backend.inputBucket.resources.bucket.bucketName,
        },
        machineImage: ecs.EcsOptimizedImage.amazonLinux2(
          ecs.AmiHardwareType.GPU
        ),
        rootVolumeSize: 100,
      }
    );

    elephantDetectorAutoProcessor.asg.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AWSAppSyncInvokeFullAccess')
    );
    elephantDetectorQueueUrl = elephantDetectorAutoProcessor.queue.queueUrl;
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

// Inject tiling batch lambda function name for orchestrating lambdas
backend.launchAnnotationSet.addEnvironment(
  'PROCESS_TILING_BATCH_FUNCTION_NAME',
  backend.processTilingBatch.resources.lambda.functionName
);
backend.launchFalseNegatives.addEnvironment(
  'PROCESS_TILING_BATCH_FUNCTION_NAME',
  backend.processTilingBatch.resources.lambda.functionName
);

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
backend.runStormflyDetector.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['sqs:SendMessage', 'sqs:GetQueueAttributes', 'sqs:GetQueueUrl'],
    resources: ['*'],
  })
);
backend.runElephantDetector.resources.lambda.addToRolePolicy(
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
backend.deleteQueue.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['sqs:DeleteQueue', 'sqs:GetQueueAttributes'],
    resources: ['*'],
  })
);
backend.deleteQueue.addEnvironment(
  'RECONCILE_FALSE_NEGATIVES_FUNCTION_NAME',
  backend.reconcileFalseNegatives.resources.lambda.functionName
);
backend.deleteQueue.addEnvironment(
  'RECONCILE_HOMOGRAPHIES_FUNCTION_NAME',
  backend.reconcileHomographies.resources.lambda.functionName
);
backend.deleteQueue.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['lambda:InvokeFunction'],
    resources: [
      backend.reconcileFalseNegatives.resources.lambda.functionArn,
      backend.reconcileHomographies.resources.lambda.functionArn,
    ],
  })
);
// cleanupJobs needs S3 permissions to delete location manifests and FN manifests
backend.cleanupJobs.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['s3:DeleteObject'],
    resources: [
      'arn:aws:s3:::*/queue-manifests/*',
      'arn:aws:s3:::*/false-negative-manifests/*',
      'arn:aws:s3:::*/qc-review-manifests/*',
    ],
  })
);
// cleanupJobs triggers reconcileFalseNegatives when species labelling jobs complete
backend.cleanupJobs.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['lambda:InvokeFunction'],
    resources: [backend.reconcileFalseNegatives.resources.lambda.functionArn],
  })
);
backend.cleanupJobs.addEnvironment(
  'RECONCILE_FALSE_NEGATIVES_FUNCTION_NAME',
  backend.reconcileFalseNegatives.resources.lambda.functionName
);
// reconcileFalseNegatives needs S3 permissions for FN pool and history manifests
backend.reconcileFalseNegatives.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['s3:GetObject', 's3:PutObject'],
    resources: [
      'arn:aws:s3:::*/false-negative-pools/*',
      'arn:aws:s3:::*/false-negative-history/*',
    ],
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
// launchFalseNegatives needs S3 permissions to write queue manifests and FN manifests
backend.launchFalseNegatives.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['s3:PutObject', 's3:GetObject'],
    resources: [
      'arn:aws:s3:::*/queue-manifests/*',
      'arn:aws:s3:::*/false-negative-manifests/*',
      'arn:aws:s3:::*/false-negative-pools/*',
      'arn:aws:s3:::*/false-negative-history/*',
    ],
  })
);
// launchQCReview needs SQS permissions to create queues and send messages
backend.launchQCReview.resources.lambda.addToRolePolicy(
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
// launchQCReview needs S3 permissions to write queue manifests and QC review manifests
backend.launchQCReview.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['s3:PutObject'],
    resources: [
      'arn:aws:s3:::*/queue-manifests/*',
      'arn:aws:s3:::*/qc-review-manifests/*',
    ],
  })
);
// launchHomography needs SQS permissions to create queues and send messages
backend.launchHomography.resources.lambda.addToRolePolicy(
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
// launchHomography needs S3 permissions to read the pre-computed manifest
backend.launchHomography.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['s3:GetObject'],
    resources: [
      'arn:aws:s3:::*/queue-manifests/*',
    ],
  })
);
// cleanupJobs triggers reconcileHomographies when homography jobs complete
backend.cleanupJobs.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['lambda:InvokeFunction'],
    resources: [backend.reconcileHomographies.resources.lambda.functionArn],
  })
);
backend.cleanupJobs.addEnvironment(
  'RECONCILE_HOMOGRAPHIES_FUNCTION_NAME',
  backend.reconcileHomographies.resources.lambda.functionName
);
// launchAnnotationSet needs S3 permissions to delete FN manifests when hasFN=true
backend.launchAnnotationSet.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['s3:DeleteObject'],
    resources: [
      'arn:aws:s3:::*/false-negative-manifests/*',
      'arn:aws:s3:::*/false-negative-pools/*',
      'arn:aws:s3:::*/false-negative-history/*',
    ],
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

// ── Workflow-targeted slippy map pre-tiler ──
//
// The pretileImage worker consumes SQS messages enqueued by the launch
// lambdas via the shared `enqueuePretile` helper. Each message produces a
// full Google-layout slippy-map pyramid for a single image. The
// reconcilePretileLaunches scheduled lambda watches for in-flight launches
// (Project.pretileManifestS3Key) and flips project status back to `active`
// once every image in the launch manifest has Image.tiledAt stamped.

const pretileStack = backend.createStack('DetwebPretile');

const pretileDlq = new sqs.Queue(pretileStack, 'PretileDlq', {
  retentionPeriod: Duration.days(14),
});

const pretileQueue = new sqs.Queue(pretileStack, 'PretileQueue', {
  // Visibility must comfortably exceed pretileImage timeout (600s).
  visibilityTimeout: Duration.seconds(700),
  retentionPeriod: Duration.days(14),
  deadLetterQueue: {
    queue: pretileDlq,
    maxReceiveCount: 3,
  },
});

// SQS → pretileImage lambda. Batch size 1 to keep visibility-timeout math
// per-image and to isolate failures so a single poison pill cannot block the
// rest of a batch.
const pretileImageLambda = backend.pretileImage.resources.lambda as lambda.Function;
pretileImageLambda.addEventSource(
  new SqsEventSource(pretileQueue, {
    batchSize: 1,
    reportBatchItemFailures: true,
    maxConcurrency: 200,
  })
);

// The pretile worker needs the same sharp layer used by handleS3Upload and
// generateTile.
pretileImageLambda.addLayers(sharpLayer);

// ── Tile refresh worker ──
//
// The refreshTiles worker consumes messages from a sibling SQS queue. Its job
// is to "touch" existing slippy-map tiles via CopyObject-in-place so the S3
// lifecycle (60-day deletion) clock resets without re-running sharp. If it
// finds no tiles under the prefix (lifecycle already ran, or a partial
// previous write), it falls back by re-enqueuing the message onto
// pretileQueue so the image gets regenerated properly.

const refreshTilesDlq = new sqs.Queue(pretileStack, 'RefreshTilesDlq', {
  retentionPeriod: Duration.days(14),
});

const refreshTilesQueue = new sqs.Queue(pretileStack, 'RefreshTilesQueue', {
  // Visibility must comfortably exceed refreshTiles timeout (120s).
  visibilityTimeout: Duration.seconds(180),
  retentionPeriod: Duration.days(14),
  deadLetterQueue: {
    queue: refreshTilesDlq,
    maxReceiveCount: 3,
  },
});

const refreshTilesLambda = backend.refreshTiles.resources.lambda as lambda.Function;
refreshTilesLambda.addEventSource(
  new SqsEventSource(refreshTilesQueue, {
    batchSize: 1,
    reportBatchItemFailures: true,
    // Refresh is pure S3 I/O — can safely run more in parallel than pretile.
    maxConcurrency: 50,
  })
);

// The refresh worker needs to be able to re-enqueue to pretileQueue when it
// finds the tile prefix empty (lifecycle fallback path).
refreshTilesLambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['sqs:SendMessage'],
    resources: [pretileQueue.queueArn],
  })
);
refreshTilesLambda.addEnvironment('PRETILE_QUEUE_URL', pretileQueue.queueUrl);


// The tile lifecycle watchdog sends refresh messages to keep tiles alive.
backend.extendTileLifecycles.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['sqs:SendMessage', 'sqs:SendMessageBatch'],
    resources: [refreshTilesQueue.queueArn],
  })
);
backend.extendTileLifecycles.addEnvironment('REFRESH_TILES_QUEUE_URL', refreshTilesQueue.queueUrl);

// Launch lambdas send pretile and refresh messages and write launch manifests.
const launchLambdasUsingPretile = [
  backend.launchAnnotationSet,
  backend.launchFalseNegatives,
  backend.launchQCReview,
  backend.launchHomography,
  backend.launchIndividualId,
];

for (const fn of launchLambdasUsingPretile) {
  fn.resources.lambda.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['sqs:SendMessage', 'sqs:SendMessageBatch'],
      resources: [pretileQueue.queueArn, refreshTilesQueue.queueArn],
    })
  );
  fn.addEnvironment('PRETILE_QUEUE_URL', pretileQueue.queueUrl);
  fn.addEnvironment('REFRESH_TILES_QUEUE_URL', refreshTilesQueue.queueUrl);
}


// ── Registration neighbour bucket cleanup ──
//
// After LightGlue finishes processing the SQS queue, monitorModelProgress
// (cron 15m) invokes registrationBucketCleanup once pendingCount reaches 0.
// That lambda picks the winning bucket per camera-pair and
// enqueues every losing-bucket neighbour to this queue; deleteRegistrationNeighbour
// consumes the queue and deletes each ImageNeighbour row.
//
// Splitting cleanup into "enumerate" (cron-driven) + "delete" (SQS-driven)
// keeps the 15-min Lambda timeout out of the critical path even when a survey
// has hundreds of thousands of cross-camera pairs.

const registrationStack = backend.createStack('DetwebRegistration');

const registrationDeleteDlq = new sqs.Queue(
  registrationStack,
  'RegistrationDeleteDlq',
  { retentionPeriod: Duration.days(14) }
);

const registrationDeleteQueue = new sqs.Queue(
  registrationStack,
  'RegistrationDeleteQueue',
  {
    // Visibility comfortably above the delete-neighbour lambda timeout (60s).
    visibilityTimeout: Duration.seconds(120),
    retentionPeriod: Duration.days(14),
    deadLetterQueue: {
      queue: registrationDeleteDlq,
      maxReceiveCount: 5,
    },
  }
);

const deleteRegistrationNeighbourLambda =
  backend.deleteRegistrationNeighbour.resources.lambda as lambda.Function;
deleteRegistrationNeighbourLambda.addEventSource(
  new SqsEventSource(registrationDeleteQueue, {
    batchSize: 10,
    reportBatchItemFailures: true,
    maxConcurrency: 50,
  })
);

// registrationBucketCleanup needs to write deletion messages onto the queue
// and know its URL.
backend.registrationBucketCleanup.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['sqs:SendMessage', 'sqs:SendMessageBatch'],
    resources: [registrationDeleteQueue.queueArn],
  })
);
backend.registrationBucketCleanup.addEnvironment(
  'REGISTRATION_DELETE_QUEUE_URL',
  registrationDeleteQueue.queueUrl
);

// Allow asynchronous registration cleanup.
backend.monitorModelProgress.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['lambda:InvokeFunction'],
    resources: [backend.registrationBucketCleanup.resources.lambda.functionArn],
  })
);
backend.monitorModelProgress.addEnvironment(
  'REGISTRATION_BUCKET_CLEANUP_FUNCTION_NAME',
  backend.registrationBucketCleanup.resources.lambda.functionName
);

// ── Registration progress stream consumer ──
//
// Listens to the ImageNeighbour DDB stream and maintains the per-project
// pendingCount on RegistrationProgress. INSERT +1, MODIFY-with-tracking-
// transition -1, REMOVE-of-untracked -1. Manual frontend homography saves
// don't toggle processedAt/failedAt and so don't move the counter.
//
// monitorModelProgress reads pendingCount as the load-bearing gate (replacing
// the old pairsProcessed >= pairsCreated check, which drifted on re-runs).

const imageNeighbourTable = backend.data.resources.tables['ImageNeighbour'];

const registrationStreamPolicy = new Policy(
  Stack.of(imageNeighbourTable),
  'RegistrationStreamConsumerPolicy',
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
backend.processRegistrationStream.resources.lambda.role?.attachInlinePolicy(
  registrationStreamPolicy
);

const registrationStreamMapping = new EventSourceMapping(
  Stack.of(imageNeighbourTable),
  'ImageNeighbourStreamMapping',
  {
    target: backend.processRegistrationStream.resources.lambda,
    eventSourceArn: imageNeighbourTable.tableStreamArn,
    startingPosition: StartingPosition.LATEST,
    // Modest batching keeps per-record error isolation predictable. The
    // handler swallows per-record errors so a poison pill doesn't double-count
    // its batch on retry.
    batchSize: 25,
  }
);
registrationStreamMapping.node.addDependency(registrationStreamPolicy);

// ── Individual ID workflow ──
//
// launchIndividualId fans out one message per image onto this queue so
// updateImageTransect can stamp Image.transectId in small batches without
// hitting a lambda timeout on surveys with hundreds of thousands of images.
// reconcileIndividualId (cron 5m) flips the project back to `active` once the
// fanout drains (IndividualIdJob.pendingImageUpdates === 0) and pretiling is
// done; releaseIndividualIdTransects (cron 10m) frees transects whose assigned
// user went inactive (>30m). Pretile SQS perms + env are granted via the
// launchLambdasUsingPretile loop above.

const individualIdStack = backend.createStack('DetwebIndividualId');

const individualIdTransectUpdateDlq = new sqs.Queue(
  individualIdStack,
  'IndividualIdTransectUpdateDlq',
  { retentionPeriod: Duration.days(14) }
);

const individualIdTransectUpdateQueue = new sqs.Queue(
  individualIdStack,
  'IndividualIdTransectUpdateQueue',
  {
    // Visibility comfortably above the updateImageTransect timeout (120s).
    visibilityTimeout: Duration.seconds(180),
    retentionPeriod: Duration.days(14),
    deadLetterQueue: {
      queue: individualIdTransectUpdateDlq,
      maxReceiveCount: 5,
    },
  }
);

const updateImageTransectLambda =
  backend.updateImageTransect.resources.lambda as lambda.Function;
updateImageTransectLambda.addEventSource(
  new SqsEventSource(individualIdTransectUpdateQueue, {
    batchSize: 10,
    reportBatchItemFailures: true,
    maxConcurrency: 50,
  })
);

// launchIndividualId writes image→transect messages onto the queue.
backend.launchIndividualId.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['sqs:SendMessage', 'sqs:SendMessageBatch'],
    resources: [individualIdTransectUpdateQueue.queueArn],
  })
);
backend.launchIndividualId.addEnvironment(
  'TRANSECT_UPDATE_QUEUE_URL',
  individualIdTransectUpdateQueue.queueUrl
);

const generalBucketName = 'surveyscope';

// Expose useful resource identifiers for downstream tooling.
backend.addOutput({
  custom: {
    lightglueTaskQueueUrl: lightglueQueueUrl ?? '',
    scoutbotTaskQueueUrl: scoutbotQueueUrl ?? '',
    madDetectorTaskQueueUrl: madDetectorQueueUrl ?? '',
    stormflyDetectorTaskQueueUrl: stormflyDetectorQueueUrl ?? '',
    elephantDetectorTaskQueueUrl: elephantDetectorQueueUrl ?? '',
    generalBucketName: generalBucketName,
  },
});
