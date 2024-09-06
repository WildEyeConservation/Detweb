/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const createProject = /* GraphQL */ `
  mutation CreateProject(
    $input: CreateProjectInput!
    $condition: ModelProjectConditionInput
  ) {
    createProject(input: $input, condition: $condition) {
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
export const updateProject = /* GraphQL */ `
  mutation UpdateProject(
    $input: UpdateProjectInput!
    $condition: ModelProjectConditionInput
  ) {
    updateProject(input: $input, condition: $condition) {
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
export const deleteProject = /* GraphQL */ `
  mutation DeleteProject(
    $input: DeleteProjectInput!
    $condition: ModelProjectConditionInput
  ) {
    deleteProject(input: $input, condition: $condition) {
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
export const createCategory = /* GraphQL */ `
  mutation CreateCategory(
    $input: CreateCategoryInput!
    $condition: ModelCategoryConditionInput
  ) {
    createCategory(input: $input, condition: $condition) {
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
export const updateCategory = /* GraphQL */ `
  mutation UpdateCategory(
    $input: UpdateCategoryInput!
    $condition: ModelCategoryConditionInput
  ) {
    updateCategory(input: $input, condition: $condition) {
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
export const deleteCategory = /* GraphQL */ `
  mutation DeleteCategory(
    $input: DeleteCategoryInput!
    $condition: ModelCategoryConditionInput
  ) {
    deleteCategory(input: $input, condition: $condition) {
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
export const createImageMeta = /* GraphQL */ `
  mutation CreateImageMeta(
    $input: CreateImageMetaInput!
    $condition: ModelImageMetaConditionInput
  ) {
    createImageMeta(input: $input, condition: $condition) {
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
export const updateImageMeta = /* GraphQL */ `
  mutation UpdateImageMeta(
    $input: UpdateImageMetaInput!
    $condition: ModelImageMetaConditionInput
  ) {
    updateImageMeta(input: $input, condition: $condition) {
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
export const deleteImageMeta = /* GraphQL */ `
  mutation DeleteImageMeta(
    $input: DeleteImageMetaInput!
    $condition: ModelImageMetaConditionInput
  ) {
    deleteImageMeta(input: $input, condition: $condition) {
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
export const createImage = /* GraphQL */ `
  mutation CreateImage(
    $input: CreateImageInput!
    $condition: ModelImageConditionInput
  ) {
    createImage(input: $input, condition: $condition) {
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
export const updateImage = /* GraphQL */ `
  mutation UpdateImage(
    $input: UpdateImageInput!
    $condition: ModelImageConditionInput
  ) {
    updateImage(input: $input, condition: $condition) {
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
export const deleteImage = /* GraphQL */ `
  mutation DeleteImage(
    $input: DeleteImageInput!
    $condition: ModelImageConditionInput
  ) {
    deleteImage(input: $input, condition: $condition) {
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
export const createAnnotationSet = /* GraphQL */ `
  mutation CreateAnnotationSet(
    $input: CreateAnnotationSetInput!
    $condition: ModelAnnotationSetConditionInput
  ) {
    createAnnotationSet(input: $input, condition: $condition) {
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
export const updateAnnotationSet = /* GraphQL */ `
  mutation UpdateAnnotationSet(
    $input: UpdateAnnotationSetInput!
    $condition: ModelAnnotationSetConditionInput
  ) {
    updateAnnotationSet(input: $input, condition: $condition) {
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
export const deleteAnnotationSet = /* GraphQL */ `
  mutation DeleteAnnotationSet(
    $input: DeleteAnnotationSetInput!
    $condition: ModelAnnotationSetConditionInput
  ) {
    deleteAnnotationSet(input: $input, condition: $condition) {
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
export const createAnnotation = /* GraphQL */ `
  mutation CreateAnnotation(
    $input: CreateAnnotationInput!
    $condition: ModelAnnotationConditionInput
  ) {
    createAnnotation(input: $input, condition: $condition) {
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
export const updateAnnotation = /* GraphQL */ `
  mutation UpdateAnnotation(
    $input: UpdateAnnotationInput!
    $condition: ModelAnnotationConditionInput
  ) {
    updateAnnotation(input: $input, condition: $condition) {
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
export const deleteAnnotation = /* GraphQL */ `
  mutation DeleteAnnotation(
    $input: DeleteAnnotationInput!
    $condition: ModelAnnotationConditionInput
  ) {
    deleteAnnotation(input: $input, condition: $condition) {
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
export const createObject = /* GraphQL */ `
  mutation CreateObject(
    $input: CreateObjectInput!
    $condition: ModelObjectConditionInput
  ) {
    createObject(input: $input, condition: $condition) {
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
export const updateObject = /* GraphQL */ `
  mutation UpdateObject(
    $input: UpdateObjectInput!
    $condition: ModelObjectConditionInput
  ) {
    updateObject(input: $input, condition: $condition) {
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
export const deleteObject = /* GraphQL */ `
  mutation DeleteObject(
    $input: DeleteObjectInput!
    $condition: ModelObjectConditionInput
  ) {
    deleteObject(input: $input, condition: $condition) {
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
export const createLocation = /* GraphQL */ `
  mutation CreateLocation(
    $input: CreateLocationInput!
    $condition: ModelLocationConditionInput
  ) {
    createLocation(input: $input, condition: $condition) {
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
export const updateLocation = /* GraphQL */ `
  mutation UpdateLocation(
    $input: UpdateLocationInput!
    $condition: ModelLocationConditionInput
  ) {
    updateLocation(input: $input, condition: $condition) {
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
export const deleteLocation = /* GraphQL */ `
  mutation DeleteLocation(
    $input: DeleteLocationInput!
    $condition: ModelLocationConditionInput
  ) {
    deleteLocation(input: $input, condition: $condition) {
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
export const createObservation = /* GraphQL */ `
  mutation CreateObservation(
    $input: CreateObservationInput!
    $condition: ModelObservationConditionInput
  ) {
    createObservation(input: $input, condition: $condition) {
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
export const updateObservation = /* GraphQL */ `
  mutation UpdateObservation(
    $input: UpdateObservationInput!
    $condition: ModelObservationConditionInput
  ) {
    updateObservation(input: $input, condition: $condition) {
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
export const deleteObservation = /* GraphQL */ `
  mutation DeleteObservation(
    $input: DeleteObservationInput!
    $condition: ModelObservationConditionInput
  ) {
    deleteObservation(input: $input, condition: $condition) {
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
export const createLocationSet = /* GraphQL */ `
  mutation CreateLocationSet(
    $input: CreateLocationSetInput!
    $condition: ModelLocationSetConditionInput
  ) {
    createLocationSet(input: $input, condition: $condition) {
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
export const updateLocationSet = /* GraphQL */ `
  mutation UpdateLocationSet(
    $input: UpdateLocationSetInput!
    $condition: ModelLocationSetConditionInput
  ) {
    updateLocationSet(input: $input, condition: $condition) {
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
export const deleteLocationSet = /* GraphQL */ `
  mutation DeleteLocationSet(
    $input: DeleteLocationSetInput!
    $condition: ModelLocationSetConditionInput
  ) {
    deleteLocationSet(input: $input, condition: $condition) {
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
export const createLocationSetMembership = /* GraphQL */ `
  mutation CreateLocationSetMembership(
    $input: CreateLocationSetMembershipInput!
    $condition: ModelLocationSetMembershipConditionInput
  ) {
    createLocationSetMembership(input: $input, condition: $condition) {
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
export const updateLocationSetMembership = /* GraphQL */ `
  mutation UpdateLocationSetMembership(
    $input: UpdateLocationSetMembershipInput!
    $condition: ModelLocationSetMembershipConditionInput
  ) {
    updateLocationSetMembership(input: $input, condition: $condition) {
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
export const deleteLocationSetMembership = /* GraphQL */ `
  mutation DeleteLocationSetMembership(
    $input: DeleteLocationSetMembershipInput!
    $condition: ModelLocationSetMembershipConditionInput
  ) {
    deleteLocationSetMembership(input: $input, condition: $condition) {
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
export const createImageSetMembership = /* GraphQL */ `
  mutation CreateImageSetMembership(
    $input: CreateImageSetMembershipInput!
    $condition: ModelImageSetMembershipConditionInput
  ) {
    createImageSetMembership(input: $input, condition: $condition) {
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
export const updateImageSetMembership = /* GraphQL */ `
  mutation UpdateImageSetMembership(
    $input: UpdateImageSetMembershipInput!
    $condition: ModelImageSetMembershipConditionInput
  ) {
    updateImageSetMembership(input: $input, condition: $condition) {
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
export const deleteImageSetMembership = /* GraphQL */ `
  mutation DeleteImageSetMembership(
    $input: DeleteImageSetMembershipInput!
    $condition: ModelImageSetMembershipConditionInput
  ) {
    deleteImageSetMembership(input: $input, condition: $condition) {
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
export const createImageSet = /* GraphQL */ `
  mutation CreateImageSet(
    $input: CreateImageSetInput!
    $condition: ModelImageSetConditionInput
  ) {
    createImageSet(input: $input, condition: $condition) {
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
export const updateImageSet = /* GraphQL */ `
  mutation UpdateImageSet(
    $input: UpdateImageSetInput!
    $condition: ModelImageSetConditionInput
  ) {
    updateImageSet(input: $input, condition: $condition) {
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
export const deleteImageSet = /* GraphQL */ `
  mutation DeleteImageSet(
    $input: DeleteImageSetInput!
    $condition: ModelImageSetConditionInput
  ) {
    deleteImageSet(input: $input, condition: $condition) {
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
export const createUserProjectMembership = /* GraphQL */ `
  mutation CreateUserProjectMembership(
    $input: CreateUserProjectMembershipInput!
    $condition: ModelUserProjectMembershipConditionInput
  ) {
    createUserProjectMembership(input: $input, condition: $condition) {
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
export const updateUserProjectMembership = /* GraphQL */ `
  mutation UpdateUserProjectMembership(
    $input: UpdateUserProjectMembershipInput!
    $condition: ModelUserProjectMembershipConditionInput
  ) {
    updateUserProjectMembership(input: $input, condition: $condition) {
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
export const deleteUserProjectMembership = /* GraphQL */ `
  mutation DeleteUserProjectMembership(
    $input: DeleteUserProjectMembershipInput!
    $condition: ModelUserProjectMembershipConditionInput
  ) {
    deleteUserProjectMembership(input: $input, condition: $condition) {
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
export const addUserToGroup = /* GraphQL */ `
  mutation AddUserToGroup($userId: String!, $groupName: String!) {
    addUserToGroup(userId: $userId, groupName: $groupName)
  }
`;
export const removeUserFromGroup = /* GraphQL */ `
  mutation RemoveUserFromGroup($userId: String!, $groupName: String!) {
    removeUserFromGroup(userId: $userId, groupName: $groupName)
  }
`;
export const createGroup = /* GraphQL */ `
  mutation CreateGroup($groupName: String!) {
    createGroup(groupName: $groupName)
  }
`;
