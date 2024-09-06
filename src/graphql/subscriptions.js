/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const onCreateProject = /* GraphQL */ `
  subscription OnCreateProject($filter: ModelSubscriptionProjectFilterInput) {
    onCreateProject(filter: $filter) {
      name
      categories {
        nextToken
        __typename
      }
      images {
        nextToken
        __typename
      }
      imageMetas {
        nextToken
        __typename
      }
      annotations {
        nextToken
        __typename
      }
      objects {
        nextToken
        __typename
      }
      imageSets {
        nextToken
        __typename
      }
      annotationSets {
        nextToken
        __typename
      }
      locations {
        nextToken
        __typename
      }
      locationSets {
        nextToken
        __typename
      }
      observations {
        nextToken
        __typename
      }
      members {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdateProject = /* GraphQL */ `
  subscription OnUpdateProject($filter: ModelSubscriptionProjectFilterInput) {
    onUpdateProject(filter: $filter) {
      name
      categories {
        nextToken
        __typename
      }
      images {
        nextToken
        __typename
      }
      imageMetas {
        nextToken
        __typename
      }
      annotations {
        nextToken
        __typename
      }
      objects {
        nextToken
        __typename
      }
      imageSets {
        nextToken
        __typename
      }
      annotationSets {
        nextToken
        __typename
      }
      locations {
        nextToken
        __typename
      }
      locationSets {
        nextToken
        __typename
      }
      observations {
        nextToken
        __typename
      }
      members {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeleteProject = /* GraphQL */ `
  subscription OnDeleteProject($filter: ModelSubscriptionProjectFilterInput) {
    onDeleteProject(filter: $filter) {
      name
      categories {
        nextToken
        __typename
      }
      images {
        nextToken
        __typename
      }
      imageMetas {
        nextToken
        __typename
      }
      annotations {
        nextToken
        __typename
      }
      objects {
        nextToken
        __typename
      }
      imageSets {
        nextToken
        __typename
      }
      annotationSets {
        nextToken
        __typename
      }
      locations {
        nextToken
        __typename
      }
      locationSets {
        nextToken
        __typename
      }
      observations {
        nextToken
        __typename
      }
      members {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onCreateCategory = /* GraphQL */ `
  subscription OnCreateCategory($filter: ModelSubscriptionCategoryFilterInput) {
    onCreateCategory(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      name
      color
      shortcutKey
      annotations {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdateCategory = /* GraphQL */ `
  subscription OnUpdateCategory($filter: ModelSubscriptionCategoryFilterInput) {
    onUpdateCategory(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      name
      color
      shortcutKey
      annotations {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeleteCategory = /* GraphQL */ `
  subscription OnDeleteCategory($filter: ModelSubscriptionCategoryFilterInput) {
    onDeleteCategory(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      name
      color
      shortcutKey
      annotations {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onCreateImageMeta = /* GraphQL */ `
  subscription OnCreateImageMeta(
    $filter: ModelSubscriptionImageMetaFilterInput
  ) {
    onCreateImageMeta(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      latitude
      longitude
      altitude_wgs84
      altitude_agl
      altitude_egm96
      width
      height
      roll
      yaw
      pitch
      timestamp
      exifData
      cameraSerial
      images {
        nextToken
        __typename
      }
      locations {
        nextToken
        __typename
      }
      annotations {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdateImageMeta = /* GraphQL */ `
  subscription OnUpdateImageMeta(
    $filter: ModelSubscriptionImageMetaFilterInput
  ) {
    onUpdateImageMeta(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      latitude
      longitude
      altitude_wgs84
      altitude_agl
      altitude_egm96
      width
      height
      roll
      yaw
      pitch
      timestamp
      exifData
      cameraSerial
      images {
        nextToken
        __typename
      }
      locations {
        nextToken
        __typename
      }
      annotations {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeleteImageMeta = /* GraphQL */ `
  subscription OnDeleteImageMeta(
    $filter: ModelSubscriptionImageMetaFilterInput
  ) {
    onDeleteImageMeta(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      latitude
      longitude
      altitude_wgs84
      altitude_agl
      altitude_egm96
      width
      height
      roll
      yaw
      pitch
      timestamp
      exifData
      cameraSerial
      images {
        nextToken
        __typename
      }
      locations {
        nextToken
        __typename
      }
      annotations {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onCreateImage = /* GraphQL */ `
  subscription OnCreateImage($filter: ModelSubscriptionImageFilterInput) {
    onCreateImage(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      derivedFrom
      path
      metaId
      meta {
        projectId
        latitude
        longitude
        altitude_wgs84
        altitude_agl
        altitude_egm96
        width
        height
        roll
        yaw
        pitch
        timestamp
        exifData
        cameraSerial
        id
        createdAt
        updatedAt
        __typename
      }
      type
      sets {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdateImage = /* GraphQL */ `
  subscription OnUpdateImage($filter: ModelSubscriptionImageFilterInput) {
    onUpdateImage(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      derivedFrom
      path
      metaId
      meta {
        projectId
        latitude
        longitude
        altitude_wgs84
        altitude_agl
        altitude_egm96
        width
        height
        roll
        yaw
        pitch
        timestamp
        exifData
        cameraSerial
        id
        createdAt
        updatedAt
        __typename
      }
      type
      sets {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeleteImage = /* GraphQL */ `
  subscription OnDeleteImage($filter: ModelSubscriptionImageFilterInput) {
    onDeleteImage(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      derivedFrom
      path
      metaId
      meta {
        projectId
        latitude
        longitude
        altitude_wgs84
        altitude_agl
        altitude_egm96
        width
        height
        roll
        yaw
        pitch
        timestamp
        exifData
        cameraSerial
        id
        createdAt
        updatedAt
        __typename
      }
      type
      sets {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onCreateAnnotationSet = /* GraphQL */ `
  subscription OnCreateAnnotationSet(
    $filter: ModelSubscriptionAnnotationSetFilterInput
  ) {
    onCreateAnnotationSet(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      annotations {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdateAnnotationSet = /* GraphQL */ `
  subscription OnUpdateAnnotationSet(
    $filter: ModelSubscriptionAnnotationSetFilterInput
  ) {
    onUpdateAnnotationSet(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      annotations {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeleteAnnotationSet = /* GraphQL */ `
  subscription OnDeleteAnnotationSet(
    $filter: ModelSubscriptionAnnotationSetFilterInput
  ) {
    onDeleteAnnotationSet(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      annotations {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onCreateAnnotation = /* GraphQL */ `
  subscription OnCreateAnnotation(
    $filter: ModelSubscriptionAnnotationFilterInput
    $owner: String
  ) {
    onCreateAnnotation(filter: $filter, owner: $owner) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      setId
      set {
        projectId
        id
        createdAt
        updatedAt
        __typename
      }
      source
      categoryId
      category {
        projectId
        name
        color
        shortcutKey
        id
        createdAt
        updatedAt
        __typename
      }
      metaId
      image {
        projectId
        latitude
        longitude
        altitude_wgs84
        altitude_agl
        altitude_egm96
        width
        height
        roll
        yaw
        pitch
        timestamp
        exifData
        cameraSerial
        id
        createdAt
        updatedAt
        __typename
      }
      x
      y
      objectId
      object {
        projectId
        id
        createdAt
        updatedAt
        __typename
      }
      id
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const onUpdateAnnotation = /* GraphQL */ `
  subscription OnUpdateAnnotation(
    $filter: ModelSubscriptionAnnotationFilterInput
    $owner: String
  ) {
    onUpdateAnnotation(filter: $filter, owner: $owner) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      setId
      set {
        projectId
        id
        createdAt
        updatedAt
        __typename
      }
      source
      categoryId
      category {
        projectId
        name
        color
        shortcutKey
        id
        createdAt
        updatedAt
        __typename
      }
      metaId
      image {
        projectId
        latitude
        longitude
        altitude_wgs84
        altitude_agl
        altitude_egm96
        width
        height
        roll
        yaw
        pitch
        timestamp
        exifData
        cameraSerial
        id
        createdAt
        updatedAt
        __typename
      }
      x
      y
      objectId
      object {
        projectId
        id
        createdAt
        updatedAt
        __typename
      }
      id
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const onDeleteAnnotation = /* GraphQL */ `
  subscription OnDeleteAnnotation(
    $filter: ModelSubscriptionAnnotationFilterInput
    $owner: String
  ) {
    onDeleteAnnotation(filter: $filter, owner: $owner) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      setId
      set {
        projectId
        id
        createdAt
        updatedAt
        __typename
      }
      source
      categoryId
      category {
        projectId
        name
        color
        shortcutKey
        id
        createdAt
        updatedAt
        __typename
      }
      metaId
      image {
        projectId
        latitude
        longitude
        altitude_wgs84
        altitude_agl
        altitude_egm96
        width
        height
        roll
        yaw
        pitch
        timestamp
        exifData
        cameraSerial
        id
        createdAt
        updatedAt
        __typename
      }
      x
      y
      objectId
      object {
        projectId
        id
        createdAt
        updatedAt
        __typename
      }
      id
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const onCreateObject = /* GraphQL */ `
  subscription OnCreateObject($filter: ModelSubscriptionObjectFilterInput) {
    onCreateObject(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      annotations {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdateObject = /* GraphQL */ `
  subscription OnUpdateObject($filter: ModelSubscriptionObjectFilterInput) {
    onUpdateObject(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      annotations {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeleteObject = /* GraphQL */ `
  subscription OnDeleteObject($filter: ModelSubscriptionObjectFilterInput) {
    onDeleteObject(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      annotations {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onCreateLocation = /* GraphQL */ `
  subscription OnCreateLocation($filter: ModelSubscriptionLocationFilterInput) {
    onCreateLocation(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      metaId
      meta {
        projectId
        latitude
        longitude
        altitude_wgs84
        altitude_agl
        altitude_egm96
        width
        height
        roll
        yaw
        pitch
        timestamp
        exifData
        cameraSerial
        id
        createdAt
        updatedAt
        __typename
      }
      height
      width
      x
      y
      source
      confidence
      observations {
        nextToken
        __typename
      }
      sets {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdateLocation = /* GraphQL */ `
  subscription OnUpdateLocation($filter: ModelSubscriptionLocationFilterInput) {
    onUpdateLocation(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      metaId
      meta {
        projectId
        latitude
        longitude
        altitude_wgs84
        altitude_agl
        altitude_egm96
        width
        height
        roll
        yaw
        pitch
        timestamp
        exifData
        cameraSerial
        id
        createdAt
        updatedAt
        __typename
      }
      height
      width
      x
      y
      source
      confidence
      observations {
        nextToken
        __typename
      }
      sets {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeleteLocation = /* GraphQL */ `
  subscription OnDeleteLocation($filter: ModelSubscriptionLocationFilterInput) {
    onDeleteLocation(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      metaId
      meta {
        projectId
        latitude
        longitude
        altitude_wgs84
        altitude_agl
        altitude_egm96
        width
        height
        roll
        yaw
        pitch
        timestamp
        exifData
        cameraSerial
        id
        createdAt
        updatedAt
        __typename
      }
      height
      width
      x
      y
      source
      confidence
      observations {
        nextToken
        __typename
      }
      sets {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onCreateObservation = /* GraphQL */ `
  subscription OnCreateObservation(
    $filter: ModelSubscriptionObservationFilterInput
    $owner: String
  ) {
    onCreateObservation(filter: $filter, owner: $owner) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      locationId
      location {
        projectId
        metaId
        height
        width
        x
        y
        source
        confidence
        id
        createdAt
        updatedAt
        __typename
      }
      id
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const onUpdateObservation = /* GraphQL */ `
  subscription OnUpdateObservation(
    $filter: ModelSubscriptionObservationFilterInput
    $owner: String
  ) {
    onUpdateObservation(filter: $filter, owner: $owner) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      locationId
      location {
        projectId
        metaId
        height
        width
        x
        y
        source
        confidence
        id
        createdAt
        updatedAt
        __typename
      }
      id
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const onDeleteObservation = /* GraphQL */ `
  subscription OnDeleteObservation(
    $filter: ModelSubscriptionObservationFilterInput
    $owner: String
  ) {
    onDeleteObservation(filter: $filter, owner: $owner) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      locationId
      location {
        projectId
        metaId
        height
        width
        x
        y
        source
        confidence
        id
        createdAt
        updatedAt
        __typename
      }
      id
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const onCreateLocationSet = /* GraphQL */ `
  subscription OnCreateLocationSet(
    $filter: ModelSubscriptionLocationSetFilterInput
  ) {
    onCreateLocationSet(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      locations {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdateLocationSet = /* GraphQL */ `
  subscription OnUpdateLocationSet(
    $filter: ModelSubscriptionLocationSetFilterInput
  ) {
    onUpdateLocationSet(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      locations {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeleteLocationSet = /* GraphQL */ `
  subscription OnDeleteLocationSet(
    $filter: ModelSubscriptionLocationSetFilterInput
  ) {
    onDeleteLocationSet(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      locations {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onCreateLocationSetMembership = /* GraphQL */ `
  subscription OnCreateLocationSetMembership(
    $filter: ModelSubscriptionLocationSetMembershipFilterInput
  ) {
    onCreateLocationSetMembership(filter: $filter) {
      locationId
      locationSetId
      location {
        projectId
        metaId
        height
        width
        x
        y
        source
        confidence
        id
        createdAt
        updatedAt
        __typename
      }
      locationSet {
        projectId
        id
        createdAt
        updatedAt
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdateLocationSetMembership = /* GraphQL */ `
  subscription OnUpdateLocationSetMembership(
    $filter: ModelSubscriptionLocationSetMembershipFilterInput
  ) {
    onUpdateLocationSetMembership(filter: $filter) {
      locationId
      locationSetId
      location {
        projectId
        metaId
        height
        width
        x
        y
        source
        confidence
        id
        createdAt
        updatedAt
        __typename
      }
      locationSet {
        projectId
        id
        createdAt
        updatedAt
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeleteLocationSetMembership = /* GraphQL */ `
  subscription OnDeleteLocationSetMembership(
    $filter: ModelSubscriptionLocationSetMembershipFilterInput
  ) {
    onDeleteLocationSetMembership(filter: $filter) {
      locationId
      locationSetId
      location {
        projectId
        metaId
        height
        width
        x
        y
        source
        confidence
        id
        createdAt
        updatedAt
        __typename
      }
      locationSet {
        projectId
        id
        createdAt
        updatedAt
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onCreateImageSetMembership = /* GraphQL */ `
  subscription OnCreateImageSetMembership(
    $filter: ModelSubscriptionImageSetMembershipFilterInput
  ) {
    onCreateImageSetMembership(filter: $filter) {
      imageId
      imageSetId
      image {
        projectId
        derivedFrom
        path
        metaId
        type
        id
        createdAt
        updatedAt
        __typename
      }
      imageSet {
        projectId
        name
        id
        createdAt
        updatedAt
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdateImageSetMembership = /* GraphQL */ `
  subscription OnUpdateImageSetMembership(
    $filter: ModelSubscriptionImageSetMembershipFilterInput
  ) {
    onUpdateImageSetMembership(filter: $filter) {
      imageId
      imageSetId
      image {
        projectId
        derivedFrom
        path
        metaId
        type
        id
        createdAt
        updatedAt
        __typename
      }
      imageSet {
        projectId
        name
        id
        createdAt
        updatedAt
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeleteImageSetMembership = /* GraphQL */ `
  subscription OnDeleteImageSetMembership(
    $filter: ModelSubscriptionImageSetMembershipFilterInput
  ) {
    onDeleteImageSetMembership(filter: $filter) {
      imageId
      imageSetId
      image {
        projectId
        derivedFrom
        path
        metaId
        type
        id
        createdAt
        updatedAt
        __typename
      }
      imageSet {
        projectId
        name
        id
        createdAt
        updatedAt
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onCreateImageSet = /* GraphQL */ `
  subscription OnCreateImageSet($filter: ModelSubscriptionImageSetFilterInput) {
    onCreateImageSet(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      name
      images {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdateImageSet = /* GraphQL */ `
  subscription OnUpdateImageSet($filter: ModelSubscriptionImageSetFilterInput) {
    onUpdateImageSet(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      name
      images {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeleteImageSet = /* GraphQL */ `
  subscription OnDeleteImageSet($filter: ModelSubscriptionImageSetFilterInput) {
    onDeleteImageSet(filter: $filter) {
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      name
      images {
        nextToken
        __typename
      }
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onCreateUserProjectMembership = /* GraphQL */ `
  subscription OnCreateUserProjectMembership(
    $filter: ModelSubscriptionUserProjectMembershipFilterInput
  ) {
    onCreateUserProjectMembership(filter: $filter) {
      userId
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      queueUrl
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdateUserProjectMembership = /* GraphQL */ `
  subscription OnUpdateUserProjectMembership(
    $filter: ModelSubscriptionUserProjectMembershipFilterInput
  ) {
    onUpdateUserProjectMembership(filter: $filter) {
      userId
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      queueUrl
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeleteUserProjectMembership = /* GraphQL */ `
  subscription OnDeleteUserProjectMembership(
    $filter: ModelSubscriptionUserProjectMembershipFilterInput
  ) {
    onDeleteUserProjectMembership(filter: $filter) {
      userId
      projectId
      project {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      queueUrl
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
