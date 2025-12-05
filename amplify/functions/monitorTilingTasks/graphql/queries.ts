/* tslint:disable */
/* eslint-disable */
// GraphQL queries for monitorTilingTasks lambda

export const tilingTasksByStatus = /* GraphQL */ `
  query TilingTasksByStatus(
    $status: String!
    $sortDirection: ModelSortDirection
    $filter: ModelTilingTaskFilterInput
    $limit: Int
    $nextToken: String
  ) {
    tilingTasksByStatus(
      status: $status
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        projectId
        locationSetId
        annotationSetId
        status
        launchConfig
        totalBatches
        completedBatches
        totalLocations
        outputS3Key
        errorMessage
        createdAt
        updatedAt
      }
      nextToken
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

export const locationsBySetIdAndConfidence = /* GraphQL */ `
  query LocationsBySetIdAndConfidence(
    $setId: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelLocationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    locationsBySetIdAndConfidence(
      setId: $setId
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        imageId
        x
        y
        width
        height
      }
      nextToken
    }
  }
`;

export const locationsByProjectIdAndSource = /* GraphQL */ `
  query LocationsByProjectIdAndSource(
    $projectId: ID!
    $source: ModelStringKeyConditionInput
    $sortDirection: ModelSortDirection
    $filter: ModelLocationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    locationsByProjectIdAndSource(
      projectId: $projectId
      source: $source
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        imageId
        x
        y
        confidence
      }
      nextToken
    }
  }
`;

export const annotationsByAnnotationSetId = /* GraphQL */ `
  query AnnotationsByAnnotationSetId(
    $setId: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelAnnotationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    annotationsByAnnotationSetId(
      setId: $setId
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        imageId
        x
        y
      }
      nextToken
    }
  }
`;

export const imagesByProjectId = /* GraphQL */ `
  query ImagesByProjectId(
    $projectId: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelImageFilterInput
    $limit: Int
    $nextToken: String
  ) {
    imagesByProjectId(
      projectId: $projectId
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        timestamp
      }
      nextToken
    }
  }
`;

export const observationsByAnnotationSetId = /* GraphQL */ `
  query ObservationsByAnnotationSetId(
    $annotationSetId: ID!
    $createdAt: ModelStringKeyConditionInput
    $sortDirection: ModelSortDirection
    $filter: ModelObservationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    observationsByAnnotationSetId(
      annotationSetId: $annotationSetId
      createdAt: $createdAt
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        locationId
      }
      nextToken
    }
  }
`;

export const getLocation = /* GraphQL */ `
  query GetLocation($id: ID!) {
    getLocation(id: $id) {
      id
      imageId
      x
      y
      width
      height
    }
  }
`;

