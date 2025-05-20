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
) {
  onCreateAnnotation(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateAnnotationSubscriptionVariables,
  APITypes.OnCreateAnnotationSubscription
>;
export const onCreateAnnotationSet = /* GraphQL */ `subscription OnCreateAnnotationSet(
  $filter: ModelSubscriptionAnnotationSetFilterInput
) {
  onCreateAnnotationSet(filter: $filter) {
    createdAt
    id
    name
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
` as GeneratedSubscription<
  APITypes.OnCreateCategorySubscriptionVariables,
  APITypes.OnCreateCategorySubscription
>;
export const onCreateImage = /* GraphQL */ `subscription OnCreateImage($filter: ModelSubscriptionImageFilterInput) {
  onCreateImage(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateImageSubscriptionVariables,
  APITypes.OnCreateImageSubscription
>;
export const onCreateImageFile = /* GraphQL */ `subscription OnCreateImageFile($filter: ModelSubscriptionImageFileFilterInput) {
  onCreateImageFile(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateImageFileSubscriptionVariables,
  APITypes.OnCreateImageFileSubscription
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
    name
    projectId
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnCreateLocationSetSubscriptionVariables,
  APITypes.OnCreateLocationSetSubscription
>;
export const onCreateObject = /* GraphQL */ `subscription OnCreateObject($filter: ModelSubscriptionObjectFilterInput) {
  onCreateObject(filter: $filter) {
    categoryId
    createdAt
    id
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
) {
  onCreateObservation(filter: $filter) {
    annotationSetId
    createdAt
    id
    locationId
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
    createdAt
    id
    name
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
    projectId
    updatedAt
    url
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnCreateQueueSubscriptionVariables,
  APITypes.OnCreateQueueSubscription
>;
export const onCreateUserProjectMembership = /* GraphQL */ `subscription OnCreateUserProjectMembership(
  $filter: ModelSubscriptionUserProjectMembershipFilterInput
) {
  onCreateUserProjectMembership(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateUserProjectMembershipSubscriptionVariables,
  APITypes.OnCreateUserProjectMembershipSubscription
>;
export const onDeleteAnnotation = /* GraphQL */ `subscription OnDeleteAnnotation(
  $filter: ModelSubscriptionAnnotationFilterInput
) {
  onDeleteAnnotation(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteAnnotationSubscriptionVariables,
  APITypes.OnDeleteAnnotationSubscription
>;
export const onDeleteAnnotationSet = /* GraphQL */ `subscription OnDeleteAnnotationSet(
  $filter: ModelSubscriptionAnnotationSetFilterInput
) {
  onDeleteAnnotationSet(filter: $filter) {
    createdAt
    id
    name
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
` as GeneratedSubscription<
  APITypes.OnDeleteCategorySubscriptionVariables,
  APITypes.OnDeleteCategorySubscription
>;
export const onDeleteImage = /* GraphQL */ `subscription OnDeleteImage($filter: ModelSubscriptionImageFilterInput) {
  onDeleteImage(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteImageSubscriptionVariables,
  APITypes.OnDeleteImageSubscription
>;
export const onDeleteImageFile = /* GraphQL */ `subscription OnDeleteImageFile($filter: ModelSubscriptionImageFileFilterInput) {
  onDeleteImageFile(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteImageFileSubscriptionVariables,
  APITypes.OnDeleteImageFileSubscription
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
    name
    projectId
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnDeleteLocationSetSubscriptionVariables,
  APITypes.OnDeleteLocationSetSubscription
>;
export const onDeleteObject = /* GraphQL */ `subscription OnDeleteObject($filter: ModelSubscriptionObjectFilterInput) {
  onDeleteObject(filter: $filter) {
    categoryId
    createdAt
    id
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
) {
  onDeleteObservation(filter: $filter) {
    annotationSetId
    createdAt
    id
    locationId
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
    createdAt
    id
    name
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
    projectId
    updatedAt
    url
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnDeleteQueueSubscriptionVariables,
  APITypes.OnDeleteQueueSubscription
>;
export const onDeleteUserProjectMembership = /* GraphQL */ `subscription OnDeleteUserProjectMembership(
  $filter: ModelSubscriptionUserProjectMembershipFilterInput
) {
  onDeleteUserProjectMembership(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteUserProjectMembershipSubscriptionVariables,
  APITypes.OnDeleteUserProjectMembershipSubscription
>;
export const onUpdateAnnotation = /* GraphQL */ `subscription OnUpdateAnnotation(
  $filter: ModelSubscriptionAnnotationFilterInput
) {
  onUpdateAnnotation(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateAnnotationSubscriptionVariables,
  APITypes.OnUpdateAnnotationSubscription
>;
export const onUpdateAnnotationSet = /* GraphQL */ `subscription OnUpdateAnnotationSet(
  $filter: ModelSubscriptionAnnotationSetFilterInput
) {
  onUpdateAnnotationSet(filter: $filter) {
    createdAt
    id
    name
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
` as GeneratedSubscription<
  APITypes.OnUpdateCategorySubscriptionVariables,
  APITypes.OnUpdateCategorySubscription
>;
export const onUpdateImage = /* GraphQL */ `subscription OnUpdateImage($filter: ModelSubscriptionImageFilterInput) {
  onUpdateImage(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateImageSubscriptionVariables,
  APITypes.OnUpdateImageSubscription
>;
export const onUpdateImageFile = /* GraphQL */ `subscription OnUpdateImageFile($filter: ModelSubscriptionImageFileFilterInput) {
  onUpdateImageFile(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateImageFileSubscriptionVariables,
  APITypes.OnUpdateImageFileSubscription
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
    name
    projectId
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnUpdateLocationSetSubscriptionVariables,
  APITypes.OnUpdateLocationSetSubscription
>;
export const onUpdateObject = /* GraphQL */ `subscription OnUpdateObject($filter: ModelSubscriptionObjectFilterInput) {
  onUpdateObject(filter: $filter) {
    categoryId
    createdAt
    id
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
) {
  onUpdateObservation(filter: $filter) {
    annotationSetId
    createdAt
    id
    locationId
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
    createdAt
    id
    name
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
    projectId
    updatedAt
    url
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnUpdateQueueSubscriptionVariables,
  APITypes.OnUpdateQueueSubscription
>;
export const onUpdateUserProjectMembership = /* GraphQL */ `subscription OnUpdateUserProjectMembership(
  $filter: ModelSubscriptionUserProjectMembershipFilterInput
) {
  onUpdateUserProjectMembership(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateUserProjectMembershipSubscriptionVariables,
  APITypes.OnUpdateUserProjectMembershipSubscription
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
