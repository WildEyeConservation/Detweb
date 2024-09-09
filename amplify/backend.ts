import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { createDetwebResources } from "./cdk2-stack";
import { addUserToGroup } from "./functions/add-user-to-group/resource";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

import * as opensearch from "aws-cdk-lib/aws-opensearchservice";
import { Stack } from "aws-cdk-lib";
  
import { storage } from "./storage/resource";
import * as iam from "aws-cdk-lib/aws-iam";

const backend=defineBackend({
  auth,
  data,
  addUserToGroup,
  storage
});

const table=backend.data.resources.cfnResources.amplifyDynamoDbTables['Annotation']

table.pointInTimeRecoveryEnabled = true;
table.streamSpecification = {
  streamViewType: dynamodb.StreamViewType.NEW_IMAGE,
};


// Get the DynamoDB table ARN
const tableArn = backend.data.resources.tables["Annotation"].tableArn;

const customStack=backend.createStack('DetwebCustom')

backend.addOutput({custom:createDetwebResources(customStack,backend)})


// Get the data stack
const dataStack = Stack.of(backend.data);
// Create the OpenSearch domain
const openSearchDomain = new opensearch.Domain(
  dataStack,
  "OpenSearchDomain",
  {
    version: opensearch.EngineVersion.OPENSEARCH_2_11,
    nodeToNodeEncryption: true,
    encryptionAtRest: {
      enabled: true,
    },
  }
);

//backend.data.resources.tables['User'].grantFullAccess(handleNewUser)


// Get the S3Bucket ARN
const s3BucketArn = backend.storage.resources.bucket.bucketArn;
// Get the S3Bucket Name
const s3BucketName = backend.storage.resources.bucket.bucketName;


//Get the region
const region = dataStack.region;


// Create an IAM role for OpenSearch integration
const openSearchIntegrationPipelineRole = new iam.Role(
  dataStack,
  "OpenSearchIntegrationPipelineRole",
  {
    assumedBy: new iam.ServicePrincipal("osis-pipelines.amazonaws.com"),
    inlinePolicies: {
      openSearchPipelinePolicy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            actions: ["es:DescribeDomain"],
            resources: [
              openSearchDomain.domainArn,
              openSearchDomain.domainArn + "/*",
            ],
            effect: iam.Effect.ALLOW,
          }),
          new iam.PolicyStatement({
            actions: ["es:ESHttp*"],
            resources: [
              openSearchDomain.domainArn,
              openSearchDomain.domainArn + "/*",
            ],
            effect: iam.Effect.ALLOW,
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              "s3:GetObject",
              "s3:AbortMultipartUpload",
              "s3:PutObject",
              "s3:PutObjectAcl",
            ],
            resources: [s3BucketArn, s3BucketArn + "/*"],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              "dynamodb:DescribeTable",
              "dynamodb:DescribeContinuousBackups",
              "dynamodb:ExportTableToPointInTime",
              "dynamodb:DescribeExport",
              "dynamodb:DescribeStream",
              "dynamodb:GetRecords",
              "dynamodb:GetShardIterator",
            ],
            resources: [tableArn, tableArn + "/*"],
          }),
        ],
      }),
    },
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "AmazonOpenSearchIngestionFullAccess"
      ),
    ],
  }
);




// Define OpenSearch index mappings
const indexName = "Annotations";


const indexMapping = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
  },
  mappings: {
    properties: {
      id: {
        type: "keyword",
      },
      done: {
        type: "boolean",
      },
      content: {
        type: "text",
      },
    },
  },
};

