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
export const createUser = /* GraphQL */ `
  mutation CreateUser(
    $input: CreateUserInput!
    $condition: ModelUserConditionInput
  ) {
    createUser(input: $input, condition: $condition) {
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
export const updateUser = /* GraphQL */ `
  mutation UpdateUser(
    $input: UpdateUserInput!
    $condition: ModelUserConditionInput
  ) {
    updateUser(input: $input, condition: $condition) {
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
export const deleteUser = /* GraphQL */ `
  mutation DeleteUser(
    $input: DeleteUserInput!
    $condition: ModelUserConditionInput
  ) {
    deleteUser(input: $input, condition: $condition) {
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
export const createUserProjectMembership = /* GraphQL */ `
  mutation CreateUserProjectMembership(
    $input: CreateUserProjectMembershipInput!
    $condition: ModelUserProjectMembershipConditionInput
  ) {
    createUserProjectMembership(input: $input, condition: $condition) {
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
export const updateUserProjectMembership = /* GraphQL */ `
  mutation UpdateUserProjectMembership(
    $input: UpdateUserProjectMembershipInput!
    $condition: ModelUserProjectMembershipConditionInput
  ) {
    updateUserProjectMembership(input: $input, condition: $condition) {
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
export const deleteUserProjectMembership = /* GraphQL */ `
  mutation DeleteUserProjectMembership(
    $input: DeleteUserProjectMembershipInput!
    $condition: ModelUserProjectMembershipConditionInput
  ) {
    deleteUserProjectMembership(input: $input, condition: $condition) {
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
export const createQueue = /* GraphQL */ `
  mutation CreateQueue(
    $input: CreateQueueInput!
    $condition: ModelQueueConditionInput
  ) {
    createQueue(input: $input, condition: $condition) {
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
export const updateQueue = /* GraphQL */ `
  mutation UpdateQueue(
    $input: UpdateQueueInput!
    $condition: ModelQueueConditionInput
  ) {
    updateQueue(input: $input, condition: $condition) {
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
export const deleteQueue = /* GraphQL */ `
  mutation DeleteQueue(
    $input: DeleteQueueInput!
    $condition: ModelQueueConditionInput
  ) {
    deleteQueue(input: $input, condition: $condition) {
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
export const createCategory = /* GraphQL */ `
  mutation CreateCategory(
    $input: CreateCategoryInput!
    $condition: ModelCategoryConditionInput
  ) {
    createCategory(input: $input, condition: $condition) {
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
export const updateCategory = /* GraphQL */ `
  mutation UpdateCategory(
    $input: UpdateCategoryInput!
    $condition: ModelCategoryConditionInput
  ) {
    updateCategory(input: $input, condition: $condition) {
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
export const deleteCategory = /* GraphQL */ `
  mutation DeleteCategory(
    $input: DeleteCategoryInput!
    $condition: ModelCategoryConditionInput
  ) {
    deleteCategory(input: $input, condition: $condition) {
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
export const createAnnotationSet = /* GraphQL */ `
  mutation CreateAnnotationSet(
    $input: CreateAnnotationSetInput!
    $condition: ModelAnnotationSetConditionInput
  ) {
    createAnnotationSet(input: $input, condition: $condition) {
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
export const updateAnnotationSet = /* GraphQL */ `
  mutation UpdateAnnotationSet(
    $input: UpdateAnnotationSetInput!
    $condition: ModelAnnotationSetConditionInput
  ) {
    updateAnnotationSet(input: $input, condition: $condition) {
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
export const deleteAnnotationSet = /* GraphQL */ `
  mutation DeleteAnnotationSet(
    $input: DeleteAnnotationSetInput!
    $condition: ModelAnnotationSetConditionInput
  ) {
    deleteAnnotationSet(input: $input, condition: $condition) {
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
export const createAnnotation = /* GraphQL */ `
  mutation CreateAnnotation(
    $input: CreateAnnotationInput!
    $condition: ModelAnnotationConditionInput
  ) {
    createAnnotation(input: $input, condition: $condition) {
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
export const updateAnnotation = /* GraphQL */ `
  mutation UpdateAnnotation(
    $input: UpdateAnnotationInput!
    $condition: ModelAnnotationConditionInput
  ) {
    updateAnnotation(input: $input, condition: $condition) {
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
export const deleteAnnotation = /* GraphQL */ `
  mutation DeleteAnnotation(
    $input: DeleteAnnotationInput!
    $condition: ModelAnnotationConditionInput
  ) {
    deleteAnnotation(input: $input, condition: $condition) {
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
export const createObject = /* GraphQL */ `
  mutation CreateObject(
    $input: CreateObjectInput!
    $condition: ModelObjectConditionInput
  ) {
    createObject(input: $input, condition: $condition) {
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
export const updateObject = /* GraphQL */ `
  mutation UpdateObject(
    $input: UpdateObjectInput!
    $condition: ModelObjectConditionInput
  ) {
    updateObject(input: $input, condition: $condition) {
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
export const deleteObject = /* GraphQL */ `
  mutation DeleteObject(
    $input: DeleteObjectInput!
    $condition: ModelObjectConditionInput
  ) {
    deleteObject(input: $input, condition: $condition) {
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
export const createImage = /* GraphQL */ `
  mutation CreateImage(
    $input: CreateImageInput!
    $condition: ModelImageConditionInput
  ) {
    createImage(input: $input, condition: $condition) {
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
export const updateImage = /* GraphQL */ `
  mutation UpdateImage(
    $input: UpdateImageInput!
    $condition: ModelImageConditionInput
  ) {
    updateImage(input: $input, condition: $condition) {
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
export const deleteImage = /* GraphQL */ `
  mutation DeleteImage(
    $input: DeleteImageInput!
    $condition: ModelImageConditionInput
  ) {
    deleteImage(input: $input, condition: $condition) {
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
export const createImageNeighbour = /* GraphQL */ `
  mutation CreateImageNeighbour(
    $input: CreateImageNeighbourInput!
    $condition: ModelImageNeighbourConditionInput
  ) {
    createImageNeighbour(input: $input, condition: $condition) {
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
export const updateImageNeighbour = /* GraphQL */ `
  mutation UpdateImageNeighbour(
    $input: UpdateImageNeighbourInput!
    $condition: ModelImageNeighbourConditionInput
  ) {
    updateImageNeighbour(input: $input, condition: $condition) {
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
export const deleteImageNeighbour = /* GraphQL */ `
  mutation DeleteImageNeighbour(
    $input: DeleteImageNeighbourInput!
    $condition: ModelImageNeighbourConditionInput
  ) {
    deleteImageNeighbour(input: $input, condition: $condition) {
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
export const createImageSet = /* GraphQL */ `
  mutation CreateImageSet(
    $input: CreateImageSetInput!
    $condition: ModelImageSetConditionInput
  ) {
    createImageSet(input: $input, condition: $condition) {
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
export const updateImageSet = /* GraphQL */ `
  mutation UpdateImageSet(
    $input: UpdateImageSetInput!
    $condition: ModelImageSetConditionInput
  ) {
    updateImageSet(input: $input, condition: $condition) {
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
export const deleteImageSet = /* GraphQL */ `
  mutation DeleteImageSet(
    $input: DeleteImageSetInput!
    $condition: ModelImageSetConditionInput
  ) {
    deleteImageSet(input: $input, condition: $condition) {
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
export const createLocationSet = /* GraphQL */ `
  mutation CreateLocationSet(
    $input: CreateLocationSetInput!
    $condition: ModelLocationSetConditionInput
  ) {
    createLocationSet(input: $input, condition: $condition) {
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
export const updateLocationSet = /* GraphQL */ `
  mutation UpdateLocationSet(
    $input: UpdateLocationSetInput!
    $condition: ModelLocationSetConditionInput
  ) {
    updateLocationSet(input: $input, condition: $condition) {
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
export const deleteLocationSet = /* GraphQL */ `
  mutation DeleteLocationSet(
    $input: DeleteLocationSetInput!
    $condition: ModelLocationSetConditionInput
  ) {
    deleteLocationSet(input: $input, condition: $condition) {
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
export const createLocation = /* GraphQL */ `
  mutation CreateLocation(
    $input: CreateLocationInput!
    $condition: ModelLocationConditionInput
  ) {
    createLocation(input: $input, condition: $condition) {
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
export const updateLocation = /* GraphQL */ `
  mutation UpdateLocation(
    $input: UpdateLocationInput!
    $condition: ModelLocationConditionInput
  ) {
    updateLocation(input: $input, condition: $condition) {
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
export const deleteLocation = /* GraphQL */ `
  mutation DeleteLocation(
    $input: DeleteLocationInput!
    $condition: ModelLocationConditionInput
  ) {
    deleteLocation(input: $input, condition: $condition) {
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
export const createObservation = /* GraphQL */ `
  mutation CreateObservation(
    $input: CreateObservationInput!
    $condition: ModelObservationConditionInput
  ) {
    createObservation(input: $input, condition: $condition) {
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
export const updateObservation = /* GraphQL */ `
  mutation UpdateObservation(
    $input: UpdateObservationInput!
    $condition: ModelObservationConditionInput
  ) {
    updateObservation(input: $input, condition: $condition) {
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
export const deleteObservation = /* GraphQL */ `
  mutation DeleteObservation(
    $input: DeleteObservationInput!
    $condition: ModelObservationConditionInput
  ) {
    deleteObservation(input: $input, condition: $condition) {
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
export const createImageSetMembership = /* GraphQL */ `
  mutation CreateImageSetMembership(
    $input: CreateImageSetMembershipInput!
    $condition: ModelImageSetMembershipConditionInput
  ) {
    createImageSetMembership(input: $input, condition: $condition) {
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
export const updateImageSetMembership = /* GraphQL */ `
  mutation UpdateImageSetMembership(
    $input: UpdateImageSetMembershipInput!
    $condition: ModelImageSetMembershipConditionInput
  ) {
    updateImageSetMembership(input: $input, condition: $condition) {
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
export const deleteImageSetMembership = /* GraphQL */ `
  mutation DeleteImageSetMembership(
    $input: DeleteImageSetMembershipInput!
    $condition: ModelImageSetMembershipConditionInput
  ) {
    deleteImageSetMembership(input: $input, condition: $condition) {
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
