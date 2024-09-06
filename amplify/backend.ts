import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { createDetwebResources } from "./cdk2-stack";
import { addUser } from "./functions/addUser/resource";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

import * as opensearch from "aws-cdk-lib/aws-opensearchservice";
import {  Stack } from "aws-cdk-lib";

const backend=defineBackend({
  auth,
  data,
  addUser
});


// Loop over all tables in backend.data and apply the same operations
// Object.values(backend.data.resources.cfnResources.amplifyDynamoDbTables).forEach((table) => {
//   table.pointInTimeRecoveryEnabled = true;
//   table.streamSpecification = {
//     streamViewType: dynamodb.StreamViewType.NEW_IMAGE,
//   };
// }); 

const customStack=backend.createStack('DetwebCustom')

backend.addOutput({custom:createDetwebResources(customStack,backend)})


// Get the data stack
// const dataStack = Stack.of(backend.data);
// Create the OpenSearch domain
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

//backend.data.resources.tables['User'].grantFullAccess(addUser)

