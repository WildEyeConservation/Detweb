import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { createDetwebResources } from "./cdk2-stack";
import { addUserToGroup } from "./functions/add-user-to-group/resource";
import { Stack } from "aws-cdk-lib";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { outputBucket, inputBucket } from "./storage/resource";
import { handleS3Upload } from "./storage/handleS3Upload/resource";
import * as sts from '@aws-sdk/client-sts';

const backend=defineBackend({
  auth,
  data,
  addUserToGroup,
  outputBucket,
  inputBucket,
  handleS3Upload
});

async function getUser() {
  const stsClient = new sts.STSClient({ region: 'eu-west-1' });
  const command = new sts.GetCallerIdentityCommand({});
  return await stsClient.send(command);
}

getUser().then((user) => {
  console.log(user.Arn)
  const lambdaFunction = backend.handleS3Upload.resources.lambda as lambda.Function;
  const layerVersion = new lambda.LayerVersion(Stack.of(lambdaFunction), 'sharpLayer', {
    code: lambda.Code.fromAsset('./amplify/layers/sharp-ph200-x64'),
    description: "Sharp layer for image processing (ph200-x86_64)",
    compatibleArchitectures: [lambda.Architecture.X86_64],
  })

  lambdaFunction.addLayers(layerVersion);

  const customStack = backend.createStack('DetwebCustom')
  const custom = createDetwebResources(customStack, backend, user.Arn!)
  backend.addOutput({ custom })
})

//const table=backend.data.resources.cfnResources.amplifyDynamoDbTables['Annotation']
//backend.handleS3Upload.resources.cfnResources.cfnFunction.layers?.push(custom.sharpLayerVersionArn)

// table.pointInTimeRecoveryEnabled = true;
// table.streamSpecification = {
//   streamViewType: dynamodb.StreamViewType.NEW_IMAGE,
// };


// Get the DynamoDB table ARN
// const tableArn = backend.data.resources.tables["Annotation"].tableArn;



// // Get the data stack
// const dataStack = Stack.of(backend.data);
// // Create the OpenSearch domain
// const openSearchDomain = new opensearch.Domain(
//   dataStack,
//   "OpenSearchDomain",
//   {
//     version: opensearch.EngineVersion.OPENSEARCH_2_11,
//     nodeToNodeEncryption: true,
//     encryptionAtRest: {
//       enabled: true,
//     },
//   }
// );

//backend.data.resources.tables['User'].grantFullAccess(handleNewUser)


// Get the S3Bucket ARN
// const s3BucketArn = backend.storageOS.resources.bucket.bucketArn;
// // Get the S3Bucket Name
// const s3BucketName = backend.storageOS.resources.bucket.bucketName;


// //Get the region
// const region = dataStack.region;


// // Create an IAM role for OpenSearch integration
// const openSearchIntegrationPipelineRole = new iam.Role(
//   dataStack,
//   "OpenSearchIntegrationPipelineRole",
//   {
//     assumedBy: new iam.ServicePrincipal("osis-pipelines.amazonaws.com"),
//     inlinePolicies: {
//       openSearchPipelinePolicy: new iam.PolicyDocument({
//         statements: [
//           new iam.PolicyStatement({
//             actions: ["es:DescribeDomain"],
//             resources: [
//               openSearchDomain.domainArn,
//               openSearchDomain.domainArn + "/*",
//             ],
//             effect: iam.Effect.ALLOW,
//           }),
//           new iam.PolicyStatement({
//             actions: ["es:ESHttp*"],
//             resources: [
//               openSearchDomain.domainArn,
//               openSearchDomain.domainArn + "/*",
//             ],
//             effect: iam.Effect.ALLOW,
//           }),
//           new iam.PolicyStatement({
//             effect: iam.Effect.ALLOW,
//             actions: [
//               "s3:GetObject",
//               "s3:AbortMultipartUpload",
//               "s3:PutObject",
//               "s3:PutObjectAcl",
//             ],
//             resources: [s3BucketArn, s3BucketArn + "/*"],
//           }),
//           new iam.PolicyStatement({
//             effect: iam.Effect.ALLOW,
//             actions: [
//               "dynamodb:DescribeTable",
//               "dynamodb:DescribeContinuousBackups",
//               "dynamodb:ExportTableToPointInTime",
//               "dynamodb:DescribeExport",
//               "dynamodb:DescribeStream",
//               "dynamodb:GetRecords",
//               "dynamodb:GetShardIterator",
//             ],
//             resources: [tableArn, tableArn + "/*"],
//           }),
//         ],
//       }),
//     },
//     managedPolicies: [
//       iam.ManagedPolicy.fromAwsManagedPolicyName(
//         "AmazonOpenSearchIngestionFullAccess"
//       ),
//     ],
//   }
// );




// Define OpenSearch index mappings
// const indexName = "Annotations";


// const indexMapping = {
//   settings: {
//     number_of_shards: 1,
//     number_of_replicas: 0,
//   },
//   mappings: {
//     properties: {
//       id: {
//         type: "keyword",
//       },
//       done: {
//         type: "boolean",
//       },
//       content: {
//         type: "text",
//       },
//     },
//   },
// };
