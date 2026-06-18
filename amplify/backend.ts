import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { addUserToGroup } from './functions/add-user-to-group/resource';
import { Stack, Fn } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { outputBucket, inputBucket } from './storage/resource';
import { generateTile } from './storage/generateTile/resource';
import { handleS3Upload } from './storage/handleS3Upload/resource';
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

const authenticatedRole = backend.auth.resources.authenticatedUserIamRole;

const sqsAnnotatorStatement = new iam.PolicyStatement({
  actions: [
    'sqs:ReceiveMessage',
    'sqs:DeleteMessage',
    'sqs:GetQueueAttributes',
  ],
  resources: ['*'],
});

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
const generalBucketArn = 'arn:aws:s3:::surveyscope';
const generalBucketArn2 = 'arn:aws:s3:::surveyscope/*';
const generalBucketPolicy = new iam.PolicyStatement({
  actions: ['s3:ListBucket', 's3:GetObject'],
  resources: [generalBucketArn, generalBucketArn2],
});

// Wildcard ARNs avoid cross-stack storage dependencies.
const groupS3ListPolicy = new iam.PolicyStatement({
  actions: ['s3:ListBucket'],
  resources: ['arn:aws:s3:::*'],
});

const groupS3ObjectsPolicy = new iam.PolicyStatement({
  actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
  resources: ['arn:aws:s3:::*/images/*'],
});

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

const groupS3LaunchPayloadsPolicy = new iam.PolicyStatement({
  actions: ['s3:PutObject'],
  resources: ['arn:aws:s3:::*/launch-payloads/*'],
});

const groupS3QueueManifestsPolicy = new iam.PolicyStatement({
  actions: ['s3:PutObject'],
  resources: ['arn:aws:s3:::*/queue-manifests/*'],
});

const groupDynamoDbQueryPolicy = new iam.PolicyStatement({
  actions: ['dynamodb:Query', 'dynamodb:Scan', 'dynamodb:BatchGetItem'],
  resources: [
    'arn:aws:dynamodb:*:*:table/*',
    'arn:aws:dynamodb:*:*:table/*/index/*',
  ],
});

const groupEcsListPolicy = new iam.PolicyStatement({
  actions: ['ecs:ListClusters', 'ecs:DescribeClusters', 'ecs:ListServices', 'ecs:DescribeServices', 'ecs:DescribeTaskDefinition'],
  resources: ['*'],
});

authenticatedRole.addToPrincipalPolicy(sqsAnnotatorStatement);
authenticatedRole.addToPrincipalPolicy(generalBucketPolicy);

// Group roles replace the authenticated Identity Pool role.
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

backend.auth.resources.groups['sysadmin'].role.addToPrincipalPolicy(sqsSysadminStatement);
backend.auth.resources.groups['sysadmin'].role.addToPrincipalPolicy(groupEcsListPolicy);

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

const envName =
  process.env.AMPLIFY_ENV ?? process.env.AWS_BRANCH ?? 'production';

let lightglueQueueUrl: string | undefined;
let scoutbotQueueUrl: string | undefined;
let madDetectorQueueUrl: string | undefined;
let stormflyDetectorQueueUrl: string | undefined;
let elephantDetectorQueueUrl: string | undefined;

if (enableEcs) {
  const ecsStack = backend.createStack('DetwebECS');
  const ecsTaskRole = new iam.Role(ecsStack, 'EcsTaskRole', {
    assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
  });

  const ecsvpc = new ec2.Vpc(ecsStack, 'my-cdk-vpc');
  ecsTaskRole.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName('AWSAppSyncInvokeFullAccess')
  );
  ecsTaskRole.addToPrincipalPolicy(
    new iam.PolicyStatement({
      actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject'],
      resources: ['arn:aws:s3:::*'],
    })
  );

  if (enableLightGlue) {
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
    Repository.fromRepositoryArn(
      ecsStack,
      'ScoutbotRepo',
      'arn:aws:ecr:eu-west-2:275736403632:repository/cdk-hnb659fds-container-assets-275736403632-eu-west-2'
    );

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
          // Zero persists the heatmap noise floor and floods writes.
          STORMFLY_THRESHOLD: process.env.STORMFLY_THRESHOLD ?? '0.2',
          STORMFLY_BOX_SIZE: process.env.STORMFLY_BOX_SIZE ?? '64',
          // The current export has a fixed batch axis.
          STORMFLY_FP16: process.env.STORMFLY_FP16 ?? '0',
          STORMFLY_BATCH: process.env.STORMFLY_BATCH ?? '1',
        },
        machineImage: ecs.EcsOptimizedImage.amazonLinux2(
          ecs.AmiHardwareType.GPU
        ),
        rootVolumeSize: 100,
        messagesPerTask: 10,
        maxTasks: 180,
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

