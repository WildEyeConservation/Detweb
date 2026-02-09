/* tslint:disable */
/* eslint-disable */
// GraphQL mutations for processTilingBatch lambda

export const createLocation = /* GraphQL */ `
  mutation CreateLocation($input: CreateLocationInput!, $condition: ModelLocationConditionInput) {
    createLocation(input: $input, condition: $condition) {
      id
      projectId
      imageId
      setId
      height
      width
      x
      y
      source
      confidence
      group
      createdAt
      updatedAt
    }
  }
`;

export const updateTilingBatch = /* GraphQL */ `
  mutation UpdateTilingBatch($input: UpdateTilingBatchInput!, $condition: ModelTilingBatchConditionInput) {
    updateTilingBatch(input: $input, condition: $condition) {
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

