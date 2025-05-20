/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "./API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const getAnnotation = /* GraphQL */ `query GetAnnotation($id: String!) {
  getAnnotation(id: $id) {
    categoryId
    createdAt
    id
    imageId
    objectId
    obscured
    projectId
    setId
    source
    updatedAt
    x
    y
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetAnnotationQueryVariables,
  APITypes.GetAnnotationQuery
>;
export const getAnnotationSet = /* GraphQL */ `query GetAnnotationSet($id: String!) {
  getAnnotationSet(id: $id) {
    createdAt
    id
    name
    projectId
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetAnnotationSetQueryVariables,
  APITypes.GetAnnotationSetQuery
>;
export const getCategory = /* GraphQL */ `query GetCategory($id: String!) {
  getCategory(id: $id) {
    color
    createdAt
    id
    name
    projectId
    shortcutKey
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetCategoryQueryVariables,
  APITypes.GetCategoryQuery
>;
export const getImage = /* GraphQL */ `query GetImage($id: String!) {
  getImage(id: $id) {
    altitude_agl
    altitude_egm96
    altitude_wgs84
    cameraSerial
    createdAt
    exifData
    height
    id
    latitude
    longitude
    pitch
    projectId
    roll
    sets {
      nextToken
      __typename
    }
    timestamp
    updatedAt
    width
    yaw
    __typename
  }
}
` as GeneratedQuery<APITypes.GetImageQueryVariables, APITypes.GetImageQuery>;
export const getImageFile = /* GraphQL */ `query GetImageFile($id: String!) {
  getImageFile(id: $id) {
    createdAt
    id
    imageId
    path
    projectId
    s3key
    type
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetImageFileQueryVariables,
  APITypes.GetImageFileQuery
>;
export const getImageSet = /* GraphQL */ `query GetImageSet($id: String!) {
  getImageSet(id: $id) {
    createdAt
    id
    images {
      nextToken
      __typename
    }
    name
    projectId
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetImageSetQueryVariables,
  APITypes.GetImageSetQuery
>;
export const getImageSetMembership = /* GraphQL */ `query GetImageSetMembership($id: String!) {
  getImageSetMembership(id: $id) {
    createdAt
    id
    image {
      altitude_agl
      altitude_egm96
      altitude_wgs84
      cameraSerial
      createdAt
      exifData
      height
      id
      latitude
      longitude
      pitch
      projectId
      roll
      timestamp
      updatedAt
      width
      yaw
      __typename
    }
    imageId
    imageSet {
      createdAt
      id
      name
      projectId
      updatedAt
      __typename
    }
    imageSetId
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetImageSetMembershipQueryVariables,
  APITypes.GetImageSetMembershipQuery
>;
export const getLocation = /* GraphQL */ `query GetLocation($id: String!) {
  getLocation(id: $id) {
    confidence
    createdAt
    height
    id
    imageId
    projectId
    setId
    source
    updatedAt
    width
    x
    y
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetLocationQueryVariables,
  APITypes.GetLocationQuery
>;
export const getLocationSet = /* GraphQL */ `query GetLocationSet($id: String!) {
  getLocationSet(id: $id) {
    createdAt
    id
    name
    projectId
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetLocationSetQueryVariables,
  APITypes.GetLocationSetQuery
>;
export const getObject = /* GraphQL */ `query GetObject($id: String!) {
  getObject(id: $id) {
    categoryId
    createdAt
    id
    projectId
    updatedAt
    __typename
  }
}
` as GeneratedQuery<APITypes.GetObjectQueryVariables, APITypes.GetObjectQuery>;
export const getObservation = /* GraphQL */ `query GetObservation($id: String!) {
  getObservation(id: $id) {
    annotationSetId
    createdAt
    id
    locationId
    projectId
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetObservationQueryVariables,
  APITypes.GetObservationQuery
>;
export const getProject = /* GraphQL */ `query GetProject($id: String!) {
  getProject(id: $id) {
    createdAt
    id
    name
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetProjectQueryVariables,
  APITypes.GetProjectQuery
>;
export const getQueue = /* GraphQL */ `query GetQueue($id: String!) {
  getQueue(id: $id) {
    createdAt
    id
    name
    projectId
    updatedAt
    url
    __typename
  }
}
` as GeneratedQuery<APITypes.GetQueueQueryVariables, APITypes.GetQueueQuery>;
export const getUserProjectMembership = /* GraphQL */ `query GetUserProjectMembership($id: String!) {
  getUserProjectMembership(id: $id) {
    createdAt
    id
    isAdmin
    projectId
    queueUrl
    updatedAt
    userId
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetUserProjectMembershipQueryVariables,
  APITypes.GetUserProjectMembershipQuery
>;
export const listAnnotationSets = /* GraphQL */ `query ListAnnotationSets(
  $filter: ModelAnnotationSetFilterInput
  $id: String
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listAnnotationSets(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      createdAt
      id
      name
      projectId
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListAnnotationSetsQueryVariables,
  APITypes.ListAnnotationSetsQuery
>;
export const listAnnotations = /* GraphQL */ `query ListAnnotations(
  $filter: ModelAnnotationFilterInput
  $id: String
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listAnnotations(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      categoryId
      createdAt
      id
      imageId
      objectId
      obscured
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
` as GeneratedQuery<
  APITypes.ListAnnotationsQueryVariables,
  APITypes.ListAnnotationsQuery
>;
export const listCategories = /* GraphQL */ `query ListCategories(
  $filter: ModelCategoryFilterInput
  $id: String
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listCategories(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      color
      createdAt
      id
      name
      projectId
      shortcutKey
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListCategoriesQueryVariables,
  APITypes.ListCategoriesQuery
>;
export const listGroupsForUser = /* GraphQL */ `query ListGroupsForUser($nextToken: String, $userId: String!) {
  listGroupsForUser(nextToken: $nextToken, userId: $userId)
}
` as GeneratedQuery<
  APITypes.ListGroupsForUserQueryVariables,
  APITypes.ListGroupsForUserQuery
>;
export const listImageFiles = /* GraphQL */ `query ListImageFiles(
  $filter: ModelImageFileFilterInput
  $id: String
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listImageFiles(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      createdAt
      id
      imageId
      path
      projectId
      s3key
      type
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListImageFilesQueryVariables,
  APITypes.ListImageFilesQuery
>;
export const listImageSetMemberships = /* GraphQL */ `query ListImageSetMemberships(
  $filter: ModelImageSetMembershipFilterInput
  $id: String
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listImageSetMemberships(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      createdAt
      id
      imageId
      imageSetId
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListImageSetMembershipsQueryVariables,
  APITypes.ListImageSetMembershipsQuery
>;
export const listImageSets = /* GraphQL */ `query ListImageSets(
  $filter: ModelImageSetFilterInput
  $id: String
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listImageSets(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      createdAt
      id
      name
      projectId
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListImageSetsQueryVariables,
  APITypes.ListImageSetsQuery
>;
export const listImages = /* GraphQL */ `query ListImages(
  $filter: ModelImageFilterInput
  $id: String
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listImages(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      altitude_agl
      altitude_egm96
      altitude_wgs84
      cameraSerial
      createdAt
      exifData
      height
      id
      latitude
      longitude
      pitch
      projectId
      roll
      timestamp
      updatedAt
      width
      yaw
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListImagesQueryVariables,
  APITypes.ListImagesQuery
>;
export const listLocationSets = /* GraphQL */ `query ListLocationSets(
  $filter: ModelLocationSetFilterInput
  $id: String
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listLocationSets(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      createdAt
      id
      name
      projectId
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListLocationSetsQueryVariables,
  APITypes.ListLocationSetsQuery
>;
export const listLocations = /* GraphQL */ `query ListLocations(
  $filter: ModelLocationFilterInput
  $id: String
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listLocations(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      confidence
      createdAt
      height
      id
      imageId
      projectId
      setId
      source
      updatedAt
      width
      x
      y
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListLocationsQueryVariables,
  APITypes.ListLocationsQuery
>;
export const listObjects = /* GraphQL */ `query ListObjects(
  $filter: ModelObjectFilterInput
  $id: String
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listObjects(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      categoryId
      createdAt
      id
      projectId
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListObjectsQueryVariables,
  APITypes.ListObjectsQuery
>;
export const listObservations = /* GraphQL */ `query ListObservations(
  $filter: ModelObservationFilterInput
  $id: String
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listObservations(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      annotationSetId
      createdAt
      id
      locationId
      projectId
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListObservationsQueryVariables,
  APITypes.ListObservationsQuery
>;
export const listProjects = /* GraphQL */ `query ListProjects(
  $filter: ModelProjectFilterInput
  $id: String
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listProjects(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      createdAt
      id
      name
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListProjectsQueryVariables,
  APITypes.ListProjectsQuery
>;
export const listQueues = /* GraphQL */ `query ListQueues(
  $filter: ModelQueueFilterInput
  $id: String
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listQueues(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      createdAt
      id
      name
      projectId
      updatedAt
      url
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListQueuesQueryVariables,
  APITypes.ListQueuesQuery
>;
export const listUserProjectMemberships = /* GraphQL */ `query ListUserProjectMemberships(
  $filter: ModelUserProjectMembershipFilterInput
  $id: String
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listUserProjectMemberships(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      createdAt
      id
      isAdmin
      projectId
      queueUrl
      updatedAt
      userId
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListUserProjectMembershipsQueryVariables,
  APITypes.ListUserProjectMembershipsQuery
>;
export const listUsers = /* GraphQL */ `query ListUsers($nextToken: String) {
  listUsers(nextToken: $nextToken) {
    NextToken
    Users {
      id
      isAdmin
      name
      __typename
    }
    __typename
  }
}
` as GeneratedQuery<APITypes.ListUsersQueryVariables, APITypes.ListUsersQuery>;
export const numberOfImagesInSet = /* GraphQL */ `query NumberOfImagesInSet($imageSetId: String!) {
  numberOfImagesInSet(imageSetId: $imageSetId) {
    count
    __typename
  }
}
` as GeneratedQuery<
  APITypes.NumberOfImagesInSetQueryVariables,
  APITypes.NumberOfImagesInSetQuery
>;
