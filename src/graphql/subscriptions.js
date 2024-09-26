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
export const onUpdateProject = /* GraphQL */ `
  subscription OnUpdateProject($filter: ModelSubscriptionProjectFilterInput) {
    onUpdateProject(filter: $filter) {
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
export const onDeleteProject = /* GraphQL */ `
  subscription OnDeleteProject($filter: ModelSubscriptionProjectFilterInput) {
    onDeleteProject(filter: $filter) {
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
export const onCreateUser = /* GraphQL */ `
  subscription OnCreateUser($filter: ModelSubscriptionUserFilterInput) {
    onCreateUser(filter: $filter) {
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
export const onUpdateUser = /* GraphQL */ `
  subscription OnUpdateUser($filter: ModelSubscriptionUserFilterInput) {
    onUpdateUser(filter: $filter) {
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
export const onDeleteUser = /* GraphQL */ `
  subscription OnDeleteUser($filter: ModelSubscriptionUserFilterInput) {
    onDeleteUser(filter: $filter) {
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
export const onCreateUserProjectMembership = /* GraphQL */ `
  subscription OnCreateUserProjectMembership(
    $filter: ModelSubscriptionUserProjectMembershipFilterInput
  ) {
    onCreateUserProjectMembership(filter: $filter) {
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
export const onUpdateUserProjectMembership = /* GraphQL */ `
  subscription OnUpdateUserProjectMembership(
    $filter: ModelSubscriptionUserProjectMembershipFilterInput
  ) {
    onUpdateUserProjectMembership(filter: $filter) {
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
export const onDeleteUserProjectMembership = /* GraphQL */ `
  subscription OnDeleteUserProjectMembership(
    $filter: ModelSubscriptionUserProjectMembershipFilterInput
  ) {
    onDeleteUserProjectMembership(filter: $filter) {
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
export const onCreateQueue = /* GraphQL */ `
  subscription OnCreateQueue($filter: ModelSubscriptionQueueFilterInput) {
    onCreateQueue(filter: $filter) {
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
export const onUpdateQueue = /* GraphQL */ `
  subscription OnUpdateQueue($filter: ModelSubscriptionQueueFilterInput) {
    onUpdateQueue(filter: $filter) {
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
export const onDeleteQueue = /* GraphQL */ `
  subscription OnDeleteQueue($filter: ModelSubscriptionQueueFilterInput) {
    onDeleteQueue(filter: $filter) {
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
export const onCreateCategory = /* GraphQL */ `
  subscription OnCreateCategory($filter: ModelSubscriptionCategoryFilterInput) {
    onCreateCategory(filter: $filter) {
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
export const onUpdateCategory = /* GraphQL */ `
  subscription OnUpdateCategory($filter: ModelSubscriptionCategoryFilterInput) {
    onUpdateCategory(filter: $filter) {
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
export const onDeleteCategory = /* GraphQL */ `
  subscription OnDeleteCategory($filter: ModelSubscriptionCategoryFilterInput) {
    onDeleteCategory(filter: $filter) {
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
export const onCreateAnnotationSet = /* GraphQL */ `
  subscription OnCreateAnnotationSet(
    $filter: ModelSubscriptionAnnotationSetFilterInput
  ) {
    onCreateAnnotationSet(filter: $filter) {
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
export const onUpdateAnnotationSet = /* GraphQL */ `
  subscription OnUpdateAnnotationSet(
    $filter: ModelSubscriptionAnnotationSetFilterInput
  ) {
    onUpdateAnnotationSet(filter: $filter) {
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
export const onDeleteAnnotationSet = /* GraphQL */ `
  subscription OnDeleteAnnotationSet(
    $filter: ModelSubscriptionAnnotationSetFilterInput
  ) {
    onDeleteAnnotationSet(filter: $filter) {
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
export const onCreateAnnotation = /* GraphQL */ `
  subscription OnCreateAnnotation(
    $filter: ModelSubscriptionAnnotationFilterInput
  ) {
    onCreateAnnotation(filter: $filter) {
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
export const onUpdateAnnotation = /* GraphQL */ `
  subscription OnUpdateAnnotation(
    $filter: ModelSubscriptionAnnotationFilterInput
  ) {
    onUpdateAnnotation(filter: $filter) {
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
export const onDeleteAnnotation = /* GraphQL */ `
  subscription OnDeleteAnnotation(
    $filter: ModelSubscriptionAnnotationFilterInput
  ) {
    onDeleteAnnotation(filter: $filter) {
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
export const onCreateObject = /* GraphQL */ `
  subscription OnCreateObject($filter: ModelSubscriptionObjectFilterInput) {
    onCreateObject(filter: $filter) {
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
export const onUpdateObject = /* GraphQL */ `
  subscription OnUpdateObject($filter: ModelSubscriptionObjectFilterInput) {
    onUpdateObject(filter: $filter) {
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
export const onDeleteObject = /* GraphQL */ `
  subscription OnDeleteObject($filter: ModelSubscriptionObjectFilterInput) {
    onDeleteObject(filter: $filter) {
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
export const onCreateImage = /* GraphQL */ `
  subscription OnCreateImage($filter: ModelSubscriptionImageFilterInput) {
    onCreateImage(filter: $filter) {
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
export const onUpdateImage = /* GraphQL */ `
  subscription OnUpdateImage($filter: ModelSubscriptionImageFilterInput) {
    onUpdateImage(filter: $filter) {
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
export const onDeleteImage = /* GraphQL */ `
  subscription OnDeleteImage($filter: ModelSubscriptionImageFilterInput) {
    onDeleteImage(filter: $filter) {
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
export const onCreateImageNeighbour = /* GraphQL */ `
  subscription OnCreateImageNeighbour(
    $filter: ModelSubscriptionImageNeighbourFilterInput
  ) {
    onCreateImageNeighbour(filter: $filter) {
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
export const onUpdateImageNeighbour = /* GraphQL */ `
  subscription OnUpdateImageNeighbour(
    $filter: ModelSubscriptionImageNeighbourFilterInput
  ) {
    onUpdateImageNeighbour(filter: $filter) {
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
export const onDeleteImageNeighbour = /* GraphQL */ `
  subscription OnDeleteImageNeighbour(
    $filter: ModelSubscriptionImageNeighbourFilterInput
  ) {
    onDeleteImageNeighbour(filter: $filter) {
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
export const onCreateImageSet = /* GraphQL */ `
  subscription OnCreateImageSet($filter: ModelSubscriptionImageSetFilterInput) {
    onCreateImageSet(filter: $filter) {
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
export const onUpdateImageSet = /* GraphQL */ `
  subscription OnUpdateImageSet($filter: ModelSubscriptionImageSetFilterInput) {
    onUpdateImageSet(filter: $filter) {
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
export const onDeleteImageSet = /* GraphQL */ `
  subscription OnDeleteImageSet($filter: ModelSubscriptionImageSetFilterInput) {
    onDeleteImageSet(filter: $filter) {
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
export const onCreateLocationSet = /* GraphQL */ `
  subscription OnCreateLocationSet(
    $filter: ModelSubscriptionLocationSetFilterInput
  ) {
    onCreateLocationSet(filter: $filter) {
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
export const onUpdateLocationSet = /* GraphQL */ `
  subscription OnUpdateLocationSet(
    $filter: ModelSubscriptionLocationSetFilterInput
  ) {
    onUpdateLocationSet(filter: $filter) {
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
export const onDeleteLocationSet = /* GraphQL */ `
  subscription OnDeleteLocationSet(
    $filter: ModelSubscriptionLocationSetFilterInput
  ) {
    onDeleteLocationSet(filter: $filter) {
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
export const onCreateLocation = /* GraphQL */ `
  subscription OnCreateLocation($filter: ModelSubscriptionLocationFilterInput) {
    onCreateLocation(filter: $filter) {
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
export const onUpdateLocation = /* GraphQL */ `
  subscription OnUpdateLocation($filter: ModelSubscriptionLocationFilterInput) {
    onUpdateLocation(filter: $filter) {
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
export const onDeleteLocation = /* GraphQL */ `
  subscription OnDeleteLocation($filter: ModelSubscriptionLocationFilterInput) {
    onDeleteLocation(filter: $filter) {
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
export const onCreateObservation = /* GraphQL */ `
  subscription OnCreateObservation(
    $filter: ModelSubscriptionObservationFilterInput
  ) {
    onCreateObservation(filter: $filter) {
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
export const onUpdateObservation = /* GraphQL */ `
  subscription OnUpdateObservation(
    $filter: ModelSubscriptionObservationFilterInput
  ) {
    onUpdateObservation(filter: $filter) {
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
export const onDeleteObservation = /* GraphQL */ `
  subscription OnDeleteObservation(
    $filter: ModelSubscriptionObservationFilterInput
  ) {
    onDeleteObservation(filter: $filter) {
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
export const onCreateImageSetMembership = /* GraphQL */ `
  subscription OnCreateImageSetMembership(
    $filter: ModelSubscriptionImageSetMembershipFilterInput
  ) {
    onCreateImageSetMembership(filter: $filter) {
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
export const onUpdateImageSetMembership = /* GraphQL */ `
  subscription OnUpdateImageSetMembership(
    $filter: ModelSubscriptionImageSetMembershipFilterInput
  ) {
    onUpdateImageSetMembership(filter: $filter) {
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
export const onDeleteImageSetMembership = /* GraphQL */ `
  subscription OnDeleteImageSetMembership(
    $filter: ModelSubscriptionImageSetMembershipFilterInput
  ) {
    onDeleteImageSetMembership(filter: $filter) {
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
