/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getProject = /* GraphQL */ `
  query GetProject($id: ID!) {
    getProject(id: $id) {
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
export const listProjects = /* GraphQL */ `
  query ListProjects(
    $filter: ModelProjectFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listProjects(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        name
        id
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getCategory = /* GraphQL */ `
  query GetCategory($id: ID!) {
    getCategory(id: $id) {
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
export const listCategories = /* GraphQL */ `
  query ListCategories(
    $filter: ModelCategoryFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listCategories(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        projectId
        name
        color
        shortcutKey
        id
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getImageMeta = /* GraphQL */ `
  query GetImageMeta($id: ID!) {
    getImageMeta(id: $id) {
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
export const listImageMetas = /* GraphQL */ `
  query ListImageMetas(
    $filter: ModelImageMetaFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listImageMetas(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
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
      nextToken
      __typename
    }
  }
`;
export const getImage = /* GraphQL */ `
  query GetImage($id: ID!) {
    getImage(id: $id) {
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
export const listImages = /* GraphQL */ `
  query ListImages(
    $filter: ModelImageFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listImages(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
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
      nextToken
      __typename
    }
  }
`;
export const getAnnotationSet = /* GraphQL */ `
  query GetAnnotationSet($id: ID!) {
    getAnnotationSet(id: $id) {
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
export const listAnnotationSets = /* GraphQL */ `
  query ListAnnotationSets(
    $filter: ModelAnnotationSetFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listAnnotationSets(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        projectId
        id
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getAnnotation = /* GraphQL */ `
  query GetAnnotation($id: ID!) {
    getAnnotation(id: $id) {
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
export const listAnnotations = /* GraphQL */ `
  query ListAnnotations(
    $filter: ModelAnnotationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listAnnotations(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        projectId
        setId
        source
        categoryId
        metaId
        x
        y
        objectId
        id
        createdAt
        updatedAt
        owner
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getObject = /* GraphQL */ `
  query GetObject($id: ID!) {
    getObject(id: $id) {
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
export const listObjects = /* GraphQL */ `
  query ListObjects(
    $filter: ModelObjectFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listObjects(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        projectId
        id
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getLocation = /* GraphQL */ `
  query GetLocation($id: ID!) {
    getLocation(id: $id) {
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
export const listLocations = /* GraphQL */ `
  query ListLocations(
    $filter: ModelLocationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listLocations(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
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
      nextToken
      __typename
    }
  }
`;
export const getObservation = /* GraphQL */ `
  query GetObservation($id: ID!) {
    getObservation(id: $id) {
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
export const listObservations = /* GraphQL */ `
  query ListObservations(
    $filter: ModelObservationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listObservations(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        projectId
        locationId
        id
        createdAt
        updatedAt
        owner
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getLocationSet = /* GraphQL */ `
  query GetLocationSet($id: ID!) {
    getLocationSet(id: $id) {
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
export const listLocationSets = /* GraphQL */ `
  query ListLocationSets(
    $filter: ModelLocationSetFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listLocationSets(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        projectId
        id
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getLocationSetMembership = /* GraphQL */ `
  query GetLocationSetMembership($id: ID!) {
    getLocationSetMembership(id: $id) {
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
export const listLocationSetMemberships = /* GraphQL */ `
  query ListLocationSetMemberships(
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
        locationId
        locationSetId
        id
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getImageSetMembership = /* GraphQL */ `
  query GetImageSetMembership($id: ID!) {
    getImageSetMembership(id: $id) {
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
export const listImageSetMemberships = /* GraphQL */ `
  query ListImageSetMemberships(
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
        imageId
        imageSetId
        id
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getImageSet = /* GraphQL */ `
  query GetImageSet($id: ID!) {
    getImageSet(id: $id) {
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
export const listImageSets = /* GraphQL */ `
  query ListImageSets(
    $filter: ModelImageSetFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listImageSets(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        projectId
        name
        id
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getUserProjectMembership = /* GraphQL */ `
  query GetUserProjectMembership($id: ID!) {
    getUserProjectMembership(id: $id) {
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
export const listUserProjectMemberships = /* GraphQL */ `
  query ListUserProjectMemberships(
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
        userId
        projectId
        queueUrl
        id
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const listUsers = /* GraphQL */ `
  query ListUsers($nextToken: String) {
    listUsers(nextToken: $nextToken) {
      Users {
        id
        name
        isAdmin
        __typename
      }
      NextToken
      __typename
    }
  }
`;
export const listGroupsForUser = /* GraphQL */ `
  query ListGroupsForUser($userId: String!, $nextToken: String) {
    listGroupsForUser(userId: $userId, nextToken: $nextToken)
  }
`;
