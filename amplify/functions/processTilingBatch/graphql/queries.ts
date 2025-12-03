/* tslint:disable */
/* eslint-disable */
// GraphQL queries for processTilingBatch lambda

export const getTilingBatch = /* GraphQL */ `
  query GetTilingBatch($id: ID!) {
    getTilingBatch(id: $id) {
      id
      tilingTaskId
      batchIndex
      status
      inputS3Key
      outputS3Key
      locationCount
      createdCount
      errorMessage
      createdAt
      updatedAt
    }
  }
`;

