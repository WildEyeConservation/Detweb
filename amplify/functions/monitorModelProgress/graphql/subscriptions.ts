/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "./API";
type GeneratedSubscription<InputType, OutputType> = string & {
  __generatedSubscriptionInput: InputType;
  __generatedSubscriptionOutput: OutputType;
};

export const onCreateAnnotation = /* GraphQL */ `subscription OnCreateAnnotation(
  $filter: ModelSubscriptionAnnotationFilterInput
  $owner: String
) {
  onCreateAnnotation(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateAnnotationSubscriptionVariables,
  APITypes.OnCreateAnnotationSubscription
>;
export const onCreateAnnotationCountPerCategoryPerSet = /* GraphQL */ `subscription OnCreateAnnotationCountPerCategoryPerSet(
  $filter: ModelSubscriptionAnnotationCountPerCategoryPerSetFilterInput
) {
  onCreateAnnotationCountPerCategoryPerSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateAnnotationCountPerCategoryPerSetSubscriptionVariables,
  APITypes.OnCreateAnnotationCountPerCategoryPerSetSubscription
>;
export const onCreateAnnotationSet = /* GraphQL */ `subscription OnCreateAnnotationSet(
  $filter: ModelSubscriptionAnnotationSetFilterInput
) {
  onCreateAnnotationSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateAnnotationSetSubscriptionVariables,
  APITypes.OnCreateAnnotationSetSubscription
>;
export const onCreateCategory = /* GraphQL */ `subscription OnCreateCategory($filter: ModelSubscriptionCategoryFilterInput) {
  onCreateCategory(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateCategorySubscriptionVariables,
  APITypes.OnCreateCategorySubscription
>;
export const onCreateImage = /* GraphQL */ `subscription OnCreateImage($filter: ModelSubscriptionImageFilterInput) {
  onCreateImage(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateImageSubscriptionVariables,
  APITypes.OnCreateImageSubscription
>;
export const onCreateImageFile = /* GraphQL */ `subscription OnCreateImageFile($filter: ModelSubscriptionImageFileFilterInput) {
  onCreateImageFile(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateImageFileSubscriptionVariables,
  APITypes.OnCreateImageFileSubscription
>;
export const onCreateImageNeighbour = /* GraphQL */ `subscription OnCreateImageNeighbour(
  $filter: ModelSubscriptionImageNeighbourFilterInput
) {
  onCreateImageNeighbour(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateImageNeighbourSubscriptionVariables,
  APITypes.OnCreateImageNeighbourSubscription
>;
export const onCreateImageSet = /* GraphQL */ `subscription OnCreateImageSet($filter: ModelSubscriptionImageSetFilterInput) {
  onCreateImageSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateImageSetSubscriptionVariables,
  APITypes.OnCreateImageSetSubscription
>;
export const onCreateImageSetMembership = /* GraphQL */ `subscription OnCreateImageSetMembership(
  $filter: ModelSubscriptionImageSetMembershipFilterInput
) {
  onCreateImageSetMembership(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateImageSetMembershipSubscriptionVariables,
  APITypes.OnCreateImageSetMembershipSubscription
>;
export const onCreateLocation = /* GraphQL */ `subscription OnCreateLocation($filter: ModelSubscriptionLocationFilterInput) {
  onCreateLocation(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateLocationSubscriptionVariables,
  APITypes.OnCreateLocationSubscription
>;
export const onCreateLocationAnnotationCount = /* GraphQL */ `subscription OnCreateLocationAnnotationCount(
  $filter: ModelSubscriptionLocationAnnotationCountFilterInput
) {
  onCreateLocationAnnotationCount(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateLocationAnnotationCountSubscriptionVariables,
  APITypes.OnCreateLocationAnnotationCountSubscription
>;
export const onCreateLocationSet = /* GraphQL */ `subscription OnCreateLocationSet(
  $filter: ModelSubscriptionLocationSetFilterInput
) {
  onCreateLocationSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateLocationSetSubscriptionVariables,
  APITypes.OnCreateLocationSetSubscription
>;
export const onCreateLocationSetMembership = /* GraphQL */ `subscription OnCreateLocationSetMembership(
  $filter: ModelSubscriptionLocationSetMembershipFilterInput
) {
  onCreateLocationSetMembership(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateLocationSetMembershipSubscriptionVariables,
  APITypes.OnCreateLocationSetMembershipSubscription
>;
export const onCreateObject = /* GraphQL */ `subscription OnCreateObject($filter: ModelSubscriptionObjectFilterInput) {
  onCreateObject(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateObjectSubscriptionVariables,
  APITypes.OnCreateObjectSubscription
>;
export const onCreateObservation = /* GraphQL */ `subscription OnCreateObservation(
  $filter: ModelSubscriptionObservationFilterInput
  $owner: String
) {
  onCreateObservation(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateObservationSubscriptionVariables,
  APITypes.OnCreateObservationSubscription
>;
export const onCreateOrganization = /* GraphQL */ `subscription OnCreateOrganization(
  $filter: ModelSubscriptionOrganizationFilterInput
) {
  onCreateOrganization(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateOrganizationSubscriptionVariables,
  APITypes.OnCreateOrganizationSubscription
>;
export const onCreateOrganizationInvite = /* GraphQL */ `subscription OnCreateOrganizationInvite(
  $filter: ModelSubscriptionOrganizationInviteFilterInput
) {
  onCreateOrganizationInvite(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateOrganizationInviteSubscriptionVariables,
  APITypes.OnCreateOrganizationInviteSubscription
>;
export const onCreateOrganizationMembership = /* GraphQL */ `subscription OnCreateOrganizationMembership(
  $filter: ModelSubscriptionOrganizationMembershipFilterInput
) {
  onCreateOrganizationMembership(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateOrganizationMembershipSubscriptionVariables,
  APITypes.OnCreateOrganizationMembershipSubscription
>;
export const onCreateOrganizationRegistration = /* GraphQL */ `subscription OnCreateOrganizationRegistration(
  $filter: ModelSubscriptionOrganizationRegistrationFilterInput
) {
  onCreateOrganizationRegistration(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateOrganizationRegistrationSubscriptionVariables,
  APITypes.OnCreateOrganizationRegistrationSubscription
>;
export const onCreateProject = /* GraphQL */ `subscription OnCreateProject($filter: ModelSubscriptionProjectFilterInput) {
  onCreateProject(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateProjectSubscriptionVariables,
  APITypes.OnCreateProjectSubscription
>;
export const onCreateProjectTestConfig = /* GraphQL */ `subscription OnCreateProjectTestConfig(
  $filter: ModelSubscriptionProjectTestConfigFilterInput
) {
  onCreateProjectTestConfig(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateProjectTestConfigSubscriptionVariables,
  APITypes.OnCreateProjectTestConfigSubscription
>;
export const onCreateQueue = /* GraphQL */ `subscription OnCreateQueue($filter: ModelSubscriptionQueueFilterInput) {
  onCreateQueue(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateQueueSubscriptionVariables,
  APITypes.OnCreateQueueSubscription
>;
export const onCreateTasksOnAnnotationSet = /* GraphQL */ `subscription OnCreateTasksOnAnnotationSet(
  $filter: ModelSubscriptionTasksOnAnnotationSetFilterInput
) {
  onCreateTasksOnAnnotationSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateTasksOnAnnotationSetSubscriptionVariables,
  APITypes.OnCreateTasksOnAnnotationSetSubscription
>;
export const onCreateTestPreset = /* GraphQL */ `subscription OnCreateTestPreset(
  $filter: ModelSubscriptionTestPresetFilterInput
) {
  onCreateTestPreset(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateTestPresetSubscriptionVariables,
  APITypes.OnCreateTestPresetSubscription
>;
export const onCreateTestPresetLocation = /* GraphQL */ `subscription OnCreateTestPresetLocation(
  $filter: ModelSubscriptionTestPresetLocationFilterInput
) {
  onCreateTestPresetLocation(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateTestPresetLocationSubscriptionVariables,
  APITypes.OnCreateTestPresetLocationSubscription
>;
export const onCreateTestPresetProject = /* GraphQL */ `subscription OnCreateTestPresetProject(
  $filter: ModelSubscriptionTestPresetProjectFilterInput
) {
  onCreateTestPresetProject(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateTestPresetProjectSubscriptionVariables,
  APITypes.OnCreateTestPresetProjectSubscription
>;
export const onCreateTestResult = /* GraphQL */ `subscription OnCreateTestResult(
  $filter: ModelSubscriptionTestResultFilterInput
) {
  onCreateTestResult(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateTestResultSubscriptionVariables,
  APITypes.OnCreateTestResultSubscription
>;
export const onCreateTestResultCategoryCount = /* GraphQL */ `subscription OnCreateTestResultCategoryCount(
  $filter: ModelSubscriptionTestResultCategoryCountFilterInput
) {
  onCreateTestResultCategoryCount(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateTestResultCategoryCountSubscriptionVariables,
  APITypes.OnCreateTestResultCategoryCountSubscription
>;
export const onCreateUserProjectMembership = /* GraphQL */ `subscription OnCreateUserProjectMembership(
  $filter: ModelSubscriptionUserProjectMembershipFilterInput
) {
  onCreateUserProjectMembership(filter: $filter) {
    backupQueue {
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
` as GeneratedSubscription<
  APITypes.OnCreateUserProjectMembershipSubscriptionVariables,
  APITypes.OnCreateUserProjectMembershipSubscription
>;
export const onCreateUserStats = /* GraphQL */ `subscription OnCreateUserStats($filter: ModelSubscriptionUserStatsFilterInput) {
  onCreateUserStats(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateUserStatsSubscriptionVariables,
  APITypes.OnCreateUserStatsSubscription
>;
export const onDeleteAnnotation = /* GraphQL */ `subscription OnDeleteAnnotation(
  $filter: ModelSubscriptionAnnotationFilterInput
  $owner: String
) {
  onDeleteAnnotation(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteAnnotationSubscriptionVariables,
  APITypes.OnDeleteAnnotationSubscription
>;
export const onDeleteAnnotationCountPerCategoryPerSet = /* GraphQL */ `subscription OnDeleteAnnotationCountPerCategoryPerSet(
  $filter: ModelSubscriptionAnnotationCountPerCategoryPerSetFilterInput
) {
  onDeleteAnnotationCountPerCategoryPerSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteAnnotationCountPerCategoryPerSetSubscriptionVariables,
  APITypes.OnDeleteAnnotationCountPerCategoryPerSetSubscription
>;
export const onDeleteAnnotationSet = /* GraphQL */ `subscription OnDeleteAnnotationSet(
  $filter: ModelSubscriptionAnnotationSetFilterInput
) {
  onDeleteAnnotationSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteAnnotationSetSubscriptionVariables,
  APITypes.OnDeleteAnnotationSetSubscription
>;
export const onDeleteCategory = /* GraphQL */ `subscription OnDeleteCategory($filter: ModelSubscriptionCategoryFilterInput) {
  onDeleteCategory(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteCategorySubscriptionVariables,
  APITypes.OnDeleteCategorySubscription
>;
export const onDeleteImage = /* GraphQL */ `subscription OnDeleteImage($filter: ModelSubscriptionImageFilterInput) {
  onDeleteImage(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteImageSubscriptionVariables,
  APITypes.OnDeleteImageSubscription
>;
export const onDeleteImageFile = /* GraphQL */ `subscription OnDeleteImageFile($filter: ModelSubscriptionImageFileFilterInput) {
  onDeleteImageFile(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteImageFileSubscriptionVariables,
  APITypes.OnDeleteImageFileSubscription
>;
export const onDeleteImageNeighbour = /* GraphQL */ `subscription OnDeleteImageNeighbour(
  $filter: ModelSubscriptionImageNeighbourFilterInput
) {
  onDeleteImageNeighbour(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteImageNeighbourSubscriptionVariables,
  APITypes.OnDeleteImageNeighbourSubscription
>;
export const onDeleteImageSet = /* GraphQL */ `subscription OnDeleteImageSet($filter: ModelSubscriptionImageSetFilterInput) {
  onDeleteImageSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteImageSetSubscriptionVariables,
  APITypes.OnDeleteImageSetSubscription
>;
export const onDeleteImageSetMembership = /* GraphQL */ `subscription OnDeleteImageSetMembership(
  $filter: ModelSubscriptionImageSetMembershipFilterInput
) {
  onDeleteImageSetMembership(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteImageSetMembershipSubscriptionVariables,
  APITypes.OnDeleteImageSetMembershipSubscription
>;
export const onDeleteLocation = /* GraphQL */ `subscription OnDeleteLocation($filter: ModelSubscriptionLocationFilterInput) {
  onDeleteLocation(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteLocationSubscriptionVariables,
  APITypes.OnDeleteLocationSubscription
>;
export const onDeleteLocationAnnotationCount = /* GraphQL */ `subscription OnDeleteLocationAnnotationCount(
  $filter: ModelSubscriptionLocationAnnotationCountFilterInput
) {
  onDeleteLocationAnnotationCount(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteLocationAnnotationCountSubscriptionVariables,
  APITypes.OnDeleteLocationAnnotationCountSubscription
>;
export const onDeleteLocationSet = /* GraphQL */ `subscription OnDeleteLocationSet(
  $filter: ModelSubscriptionLocationSetFilterInput
) {
  onDeleteLocationSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteLocationSetSubscriptionVariables,
  APITypes.OnDeleteLocationSetSubscription
>;
export const onDeleteLocationSetMembership = /* GraphQL */ `subscription OnDeleteLocationSetMembership(
  $filter: ModelSubscriptionLocationSetMembershipFilterInput
) {
  onDeleteLocationSetMembership(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteLocationSetMembershipSubscriptionVariables,
  APITypes.OnDeleteLocationSetMembershipSubscription
>;
export const onDeleteObject = /* GraphQL */ `subscription OnDeleteObject($filter: ModelSubscriptionObjectFilterInput) {
  onDeleteObject(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteObjectSubscriptionVariables,
  APITypes.OnDeleteObjectSubscription
>;
export const onDeleteObservation = /* GraphQL */ `subscription OnDeleteObservation(
  $filter: ModelSubscriptionObservationFilterInput
  $owner: String
) {
  onDeleteObservation(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteObservationSubscriptionVariables,
  APITypes.OnDeleteObservationSubscription
>;
export const onDeleteOrganization = /* GraphQL */ `subscription OnDeleteOrganization(
  $filter: ModelSubscriptionOrganizationFilterInput
) {
  onDeleteOrganization(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteOrganizationSubscriptionVariables,
  APITypes.OnDeleteOrganizationSubscription
>;
export const onDeleteOrganizationInvite = /* GraphQL */ `subscription OnDeleteOrganizationInvite(
  $filter: ModelSubscriptionOrganizationInviteFilterInput
) {
  onDeleteOrganizationInvite(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteOrganizationInviteSubscriptionVariables,
  APITypes.OnDeleteOrganizationInviteSubscription
>;
export const onDeleteOrganizationMembership = /* GraphQL */ `subscription OnDeleteOrganizationMembership(
  $filter: ModelSubscriptionOrganizationMembershipFilterInput
) {
  onDeleteOrganizationMembership(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteOrganizationMembershipSubscriptionVariables,
  APITypes.OnDeleteOrganizationMembershipSubscription
>;
export const onDeleteOrganizationRegistration = /* GraphQL */ `subscription OnDeleteOrganizationRegistration(
  $filter: ModelSubscriptionOrganizationRegistrationFilterInput
) {
  onDeleteOrganizationRegistration(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteOrganizationRegistrationSubscriptionVariables,
  APITypes.OnDeleteOrganizationRegistrationSubscription
>;
export const onDeleteProject = /* GraphQL */ `subscription OnDeleteProject($filter: ModelSubscriptionProjectFilterInput) {
  onDeleteProject(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteProjectSubscriptionVariables,
  APITypes.OnDeleteProjectSubscription
>;
export const onDeleteProjectTestConfig = /* GraphQL */ `subscription OnDeleteProjectTestConfig(
  $filter: ModelSubscriptionProjectTestConfigFilterInput
) {
  onDeleteProjectTestConfig(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteProjectTestConfigSubscriptionVariables,
  APITypes.OnDeleteProjectTestConfigSubscription
>;
export const onDeleteQueue = /* GraphQL */ `subscription OnDeleteQueue($filter: ModelSubscriptionQueueFilterInput) {
  onDeleteQueue(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteQueueSubscriptionVariables,
  APITypes.OnDeleteQueueSubscription
>;
export const onDeleteTasksOnAnnotationSet = /* GraphQL */ `subscription OnDeleteTasksOnAnnotationSet(
  $filter: ModelSubscriptionTasksOnAnnotationSetFilterInput
) {
  onDeleteTasksOnAnnotationSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteTasksOnAnnotationSetSubscriptionVariables,
  APITypes.OnDeleteTasksOnAnnotationSetSubscription
>;
export const onDeleteTestPreset = /* GraphQL */ `subscription OnDeleteTestPreset(
  $filter: ModelSubscriptionTestPresetFilterInput
) {
  onDeleteTestPreset(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteTestPresetSubscriptionVariables,
  APITypes.OnDeleteTestPresetSubscription
>;
export const onDeleteTestPresetLocation = /* GraphQL */ `subscription OnDeleteTestPresetLocation(
  $filter: ModelSubscriptionTestPresetLocationFilterInput
) {
  onDeleteTestPresetLocation(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteTestPresetLocationSubscriptionVariables,
  APITypes.OnDeleteTestPresetLocationSubscription
>;
export const onDeleteTestPresetProject = /* GraphQL */ `subscription OnDeleteTestPresetProject(
  $filter: ModelSubscriptionTestPresetProjectFilterInput
) {
  onDeleteTestPresetProject(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteTestPresetProjectSubscriptionVariables,
  APITypes.OnDeleteTestPresetProjectSubscription
>;
export const onDeleteTestResult = /* GraphQL */ `subscription OnDeleteTestResult(
  $filter: ModelSubscriptionTestResultFilterInput
) {
  onDeleteTestResult(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteTestResultSubscriptionVariables,
  APITypes.OnDeleteTestResultSubscription
>;
export const onDeleteTestResultCategoryCount = /* GraphQL */ `subscription OnDeleteTestResultCategoryCount(
  $filter: ModelSubscriptionTestResultCategoryCountFilterInput
) {
  onDeleteTestResultCategoryCount(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteTestResultCategoryCountSubscriptionVariables,
  APITypes.OnDeleteTestResultCategoryCountSubscription
>;
export const onDeleteUserProjectMembership = /* GraphQL */ `subscription OnDeleteUserProjectMembership(
  $filter: ModelSubscriptionUserProjectMembershipFilterInput
) {
  onDeleteUserProjectMembership(filter: $filter) {
    backupQueue {
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
` as GeneratedSubscription<
  APITypes.OnDeleteUserProjectMembershipSubscriptionVariables,
  APITypes.OnDeleteUserProjectMembershipSubscription
>;
export const onDeleteUserStats = /* GraphQL */ `subscription OnDeleteUserStats($filter: ModelSubscriptionUserStatsFilterInput) {
  onDeleteUserStats(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteUserStatsSubscriptionVariables,
  APITypes.OnDeleteUserStatsSubscription
>;
export const onUpdateAnnotation = /* GraphQL */ `subscription OnUpdateAnnotation(
  $filter: ModelSubscriptionAnnotationFilterInput
  $owner: String
) {
  onUpdateAnnotation(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateAnnotationSubscriptionVariables,
  APITypes.OnUpdateAnnotationSubscription
>;
export const onUpdateAnnotationCountPerCategoryPerSet = /* GraphQL */ `subscription OnUpdateAnnotationCountPerCategoryPerSet(
  $filter: ModelSubscriptionAnnotationCountPerCategoryPerSetFilterInput
) {
  onUpdateAnnotationCountPerCategoryPerSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateAnnotationCountPerCategoryPerSetSubscriptionVariables,
  APITypes.OnUpdateAnnotationCountPerCategoryPerSetSubscription
>;
export const onUpdateAnnotationSet = /* GraphQL */ `subscription OnUpdateAnnotationSet(
  $filter: ModelSubscriptionAnnotationSetFilterInput
) {
  onUpdateAnnotationSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateAnnotationSetSubscriptionVariables,
  APITypes.OnUpdateAnnotationSetSubscription
>;
export const onUpdateCategory = /* GraphQL */ `subscription OnUpdateCategory($filter: ModelSubscriptionCategoryFilterInput) {
  onUpdateCategory(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateCategorySubscriptionVariables,
  APITypes.OnUpdateCategorySubscription
>;
export const onUpdateImage = /* GraphQL */ `subscription OnUpdateImage($filter: ModelSubscriptionImageFilterInput) {
  onUpdateImage(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateImageSubscriptionVariables,
  APITypes.OnUpdateImageSubscription
>;
export const onUpdateImageFile = /* GraphQL */ `subscription OnUpdateImageFile($filter: ModelSubscriptionImageFileFilterInput) {
  onUpdateImageFile(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateImageFileSubscriptionVariables,
  APITypes.OnUpdateImageFileSubscription
>;
export const onUpdateImageNeighbour = /* GraphQL */ `subscription OnUpdateImageNeighbour(
  $filter: ModelSubscriptionImageNeighbourFilterInput
) {
  onUpdateImageNeighbour(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateImageNeighbourSubscriptionVariables,
  APITypes.OnUpdateImageNeighbourSubscription
>;
export const onUpdateImageSet = /* GraphQL */ `subscription OnUpdateImageSet($filter: ModelSubscriptionImageSetFilterInput) {
  onUpdateImageSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateImageSetSubscriptionVariables,
  APITypes.OnUpdateImageSetSubscription
>;
export const onUpdateImageSetMembership = /* GraphQL */ `subscription OnUpdateImageSetMembership(
  $filter: ModelSubscriptionImageSetMembershipFilterInput
) {
  onUpdateImageSetMembership(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateImageSetMembershipSubscriptionVariables,
  APITypes.OnUpdateImageSetMembershipSubscription
>;
export const onUpdateLocation = /* GraphQL */ `subscription OnUpdateLocation($filter: ModelSubscriptionLocationFilterInput) {
  onUpdateLocation(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateLocationSubscriptionVariables,
  APITypes.OnUpdateLocationSubscription
>;
export const onUpdateLocationAnnotationCount = /* GraphQL */ `subscription OnUpdateLocationAnnotationCount(
  $filter: ModelSubscriptionLocationAnnotationCountFilterInput
) {
  onUpdateLocationAnnotationCount(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateLocationAnnotationCountSubscriptionVariables,
  APITypes.OnUpdateLocationAnnotationCountSubscription
>;
export const onUpdateLocationSet = /* GraphQL */ `subscription OnUpdateLocationSet(
  $filter: ModelSubscriptionLocationSetFilterInput
) {
  onUpdateLocationSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateLocationSetSubscriptionVariables,
  APITypes.OnUpdateLocationSetSubscription
>;
export const onUpdateLocationSetMembership = /* GraphQL */ `subscription OnUpdateLocationSetMembership(
  $filter: ModelSubscriptionLocationSetMembershipFilterInput
) {
  onUpdateLocationSetMembership(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateLocationSetMembershipSubscriptionVariables,
  APITypes.OnUpdateLocationSetMembershipSubscription
>;
export const onUpdateObject = /* GraphQL */ `subscription OnUpdateObject($filter: ModelSubscriptionObjectFilterInput) {
  onUpdateObject(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateObjectSubscriptionVariables,
  APITypes.OnUpdateObjectSubscription
>;
export const onUpdateObservation = /* GraphQL */ `subscription OnUpdateObservation(
  $filter: ModelSubscriptionObservationFilterInput
  $owner: String
) {
  onUpdateObservation(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateObservationSubscriptionVariables,
  APITypes.OnUpdateObservationSubscription
>;
export const onUpdateOrganization = /* GraphQL */ `subscription OnUpdateOrganization(
  $filter: ModelSubscriptionOrganizationFilterInput
) {
  onUpdateOrganization(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateOrganizationSubscriptionVariables,
  APITypes.OnUpdateOrganizationSubscription
>;
export const onUpdateOrganizationInvite = /* GraphQL */ `subscription OnUpdateOrganizationInvite(
  $filter: ModelSubscriptionOrganizationInviteFilterInput
) {
  onUpdateOrganizationInvite(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateOrganizationInviteSubscriptionVariables,
  APITypes.OnUpdateOrganizationInviteSubscription
>;
export const onUpdateOrganizationMembership = /* GraphQL */ `subscription OnUpdateOrganizationMembership(
  $filter: ModelSubscriptionOrganizationMembershipFilterInput
) {
  onUpdateOrganizationMembership(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateOrganizationMembershipSubscriptionVariables,
  APITypes.OnUpdateOrganizationMembershipSubscription
>;
export const onUpdateOrganizationRegistration = /* GraphQL */ `subscription OnUpdateOrganizationRegistration(
  $filter: ModelSubscriptionOrganizationRegistrationFilterInput
) {
  onUpdateOrganizationRegistration(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateOrganizationRegistrationSubscriptionVariables,
  APITypes.OnUpdateOrganizationRegistrationSubscription
>;
export const onUpdateProject = /* GraphQL */ `subscription OnUpdateProject($filter: ModelSubscriptionProjectFilterInput) {
  onUpdateProject(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateProjectSubscriptionVariables,
  APITypes.OnUpdateProjectSubscription
>;
export const onUpdateProjectTestConfig = /* GraphQL */ `subscription OnUpdateProjectTestConfig(
  $filter: ModelSubscriptionProjectTestConfigFilterInput
) {
  onUpdateProjectTestConfig(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateProjectTestConfigSubscriptionVariables,
  APITypes.OnUpdateProjectTestConfigSubscription
>;
export const onUpdateQueue = /* GraphQL */ `subscription OnUpdateQueue($filter: ModelSubscriptionQueueFilterInput) {
  onUpdateQueue(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateQueueSubscriptionVariables,
  APITypes.OnUpdateQueueSubscription
>;
export const onUpdateTasksOnAnnotationSet = /* GraphQL */ `subscription OnUpdateTasksOnAnnotationSet(
  $filter: ModelSubscriptionTasksOnAnnotationSetFilterInput
) {
  onUpdateTasksOnAnnotationSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateTasksOnAnnotationSetSubscriptionVariables,
  APITypes.OnUpdateTasksOnAnnotationSetSubscription
>;
export const onUpdateTestPreset = /* GraphQL */ `subscription OnUpdateTestPreset(
  $filter: ModelSubscriptionTestPresetFilterInput
) {
  onUpdateTestPreset(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateTestPresetSubscriptionVariables,
  APITypes.OnUpdateTestPresetSubscription
>;
export const onUpdateTestPresetLocation = /* GraphQL */ `subscription OnUpdateTestPresetLocation(
  $filter: ModelSubscriptionTestPresetLocationFilterInput
) {
  onUpdateTestPresetLocation(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateTestPresetLocationSubscriptionVariables,
  APITypes.OnUpdateTestPresetLocationSubscription
>;
export const onUpdateTestPresetProject = /* GraphQL */ `subscription OnUpdateTestPresetProject(
  $filter: ModelSubscriptionTestPresetProjectFilterInput
) {
  onUpdateTestPresetProject(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateTestPresetProjectSubscriptionVariables,
  APITypes.OnUpdateTestPresetProjectSubscription
>;
export const onUpdateTestResult = /* GraphQL */ `subscription OnUpdateTestResult(
  $filter: ModelSubscriptionTestResultFilterInput
) {
  onUpdateTestResult(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateTestResultSubscriptionVariables,
  APITypes.OnUpdateTestResultSubscription
>;
export const onUpdateTestResultCategoryCount = /* GraphQL */ `subscription OnUpdateTestResultCategoryCount(
  $filter: ModelSubscriptionTestResultCategoryCountFilterInput
) {
  onUpdateTestResultCategoryCount(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateTestResultCategoryCountSubscriptionVariables,
  APITypes.OnUpdateTestResultCategoryCountSubscription
>;
export const onUpdateUserProjectMembership = /* GraphQL */ `subscription OnUpdateUserProjectMembership(
  $filter: ModelSubscriptionUserProjectMembershipFilterInput
) {
  onUpdateUserProjectMembership(filter: $filter) {
    backupQueue {
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
` as GeneratedSubscription<
  APITypes.OnUpdateUserProjectMembershipSubscriptionVariables,
  APITypes.OnUpdateUserProjectMembershipSubscription
>;
export const onUpdateUserStats = /* GraphQL */ `subscription OnUpdateUserStats($filter: ModelSubscriptionUserStatsFilterInput) {
  onUpdateUserStats(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateUserStatsSubscriptionVariables,
  APITypes.OnUpdateUserStatsSubscription
>;
export const receive = /* GraphQL */ `subscription Receive {
  receive {
    channelName
    content
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.ReceiveSubscriptionVariables,
  APITypes.ReceiveSubscription
>;
