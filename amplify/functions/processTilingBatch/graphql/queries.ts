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

export const tilingBatchesByTaskId = /* GraphQL */ `
  query TilingBatchesByTaskId(
    $tilingTaskId: ID!
    $batchIndex: ModelIntKeyConditionInput
    $sortDirection: ModelSortDirection
    $filter: ModelTilingBatchFilterInput
    $limit: Int
    $nextToken: String
  ) {
    tilingBatchesByTaskId(
      tilingTaskId: $tilingTaskId
      batchIndex: $batchIndex
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
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
      nextToken
    }
  }
`;

