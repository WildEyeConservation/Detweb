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
` as GeneratedSubscription<
  APITypes.OnCreateAnnotationSubscriptionVariables,
  APITypes.OnCreateAnnotationSubscription
>;
export const onCreateAnnotationSet = /* GraphQL */ `subscription OnCreateAnnotationSet(
  $filter: ModelSubscriptionAnnotationSetFilterInput
) {
  onCreateAnnotationSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateAnnotationSetSubscriptionVariables,
  APITypes.OnCreateAnnotationSetSubscription
>;
export const onCreateCategory = /* GraphQL */ `subscription OnCreateCategory($filter: ModelSubscriptionCategoryFilterInput) {
  onCreateCategory(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateLocationSubscriptionVariables,
  APITypes.OnCreateLocationSubscription
>;
export const onCreateLocationSet = /* GraphQL */ `subscription OnCreateLocationSet(
  $filter: ModelSubscriptionLocationSetFilterInput
) {
  onCreateLocationSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateObjectSubscriptionVariables,
  APITypes.OnCreateObjectSubscription
>;
export const onCreateObservation = /* GraphQL */ `subscription OnCreateObservation(
  $filter: ModelSubscriptionObservationFilterInput
  $owner: String
) {
  onCreateObservation(filter: $filter, owner: $owner) {
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
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnCreateObservationSubscriptionVariables,
  APITypes.OnCreateObservationSubscription
>;
export const onCreateProject = /* GraphQL */ `subscription OnCreateProject($filter: ModelSubscriptionProjectFilterInput) {
  onCreateProject(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateProjectSubscriptionVariables,
  APITypes.OnCreateProjectSubscription
>;
export const onCreateQueue = /* GraphQL */ `subscription OnCreateQueue($filter: ModelSubscriptionQueueFilterInput) {
  onCreateQueue(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateQueueSubscriptionVariables,
  APITypes.OnCreateQueueSubscription
>;
export const onCreateUserObservationStats = /* GraphQL */ `subscription OnCreateUserObservationStats(
  $filter: ModelSubscriptionUserObservationStatsFilterInput
) {
  onCreateUserObservationStats(filter: $filter) {
    activeTime
    count
    createdAt
    lastUpdated
    projectId
    updatedAt
    userId
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnCreateUserObservationStatsSubscriptionVariables,
  APITypes.OnCreateUserObservationStatsSubscription
>;
export const onCreateUserProjectMembership = /* GraphQL */ `subscription OnCreateUserProjectMembership(
  $filter: ModelSubscriptionUserProjectMembershipFilterInput
) {
  onCreateUserProjectMembership(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateUserProjectMembershipSubscriptionVariables,
  APITypes.OnCreateUserProjectMembershipSubscription
>;
export const onCreateUserStats = /* GraphQL */ `subscription OnCreateUserStats($filter: ModelSubscriptionUserStatsFilterInput) {
  onCreateUserStats(filter: $filter) {
    activeTime
    annotationCount
    createdAt
    date
    observationCount
    projectId
    setId
    updatedAt
    userId
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
` as GeneratedSubscription<
  APITypes.OnDeleteAnnotationSubscriptionVariables,
  APITypes.OnDeleteAnnotationSubscription
>;
export const onDeleteAnnotationSet = /* GraphQL */ `subscription OnDeleteAnnotationSet(
  $filter: ModelSubscriptionAnnotationSetFilterInput
) {
  onDeleteAnnotationSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteAnnotationSetSubscriptionVariables,
  APITypes.OnDeleteAnnotationSetSubscription
>;
export const onDeleteCategory = /* GraphQL */ `subscription OnDeleteCategory($filter: ModelSubscriptionCategoryFilterInput) {
  onDeleteCategory(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteLocationSubscriptionVariables,
  APITypes.OnDeleteLocationSubscription
>;
export const onDeleteLocationSet = /* GraphQL */ `subscription OnDeleteLocationSet(
  $filter: ModelSubscriptionLocationSetFilterInput
) {
  onDeleteLocationSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteObjectSubscriptionVariables,
  APITypes.OnDeleteObjectSubscription
>;
export const onDeleteObservation = /* GraphQL */ `subscription OnDeleteObservation(
  $filter: ModelSubscriptionObservationFilterInput
  $owner: String
) {
  onDeleteObservation(filter: $filter, owner: $owner) {
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
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnDeleteObservationSubscriptionVariables,
  APITypes.OnDeleteObservationSubscription
>;
export const onDeleteProject = /* GraphQL */ `subscription OnDeleteProject($filter: ModelSubscriptionProjectFilterInput) {
  onDeleteProject(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteProjectSubscriptionVariables,
  APITypes.OnDeleteProjectSubscription
>;
export const onDeleteQueue = /* GraphQL */ `subscription OnDeleteQueue($filter: ModelSubscriptionQueueFilterInput) {
  onDeleteQueue(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteQueueSubscriptionVariables,
  APITypes.OnDeleteQueueSubscription
>;
export const onDeleteUserObservationStats = /* GraphQL */ `subscription OnDeleteUserObservationStats(
  $filter: ModelSubscriptionUserObservationStatsFilterInput
) {
  onDeleteUserObservationStats(filter: $filter) {
    activeTime
    count
    createdAt
    lastUpdated
    projectId
    updatedAt
    userId
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnDeleteUserObservationStatsSubscriptionVariables,
  APITypes.OnDeleteUserObservationStatsSubscription
>;
export const onDeleteUserProjectMembership = /* GraphQL */ `subscription OnDeleteUserProjectMembership(
  $filter: ModelSubscriptionUserProjectMembershipFilterInput
) {
  onDeleteUserProjectMembership(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteUserProjectMembershipSubscriptionVariables,
  APITypes.OnDeleteUserProjectMembershipSubscription
>;
export const onDeleteUserStats = /* GraphQL */ `subscription OnDeleteUserStats($filter: ModelSubscriptionUserStatsFilterInput) {
  onDeleteUserStats(filter: $filter) {
    activeTime
    annotationCount
    createdAt
    date
    observationCount
    projectId
    setId
    updatedAt
    userId
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
` as GeneratedSubscription<
  APITypes.OnUpdateAnnotationSubscriptionVariables,
  APITypes.OnUpdateAnnotationSubscription
>;
export const onUpdateAnnotationSet = /* GraphQL */ `subscription OnUpdateAnnotationSet(
  $filter: ModelSubscriptionAnnotationSetFilterInput
) {
  onUpdateAnnotationSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateAnnotationSetSubscriptionVariables,
  APITypes.OnUpdateAnnotationSetSubscription
>;
export const onUpdateCategory = /* GraphQL */ `subscription OnUpdateCategory($filter: ModelSubscriptionCategoryFilterInput) {
  onUpdateCategory(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateLocationSubscriptionVariables,
  APITypes.OnUpdateLocationSubscription
>;
export const onUpdateLocationSet = /* GraphQL */ `subscription OnUpdateLocationSet(
  $filter: ModelSubscriptionLocationSetFilterInput
) {
  onUpdateLocationSet(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateObjectSubscriptionVariables,
  APITypes.OnUpdateObjectSubscription
>;
export const onUpdateObservation = /* GraphQL */ `subscription OnUpdateObservation(
  $filter: ModelSubscriptionObservationFilterInput
  $owner: String
) {
  onUpdateObservation(filter: $filter, owner: $owner) {
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
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnUpdateObservationSubscriptionVariables,
  APITypes.OnUpdateObservationSubscription
>;
export const onUpdateProject = /* GraphQL */ `subscription OnUpdateProject($filter: ModelSubscriptionProjectFilterInput) {
  onUpdateProject(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateProjectSubscriptionVariables,
  APITypes.OnUpdateProjectSubscription
>;
export const onUpdateQueue = /* GraphQL */ `subscription OnUpdateQueue($filter: ModelSubscriptionQueueFilterInput) {
  onUpdateQueue(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateQueueSubscriptionVariables,
  APITypes.OnUpdateQueueSubscription
>;
export const onUpdateUserObservationStats = /* GraphQL */ `subscription OnUpdateUserObservationStats(
  $filter: ModelSubscriptionUserObservationStatsFilterInput
) {
  onUpdateUserObservationStats(filter: $filter) {
    activeTime
    count
    createdAt
    lastUpdated
    projectId
    updatedAt
    userId
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnUpdateUserObservationStatsSubscriptionVariables,
  APITypes.OnUpdateUserObservationStatsSubscription
>;
export const onUpdateUserProjectMembership = /* GraphQL */ `subscription OnUpdateUserProjectMembership(
  $filter: ModelSubscriptionUserProjectMembershipFilterInput
) {
  onUpdateUserProjectMembership(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateUserProjectMembershipSubscriptionVariables,
  APITypes.OnUpdateUserProjectMembershipSubscription
>;
export const onUpdateUserStats = /* GraphQL */ `subscription OnUpdateUserStats($filter: ModelSubscriptionUserStatsFilterInput) {
  onUpdateUserStats(filter: $filter) {
    activeTime
    annotationCount
    createdAt
    date
    observationCount
    projectId
    setId
    updatedAt
    userId
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
