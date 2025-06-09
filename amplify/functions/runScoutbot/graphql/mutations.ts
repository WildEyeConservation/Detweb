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
      annotationSetId
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
      register
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
      register
      updatedAt
      __typename
    }
    annotationSetId
    category {
      annotationCount
      annotationSetId
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
    categories {
      nextToken
      __typename
    }
    createdAt
    id
    locationAnnotationCounts {
      nextToken
      __typename
    }
    name
    observations {
      nextToken
      __typename
    }
    project {
      createdAt
      createdBy
      hidden
      id
      name
      organizationId
      status
      updatedAt
      __typename
    }
    projectId
    register
    tasks {
      nextToken
      __typename
    }
    testPresetLocations {
      nextToken
      __typename
    }
    testResults {
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
    annotationSet {
      annotationCount
      createdAt
      id
      name
      projectId
      register
      updatedAt
      __typename
    }
    annotationSetId
    annotations {
      nextToken
      __typename
    }
    color
    createdAt
    id
    locationAnnotationCounts {
      nextToken
      __typename
    }
    name
    objects {
      nextToken
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
    annotationCounts {
      nextToken
      __typename
    }
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
    testPresets {
      nextToken
      __typename
    }
    testResults {
      nextToken
      __typename
    }
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
export const createLocationAnnotationCount = /* GraphQL */ `mutation CreateLocationAnnotationCount(
  $condition: ModelLocationAnnotationCountConditionInput
  $input: CreateLocationAnnotationCountInput!
) {
  createLocationAnnotationCount(condition: $condition, input: $input) {
    annotationSet {
      annotationCount
      createdAt
      id
      name
      projectId
      register
      updatedAt
      __typename
    }
    annotationSetId
    category {
      annotationCount
      annotationSetId
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
    count
    createdAt
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
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateLocationAnnotationCountMutationVariables,
  APITypes.CreateLocationAnnotationCountMutation
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
      annotationSetId
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
      register
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
export const createOrganization = /* GraphQL */ `mutation CreateOrganization(
  $condition: ModelOrganizationConditionInput
  $input: CreateOrganizationInput!
) {
  createOrganization(condition: $condition, input: $input) {
    createdAt
    description
    id
    invites {
      nextToken
      __typename
    }
    memberships {
      nextToken
      __typename
    }
    name
    projects {
      nextToken
      __typename
    }
    testPresets {
      nextToken
      __typename
    }
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateOrganizationMutationVariables,
  APITypes.CreateOrganizationMutation
>;
export const createOrganizationInvite = /* GraphQL */ `mutation CreateOrganizationInvite(
  $condition: ModelOrganizationInviteConditionInput
  $input: CreateOrganizationInviteInput!
) {
  createOrganizationInvite(condition: $condition, input: $input) {
    createdAt
    id
    invitedBy
    organization {
      createdAt
      description
      id
      name
      updatedAt
      __typename
    }
    organizationId
    status
    updatedAt
    username
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateOrganizationInviteMutationVariables,
  APITypes.CreateOrganizationInviteMutation
>;
export const createOrganizationMembership = /* GraphQL */ `mutation CreateOrganizationMembership(
  $condition: ModelOrganizationMembershipConditionInput
  $input: CreateOrganizationMembershipInput!
) {
  createOrganizationMembership(condition: $condition, input: $input) {
    createdAt
    isAdmin
    isTested
    organization {
      createdAt
      description
      id
      name
      updatedAt
      __typename
    }
    organizationId
    updatedAt
    userId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateOrganizationMembershipMutationVariables,
  APITypes.CreateOrganizationMembershipMutation
>;
export const createOrganizationRegistration = /* GraphQL */ `mutation CreateOrganizationRegistration(
  $condition: ModelOrganizationRegistrationConditionInput
  $input: CreateOrganizationRegistrationInput!
) {
  createOrganizationRegistration(condition: $condition, input: $input) {
    briefDescription
    createdAt
    id
    organizationName
    requestedBy
    status
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateOrganizationRegistrationMutationVariables,
  APITypes.CreateOrganizationRegistrationMutation
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
    createdAt
    createdBy
    hidden
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
    organization {
      createdAt
      description
      id
      name
      updatedAt
      __typename
    }
    organizationId
    queues {
      nextToken
      __typename
    }
    status
    testConfig {
      accuracy
      createdAt
      deadzone
      interval
      postTestConfirmation
      projectId
      random
      testType
      updatedAt
      __typename
    }
    testResults {
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
export const createProjectTestConfig = /* GraphQL */ `mutation CreateProjectTestConfig(
  $condition: ModelProjectTestConfigConditionInput
  $input: CreateProjectTestConfigInput!
) {
  createProjectTestConfig(condition: $condition, input: $input) {
    accuracy
    createdAt
    deadzone
    interval
    postTestConfirmation
    project {
      createdAt
      createdBy
      hidden
      id
      name
      organizationId
      status
      updatedAt
      __typename
    }
    projectId
    random
    testPresetProjects {
      nextToken
      __typename
    }
    testType
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateProjectTestConfigMutationVariables,
  APITypes.CreateProjectTestConfigMutation
>;
export const createQueue = /* GraphQL */ `mutation CreateQueue(
  $condition: ModelQueueConditionInput
  $input: CreateQueueInput!
) {
  createQueue(condition: $condition, input: $input) {
    approximateSize
    backupUsers {
      nextToken
      __typename
    }
    batchSize
    createdAt
    hidden
    id
    name
    project {
      createdAt
      createdBy
      hidden
      id
      name
      organizationId
      status
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
    zoom
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
      register
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
export const createTestPreset = /* GraphQL */ `mutation CreateTestPreset(
  $condition: ModelTestPresetConditionInput
  $input: CreateTestPresetInput!
) {
  createTestPreset(condition: $condition, input: $input) {
    createdAt
    id
    locations {
      nextToken
      __typename
    }
    name
    organization {
      createdAt
      description
      id
      name
      updatedAt
      __typename
    }
    organizationId
    projects {
      nextToken
      __typename
    }
    testResults {
      nextToken
      __typename
    }
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateTestPresetMutationVariables,
  APITypes.CreateTestPresetMutation
>;
export const createTestPresetLocation = /* GraphQL */ `mutation CreateTestPresetLocation(
  $condition: ModelTestPresetLocationConditionInput
  $input: CreateTestPresetLocationInput!
) {
  createTestPresetLocation(condition: $condition, input: $input) {
    annotationSet {
      annotationCount
      createdAt
      id
      name
      projectId
      register
      updatedAt
      __typename
    }
    annotationSetId
    createdAt
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
    testPreset {
      createdAt
      id
      name
      organizationId
      updatedAt
      __typename
    }
    testPresetId
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateTestPresetLocationMutationVariables,
  APITypes.CreateTestPresetLocationMutation
>;
export const createTestPresetProject = /* GraphQL */ `mutation CreateTestPresetProject(
  $condition: ModelTestPresetProjectConditionInput
  $input: CreateTestPresetProjectInput!
) {
  createTestPresetProject(condition: $condition, input: $input) {
    createdAt
    projectConfig {
      accuracy
      createdAt
      deadzone
      interval
      postTestConfirmation
      projectId
      random
      testType
      updatedAt
      __typename
    }
    projectId
    testPreset {
      createdAt
      id
      name
      organizationId
      updatedAt
      __typename
    }
    testPresetId
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateTestPresetProjectMutationVariables,
  APITypes.CreateTestPresetProjectMutation
>;
export const createTestResult = /* GraphQL */ `mutation CreateTestResult(
  $condition: ModelTestResultConditionInput
  $input: CreateTestResultInput!
) {
  createTestResult(condition: $condition, input: $input) {
    annotationSet {
      annotationCount
      createdAt
      id
      name
      projectId
      register
      updatedAt
      __typename
    }
    annotationSetId
    categoryCounts {
      nextToken
      __typename
    }
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
    passedOnTotal
    project {
      createdAt
      createdBy
      hidden
      id
      name
      organizationId
      status
      updatedAt
      __typename
    }
    projectId
    testAnimals
    testPreset {
      createdAt
      id
      name
      organizationId
      updatedAt
      __typename
    }
    testPresetId
    totalMissedAnimals
    updatedAt
    userId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateTestResultMutationVariables,
  APITypes.CreateTestResultMutation
>;
export const createTestResultCategoryCount = /* GraphQL */ `mutation CreateTestResultCategoryCount(
  $condition: ModelTestResultCategoryCountConditionInput
  $input: CreateTestResultCategoryCountInput!
) {
  createTestResultCategoryCount(condition: $condition, input: $input) {
    categoryName
    createdAt
    testCount
    testResult {
      annotationSetId
      createdAt
      id
      locationId
      passedOnTotal
      projectId
      testAnimals
      testPresetId
      totalMissedAnimals
      updatedAt
      userId
      __typename
    }
    testResultId
    updatedAt
    userCount
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateTestResultCategoryCountMutationVariables,
  APITypes.CreateTestResultCategoryCountMutation
>;
export const createUserProjectMembership = /* GraphQL */ `mutation CreateUserProjectMembership(
  $condition: ModelUserProjectMembershipConditionInput
  $input: CreateUserProjectMembershipInput!
) {
  createUserProjectMembership(condition: $condition, input: $input) {
    backupQueue {
      approximateSize
      batchSize
      createdAt
      hidden
      id
      name
      projectId
      updatedAt
      url
      zoom
      __typename
    }
    backupQueueId
    createdAt
    id
    isAdmin
    project {
      createdAt
      createdBy
      hidden
      id
      name
      organizationId
      status
      updatedAt
      __typename
    }
    projectId
    queue {
      approximateSize
      batchSize
      createdAt
      hidden
      id
      name
      projectId
      updatedAt
      url
      zoom
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
      annotationSetId
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
      register
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
      register
      updatedAt
      __typename
    }
    annotationSetId
    category {
      annotationCount
      annotationSetId
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
    categories {
      nextToken
      __typename
    }
    createdAt
    id
    locationAnnotationCounts {
      nextToken
      __typename
    }
    name
    observations {
      nextToken
      __typename
    }
    project {
      createdAt
      createdBy
      hidden
      id
      name
      organizationId
      status
      updatedAt
      __typename
    }
    projectId
    register
    tasks {
      nextToken
      __typename
    }
    testPresetLocations {
      nextToken
      __typename
    }
    testResults {
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
    annotationSet {
      annotationCount
      createdAt
      id
      name
      projectId
      register
      updatedAt
      __typename
    }
    annotationSetId
    annotations {
      nextToken
      __typename
    }
    color
    createdAt
    id
    locationAnnotationCounts {
      nextToken
      __typename
    }
    name
    objects {
      nextToken
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
    annotationCounts {
      nextToken
      __typename
    }
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
    testPresets {
      nextToken
      __typename
    }
    testResults {
      nextToken
      __typename
    }
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
export const deleteLocationAnnotationCount = /* GraphQL */ `mutation DeleteLocationAnnotationCount(
  $condition: ModelLocationAnnotationCountConditionInput
  $input: DeleteLocationAnnotationCountInput!
) {
  deleteLocationAnnotationCount(condition: $condition, input: $input) {
    annotationSet {
      annotationCount
      createdAt
      id
      name
      projectId
      register
      updatedAt
      __typename
    }
    annotationSetId
    category {
      annotationCount
      annotationSetId
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
    count
    createdAt
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
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteLocationAnnotationCountMutationVariables,
  APITypes.DeleteLocationAnnotationCountMutation
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
      annotationSetId
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
      register
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
export const deleteOrganization = /* GraphQL */ `mutation DeleteOrganization(
  $condition: ModelOrganizationConditionInput
  $input: DeleteOrganizationInput!
) {
  deleteOrganization(condition: $condition, input: $input) {
    createdAt
    description
    id
    invites {
      nextToken
      __typename
    }
    memberships {
      nextToken
      __typename
    }
    name
    projects {
      nextToken
      __typename
    }
    testPresets {
      nextToken
      __typename
    }
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteOrganizationMutationVariables,
  APITypes.DeleteOrganizationMutation
>;
export const deleteOrganizationInvite = /* GraphQL */ `mutation DeleteOrganizationInvite(
  $condition: ModelOrganizationInviteConditionInput
  $input: DeleteOrganizationInviteInput!
) {
  deleteOrganizationInvite(condition: $condition, input: $input) {
    createdAt
    id
    invitedBy
    organization {
      createdAt
      description
      id
      name
      updatedAt
      __typename
    }
    organizationId
    status
    updatedAt
    username
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteOrganizationInviteMutationVariables,
  APITypes.DeleteOrganizationInviteMutation
>;
export const deleteOrganizationMembership = /* GraphQL */ `mutation DeleteOrganizationMembership(
  $condition: ModelOrganizationMembershipConditionInput
  $input: DeleteOrganizationMembershipInput!
) {
  deleteOrganizationMembership(condition: $condition, input: $input) {
    createdAt
    isAdmin
    isTested
    organization {
      createdAt
      description
      id
      name
      updatedAt
      __typename
    }
    organizationId
    updatedAt
    userId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteOrganizationMembershipMutationVariables,
  APITypes.DeleteOrganizationMembershipMutation
>;
export const deleteOrganizationRegistration = /* GraphQL */ `mutation DeleteOrganizationRegistration(
  $condition: ModelOrganizationRegistrationConditionInput
  $input: DeleteOrganizationRegistrationInput!
) {
  deleteOrganizationRegistration(condition: $condition, input: $input) {
    briefDescription
    createdAt
    id
    organizationName
    requestedBy
    status
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteOrganizationRegistrationMutationVariables,
  APITypes.DeleteOrganizationRegistrationMutation
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
    createdAt
    createdBy
    hidden
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
    organization {
      createdAt
      description
      id
      name
      updatedAt
      __typename
    }
    organizationId
    queues {
      nextToken
      __typename
    }
    status
    testConfig {
      accuracy
      createdAt
      deadzone
      interval
      postTestConfirmation
      projectId
      random
      testType
      updatedAt
      __typename
    }
    testResults {
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
export const deleteProjectTestConfig = /* GraphQL */ `mutation DeleteProjectTestConfig(
  $condition: ModelProjectTestConfigConditionInput
  $input: DeleteProjectTestConfigInput!
) {
  deleteProjectTestConfig(condition: $condition, input: $input) {
    accuracy
    createdAt
    deadzone
    interval
    postTestConfirmation
    project {
      createdAt
      createdBy
      hidden
      id
      name
      organizationId
      status
      updatedAt
      __typename
    }
    projectId
    random
    testPresetProjects {
      nextToken
      __typename
    }
    testType
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteProjectTestConfigMutationVariables,
  APITypes.DeleteProjectTestConfigMutation
>;
export const deleteQueue = /* GraphQL */ `mutation DeleteQueue(
  $condition: ModelQueueConditionInput
  $input: DeleteQueueInput!
) {
  deleteQueue(condition: $condition, input: $input) {
    approximateSize
    backupUsers {
      nextToken
      __typename
    }
    batchSize
    createdAt
    hidden
    id
    name
    project {
      createdAt
      createdBy
      hidden
      id
      name
      organizationId
      status
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
    zoom
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
      register
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
export const deleteTestPreset = /* GraphQL */ `mutation DeleteTestPreset(
  $condition: ModelTestPresetConditionInput
  $input: DeleteTestPresetInput!
) {
  deleteTestPreset(condition: $condition, input: $input) {
    createdAt
    id
    locations {
      nextToken
      __typename
    }
    name
    organization {
      createdAt
      description
      id
      name
      updatedAt
      __typename
    }
    organizationId
    projects {
      nextToken
      __typename
    }
    testResults {
      nextToken
      __typename
    }
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteTestPresetMutationVariables,
  APITypes.DeleteTestPresetMutation
>;
export const deleteTestPresetLocation = /* GraphQL */ `mutation DeleteTestPresetLocation(
  $condition: ModelTestPresetLocationConditionInput
  $input: DeleteTestPresetLocationInput!
) {
  deleteTestPresetLocation(condition: $condition, input: $input) {
    annotationSet {
      annotationCount
      createdAt
      id
      name
      projectId
      register
      updatedAt
      __typename
    }
    annotationSetId
    createdAt
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
    testPreset {
      createdAt
      id
      name
      organizationId
      updatedAt
      __typename
    }
    testPresetId
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteTestPresetLocationMutationVariables,
  APITypes.DeleteTestPresetLocationMutation
>;
export const deleteTestPresetProject = /* GraphQL */ `mutation DeleteTestPresetProject(
  $condition: ModelTestPresetProjectConditionInput
  $input: DeleteTestPresetProjectInput!
) {
  deleteTestPresetProject(condition: $condition, input: $input) {
    createdAt
    projectConfig {
      accuracy
      createdAt
      deadzone
      interval
      postTestConfirmation
      projectId
      random
      testType
      updatedAt
      __typename
    }
    projectId
    testPreset {
      createdAt
      id
      name
      organizationId
      updatedAt
      __typename
    }
    testPresetId
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteTestPresetProjectMutationVariables,
  APITypes.DeleteTestPresetProjectMutation
>;
export const deleteTestResult = /* GraphQL */ `mutation DeleteTestResult(
  $condition: ModelTestResultConditionInput
  $input: DeleteTestResultInput!
) {
  deleteTestResult(condition: $condition, input: $input) {
    annotationSet {
      annotationCount
      createdAt
      id
      name
      projectId
      register
      updatedAt
      __typename
    }
    annotationSetId
    categoryCounts {
      nextToken
      __typename
    }
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
    passedOnTotal
    project {
      createdAt
      createdBy
      hidden
      id
      name
      organizationId
      status
      updatedAt
      __typename
    }
    projectId
    testAnimals
    testPreset {
      createdAt
      id
      name
      organizationId
      updatedAt
      __typename
    }
    testPresetId
    totalMissedAnimals
    updatedAt
    userId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteTestResultMutationVariables,
  APITypes.DeleteTestResultMutation
>;
export const deleteTestResultCategoryCount = /* GraphQL */ `mutation DeleteTestResultCategoryCount(
  $condition: ModelTestResultCategoryCountConditionInput
  $input: DeleteTestResultCategoryCountInput!
) {
  deleteTestResultCategoryCount(condition: $condition, input: $input) {
    categoryName
    createdAt
    testCount
    testResult {
      annotationSetId
      createdAt
      id
      locationId
      passedOnTotal
      projectId
      testAnimals
      testPresetId
      totalMissedAnimals
      updatedAt
      userId
      __typename
    }
    testResultId
    updatedAt
    userCount
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteTestResultCategoryCountMutationVariables,
  APITypes.DeleteTestResultCategoryCountMutation
>;
export const deleteUserProjectMembership = /* GraphQL */ `mutation DeleteUserProjectMembership(
  $condition: ModelUserProjectMembershipConditionInput
  $input: DeleteUserProjectMembershipInput!
) {
  deleteUserProjectMembership(condition: $condition, input: $input) {
    backupQueue {
      approximateSize
      batchSize
      createdAt
      hidden
      id
      name
      projectId
      updatedAt
      url
      zoom
      __typename
    }
    backupQueueId
    createdAt
    id
    isAdmin
    project {
      createdAt
      createdBy
      hidden
      id
      name
      organizationId
      status
      updatedAt
      __typename
    }
    projectId
    queue {
      approximateSize
      batchSize
      createdAt
      hidden
      id
      name
      projectId
      updatedAt
      url
      zoom
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
      annotationSetId
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
      register
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
      register
      updatedAt
      __typename
    }
    annotationSetId
    category {
      annotationCount
      annotationSetId
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
    categories {
      nextToken
      __typename
    }
    createdAt
    id
    locationAnnotationCounts {
      nextToken
      __typename
    }
    name
    observations {
      nextToken
      __typename
    }
    project {
      createdAt
      createdBy
      hidden
      id
      name
      organizationId
      status
      updatedAt
      __typename
    }
    projectId
    register
    tasks {
      nextToken
      __typename
    }
    testPresetLocations {
      nextToken
      __typename
    }
    testResults {
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
    annotationSet {
      annotationCount
      createdAt
      id
      name
      projectId
      register
      updatedAt
      __typename
    }
    annotationSetId
    annotations {
      nextToken
      __typename
    }
    color
    createdAt
    id
    locationAnnotationCounts {
      nextToken
      __typename
    }
    name
    objects {
      nextToken
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
    annotationCounts {
      nextToken
      __typename
    }
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
    testPresets {
      nextToken
      __typename
    }
    testResults {
      nextToken
      __typename
    }
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
export const updateLocationAnnotationCount = /* GraphQL */ `mutation UpdateLocationAnnotationCount(
  $condition: ModelLocationAnnotationCountConditionInput
  $input: UpdateLocationAnnotationCountInput!
) {
  updateLocationAnnotationCount(condition: $condition, input: $input) {
    annotationSet {
      annotationCount
      createdAt
      id
      name
      projectId
      register
      updatedAt
      __typename
    }
    annotationSetId
    category {
      annotationCount
      annotationSetId
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
    count
    createdAt
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
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateLocationAnnotationCountMutationVariables,
  APITypes.UpdateLocationAnnotationCountMutation
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
      annotationSetId
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
      register
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
      createdBy
      hidden
      id
      name
      organizationId
      status
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
export const updateOrganization = /* GraphQL */ `mutation UpdateOrganization(
  $condition: ModelOrganizationConditionInput
  $input: UpdateOrganizationInput!
) {
  updateOrganization(condition: $condition, input: $input) {
    createdAt
    description
    id
    invites {
      nextToken
      __typename
    }
    memberships {
      nextToken
      __typename
    }
    name
    projects {
      nextToken
      __typename
    }
    testPresets {
      nextToken
      __typename
    }
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateOrganizationMutationVariables,
  APITypes.UpdateOrganizationMutation
>;
export const updateOrganizationInvite = /* GraphQL */ `mutation UpdateOrganizationInvite(
  $condition: ModelOrganizationInviteConditionInput
  $input: UpdateOrganizationInviteInput!
) {
  updateOrganizationInvite(condition: $condition, input: $input) {
    createdAt
    id
    invitedBy
    organization {
      createdAt
      description
      id
      name
      updatedAt
      __typename
    }
    organizationId
    status
    updatedAt
    username
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateOrganizationInviteMutationVariables,
  APITypes.UpdateOrganizationInviteMutation
>;
export const updateOrganizationMembership = /* GraphQL */ `mutation UpdateOrganizationMembership(
  $condition: ModelOrganizationMembershipConditionInput
  $input: UpdateOrganizationMembershipInput!
) {
  updateOrganizationMembership(condition: $condition, input: $input) {
    createdAt
    isAdmin
    isTested
    organization {
      createdAt
      description
      id
      name
      updatedAt
      __typename
    }
    organizationId
    updatedAt
    userId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateOrganizationMembershipMutationVariables,
  APITypes.UpdateOrganizationMembershipMutation
>;
export const updateOrganizationRegistration = /* GraphQL */ `mutation UpdateOrganizationRegistration(
  $condition: ModelOrganizationRegistrationConditionInput
  $input: UpdateOrganizationRegistrationInput!
) {
  updateOrganizationRegistration(condition: $condition, input: $input) {
    briefDescription
    createdAt
    id
    organizationName
    requestedBy
    status
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateOrganizationRegistrationMutationVariables,
  APITypes.UpdateOrganizationRegistrationMutation
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
    createdAt
    createdBy
    hidden
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
    organization {
      createdAt
      description
      id
      name
      updatedAt
      __typename
    }
    organizationId
    queues {
      nextToken
      __typename
    }
    status
    testConfig {
      accuracy
      createdAt
      deadzone
      interval
      postTestConfirmation
      projectId
      random
      testType
      updatedAt
      __typename
    }
    testResults {
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
export const updateProjectMemberships = /* GraphQL */ `mutation UpdateProjectMemberships($projectId: String!) {
  updateProjectMemberships(projectId: $projectId)
}
` as GeneratedMutation<
  APITypes.UpdateProjectMembershipsMutationVariables,
  APITypes.UpdateProjectMembershipsMutation
>;
export const updateProjectTestConfig = /* GraphQL */ `mutation UpdateProjectTestConfig(
  $condition: ModelProjectTestConfigConditionInput
  $input: UpdateProjectTestConfigInput!
) {
  updateProjectTestConfig(condition: $condition, input: $input) {
    accuracy
    createdAt
    deadzone
    interval
    postTestConfirmation
    project {
      createdAt
      createdBy
      hidden
      id
      name
      organizationId
      status
      updatedAt
      __typename
    }
    projectId
    random
    testPresetProjects {
      nextToken
      __typename
    }
    testType
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateProjectTestConfigMutationVariables,
  APITypes.UpdateProjectTestConfigMutation
>;
export const updateQueue = /* GraphQL */ `mutation UpdateQueue(
  $condition: ModelQueueConditionInput
  $input: UpdateQueueInput!
) {
  updateQueue(condition: $condition, input: $input) {
    approximateSize
    backupUsers {
      nextToken
      __typename
    }
    batchSize
    createdAt
    hidden
    id
    name
    project {
      createdAt
      createdBy
      hidden
      id
      name
      organizationId
      status
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
    zoom
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
      register
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
export const updateTestPreset = /* GraphQL */ `mutation UpdateTestPreset(
  $condition: ModelTestPresetConditionInput
  $input: UpdateTestPresetInput!
) {
  updateTestPreset(condition: $condition, input: $input) {
    createdAt
    id
    locations {
      nextToken
      __typename
    }
    name
    organization {
      createdAt
      description
      id
      name
      updatedAt
      __typename
    }
    organizationId
    projects {
      nextToken
      __typename
    }
    testResults {
      nextToken
      __typename
    }
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateTestPresetMutationVariables,
  APITypes.UpdateTestPresetMutation
>;
export const updateTestPresetLocation = /* GraphQL */ `mutation UpdateTestPresetLocation(
  $condition: ModelTestPresetLocationConditionInput
  $input: UpdateTestPresetLocationInput!
) {
  updateTestPresetLocation(condition: $condition, input: $input) {
    annotationSet {
      annotationCount
      createdAt
      id
      name
      projectId
      register
      updatedAt
      __typename
    }
    annotationSetId
    createdAt
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
    testPreset {
      createdAt
      id
      name
      organizationId
      updatedAt
      __typename
    }
    testPresetId
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateTestPresetLocationMutationVariables,
  APITypes.UpdateTestPresetLocationMutation
>;
export const updateTestPresetProject = /* GraphQL */ `mutation UpdateTestPresetProject(
  $condition: ModelTestPresetProjectConditionInput
  $input: UpdateTestPresetProjectInput!
) {
  updateTestPresetProject(condition: $condition, input: $input) {
    createdAt
    projectConfig {
      accuracy
      createdAt
      deadzone
      interval
      postTestConfirmation
      projectId
      random
      testType
      updatedAt
      __typename
    }
    projectId
    testPreset {
      createdAt
      id
      name
      organizationId
      updatedAt
      __typename
    }
    testPresetId
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateTestPresetProjectMutationVariables,
  APITypes.UpdateTestPresetProjectMutation
>;
export const updateTestResult = /* GraphQL */ `mutation UpdateTestResult(
  $condition: ModelTestResultConditionInput
  $input: UpdateTestResultInput!
) {
  updateTestResult(condition: $condition, input: $input) {
    annotationSet {
      annotationCount
      createdAt
      id
      name
      projectId
      register
      updatedAt
      __typename
    }
    annotationSetId
    categoryCounts {
      nextToken
      __typename
    }
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
    passedOnTotal
    project {
      createdAt
      createdBy
      hidden
      id
      name
      organizationId
      status
      updatedAt
      __typename
    }
    projectId
    testAnimals
    testPreset {
      createdAt
      id
      name
      organizationId
      updatedAt
      __typename
    }
    testPresetId
    totalMissedAnimals
    updatedAt
    userId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateTestResultMutationVariables,
  APITypes.UpdateTestResultMutation
>;
export const updateTestResultCategoryCount = /* GraphQL */ `mutation UpdateTestResultCategoryCount(
  $condition: ModelTestResultCategoryCountConditionInput
  $input: UpdateTestResultCategoryCountInput!
) {
  updateTestResultCategoryCount(condition: $condition, input: $input) {
    categoryName
    createdAt
    testCount
    testResult {
      annotationSetId
      createdAt
      id
      locationId
      passedOnTotal
      projectId
      testAnimals
      testPresetId
      totalMissedAnimals
      updatedAt
      userId
      __typename
    }
    testResultId
    updatedAt
    userCount
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateTestResultCategoryCountMutationVariables,
  APITypes.UpdateTestResultCategoryCountMutation
>;
export const updateUserProjectMembership = /* GraphQL */ `mutation UpdateUserProjectMembership(
  $condition: ModelUserProjectMembershipConditionInput
  $input: UpdateUserProjectMembershipInput!
) {
  updateUserProjectMembership(condition: $condition, input: $input) {
    backupQueue {
      approximateSize
      batchSize
      createdAt
      hidden
      id
      name
      projectId
      updatedAt
      url
      zoom
      __typename
    }
    backupQueueId
    createdAt
    id
    isAdmin
    project {
      createdAt
      createdBy
      hidden
      id
      name
      organizationId
      status
      updatedAt
      __typename
    }
    projectId
    queue {
      approximateSize
      batchSize
      createdAt
      hidden
      id
      name
      projectId
      updatedAt
      url
      zoom
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
