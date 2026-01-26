/* tslint:disable */
/* eslint-disable */
// GraphQL queries for findAndRequeueMissingLocations lambda

export const listQueues = /* GraphQL */ `
  query ListQueues(
    $filter: ModelQueueFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listQueues(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        projectId
        name
        url
        tag
        approximateSize
        annotationSetId
        locationSetId
        launchedCount
        observedCount
        locationManifestS3Key
        emptyQueueTimestamp
        requeuesCompleted
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

export const getProject = /* GraphQL */ `
  query GetProject($id: ID!) {
    getProject(id: $id) {
      id
      name
    }
  }
`;

export const annotationsByImageIdAndSetId = /* GraphQL */ `query AnnotationsByImageIdAndSetId(
  $filter: ModelAnnotationFilterInput
  $imageId: ID!
  $limit: Int
  $nextToken: String
  $setId: ModelIDKeyConditionInput
  $sortDirection: ModelSortDirection
) {
  annotationsByImageIdAndSetId(
    filter: $filter
    imageId: $imageId
    limit: $limit
    nextToken: $nextToken
    setId: $setId
    sortDirection: $sortDirection
  ) {
    items {
      categoryId
      createdAt
      id
      imageId
      objectId
      obscured
      owner
      projectId
      setId
      source
      updatedAt
      x
      y
      __typename
    }
    nextToken
    __typename
  }
}
`;