backend.launchAnnotationSet.addEnvironment(
  'PROCESS_TILING_BATCH_FUNCTION_NAME',
  backend.processTilingBatch.resources.lambda.functionName
);
backend.launchFalseNegatives.addEnvironment(
  'PROCESS_TILING_BATCH_FUNCTION_NAME',
  backend.processTilingBatch.resources.lambda.functionName
);

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
backend.launchQCReview.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['s3:PutObject'],
    resources: [
      'arn:aws:s3:::*/queue-manifests/*',
      'arn:aws:s3:::*/qc-review-manifests/*',
    ],
  })
);
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
backend.launchHomography.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['s3:GetObject'],
    resources: [
      'arn:aws:s3:::*/queue-manifests/*',
    ],
  })
);
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
backend.processTilingBatch.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['lambda:InvokeFunction'],
    resources: ['*'],
  })
);
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
backend.monitorScoutbotDlq.addEnvironment(
  'SCOUTBOT_QUEUE_URL_PARAM',
  `/${envName}/monitorScoutbotDlq/QueueUrl`
);
backend.monitorScoutbotDlq.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['ssm:GetParameter'],
    resources: ['arn:aws:ssm:*:*:parameter/*'],
  })
);

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

const pretileStack = backend.createStack('DetwebPretile');

const pretileDlq = new sqs.Queue(pretileStack, 'PretileDlq', {
  retentionPeriod: Duration.days(14),
});

const pretileQueue = new sqs.Queue(pretileStack, 'PretileQueue', {
  // Exceeds the 600-second worker timeout.
  visibilityTimeout: Duration.seconds(700),
  retentionPeriod: Duration.days(14),
  deadLetterQueue: {
    queue: pretileDlq,
    maxReceiveCount: 3,
  },
});

const pretileImageLambda = backend.pretileImage.resources.lambda as lambda.Function;
pretileImageLambda.addEventSource(
  new SqsEventSource(pretileQueue, {
    batchSize: 1,
    reportBatchItemFailures: true,
    maxConcurrency: 200,
  })
);

pretileImageLambda.addLayers(sharpLayer);

const refreshTilesDlq = new sqs.Queue(pretileStack, 'RefreshTilesDlq', {
  retentionPeriod: Duration.days(14),
});

const refreshTilesQueue = new sqs.Queue(pretileStack, 'RefreshTilesQueue', {
  // Exceeds the 120-second worker timeout.
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
    maxConcurrency: 50,
  })
);

refreshTilesLambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['sqs:SendMessage'],
    resources: [pretileQueue.queueArn],
  })
);
refreshTilesLambda.addEnvironment('PRETILE_QUEUE_URL', pretileQueue.queueUrl);


backend.extendTileLifecycles.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['sqs:SendMessage', 'sqs:SendMessageBatch'],
    resources: [refreshTilesQueue.queueArn],
  })
);
backend.extendTileLifecycles.addEnvironment('REFRESH_TILES_QUEUE_URL', refreshTilesQueue.queueUrl);

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
    // Exceeds the 60-second worker timeout.
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
    // The handler isolates per-record failures.
    batchSize: 25,
  }
);
registrationStreamMapping.node.addDependency(registrationStreamPolicy);

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
    // Exceeds the 120-second worker timeout.
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
