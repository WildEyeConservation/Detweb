/* eslint-disable */
// this is an auto generated file. This will be overwritten
export const getProject = /* GraphQL */ `
  query GetProject($name: String!) {
    getProject(name: $name) {
      name
      categories {
        nextToken
        __typename
      }
      annotationSet {
        nextToken
        __typename
      }
      locationSets {
        nextToken
        __typename
      }
      imageSets {
        nextToken
        __typename
      }
      queues {
        nextToken
        __typename
      }
      users {
        nextToken
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listProjects = /* GraphQL */ `
  query ListProjects(
    $name: String
    $filter: ModelProjectFilterInput
    $limit: Int
    $nextToken: String
    $sortDirection: ModelSortDirection
  ) {
    listProjects(
      name: $name
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      sortDirection: $sortDirection
    ) {
      items {
        name
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getUser = /* GraphQL */ `
  query GetUser($id: String!) {
    getUser(id: $id) {
      id
      name
      email
      isAdmin
      projects {
        nextToken
        __typename
      }
      currentProjectId
      currentProject {
        name
        createdAt
        updatedAt
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listUsers = /* GraphQL */ `
  query ListUsers(
    $id: String
    $filter: ModelUserFilterInput
    $limit: Int
    $nextToken: String
    $sortDirection: ModelSortDirection
  ) {
    listUsers(
      id: $id
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      sortDirection: $sortDirection
    ) {
      items {
        id
        name
        email
        isAdmin
        currentProjectId
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
      user {
        id
        name
        email
        isAdmin
        currentProjectId
        createdAt
        updatedAt
        __typename
      }
      projectId
      project {
        name
        createdAt
        updatedAt
        __typename
      }
      queueUrl
      queue {
        name
        url
        projectId
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
export const userProjectMembershipsByUserId = /* GraphQL */ `
  query UserProjectMembershipsByUserId(
    $userId: String!
    $sortDirection: ModelSortDirection
    $filter: ModelUserProjectMembershipFilterInput
    $limit: Int
    $nextToken: String
  ) {
    userProjectMembershipsByUserId(
      userId: $userId
      sortDirection: $sortDirection
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
export const userProjectMembershipsByProjectId = /* GraphQL */ `
  query UserProjectMembershipsByProjectId(
    $projectId: String!
    $sortDirection: ModelSortDirection
    $filter: ModelUserProjectMembershipFilterInput
    $limit: Int
    $nextToken: String
  ) {
    userProjectMembershipsByProjectId(
      projectId: $projectId
      sortDirection: $sortDirection
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
export const userProjectMembershipsByQueueUrl = /* GraphQL */ `
  query UserProjectMembershipsByQueueUrl(
    $queueUrl: String!
    $sortDirection: ModelSortDirection
    $filter: ModelUserProjectMembershipFilterInput
    $limit: Int
    $nextToken: String
  ) {
    userProjectMembershipsByQueueUrl(
      queueUrl: $queueUrl
      sortDirection: $sortDirection
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
export const getQueue = /* GraphQL */ `
  query GetQueue($url: String!) {
    getQueue(url: $url) {
      name
      url
      users {
        nextToken
        __typename
      }
      projectId
      project {
        name
        createdAt
        updatedAt
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listQueues = /* GraphQL */ `
  query ListQueues(
    $url: String
    $filter: ModelQueueFilterInput
    $limit: Int
    $nextToken: String
    $sortDirection: ModelSortDirection
  ) {
    listQueues(
      url: $url
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      sortDirection: $sortDirection
    ) {
      items {
        name
        url
        projectId
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const queuesByProjectId = /* GraphQL */ `
  query QueuesByProjectId(
    $projectId: String!
    $sortDirection: ModelSortDirection
    $filter: ModelQueueFilterInput
    $limit: Int
    $nextToken: String
  ) {
    queuesByProjectId(
      projectId: $projectId
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        name
        url
        projectId
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
      id
      name
      color
      shortcutKey
      annotations {
        nextToken
        __typename
      }
      objects {
        nextToken
        __typename
      }
      projectName
      project {
        name
        createdAt
        updatedAt
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listCategories = /* GraphQL */ `
  query ListCategories(
    $id: ID
    $filter: ModelCategoryFilterInput
    $limit: Int
    $nextToken: String
    $sortDirection: ModelSortDirection
  ) {
    listCategories(
      id: $id
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      sortDirection: $sortDirection
    ) {
      items {
        id
        name
        color
        shortcutKey
        projectName
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const categoriesByProjectName = /* GraphQL */ `
  query CategoriesByProjectName(
    $projectName: String!
    $sortDirection: ModelSortDirection
    $filter: ModelCategoryFilterInput
    $limit: Int
    $nextToken: String
  ) {
    categoriesByProjectName(
      projectName: $projectName
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        name
        color
        shortcutKey
        projectName
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
      id
      name
      projectName
      project {
        name
        createdAt
        updatedAt
        __typename
      }
      annotations {
        nextToken
        __typename
      }
      observations {
        nextToken
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listAnnotationSets = /* GraphQL */ `
  query ListAnnotationSets(
    $id: ID
    $filter: ModelAnnotationSetFilterInput
    $limit: Int
    $nextToken: String
    $sortDirection: ModelSortDirection
  ) {
    listAnnotationSets(
      id: $id
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      sortDirection: $sortDirection
    ) {
      items {
        id
        name
        projectName
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const annotationSetsByProjectName = /* GraphQL */ `
  query AnnotationSetsByProjectName(
    $projectName: String!
    $sortDirection: ModelSortDirection
    $filter: ModelAnnotationSetFilterInput
    $limit: Int
    $nextToken: String
  ) {
    annotationSetsByProjectName(
      projectName: $projectName
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        name
        projectName
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
      x
      y
      obscured
      note
      origin
      imageKey
      image {
        key
        hash
        width
        height
        longitude
        latitude
        altitude_msl
        roll
        yaw
        pitch
        timestamp
        altitude_agl
        exifData
        cameraSerial
        createdAt
        updatedAt
        __typename
      }
      annotationSetId
      annotationSet {
        id
        name
        projectName
        createdAt
        updatedAt
        __typename
      }
      categoryId
      category {
        id
        name
        color
        shortcutKey
        projectName
        createdAt
        updatedAt
        __typename
      }
      objectId
      object {
        categoryId
        latitude
        longitude
        id
        createdAt
        updatedAt
        __typename
      }
      owner
      id
      createdAt
      updatedAt
      objectAnnotationsId
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
        x
        y
        obscured
        note
        origin
        imageKey
        annotationSetId
        categoryId
        objectId
        owner
        id
        createdAt
        updatedAt
        objectAnnotationsId
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const annotationsByImageKey = /* GraphQL */ `
  query AnnotationsByImageKey(
    $imageKey: String!
    $sortDirection: ModelSortDirection
    $filter: ModelAnnotationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    annotationsByImageKey(
      imageKey: $imageKey
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        x
        y
        obscured
        note
        origin
        imageKey
        annotationSetId
        categoryId
        objectId
        owner
        id
        createdAt
        updatedAt
        objectAnnotationsId
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const annotationsByAnnotationSetId = /* GraphQL */ `
  query AnnotationsByAnnotationSetId(
    $annotationSetId: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelAnnotationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    annotationsByAnnotationSetId(
      annotationSetId: $annotationSetId
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        x
        y
        obscured
        note
        origin
        imageKey
        annotationSetId
        categoryId
        objectId
        owner
        id
        createdAt
        updatedAt
        objectAnnotationsId
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const annotationsByCategoryId = /* GraphQL */ `
  query AnnotationsByCategoryId(
    $categoryId: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelAnnotationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    annotationsByCategoryId(
      categoryId: $categoryId
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        x
        y
        obscured
        note
        origin
        imageKey
        annotationSetId
        categoryId
        objectId
        owner
        id
        createdAt
        updatedAt
        objectAnnotationsId
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const annotationsByObjectId = /* GraphQL */ `
  query AnnotationsByObjectId(
    $objectId: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelAnnotationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    annotationsByObjectId(
      objectId: $objectId
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        x
        y
        obscured
        note
        origin
        imageKey
        annotationSetId
        categoryId
        objectId
        owner
        id
        createdAt
        updatedAt
        objectAnnotationsId
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
      categoryId
      category {
        id
        name
        color
        shortcutKey
        projectName
        createdAt
        updatedAt
        __typename
      }
      latitude
      longitude
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
        categoryId
        latitude
        longitude
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
export const objectsByCategoryId = /* GraphQL */ `
  query ObjectsByCategoryId(
    $categoryId: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelObjectFilterInput
    $limit: Int
    $nextToken: String
  ) {
    objectsByCategoryId(
      categoryId: $categoryId
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        categoryId
        latitude
        longitude
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
  query GetImage($key: String!) {
    getImage(key: $key) {
      key
      hash
      width
      height
      longitude
      latitude
      altitude_msl
      roll
      yaw
      pitch
      timestamp
      altitude_agl
      exifData
      cameraSerial
      annotations {
        nextToken
        __typename
      }
      locations {
        nextToken
        __typename
      }
      collections {
        nextToken
        __typename
      }
      leftNeighbours {
        nextToken
        __typename
      }
      rightNeighbours {
        nextToken
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listImages = /* GraphQL */ `
  query ListImages(
    $key: String
    $filter: ModelImageFilterInput
    $limit: Int
    $nextToken: String
    $sortDirection: ModelSortDirection
  ) {
    listImages(
      key: $key
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      sortDirection: $sortDirection
    ) {
      items {
        key
        hash
        width
        height
        longitude
        latitude
        altitude_msl
        roll
        yaw
        pitch
        timestamp
        altitude_agl
        exifData
        cameraSerial
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getImageNeighbour = /* GraphQL */ `
  query GetImageNeighbour($id: ID!) {
    getImageNeighbour(id: $id) {
      image1key
      image1 {
        key
        hash
        width
        height
        longitude
        latitude
        altitude_msl
        roll
        yaw
        pitch
        timestamp
        altitude_agl
        exifData
        cameraSerial
        createdAt
        updatedAt
        __typename
      }
      image2key
      image2 {
        key
        hash
        width
        height
        longitude
        latitude
        altitude_msl
        roll
        yaw
        pitch
        timestamp
        altitude_agl
        exifData
        cameraSerial
        createdAt
        updatedAt
        __typename
      }
      homography
      id
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listImageNeighbours = /* GraphQL */ `
  query ListImageNeighbours(
    $filter: ModelImageNeighbourFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listImageNeighbours(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        image1key
        image2key
        homography
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
export const imageNeighboursByImage1key = /* GraphQL */ `
  query ImageNeighboursByImage1key(
    $image1key: String!
    $sortDirection: ModelSortDirection
    $filter: ModelImageNeighbourFilterInput
    $limit: Int
    $nextToken: String
  ) {
    imageNeighboursByImage1key(
      image1key: $image1key
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        image1key
        image2key
        homography
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
export const imageNeighboursByImage2key = /* GraphQL */ `
  query ImageNeighboursByImage2key(
    $image2key: String!
    $sortDirection: ModelSortDirection
    $filter: ModelImageNeighbourFilterInput
    $limit: Int
    $nextToken: String
  ) {
    imageNeighboursByImage2key(
      image2key: $image2key
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        image1key
        image2key
        homography
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
  query GetImageSet($name: String!) {
    getImageSet(name: $name) {
      name
      images {
        nextToken
        __typename
      }
      projectName
      project {
        name
        createdAt
        updatedAt
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listImageSets = /* GraphQL */ `
  query ListImageSets(
    $name: String
    $filter: ModelImageSetFilterInput
    $limit: Int
    $nextToken: String
    $sortDirection: ModelSortDirection
  ) {
    listImageSets(
      name: $name
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      sortDirection: $sortDirection
    ) {
      items {
        name
        projectName
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const imageSetsByProjectName = /* GraphQL */ `
  query ImageSetsByProjectName(
    $projectName: String!
    $sortDirection: ModelSortDirection
    $filter: ModelImageSetFilterInput
    $limit: Int
    $nextToken: String
  ) {
    imageSetsByProjectName(
      projectName: $projectName
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        name
        projectName
        createdAt
        updatedAt
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
      id
      name
      readGroup
      locations {
        nextToken
        __typename
      }
      projectName
      project {
        name
        createdAt
        updatedAt
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listLocationSets = /* GraphQL */ `
  query ListLocationSets(
    $id: ID
    $filter: ModelLocationSetFilterInput
    $limit: Int
    $nextToken: String
    $sortDirection: ModelSortDirection
  ) {
    listLocationSets(
      id: $id
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      sortDirection: $sortDirection
    ) {
      items {
        id
        name
        readGroup
        projectName
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const locationSetsByProjectName = /* GraphQL */ `
  query LocationSetsByProjectName(
    $projectName: String!
    $sortDirection: ModelSortDirection
    $filter: ModelLocationSetFilterInput
    $limit: Int
    $nextToken: String
  ) {
    locationSetsByProjectName(
      projectName: $projectName
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        name
        readGroup
        projectName
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
      id
      setId
      set {
        id
        name
        readGroup
        projectName
        createdAt
        updatedAt
        __typename
      }
      confidence
      isTest
      imageKey
      image {
        key
        hash
        width
        height
        longitude
        latitude
        altitude_msl
        roll
        yaw
        pitch
        timestamp
        altitude_agl
        exifData
        cameraSerial
        createdAt
        updatedAt
        __typename
      }
      observations {
        nextToken
        __typename
      }
      x
      y
      width
      height
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listLocations = /* GraphQL */ `
  query ListLocations(
    $id: ID
    $filter: ModelLocationFilterInput
    $limit: Int
    $nextToken: String
    $sortDirection: ModelSortDirection
  ) {
    listLocations(
      id: $id
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      sortDirection: $sortDirection
    ) {
      items {
        id
        setId
        confidence
        isTest
        imageKey
        x
        y
        width
        height
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const locationsBySetId = /* GraphQL */ `
  query LocationsBySetId(
    $setId: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelLocationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    locationsBySetId(
      setId: $setId
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        setId
        confidence
        isTest
        imageKey
        x
        y
        width
        height
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const testLocations = /* GraphQL */ `
  query TestLocations(
    $setId: ID!
    $isTest: ModelIntKeyConditionInput
    $sortDirection: ModelSortDirection
    $filter: ModelLocationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    testLocations(
      setId: $setId
      isTest: $isTest
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        setId
        confidence
        isTest
        imageKey
        x
        y
        width
        height
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const locationsByImageKey = /* GraphQL */ `
  query LocationsByImageKey(
    $imageKey: String!
    $sortDirection: ModelSortDirection
    $filter: ModelLocationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    locationsByImageKey(
      imageKey: $imageKey
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        setId
        confidence
        isTest
        imageKey
        x
        y
        width
        height
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
      locationId
      location {
        id
        setId
        confidence
        isTest
        imageKey
        x
        y
        width
        height
        createdAt
        updatedAt
        __typename
      }
      annotationSetId
      annotationSet {
        id
        name
        projectName
        createdAt
        updatedAt
        __typename
      }
      owner
      createdAt
      id
      updatedAt
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
        locationId
        annotationSetId
        owner
        createdAt
        id
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const observationsByLocationId = /* GraphQL */ `
  query ObservationsByLocationId(
    $locationId: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelObservationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    observationsByLocationId(
      locationId: $locationId
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        locationId
        annotationSetId
        owner
        createdAt
        id
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const observationsByLocationIdAndOwnerAndCreatedAt = /* GraphQL */ `
  query ObservationsByLocationIdAndOwnerAndCreatedAt(
    $locationId: ID!
    $ownerCreatedAt: ModelObservationObservationsByLocationIdAndOwnerAndCreatedAtCompositeKeyConditionInput
    $sortDirection: ModelSortDirection
    $filter: ModelObservationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    observationsByLocationIdAndOwnerAndCreatedAt(
      locationId: $locationId
      ownerCreatedAt: $ownerCreatedAt
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        locationId
        annotationSetId
        owner
        createdAt
        id
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const observationsByAnnotationSetId = /* GraphQL */ `
  query ObservationsByAnnotationSetId(
    $annotationSetId: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelObservationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    observationsByAnnotationSetId(
      annotationSetId: $annotationSetId
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        locationId
        annotationSetId
        owner
        createdAt
        id
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const observationsByOwnerAndCreatedAt = /* GraphQL */ `
  query ObservationsByOwnerAndCreatedAt(
    $owner: String!
    $createdAt: ModelStringKeyConditionInput
    $sortDirection: ModelSortDirection
    $filter: ModelObservationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    observationsByOwnerAndCreatedAt(
      owner: $owner
      createdAt: $createdAt
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        locationId
        annotationSetId
        owner
        createdAt
        id
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
      id
      imageKey
      imageSetName
      image {
        key
        hash
        width
        height
        longitude
        latitude
        altitude_msl
        roll
        yaw
        pitch
        timestamp
        altitude_agl
        exifData
        cameraSerial
        createdAt
        updatedAt
        __typename
      }
      imageSet {
        name
        projectName
        createdAt
        updatedAt
        __typename
      }
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
        id
        imageKey
        imageSetName
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const imageSetMembershipsByImageKey = /* GraphQL */ `
  query ImageSetMembershipsByImageKey(
    $imageKey: String!
    $sortDirection: ModelSortDirection
    $filter: ModelImageSetMembershipFilterInput
    $limit: Int
    $nextToken: String
  ) {
    imageSetMembershipsByImageKey(
      imageKey: $imageKey
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        imageKey
        imageSetName
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const imageSetMembershipsByImageSetName = /* GraphQL */ `
  query ImageSetMembershipsByImageSetName(
    $imageSetName: String!
    $sortDirection: ModelSortDirection
    $filter: ModelImageSetMembershipFilterInput
    $limit: Int
    $nextToken: String
  ) {
    imageSetMembershipsByImageSetName(
      imageSetName: $imageSetName
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        imageKey
        imageSetName
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
