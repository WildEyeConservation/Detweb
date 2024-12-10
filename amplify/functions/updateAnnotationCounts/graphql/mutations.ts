/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "./API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const addUserToGroup = /* GraphQL */ `mutation AddUserToGroup($groupName: String!, $userId: String!) {
  addUserToGroup(groupName: $groupName, userId: $userId)
}
` as GeneratedMutation<
  APITypes.AddUserToGroupMutationVariables,
  APITypes.AddUserToGroupMutation
>;
export const createAnnotation = /* GraphQL */ `mutation CreateAnnotation(
  $condition: ModelAnnotationConditionInput
  $input: CreateAnnotationInput!
) {
  createAnnotation(condition: $condition, input: $input) {
    category {
      annotationCount
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
      annotationCount
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
` as GeneratedMutation<
  APITypes.CreateAnnotationMutationVariables,
  APITypes.CreateAnnotationMutation
>;
export const createAnnotationCountPerCategoryPerSet = /* GraphQL */ `mutation CreateAnnotationCountPerCategoryPerSet(
  $condition: ModelAnnotationCountPerCategoryPerSetConditionInput
  $input: CreateAnnotationCountPerCategoryPerSetInput!
) {
  createAnnotationCountPerCategoryPerSet(condition: $condition, input: $input) {
    annotationCount
    annotationSet {
      annotationCount
      createdAt
      id
      name
      projectId
      updatedAt
      __typename
    }
    annotationSetId
    category {
      annotationCount
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
` as GeneratedMutation<
  APITypes.CreateAnnotationCountPerCategoryPerSetMutationVariables,
  APITypes.CreateAnnotationCountPerCategoryPerSetMutation
>;
export const createAnnotationSet = /* GraphQL */ `mutation CreateAnnotationSet(
  $condition: ModelAnnotationSetConditionInput
  $input: CreateAnnotationSetInput!
) {
  createAnnotationSet(condition: $condition, input: $input) {
    annotationCount
    annotationCountPerCategory {
      nextToken
      __typename
    }
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
    tasks {
      nextToken
      __typename
    }
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateAnnotationSetMutationVariables,
  APITypes.CreateAnnotationSetMutation
>;
export const createCategory = /* GraphQL */ `mutation CreateCategory(
  $condition: ModelCategoryConditionInput
  $input: CreateCategoryInput!
) {
  createCategory(condition: $condition, input: $input) {
    annotationCount
    annotationCountPerSet {
      nextToken
      __typename
    }
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
` as GeneratedMutation<
  APITypes.CreateCategoryMutationVariables,
  APITypes.CreateCategoryMutation
>;
export const createGroup = /* GraphQL */ `mutation CreateGroup($groupName: String!) {
  createGroup(groupName: $groupName)
}
` as GeneratedMutation<
  APITypes.CreateGroupMutationVariables,
  APITypes.CreateGroupMutation
>;
export const createImage = /* GraphQL */ `mutation CreateImage(
  $condition: ModelImageConditionInput
  $input: CreateImageInput!
) {
  createImage(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.CreateImageMutationVariables,
  APITypes.CreateImageMutation
>;
export const createImageFile = /* GraphQL */ `mutation CreateImageFile(
  $condition: ModelImageFileConditionInput
  $input: CreateImageFileInput!
) {
  createImageFile(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.CreateImageFileMutationVariables,
  APITypes.CreateImageFileMutation
>;
export const createImageNeighbour = /* GraphQL */ `mutation CreateImageNeighbour(
  $condition: ModelImageNeighbourConditionInput
  $input: CreateImageNeighbourInput!
) {
  createImageNeighbour(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.CreateImageNeighbourMutationVariables,
  APITypes.CreateImageNeighbourMutation
>;
export const createImageSet = /* GraphQL */ `mutation CreateImageSet(
  $condition: ModelImageSetConditionInput
  $input: CreateImageSetInput!
) {
  createImageSet(condition: $condition, input: $input) {
    createdAt
    id
    imageCount
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
` as GeneratedMutation<
  APITypes.CreateImageSetMutationVariables,
  APITypes.CreateImageSetMutation
>;
export const createImageSetMembership = /* GraphQL */ `mutation CreateImageSetMembership(
  $condition: ModelImageSetMembershipConditionInput
  $input: CreateImageSetMembershipInput!
) {
  createImageSetMembership(condition: $condition, input: $input) {
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
      imageCount
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
` as GeneratedMutation<
  APITypes.CreateImageSetMembershipMutationVariables,
  APITypes.CreateImageSetMembershipMutation
>;
export const createLocation = /* GraphQL */ `mutation CreateLocation(
  $condition: ModelLocationConditionInput
  $input: CreateLocationInput!
) {
  createLocation(condition: $condition, input: $input) {
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
      locationCount
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
` as GeneratedMutation<
  APITypes.CreateLocationMutationVariables,
  APITypes.CreateLocationMutation
>;
export const createLocationSet = /* GraphQL */ `mutation CreateLocationSet(
  $condition: ModelLocationSetConditionInput
  $input: CreateLocationSetInput!
) {
  createLocationSet(condition: $condition, input: $input) {
    createdAt
    id
    locationCount
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
    tasks {
      nextToken
      __typename
    }
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateLocationSetMutationVariables,
  APITypes.CreateLocationSetMutation
>;
export const createLocationSetMembership = /* GraphQL */ `mutation CreateLocationSetMembership(
  $condition: ModelLocationSetMembershipConditionInput
  $input: CreateLocationSetMembershipInput!
) {
  createLocationSetMembership(condition: $condition, input: $input) {
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
      locationCount
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
` as GeneratedMutation<
  APITypes.CreateLocationSetMembershipMutationVariables,
  APITypes.CreateLocationSetMembershipMutation
>;
export const createObject = /* GraphQL */ `mutation CreateObject(
  $condition: ModelObjectConditionInput
  $input: CreateObjectInput!
) {
  createObject(condition: $condition, input: $input) {
    annotations {
      nextToken
      __typename
    }
    category {
      annotationCount
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
` as GeneratedMutation<
  APITypes.CreateObjectMutationVariables,
  APITypes.CreateObjectMutation
>;
export const createObservation = /* GraphQL */ `mutation CreateObservation(
  $condition: ModelObservationConditionInput
  $input: CreateObservationInput!
) {
  createObservation(condition: $condition, input: $input) {
    annotationCount
    annotationSet {
      annotationCount
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
` as GeneratedMutation<
  APITypes.CreateObservationMutationVariables,
  APITypes.CreateObservationMutation
>;
export const createProject = /* GraphQL */ `mutation CreateProject(
  $condition: ModelProjectConditionInput
  $input: CreateProjectInput!
) {
  createProject(condition: $condition, input: $input) {
    annotationCountsPerCategoryPerSet {
      nextToken
      __typename
    }
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
` as GeneratedMutation<
  APITypes.CreateProjectMutationVariables,
  APITypes.CreateProjectMutation
>;
export const createQueue = /* GraphQL */ `mutation CreateQueue(
  $condition: ModelQueueConditionInput
  $input: CreateQueueInput!
) {
  createQueue(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.CreateQueueMutationVariables,
  APITypes.CreateQueueMutation
>;
export const createTasksOnAnnotationSet = /* GraphQL */ `mutation CreateTasksOnAnnotationSet(
  $condition: ModelTasksOnAnnotationSetConditionInput
  $input: CreateTasksOnAnnotationSetInput!
) {
  createTasksOnAnnotationSet(condition: $condition, input: $input) {
    annotationSet {
      annotationCount
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
    locationSet {
      createdAt
      id
      locationCount
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
` as GeneratedMutation<
  APITypes.CreateTasksOnAnnotationSetMutationVariables,
  APITypes.CreateTasksOnAnnotationSetMutation
>;
export const createUserProjectMembership = /* GraphQL */ `mutation CreateUserProjectMembership(
  $condition: ModelUserProjectMembershipConditionInput
  $input: CreateUserProjectMembershipInput!
) {
  createUserProjectMembership(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.CreateUserProjectMembershipMutationVariables,
  APITypes.CreateUserProjectMembershipMutation
>;
export const createUserStats = /* GraphQL */ `mutation CreateUserStats(
  $condition: ModelUserStatsConditionInput
  $input: CreateUserStatsInput!
) {
  createUserStats(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.CreateUserStatsMutationVariables,
  APITypes.CreateUserStatsMutation
>;
export const deleteAnnotation = /* GraphQL */ `mutation DeleteAnnotation(
  $condition: ModelAnnotationConditionInput
  $input: DeleteAnnotationInput!
) {
  deleteAnnotation(condition: $condition, input: $input) {
    category {
      annotationCount
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
      annotationCount
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
` as GeneratedMutation<
  APITypes.DeleteAnnotationMutationVariables,
  APITypes.DeleteAnnotationMutation
>;
export const deleteAnnotationCountPerCategoryPerSet = /* GraphQL */ `mutation DeleteAnnotationCountPerCategoryPerSet(
  $condition: ModelAnnotationCountPerCategoryPerSetConditionInput
  $input: DeleteAnnotationCountPerCategoryPerSetInput!
) {
  deleteAnnotationCountPerCategoryPerSet(condition: $condition, input: $input) {
    annotationCount
    annotationSet {
      annotationCount
      createdAt
      id
      name
      projectId
      updatedAt
      __typename
    }
    annotationSetId
    category {
      annotationCount
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
` as GeneratedMutation<
  APITypes.DeleteAnnotationCountPerCategoryPerSetMutationVariables,
  APITypes.DeleteAnnotationCountPerCategoryPerSetMutation
>;
export const deleteAnnotationSet = /* GraphQL */ `mutation DeleteAnnotationSet(
  $condition: ModelAnnotationSetConditionInput
  $input: DeleteAnnotationSetInput!
) {
  deleteAnnotationSet(condition: $condition, input: $input) {
    annotationCount
    annotationCountPerCategory {
      nextToken
      __typename
    }
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
    tasks {
      nextToken
      __typename
    }
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteAnnotationSetMutationVariables,
  APITypes.DeleteAnnotationSetMutation
>;
export const deleteCategory = /* GraphQL */ `mutation DeleteCategory(
  $condition: ModelCategoryConditionInput
  $input: DeleteCategoryInput!
) {
  deleteCategory(condition: $condition, input: $input) {
    annotationCount
    annotationCountPerSet {
      nextToken
      __typename
    }
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
` as GeneratedMutation<
  APITypes.DeleteCategoryMutationVariables,
  APITypes.DeleteCategoryMutation
>;
export const deleteImage = /* GraphQL */ `mutation DeleteImage(
  $condition: ModelImageConditionInput
  $input: DeleteImageInput!
) {
  deleteImage(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.DeleteImageMutationVariables,
  APITypes.DeleteImageMutation
>;
export const deleteImageFile = /* GraphQL */ `mutation DeleteImageFile(
  $condition: ModelImageFileConditionInput
  $input: DeleteImageFileInput!
) {
  deleteImageFile(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.DeleteImageFileMutationVariables,
  APITypes.DeleteImageFileMutation
>;
export const deleteImageNeighbour = /* GraphQL */ `mutation DeleteImageNeighbour(
  $condition: ModelImageNeighbourConditionInput
  $input: DeleteImageNeighbourInput!
) {
  deleteImageNeighbour(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.DeleteImageNeighbourMutationVariables,
  APITypes.DeleteImageNeighbourMutation
>;
export const deleteImageSet = /* GraphQL */ `mutation DeleteImageSet(
  $condition: ModelImageSetConditionInput
  $input: DeleteImageSetInput!
) {
  deleteImageSet(condition: $condition, input: $input) {
    createdAt
    id
    imageCount
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
` as GeneratedMutation<
  APITypes.DeleteImageSetMutationVariables,
  APITypes.DeleteImageSetMutation
>;
export const deleteImageSetMembership = /* GraphQL */ `mutation DeleteImageSetMembership(
  $condition: ModelImageSetMembershipConditionInput
  $input: DeleteImageSetMembershipInput!
) {
  deleteImageSetMembership(condition: $condition, input: $input) {
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
      imageCount
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
` as GeneratedMutation<
  APITypes.DeleteImageSetMembershipMutationVariables,
  APITypes.DeleteImageSetMembershipMutation
>;
export const deleteLocation = /* GraphQL */ `mutation DeleteLocation(
  $condition: ModelLocationConditionInput
  $input: DeleteLocationInput!
) {
  deleteLocation(condition: $condition, input: $input) {
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
      locationCount
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
` as GeneratedMutation<
  APITypes.DeleteLocationMutationVariables,
  APITypes.DeleteLocationMutation
>;
export const deleteLocationSet = /* GraphQL */ `mutation DeleteLocationSet(
  $condition: ModelLocationSetConditionInput
  $input: DeleteLocationSetInput!
) {
  deleteLocationSet(condition: $condition, input: $input) {
    createdAt
    id
    locationCount
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
    tasks {
      nextToken
      __typename
    }
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteLocationSetMutationVariables,
  APITypes.DeleteLocationSetMutation
>;
export const deleteLocationSetMembership = /* GraphQL */ `mutation DeleteLocationSetMembership(
  $condition: ModelLocationSetMembershipConditionInput
  $input: DeleteLocationSetMembershipInput!
) {
  deleteLocationSetMembership(condition: $condition, input: $input) {
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
      locationCount
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
` as GeneratedMutation<
  APITypes.DeleteLocationSetMembershipMutationVariables,
  APITypes.DeleteLocationSetMembershipMutation
>;
export const deleteObject = /* GraphQL */ `mutation DeleteObject(
  $condition: ModelObjectConditionInput
  $input: DeleteObjectInput!
) {
  deleteObject(condition: $condition, input: $input) {
    annotations {
      nextToken
      __typename
    }
    category {
      annotationCount
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
` as GeneratedMutation<
  APITypes.DeleteObjectMutationVariables,
  APITypes.DeleteObjectMutation
>;
export const deleteObservation = /* GraphQL */ `mutation DeleteObservation(
  $condition: ModelObservationConditionInput
  $input: DeleteObservationInput!
) {
  deleteObservation(condition: $condition, input: $input) {
    annotationCount
    annotationSet {
      annotationCount
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
` as GeneratedMutation<
  APITypes.DeleteObservationMutationVariables,
  APITypes.DeleteObservationMutation
>;
export const deleteProject = /* GraphQL */ `mutation DeleteProject(
  $condition: ModelProjectConditionInput
  $input: DeleteProjectInput!
) {
  deleteProject(condition: $condition, input: $input) {
    annotationCountsPerCategoryPerSet {
      nextToken
      __typename
    }
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
` as GeneratedMutation<
  APITypes.DeleteProjectMutationVariables,
  APITypes.DeleteProjectMutation
>;
export const deleteQueue = /* GraphQL */ `mutation DeleteQueue(
  $condition: ModelQueueConditionInput
  $input: DeleteQueueInput!
) {
  deleteQueue(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.DeleteQueueMutationVariables,
  APITypes.DeleteQueueMutation
>;
export const deleteTasksOnAnnotationSet = /* GraphQL */ `mutation DeleteTasksOnAnnotationSet(
  $condition: ModelTasksOnAnnotationSetConditionInput
  $input: DeleteTasksOnAnnotationSetInput!
) {
  deleteTasksOnAnnotationSet(condition: $condition, input: $input) {
    annotationSet {
      annotationCount
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
    locationSet {
      createdAt
      id
      locationCount
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
` as GeneratedMutation<
  APITypes.DeleteTasksOnAnnotationSetMutationVariables,
  APITypes.DeleteTasksOnAnnotationSetMutation
>;
export const deleteUserProjectMembership = /* GraphQL */ `mutation DeleteUserProjectMembership(
  $condition: ModelUserProjectMembershipConditionInput
  $input: DeleteUserProjectMembershipInput!
) {
  deleteUserProjectMembership(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.DeleteUserProjectMembershipMutationVariables,
  APITypes.DeleteUserProjectMembershipMutation
>;
export const deleteUserStats = /* GraphQL */ `mutation DeleteUserStats(
  $condition: ModelUserStatsConditionInput
  $input: DeleteUserStatsInput!
) {
  deleteUserStats(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.DeleteUserStatsMutationVariables,
  APITypes.DeleteUserStatsMutation
>;
export const processImages = /* GraphQL */ `mutation ProcessImages($model: String!, $s3key: String!, $threshold: Float) {
  processImages(model: $model, s3key: $s3key, threshold: $threshold)
}
` as GeneratedMutation<
  APITypes.ProcessImagesMutationVariables,
  APITypes.ProcessImagesMutation
>;
export const publish = /* GraphQL */ `mutation Publish($channelName: String!, $content: String!) {
  publish(channelName: $channelName, content: $content) {
    channelName
    content
    __typename
  }
}
` as GeneratedMutation<
  APITypes.PublishMutationVariables,
  APITypes.PublishMutation
>;
export const removeUserFromGroup = /* GraphQL */ `mutation RemoveUserFromGroup($groupName: String!, $userId: String!) {
  removeUserFromGroup(groupName: $groupName, userId: $userId)
}
` as GeneratedMutation<
  APITypes.RemoveUserFromGroupMutationVariables,
  APITypes.RemoveUserFromGroupMutation
>;
export const updateAnnotation = /* GraphQL */ `mutation UpdateAnnotation(
  $condition: ModelAnnotationConditionInput
  $input: UpdateAnnotationInput!
) {
  updateAnnotation(condition: $condition, input: $input) {
    category {
      annotationCount
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
      annotationCount
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
` as GeneratedMutation<
  APITypes.UpdateAnnotationMutationVariables,
  APITypes.UpdateAnnotationMutation
>;
export const updateAnnotationCountPerCategoryPerSet = /* GraphQL */ `mutation UpdateAnnotationCountPerCategoryPerSet(
  $condition: ModelAnnotationCountPerCategoryPerSetConditionInput
  $input: UpdateAnnotationCountPerCategoryPerSetInput!
) {
  updateAnnotationCountPerCategoryPerSet(condition: $condition, input: $input) {
    annotationCount
    annotationSet {
      annotationCount
      createdAt
      id
      name
      projectId
      updatedAt
      __typename
    }
    annotationSetId
    category {
      annotationCount
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
` as GeneratedMutation<
  APITypes.UpdateAnnotationCountPerCategoryPerSetMutationVariables,
  APITypes.UpdateAnnotationCountPerCategoryPerSetMutation
>;
export const updateAnnotationSet = /* GraphQL */ `mutation UpdateAnnotationSet(
  $condition: ModelAnnotationSetConditionInput
  $input: UpdateAnnotationSetInput!
) {
  updateAnnotationSet(condition: $condition, input: $input) {
    annotationCount
    annotationCountPerCategory {
      nextToken
      __typename
    }
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
    tasks {
      nextToken
      __typename
    }
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateAnnotationSetMutationVariables,
  APITypes.UpdateAnnotationSetMutation
>;
export const updateCategory = /* GraphQL */ `mutation UpdateCategory(
  $condition: ModelCategoryConditionInput
  $input: UpdateCategoryInput!
) {
  updateCategory(condition: $condition, input: $input) {
    annotationCount
    annotationCountPerSet {
      nextToken
      __typename
    }
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
` as GeneratedMutation<
  APITypes.UpdateCategoryMutationVariables,
  APITypes.UpdateCategoryMutation
>;
export const updateImage = /* GraphQL */ `mutation UpdateImage(
  $condition: ModelImageConditionInput
  $input: UpdateImageInput!
) {
  updateImage(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.UpdateImageMutationVariables,
  APITypes.UpdateImageMutation
>;
export const updateImageFile = /* GraphQL */ `mutation UpdateImageFile(
  $condition: ModelImageFileConditionInput
  $input: UpdateImageFileInput!
) {
  updateImageFile(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.UpdateImageFileMutationVariables,
  APITypes.UpdateImageFileMutation
>;
export const updateImageNeighbour = /* GraphQL */ `mutation UpdateImageNeighbour(
  $condition: ModelImageNeighbourConditionInput
  $input: UpdateImageNeighbourInput!
) {
  updateImageNeighbour(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.UpdateImageNeighbourMutationVariables,
  APITypes.UpdateImageNeighbourMutation
>;
export const updateImageSet = /* GraphQL */ `mutation UpdateImageSet(
  $condition: ModelImageSetConditionInput
  $input: UpdateImageSetInput!
) {
  updateImageSet(condition: $condition, input: $input) {
    createdAt
    id
    imageCount
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
` as GeneratedMutation<
  APITypes.UpdateImageSetMutationVariables,
  APITypes.UpdateImageSetMutation
>;
export const updateImageSetMembership = /* GraphQL */ `mutation UpdateImageSetMembership(
  $condition: ModelImageSetMembershipConditionInput
  $input: UpdateImageSetMembershipInput!
) {
  updateImageSetMembership(condition: $condition, input: $input) {
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
      imageCount
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
` as GeneratedMutation<
  APITypes.UpdateImageSetMembershipMutationVariables,
  APITypes.UpdateImageSetMembershipMutation
>;
export const updateLocation = /* GraphQL */ `mutation UpdateLocation(
  $condition: ModelLocationConditionInput
  $input: UpdateLocationInput!
) {
  updateLocation(condition: $condition, input: $input) {
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
      locationCount
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
` as GeneratedMutation<
  APITypes.UpdateLocationMutationVariables,
  APITypes.UpdateLocationMutation
>;
export const updateLocationSet = /* GraphQL */ `mutation UpdateLocationSet(
  $condition: ModelLocationSetConditionInput
  $input: UpdateLocationSetInput!
) {
  updateLocationSet(condition: $condition, input: $input) {
    createdAt
    id
    locationCount
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
    tasks {
      nextToken
      __typename
    }
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateLocationSetMutationVariables,
  APITypes.UpdateLocationSetMutation
>;
export const updateLocationSetMembership = /* GraphQL */ `mutation UpdateLocationSetMembership(
  $condition: ModelLocationSetMembershipConditionInput
  $input: UpdateLocationSetMembershipInput!
) {
  updateLocationSetMembership(condition: $condition, input: $input) {
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
      locationCount
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
` as GeneratedMutation<
  APITypes.UpdateLocationSetMembershipMutationVariables,
  APITypes.UpdateLocationSetMembershipMutation
>;
export const updateObject = /* GraphQL */ `mutation UpdateObject(
  $condition: ModelObjectConditionInput
  $input: UpdateObjectInput!
) {
  updateObject(condition: $condition, input: $input) {
    annotations {
      nextToken
      __typename
    }
    category {
      annotationCount
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
` as GeneratedMutation<
  APITypes.UpdateObjectMutationVariables,
  APITypes.UpdateObjectMutation
>;
export const updateObservation = /* GraphQL */ `mutation UpdateObservation(
  $condition: ModelObservationConditionInput
  $input: UpdateObservationInput!
) {
  updateObservation(condition: $condition, input: $input) {
    annotationCount
    annotationSet {
      annotationCount
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
` as GeneratedMutation<
  APITypes.UpdateObservationMutationVariables,
  APITypes.UpdateObservationMutation
>;
export const updateProject = /* GraphQL */ `mutation UpdateProject(
  $condition: ModelProjectConditionInput
  $input: UpdateProjectInput!
) {
  updateProject(condition: $condition, input: $input) {
    annotationCountsPerCategoryPerSet {
      nextToken
      __typename
    }
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
` as GeneratedMutation<
  APITypes.UpdateProjectMutationVariables,
  APITypes.UpdateProjectMutation
>;
export const updateQueue = /* GraphQL */ `mutation UpdateQueue(
  $condition: ModelQueueConditionInput
  $input: UpdateQueueInput!
) {
  updateQueue(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.UpdateQueueMutationVariables,
  APITypes.UpdateQueueMutation
>;
export const updateTasksOnAnnotationSet = /* GraphQL */ `mutation UpdateTasksOnAnnotationSet(
  $condition: ModelTasksOnAnnotationSetConditionInput
  $input: UpdateTasksOnAnnotationSetInput!
) {
  updateTasksOnAnnotationSet(condition: $condition, input: $input) {
    annotationSet {
      annotationCount
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
    locationSet {
      createdAt
      id
      locationCount
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
` as GeneratedMutation<
  APITypes.UpdateTasksOnAnnotationSetMutationVariables,
  APITypes.UpdateTasksOnAnnotationSetMutation
>;
export const updateUserProjectMembership = /* GraphQL */ `mutation UpdateUserProjectMembership(
  $condition: ModelUserProjectMembershipConditionInput
  $input: UpdateUserProjectMembershipInput!
) {
  updateUserProjectMembership(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.UpdateUserProjectMembershipMutationVariables,
  APITypes.UpdateUserProjectMembershipMutation
>;
export const updateUserStats = /* GraphQL */ `mutation UpdateUserStats(
  $condition: ModelUserStatsConditionInput
  $input: UpdateUserStatsInput!
) {
  updateUserStats(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.UpdateUserStatsMutationVariables,
  APITypes.UpdateUserStatsMutation
>;
