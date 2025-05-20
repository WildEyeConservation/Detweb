/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "./API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const annotationSetsByProjectId = /* GraphQL */ `query AnnotationSetsByProjectId(
  $filter: ModelAnnotationSetFilterInput
  $limit: Int
  $nextToken: String
  $projectId: ID!
  $sortDirection: ModelSortDirection
) {
  annotationSetsByProjectId(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    projectId: $projectId
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
  APITypes.AnnotationSetsByProjectIdQueryVariables,
  APITypes.AnnotationSetsByProjectIdQuery
>;
export const annotationsByAnnotationSetId = /* GraphQL */ `query AnnotationsByAnnotationSetId(
  $filter: ModelAnnotationFilterInput
  $limit: Int
  $nextToken: String
  $setId: ID!
  $sortDirection: ModelSortDirection
) {
  annotationsByAnnotationSetId(
    filter: $filter
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
` as GeneratedQuery<
  APITypes.AnnotationsByAnnotationSetIdQueryVariables,
  APITypes.AnnotationsByAnnotationSetIdQuery
>;
export const annotationsByCategoryId = /* GraphQL */ `query AnnotationsByCategoryId(
  $categoryId: ID!
  $filter: ModelAnnotationFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  annotationsByCategoryId(
    categoryId: $categoryId
    filter: $filter
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
` as GeneratedQuery<
  APITypes.AnnotationsByCategoryIdQueryVariables,
  APITypes.AnnotationsByCategoryIdQuery
>;
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
` as GeneratedQuery<
  APITypes.AnnotationsByImageIdAndSetIdQueryVariables,
  APITypes.AnnotationsByImageIdAndSetIdQuery
>;
export const annotationsByObjectId = /* GraphQL */ `query AnnotationsByObjectId(
  $filter: ModelAnnotationFilterInput
  $limit: Int
  $nextToken: String
  $objectId: ID!
  $sortDirection: ModelSortDirection
) {
  annotationsByObjectId(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    objectId: $objectId
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
` as GeneratedQuery<
  APITypes.AnnotationsByObjectIdQueryVariables,
  APITypes.AnnotationsByObjectIdQuery
>;
export const categoriesByProjectId = /* GraphQL */ `query CategoriesByProjectId(
  $filter: ModelCategoryFilterInput
  $limit: Int
  $nextToken: String
  $projectId: ID!
  $sortDirection: ModelSortDirection
) {
  categoriesByProjectId(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    projectId: $projectId
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
  APITypes.CategoriesByProjectIdQueryVariables,
  APITypes.CategoriesByProjectIdQuery
>;
export const getAnnotation = /* GraphQL */ `query GetAnnotation($id: ID!) {
  getAnnotation(id: $id) {
    category {
      color
      createdAt
      id
      name
      projectId
      shortcutKey
      updatedAt
      __typename
    }
    categoryId
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
      originalPath
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
    object {
      categoryId
      createdAt
      id
      projectId
      updatedAt
      __typename
    }
    objectId
    obscured
    owner
    project {
      createdAt
      id
      name
      updatedAt
      __typename
    }
    projectId
    set {
      createdAt
      id
      name
      projectId
      updatedAt
      __typename
    }
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
export const getAnnotationCounts = /* GraphQL */ `query GetAnnotationCounts($annotationSetId: String!) {
  getAnnotationCounts(annotationSetId: $annotationSetId)
}
` as GeneratedQuery<
  APITypes.GetAnnotationCountsQueryVariables,
  APITypes.GetAnnotationCountsQuery
>;
export const getAnnotationSet = /* GraphQL */ `query GetAnnotationSet($id: ID!) {
  getAnnotationSet(id: $id) {
    annotations {
      nextToken
      __typename
    }
    createdAt
    id
    name
    observations {
      nextToken
      __typename
    }
    project {
      createdAt
      id
      name
      updatedAt
      __typename
    }
    projectId
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetAnnotationSetQueryVariables,
  APITypes.GetAnnotationSetQuery
>;
export const getCategory = /* GraphQL */ `query GetCategory($id: ID!) {
  getCategory(id: $id) {
    annotations {
      nextToken
      __typename
    }
    color
    createdAt
    id
    name
    objects {
      nextToken
      __typename
    }
    project {
      createdAt
      id
      name
      updatedAt
      __typename
    }
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
export const getImage = /* GraphQL */ `query GetImage($id: ID!) {
  getImage(id: $id) {
    altitude_agl
    altitude_egm96
    altitude_wgs84
    annotations {
      nextToken
      __typename
    }
    cameraSerial
    createdAt
    exifData
    files {
      nextToken
      __typename
    }
    height
    id
    latitude
    leftNeighbours {
      nextToken
      __typename
    }
    locations {
      nextToken
      __typename
    }
    longitude
    memberships {
      nextToken
      __typename
    }
    originalPath
    pitch
    project {
      createdAt
      id
      name
      updatedAt
      __typename
    }
    projectId
    rightNeighbours {
      nextToken
      __typename
    }
    roll
    timestamp
    updatedAt
    width
    yaw
    __typename
  }
}
` as GeneratedQuery<APITypes.GetImageQueryVariables, APITypes.GetImageQuery>;
export const getImageCounts = /* GraphQL */ `query GetImageCounts($imageSetId: String!) {
  getImageCounts(imageSetId: $imageSetId)
}
` as GeneratedQuery<
  APITypes.GetImageCountsQueryVariables,
  APITypes.GetImageCountsQuery
>;
export const getImageFile = /* GraphQL */ `query GetImageFile($id: ID!) {
  getImageFile(id: $id) {
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
      originalPath
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
    key
    path
    project {
      createdAt
      id
      name
      updatedAt
      __typename
    }
    projectId
    type
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetImageFileQueryVariables,
  APITypes.GetImageFileQuery
>;
export const getImageNeighbour = /* GraphQL */ `query GetImageNeighbour($image1Id: ID!, $image2Id: ID!) {
  getImageNeighbour(image1Id: $image1Id, image2Id: $image2Id) {
    createdAt
    homography
    image1 {
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
      originalPath
      pitch
      projectId
      roll
      timestamp
      updatedAt
      width
      yaw
      __typename
    }
    image1Id
    image2 {
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
      originalPath
      pitch
      projectId
      roll
      timestamp
      updatedAt
      width
      yaw
      __typename
    }
    image2Id
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetImageNeighbourQueryVariables,
  APITypes.GetImageNeighbourQuery
>;
export const getImageSet = /* GraphQL */ `query GetImageSet($id: ID!) {
  getImageSet(id: $id) {
    createdAt
    id
    images {
      nextToken
      __typename
    }
    name
    project {
      createdAt
      id
      name
      updatedAt
      __typename
    }
    projectId
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetImageSetQueryVariables,
  APITypes.GetImageSetQuery
>;
export const getImageSetMembership = /* GraphQL */ `query GetImageSetMembership($id: ID!) {
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
      originalPath
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
export const getLocation = /* GraphQL */ `query GetLocation($id: ID!) {
  getLocation(id: $id) {
    confidence
    createdAt
    height
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
      originalPath
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
    observations {
      nextToken
      __typename
    }
    project {
      createdAt
      id
      name
      updatedAt
      __typename
    }
    projectId
    set {
      createdAt
      id
      name
      projectId
      updatedAt
      __typename
    }
    setId
    sets {
      nextToken
      __typename
    }
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
export const getLocationSet = /* GraphQL */ `query GetLocationSet($id: ID!) {
  getLocationSet(id: $id) {
    createdAt
    id
    locations {
      nextToken
      __typename
    }
    memberships {
      nextToken
      __typename
    }
    name
    project {
      createdAt
      id
      name
      updatedAt
      __typename
    }
    projectId
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetLocationSetQueryVariables,
  APITypes.GetLocationSetQuery
>;
export const getLocationSetMembership = /* GraphQL */ `query GetLocationSetMembership($id: ID!) {
  getLocationSetMembership(id: $id) {
    createdAt
    id
    location {
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
    locationId
    locationSet {
      createdAt
      id
      name
      projectId
      updatedAt
      __typename
    }
    locationSetId
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetLocationSetMembershipQueryVariables,
  APITypes.GetLocationSetMembershipQuery
>;
export const getObject = /* GraphQL */ `query GetObject($id: ID!) {
  getObject(id: $id) {
    annotations {
      nextToken
      __typename
    }
    category {
      color
      createdAt
      id
      name
      projectId
      shortcutKey
      updatedAt
      __typename
    }
    categoryId
    createdAt
    id
    project {
      createdAt
      id
      name
      updatedAt
      __typename
    }
    projectId
    updatedAt
    __typename
  }
}
` as GeneratedQuery<APITypes.GetObjectQueryVariables, APITypes.GetObjectQuery>;
export const getObservation = /* GraphQL */ `query GetObservation($id: ID!) {
  getObservation(id: $id) {
    annotationCount
    annotationSet {
      createdAt
      id
      name
      projectId
      updatedAt
      __typename
    }
    annotationSetId
    createdAt
    id
    loadingTime
    location {
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
    locationId
    owner
    project {
      createdAt
      id
      name
      updatedAt
      __typename
    }
    projectId
    timeTaken
    updatedAt
    waitingTime
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetObservationQueryVariables,
  APITypes.GetObservationQuery
>;
export const getProject = /* GraphQL */ `query GetProject($id: ID!) {
  getProject(id: $id) {
    annotationSets {
      nextToken
      __typename
    }
    annotations {
      nextToken
      __typename
    }
    categories {
      nextToken
      __typename
    }
    createdAt
    id
    imageFiles {
      nextToken
      __typename
    }
    imageSets {
      nextToken
      __typename
    }
    images {
      nextToken
      __typename
    }
    locationSets {
      nextToken
      __typename
    }
    locations {
      nextToken
      __typename
    }
    members {
      nextToken
      __typename
    }
    name
    objects {
      nextToken
      __typename
    }
    observations {
      nextToken
      __typename
    }
    queues {
      nextToken
      __typename
    }
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetProjectQueryVariables,
  APITypes.GetProjectQuery
>;
export const getQueue = /* GraphQL */ `query GetQueue($id: ID!) {
  getQueue(id: $id) {
    createdAt
    id
    name
    project {
      createdAt
      id
      name
      updatedAt
      __typename
    }
    projectId
    updatedAt
    url
    users {
      nextToken
      __typename
    }
    __typename
  }
}
` as GeneratedQuery<APITypes.GetQueueQueryVariables, APITypes.GetQueueQuery>;
export const getUserProjectMembership = /* GraphQL */ `query GetUserProjectMembership($id: ID!) {
  getUserProjectMembership(id: $id) {
    createdAt
    id
    isAdmin
    project {
      createdAt
      id
      name
      updatedAt
      __typename
    }
    projectId
    queue {
      createdAt
      id
      name
      projectId
      updatedAt
      url
      __typename
    }
    queueId
    updatedAt
    userId
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetUserProjectMembershipQueryVariables,
  APITypes.GetUserProjectMembershipQuery
>;
export const getUserStats = /* GraphQL */ `query GetUserStats(
  $date: AWSDate!
  $projectId: ID!
  $setId: ID!
  $userId: ID!
) {
  getUserStats(
    date: $date
    projectId: $projectId
    setId: $setId
    userId: $userId
  ) {
    activeTime
    annotationCount
    annotationTime
    createdAt
    date
    observationCount
    projectId
    searchCount
    searchTime
    setId
    sightingCount
    updatedAt
    userId
    waitingTime
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetUserStatsQueryVariables,
  APITypes.GetUserStatsQuery
>;
export const imageNeighboursByImage1key = /* GraphQL */ `query ImageNeighboursByImage1key(
  $filter: ModelImageNeighbourFilterInput
  $image1Id: ID!
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  imageNeighboursByImage1key(
    filter: $filter
    image1Id: $image1Id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      createdAt
      homography
      image1Id
      image2Id
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ImageNeighboursByImage1keyQueryVariables,
  APITypes.ImageNeighboursByImage1keyQuery
>;
export const imageNeighboursByImage2key = /* GraphQL */ `query ImageNeighboursByImage2key(
  $filter: ModelImageNeighbourFilterInput
  $image2Id: ID!
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  imageNeighboursByImage2key(
    filter: $filter
    image2Id: $image2Id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      createdAt
      homography
      image1Id
      image2Id
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ImageNeighboursByImage2keyQueryVariables,
  APITypes.ImageNeighboursByImage2keyQuery
>;
export const imageSetMembershipsByImageSetId = /* GraphQL */ `query ImageSetMembershipsByImageSetId(
  $filter: ModelImageSetMembershipFilterInput
  $imageSetId: ID!
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  imageSetMembershipsByImageSetId(
    filter: $filter
    imageSetId: $imageSetId
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
  APITypes.ImageSetMembershipsByImageSetIdQueryVariables,
  APITypes.ImageSetMembershipsByImageSetIdQuery
>;
export const imageSetsByProjectId = /* GraphQL */ `query ImageSetsByProjectId(
  $filter: ModelImageSetFilterInput
  $limit: Int
  $nextToken: String
  $projectId: ID!
  $sortDirection: ModelSortDirection
) {
  imageSetsByProjectId(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    projectId: $projectId
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
  APITypes.ImageSetsByProjectIdQueryVariables,
  APITypes.ImageSetsByProjectIdQuery
>;
export const imagesByPath = /* GraphQL */ `query ImagesByPath(
  $filter: ModelImageFileFilterInput
  $limit: Int
  $nextToken: String
  $path: String!
  $sortDirection: ModelSortDirection
) {
  imagesByPath(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    path: $path
    sortDirection: $sortDirection
  ) {
    items {
      createdAt
      id
      imageId
      key
      path
      projectId
      type
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ImagesByPathQueryVariables,
  APITypes.ImagesByPathQuery
>;
export const imagesByimageId = /* GraphQL */ `query ImagesByimageId(
  $filter: ModelImageFileFilterInput
  $imageId: ID!
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  imagesByimageId(
    filter: $filter
    imageId: $imageId
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      createdAt
      id
      imageId
      key
      path
      projectId
      type
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ImagesByimageIdQueryVariables,
  APITypes.ImagesByimageIdQuery
>;
export const listAnnotationSets = /* GraphQL */ `query ListAnnotationSets(
  $filter: ModelAnnotationSetFilterInput
  $limit: Int
  $nextToken: String
) {
  listAnnotationSets(filter: $filter, limit: $limit, nextToken: $nextToken) {
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
  $limit: Int
  $nextToken: String
) {
  listAnnotations(filter: $filter, limit: $limit, nextToken: $nextToken) {
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
` as GeneratedQuery<
  APITypes.ListAnnotationsQueryVariables,
  APITypes.ListAnnotationsQuery
>;
export const listCategories = /* GraphQL */ `query ListCategories(
  $filter: ModelCategoryFilterInput
  $limit: Int
  $nextToken: String
) {
  listCategories(filter: $filter, limit: $limit, nextToken: $nextToken) {
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
  $limit: Int
  $nextToken: String
) {
  listImageFiles(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      createdAt
      id
      imageId
      key
      path
      projectId
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
export const listImageNeighbours = /* GraphQL */ `query ListImageNeighbours(
  $filter: ModelImageNeighbourFilterInput
  $image1Id: ID
  $image2Id: ModelIDKeyConditionInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listImageNeighbours(
    filter: $filter
    image1Id: $image1Id
    image2Id: $image2Id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      createdAt
      homography
      image1Id
      image2Id
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListImageNeighboursQueryVariables,
  APITypes.ListImageNeighboursQuery
>;
export const listImageSetMemberships = /* GraphQL */ `query ListImageSetMemberships(
  $filter: ModelImageSetMembershipFilterInput
  $limit: Int
  $nextToken: String
) {
  listImageSetMemberships(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
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
  $limit: Int
  $nextToken: String
) {
  listImageSets(filter: $filter, limit: $limit, nextToken: $nextToken) {
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
  $limit: Int
  $nextToken: String
) {
  listImages(filter: $filter, limit: $limit, nextToken: $nextToken) {
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
      originalPath
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
export const listLocationSetMemberships = /* GraphQL */ `query ListLocationSetMemberships(
  $filter: ModelLocationSetMembershipFilterInput
  $limit: Int
  $nextToken: String
) {
  listLocationSetMemberships(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
      createdAt
      id
      locationId
      locationSetId
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListLocationSetMembershipsQueryVariables,
  APITypes.ListLocationSetMembershipsQuery
>;
export const listLocationSets = /* GraphQL */ `query ListLocationSets(
  $filter: ModelLocationSetFilterInput
  $limit: Int
  $nextToken: String
) {
  listLocationSets(filter: $filter, limit: $limit, nextToken: $nextToken) {
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
  $limit: Int
  $nextToken: String
) {
  listLocations(filter: $filter, limit: $limit, nextToken: $nextToken) {
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
  $limit: Int
  $nextToken: String
) {
  listObjects(filter: $filter, limit: $limit, nextToken: $nextToken) {
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
  $limit: Int
  $nextToken: String
) {
  listObservations(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      annotationCount
      annotationSetId
      createdAt
      id
      loadingTime
      locationId
      owner
      projectId
      timeTaken
      updatedAt
      waitingTime
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
  $limit: Int
  $nextToken: String
) {
  listProjects(filter: $filter, limit: $limit, nextToken: $nextToken) {
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
  $limit: Int
  $nextToken: String
) {
  listQueues(filter: $filter, limit: $limit, nextToken: $nextToken) {
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
  $limit: Int
  $nextToken: String
) {
  listUserProjectMemberships(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
      createdAt
      id
      isAdmin
      projectId
      queueId
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
export const listUserStats = /* GraphQL */ `query ListUserStats(
  $filter: ModelUserStatsFilterInput
  $limit: Int
  $nextToken: String
  $projectId: ID
  $sortDirection: ModelSortDirection
  $userIdDateSetId: ModelUserStatsPrimaryCompositeKeyConditionInput
) {
  listUserStats(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    projectId: $projectId
    sortDirection: $sortDirection
    userIdDateSetId: $userIdDateSetId
  ) {
    items {
      activeTime
      annotationCount
      annotationTime
      createdAt
      date
      observationCount
      projectId
      searchCount
      searchTime
      setId
      sightingCount
      updatedAt
      userId
      waitingTime
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListUserStatsQueryVariables,
  APITypes.ListUserStatsQuery
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
export const locationSetsByProjectId = /* GraphQL */ `query LocationSetsByProjectId(
  $filter: ModelLocationSetFilterInput
  $limit: Int
  $nextToken: String
  $projectId: ID!
  $sortDirection: ModelSortDirection
) {
  locationSetsByProjectId(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    projectId: $projectId
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
  APITypes.LocationSetsByProjectIdQueryVariables,
  APITypes.LocationSetsByProjectIdQuery
>;
export const locationsByImageKey = /* GraphQL */ `query LocationsByImageKey(
  $confidence: ModelFloatKeyConditionInput
  $filter: ModelLocationFilterInput
  $imageId: ID!
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  locationsByImageKey(
    confidence: $confidence
    filter: $filter
    imageId: $imageId
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
  APITypes.LocationsByImageKeyQueryVariables,
  APITypes.LocationsByImageKeyQuery
>;
export const locationsBySetIdAndConfidence = /* GraphQL */ `query LocationsBySetIdAndConfidence(
  $confidence: ModelFloatKeyConditionInput
  $filter: ModelLocationFilterInput
  $limit: Int
  $nextToken: String
  $setId: ID!
  $sortDirection: ModelSortDirection
) {
  locationsBySetIdAndConfidence(
    confidence: $confidence
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    setId: $setId
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
  APITypes.LocationsBySetIdAndConfidenceQueryVariables,
  APITypes.LocationsBySetIdAndConfidenceQuery
>;
export const objectsByCategoryId = /* GraphQL */ `query ObjectsByCategoryId(
  $categoryId: ID!
  $filter: ModelObjectFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  objectsByCategoryId(
    categoryId: $categoryId
    filter: $filter
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
  APITypes.ObjectsByCategoryIdQueryVariables,
  APITypes.ObjectsByCategoryIdQuery
>;
export const observationsByAnnotationSetId = /* GraphQL */ `query ObservationsByAnnotationSetId(
  $annotationSetId: ID!
  $filter: ModelObservationFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  observationsByAnnotationSetId(
    annotationSetId: $annotationSetId
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      annotationCount
      annotationSetId
      createdAt
      id
      loadingTime
      locationId
      owner
      projectId
      timeTaken
      updatedAt
      waitingTime
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ObservationsByAnnotationSetIdQueryVariables,
  APITypes.ObservationsByAnnotationSetIdQuery
>;
export const observationsByLocationId = /* GraphQL */ `query ObservationsByLocationId(
  $filter: ModelObservationFilterInput
  $limit: Int
  $locationId: ID!
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  observationsByLocationId(
    filter: $filter
    limit: $limit
    locationId: $locationId
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      annotationCount
      annotationSetId
      createdAt
      id
      loadingTime
      locationId
      owner
      projectId
      timeTaken
      updatedAt
      waitingTime
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ObservationsByLocationIdQueryVariables,
  APITypes.ObservationsByLocationIdQuery
>;
export const queuesByProjectId = /* GraphQL */ `query QueuesByProjectId(
  $filter: ModelQueueFilterInput
  $limit: Int
  $nextToken: String
  $projectId: ID!
  $sortDirection: ModelSortDirection
) {
  queuesByProjectId(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    projectId: $projectId
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
  APITypes.QueuesByProjectIdQueryVariables,
  APITypes.QueuesByProjectIdQuery
>;
export const userProjectMembershipsByProjectId = /* GraphQL */ `query UserProjectMembershipsByProjectId(
  $filter: ModelUserProjectMembershipFilterInput
  $limit: Int
  $nextToken: String
  $projectId: ID!
  $sortDirection: ModelSortDirection
) {
  userProjectMembershipsByProjectId(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    projectId: $projectId
    sortDirection: $sortDirection
  ) {
    items {
      createdAt
      id
      isAdmin
      projectId
      queueId
      updatedAt
      userId
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.UserProjectMembershipsByProjectIdQueryVariables,
  APITypes.UserProjectMembershipsByProjectIdQuery
>;
export const userProjectMembershipsByQueueId = /* GraphQL */ `query UserProjectMembershipsByQueueId(
  $filter: ModelUserProjectMembershipFilterInput
  $limit: Int
  $nextToken: String
  $queueId: ID!
  $sortDirection: ModelSortDirection
) {
  userProjectMembershipsByQueueId(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    queueId: $queueId
    sortDirection: $sortDirection
  ) {
    items {
      createdAt
      id
      isAdmin
      projectId
      queueId
      updatedAt
      userId
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.UserProjectMembershipsByQueueIdQueryVariables,
  APITypes.UserProjectMembershipsByQueueIdQuery
>;
export const userProjectMembershipsByUserId = /* GraphQL */ `query UserProjectMembershipsByUserId(
  $filter: ModelUserProjectMembershipFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
  $userId: String!
) {
  userProjectMembershipsByUserId(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
    userId: $userId
  ) {
    items {
      createdAt
      id
      isAdmin
      projectId
      queueId
      updatedAt
      userId
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.UserProjectMembershipsByUserIdQueryVariables,
  APITypes.UserProjectMembershipsByUserIdQuery
>;
