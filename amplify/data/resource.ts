import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { addUserToGroup } from '../functions/add-user-to-group/resource';
import { createGroup } from '../data/create-group/resource';
import { listUsers } from '../data/list-users/resource';
import { listGroupsForUser } from '../data/list-groups-for-user/resource';
import { processImages } from '../functions/processImages/resource';
import { updateUserStats } from '../functions/updateUserStats/resource';
import { monitorModelProgress } from '../functions/monitorModelProgress/resource';
import { updateProjectMemberships } from '../functions/updateProjectMemberships/resource';
import { cleanupJobs } from '../functions/cleanupJobs/resource';
import { runImageRegistration } from '../functions/runImageRegistration/resource';
import { runScoutbot } from '../functions/runScoutbot/resource';
import { runHeatmapper } from '../functions/runHeatmapper/resource';
import { runPointFinder } from '../functions/runPointFinder/resource';
import { deleteProject } from '../functions/deleteProject/resource';
import { generateSurveyResults } from '../functions/generateSurveyResults/resource';
import { getJwtSecret } from '../functions/getJwtSecret/resource';
import { runMadDetector } from '../functions/runMadDetector/resource';
// import { consolidateUserStats } from '../functions/consolidateUserStats/resource';

const schema = a
  .schema({
    UserType: a.customType({
      name: a.string(),
      id: a.id().required(),
      email: a.string(),
      isAdmin: a.boolean(),
    }),
    Project: a
      .model({
        organizationId: a.id().required(),
        organization: a.belongsTo('Organization', 'organizationId'),
        name: a.string().required(),
        images: a.hasMany('Image', 'projectId'),
        imageFiles: a.hasMany('ImageFile', 'projectId'),
        annotations: a.hasMany('Annotation', 'projectId'),
        objects: a.hasMany('Object', 'projectId'),
        imageSets: a.hasMany('ImageSet', 'projectId'),
        annotationSets: a.hasMany('AnnotationSet', 'projectId'),
        locations: a.hasMany('Location', 'projectId'),
        locationSets: a.hasMany('LocationSet', 'projectId'),
        observations: a.hasMany('Observation', 'projectId'),
        members: a.hasMany('UserProjectMembership', 'projectId'),
        queues: a.hasMany('Queue', 'projectId'),
        shapefile: a.hasOne('Shapefile', 'projectId'),
        testConfig: a.hasOne('ProjectTestConfig', 'projectId'),
        testResults: a.hasMany('TestResult', 'projectId'),
        createdBy: a.string().required(),
        hidden: a.boolean().default(false),
        status: a.string().default('active'),
        cameras: a.hasMany('Camera', 'projectId'),
        transects: a.hasMany('Transect', 'projectId'),
        strata: a.hasMany('Stratum', 'projectId'),
        jollyResultsMemberships: a.hasMany(
          'JollyResultsMembership',
          'surveyId'
        ),
        cameraOverlaps: a.hasMany('CameraOverlap', 'projectId'),
        shapefileExclusions: a.hasMany('ShapefileExclusions', 'projectId'),
      })
      .authorization((allow) => [allow.authenticated()]),
    // .authorization(allow => [allow.groupDefinedIn('id').to(['read']),
    // allow.group('orgadmin').to(['create', 'update', 'delete', 'read']),
    // allow.custom()]),
    Category: a
      .model({
        projectId: a.id().required(),
        annotationSetId: a.id().required(),
        annotationSet: a.belongsTo('AnnotationSet', 'annotationSetId'),
        name: a.string().required(),
        color: a.string(),
        shortcutKey: a.string(),
        annotations: a.hasMany('Annotation', 'categoryId'),
        annotationCount: a.integer().default(0),
        objects: a.hasMany('Object', 'categoryId'),
        locationAnnotationCounts: a.hasMany(
          'LocationAnnotationCount',
          'categoryId'
        ),
      })
      .authorization((allow) => [allow.authenticated()])
      // .authorization(allow => [allow.groupDefinedIn('projectId')])
      .secondaryIndexes((index) => [
        index('annotationSetId').queryField('categoriesByAnnotationSetId'),
        index('projectId').queryField('categoriesByProjectId'),
      ]),
    Image: a
      .model({
        projectId: a.id().required(),
        project: a.belongsTo('Project', 'projectId'),
        latitude: a.float(),
        longitude: a.float(),
        altitude_wgs84: a.float(),
        altitude_agl: a.float(),
        altitude_egm96: a.float(),
        width: a.integer().required(),
        height: a.integer().required(),
        roll: a.float(),
        yaw: a.float(),
        pitch: a.float(),
        originalPath: a.string(),
        timestamp: a.timestamp(),
        exifData: a.string(),
        cameraSerial: a.string(),
        files: a.hasMany('ImageFile', 'imageId'),
        locations: a.hasMany('Location', 'imageId'),
        annotations: a.hasMany('Annotation', 'imageId'),
        memberships: a.hasMany('ImageSetMembership', 'imageId'),
        leftNeighbours: a.hasMany('ImageNeighbour', 'image1Id'),
        rightNeighbours: a.hasMany('ImageNeighbour', 'image2Id'),
        cameraId: a.id(),
        camera: a.belongsTo('Camera', 'cameraId'),
        transectId: a.id(),
        transect: a.belongsTo('Transect', 'transectId'),
        // sets: [ImageSet] @manyToMany(relationName: "ImageSetMembership")
        //   leftNeighbours: [ImageNeighbour] @hasMany(indexName:"bySecondNeighbour",fields:["key"])
        //   rightNeighbours: [ImageNeighbour] @hasMany(indexName:"byFirstNeighbour",fields:["key"])
      })
      .authorization((allow) => [allow.authenticated()])
      .secondaryIndexes((index) => [
        index('projectId').queryField('imagesByProjectId'),
      ]),
    // .authorization(allow => [allow.groupDefinedIn('projectId')]),
    ImageFile: a
      .model({
        projectId: a.id().required(),
        project: a.belongsTo('Project', 'projectId'),
        path: a.string().required(),
        imageId: a.id(),
        key: a.string().required(),
        image: a.belongsTo('Image', 'imageId'),
        type: a.string().required(),
        // Add this line to define the reverse relationship
        // .authorization(allow => [allow.groupDefinedIn('projectId')])
      })
      .authorization((allow) => [allow.authenticated()])
      .secondaryIndexes((index) => [
        index('imageId').queryField('imagesByimageId'),
        index('path').queryField('imagesByPath'),
      ]),
    AnnotationSet: a
      .model({
        projectId: a.id().required(),
        project: a.belongsTo('Project', 'projectId'),
        name: a.string().required(),
        annotations: a.hasMany('Annotation', 'setId'),
        annotationCount: a.integer().default(0),
        observations: a.hasMany('Observation', 'annotationSetId'),
        tasks: a.hasMany('TasksOnAnnotationSet', 'annotationSetId'),
        testPresetLocations: a.hasMany('TestPresetLocation', 'annotationSetId'),
        locationAnnotationCounts: a.hasMany(
          'LocationAnnotationCount',
          'annotationSetId'
        ),
        testResults: a.hasMany('TestResult', 'annotationSetId'),
        categories: a.hasMany('Category', 'annotationSetId'),
        register: a.boolean().default(false),
        jollyResultsMemberships: a.hasMany(
          'JollyResultsMembership',
          'annotationSetId'
        ),
      })
      .authorization((allow) => [allow.authenticated()])
      // .authorization(allow => [allow.groupDefinedIn('projectId')])
      .secondaryIndexes((index) => [
        index('projectId').queryField('annotationSetsByProjectId'),
      ]),
    Annotation: a
      .model({
        projectId: a.id().required(),
        project: a.belongsTo('Project', 'projectId'),
        setId: a.id().required(),
        set: a.belongsTo('AnnotationSet', 'setId'),
        source: a.string().required(),
        categoryId: a.id().required(),
        category: a.belongsTo('Category', 'categoryId'),
        imageId: a.id().required(),
        image: a.belongsTo('Image', 'imageId'),
        x: a.integer().required(),
        y: a.integer().required(),
        obscured: a.boolean(),
        objectId: a.id(),
        object: a.belongsTo('Object', 'objectId'),
      })
      .authorization((allow) => [allow.authenticated(), allow.owner()])
      .secondaryIndexes((index) => [
        index('setId').queryField('annotationsByAnnotationSetId'),
        index('imageId')
          .sortKeys(['setId'])
          .queryField('annotationsByImageIdAndSetId'),
        index('objectId').queryField('annotationsByObjectId'),
        index('categoryId').queryField('annotationsByCategoryId'),
      ]),
    LocationAnnotationCount: a
      .model({
        locationId: a.id().required(),
        location: a.belongsTo('Location', 'locationId'),
        categoryId: a.id().required(),
        category: a.belongsTo('Category', 'categoryId'),
        annotationSetId: a.id().required(),
        annotationSet: a.belongsTo('AnnotationSet', 'annotationSetId'),
        count: a.integer().default(0),
      })
      .identifier(['locationId', 'categoryId', 'annotationSetId'])
      .authorization((allow) => [allow.authenticated()])
      .secondaryIndexes((index) => [
        index('locationId')
          .sortKeys(['annotationSetId'])
          .queryField('categoryCountsByLocationIdAndAnnotationSetId'),
      ]),
    Object: a
      .model({
        projectId: a.id().required(),
        project: a.belongsTo('Project', 'projectId'),
        annotations: a.hasMany('Annotation', 'objectId'),
        categoryId: a.id().required(),
        category: a.belongsTo('Category', 'categoryId'),
      })
      .authorization((allow) => [allow.authenticated()])
      // .authorization(allow => [allow.groupDefinedIn('projectId')])
      .secondaryIndexes((index) => [
        index('categoryId').queryField('objectsByCategoryId'),
      ]),
    Location: a
      .model({
        projectId: a.id().required(),
        project: a.belongsTo('Project', 'projectId'),
        imageId: a.id(),
        image: a.belongsTo('Image', 'imageId'),
        setId: a.id().required(),
        set: a.belongsTo('LocationSet', 'setId'),
        height: a.integer(),
        width: a.integer(),
        x: a.integer().required(),
        y: a.integer().required(),
        source: a.string().required(),
        confidence: a.float(),
        observations: a.hasMany('Observation', 'locationId'),
        sets: a.hasMany('LocationSetMembership', 'locationId'),
        testPresets: a.hasMany('TestPresetLocation', 'locationId'),
        annotationCounts: a.hasMany('LocationAnnotationCount', 'locationId'),
        testResults: a.hasMany('TestResult', 'locationId'),
      })
      .authorization((allow) => [allow.authenticated()])
      // .authorization(allow => [allow.groupDefinedIn('projectId')])

      .secondaryIndexes((index) => [
        index('imageId')
          .sortKeys(['confidence'])
          .queryField('locationsByImageKey'),
        index('setId')
          .sortKeys(['confidence'])
          .queryField('locationsBySetIdAndConfidence'),
        index('projectId')
          .sortKeys(['source'])
          .queryField('locationsByProjectIdAndSource'),
      ]),
    Observation: a
      .model({
        projectId: a.id().required(),
        owner: a.string(),
        project: a.belongsTo('Project', 'projectId'),
        timeTaken: a.float(),
        annotationCount: a.integer(),
        waitingTime: a.float(),
        loadingTime: a.float(),
        locationId: a.id().required(),
        location: a.belongsTo('Location', 'locationId'),
        annotationSetId: a.id().required(),
        annotationSet: a.belongsTo('AnnotationSet', 'annotationSetId'),
        createdAt: a.string().required(),
      })
      .authorization((allow) => [allow.authenticated(), allow.owner()])
      .secondaryIndexes((index) => [
        index('locationId').queryField('observationsByLocationId'),
        index('annotationSetId')
          .sortKeys(['createdAt'])
          .queryField('observationsByAnnotationSetId'),
        index('owner').queryField('observationsByOwner'),
      ]),
    LocationSet: a
      .model({
        projectId: a.id().required(),
        name: a.string().required(),
        project: a.belongsTo('Project', 'projectId'),
        locations: a.hasMany('Location', 'setId'),
        memberships: a.hasMany('LocationSetMembership', 'locationSetId'),
        locationCount: a.integer().default(0),
        tasks: a.hasMany('TasksOnAnnotationSet', 'locationSetId'),
      })
      .authorization((allow) => [allow.authenticated()])
      // .authorization(allow => [allow.groupDefinedIn('projectId')])
      .secondaryIndexes((index) => [
        index('projectId').queryField('locationSetsByProjectId'),
      ]),
    LocationSetMembership: a
      .model({
        locationId: a.id().required(),
        locationSetId: a.id().required(),
        location: a.belongsTo('Location', 'locationId'),
        locationSet: a.belongsTo('LocationSet', 'locationSetId'),
      })
      .authorization((allow) => [allow.authenticated()]),
    ImageSetMembership: a
      .model({
        imageId: a.id().required(),
        imageSetId: a.id().required(),
        image: a.belongsTo('Image', 'imageId'),
        imageSet: a.belongsTo('ImageSet', 'imageSetId'),
      })
      .authorization((allow) => [allow.authenticated()])
      .secondaryIndexes((index) => [
        index('imageSetId').queryField('imageSetMembershipsByImageSetId'),
      ]),
    ImageSet: a
      .model({
        projectId: a.id().required(),
        project: a.belongsTo('Project', 'projectId'),
        name: a.string().required(),
        images: a.hasMany('ImageSetMembership', 'imageSetId'),
        imageCount: a.integer().default(0),
      })
      .authorization((allow) => [allow.authenticated()])
      //.authorization(allow => [allow.groupDefinedIn('projectId')])
      .secondaryIndexes((index) => [
        index('projectId').queryField('imageSetsByProjectId'),
      ]),
    UserProjectMembership: a
      .model({
        userId: a.string().required(),
        projectId: a.id().required(),
        project: a.belongsTo('Project', 'projectId'),
        isAdmin: a.boolean(),
        queueId: a.id(),
        queue: a.belongsTo('Queue', 'queueId'),
        backupQueueId: a.id(),
        backupQueue: a.belongsTo('Queue', 'backupQueueId'),
      })
      .authorization((allow) => [allow.authenticated()])
      //.authorization(allow => [allow.groupDefinedIn('projectId'), allow.group('orgadmin')])
      .secondaryIndexes((index) => [
        index('projectId').queryField('userProjectMembershipsByProjectId'),
        index('userId').queryField('userProjectMembershipsByUserId'),
        // index('queueId')  .queryField('userProjectMembershipsByQueueId')
      ]),
    //   type ImageNeighbour
    //   @model
    //   @auth(
    //   rules: [
    //     {allow: public, provider: iam},
    //     {allow: private, provider: iam},
    //     { allow: groups, groups: ["admin"] }
    //   ])
    // {
    //  image1key: String! @index(name:"byFirstNeighbour")
    //  image1: Image @belongsTo (fields: ["image1key"])
    //  image2key: String! @index(name:"bySecondNeighbour")
    //  image2: Image @belongsTo (fields: ["image2key"])
    //  homography: [Float]
    // }
    ImageNeighbour: a
      .model({
        image1Id: a.id().required(),
        image1: a.belongsTo('Image', 'image1Id'),
        image2Id: a.id().required(),
        image2: a.belongsTo('Image', 'image2Id'),
        homography: a.float().array(),
      })
      .authorization((allow) => [allow.authenticated()])
      .identifier(['image1Id', 'image2Id'])
      .secondaryIndexes((index) => [
        index('image1Id').queryField('imageNeighboursByImage1key'),
        index('image2Id').queryField('imageNeighboursByImage2key'),
      ]),
    Queue: a
      .model({
        projectId: a.id().required(),
        project: a.belongsTo('Project', 'projectId'),
        name: a.string().required(),
        users: a.hasMany('UserProjectMembership', 'queueId'),
        batchSize: a.integer().default(0),
        totalBatches: a.integer().default(0),
        backupUsers: a.hasMany('UserProjectMembership', 'backupQueueId'),
        url: a.url(),
        zoom: a.integer(),
        hidden: a.boolean().default(false),
        // used in conjuction with the cleanupJobs function (every 15m) to determine if the queue is still active
        approximateSize: a.integer(),
        tag: a.string(),
      })
      .authorization((allow) => [allow.authenticated()])
      //.authorization(allow => [allow.groupDefinedIn('projectId')])
      .secondaryIndexes((index) => [
        index('projectId').queryField('queuesByProjectId'),
      ]),
    UserStats: a
      .model({
        projectId: a.id().required(),
        setId: a.id().required(),
        date: a.date().required(),
        userId: a.id().required(),
        observationCount: a.integer().required(),
        sightingCount: a.integer(),
        annotationTime: a.float(),
        annotationCount: a.integer().required(),
        activeTime: a.float().required(),
        searchTime: a.float(),
        searchCount: a.integer(),
        waitingTime: a.float(),
      })
      .identifier(['projectId', 'userId', 'date', 'setId'])
      .authorization((allow) => [allow.authenticated(), allow.publicApiKey()]),
    TasksOnAnnotationSet: a
      .model({
        annotationSetId: a.id().required(),
        annotationSet: a.belongsTo('AnnotationSet', 'annotationSetId'),
        locationSetId: a.id().required(),
        locationSet: a.belongsTo('LocationSet', 'locationSetId'),
      })
      .authorization((allow) => [allow.authenticated()])
      .secondaryIndexes((index) => [
        index('annotationSetId').queryField('locationSetsByAnnotationSetId'),
      ]),
    ProjectTestConfig: a
      .model({
        projectId: a.id().required(),
        project: a.belongsTo('Project', 'projectId'),
        testType: a.string(),
        random: a.float(),
        interval: a.float(),
        deadzone: a.float(),
        postTestConfirmation: a.boolean(),
        accuracy: a.integer().required(),
        testPresetProjects: a.hasMany('TestPresetProject', 'projectId'),
      })
      .authorization((allow) => [allow.authenticated()])
      .identifier(['projectId']),
    TestPresetProject: a
      .model({
        testPresetId: a.id().required(),
        testPreset: a.belongsTo('TestPreset', 'testPresetId'),
        projectId: a.id().required(),
        projectConfig: a.belongsTo('ProjectTestConfig', 'projectId'),
      })
      .authorization((allow) => [allow.authenticated()])
      .identifier(['testPresetId', 'projectId'])
      .secondaryIndexes((index) => [
        index('projectId').queryField('testPresetsByProjectId'),
      ]),
    TestPreset: a
      .model({
        organizationId: a.id().required(),
        organization: a.belongsTo('Organization', 'organizationId'),
        name: a.string().required(),
        locations: a.hasMany('TestPresetLocation', 'testPresetId'),
        projects: a.hasMany('TestPresetProject', 'testPresetId'),
        testResults: a.hasMany('TestResult', 'testPresetId'),
      })
      .authorization((allow) => [allow.authenticated()])
      .secondaryIndexes((index) => [
        index('organizationId').queryField('testPresetsByOrganizationId'),
        index('name').queryField('testPresetsByName'),
      ]),
    TestPresetLocation: a
      .model({
        testPresetId: a.id().required(),
        testPreset: a.belongsTo('TestPreset', 'testPresetId'),
        locationId: a.id().required(),
        location: a.belongsTo('Location', 'locationId'),
        annotationSetId: a.id().required(),
        annotationSet: a.belongsTo('AnnotationSet', 'annotationSetId'),
      })
      .authorization((allow) => [allow.authenticated()])
      .identifier(['testPresetId', 'locationId', 'annotationSetId'])
      .secondaryIndexes((index) => [
        index('testPresetId').queryField('locationsByTestPresetId'),
        index('locationId').queryField('testPresetsByLocationId'),
      ]),
    TestResult: a
      .model({
        userId: a.id().required(),
        projectId: a.id().required(),
        project: a.belongsTo('Project', 'projectId'),
        testPresetId: a.id().required(),
        testPreset: a.belongsTo('TestPreset', 'testPresetId'),
        locationId: a.id().required(),
        location: a.belongsTo('Location', 'locationId'),
        annotationSetId: a.id().required(),
        annotationSet: a.belongsTo('AnnotationSet', 'annotationSetId'),
        testAnimals: a.integer().required(),
        totalMissedAnimals: a.integer().required(),
        passedOnTotal: a.boolean().required(),
        categoryCounts: a.hasMany('TestResultCategoryCount', 'testResultId'),
      })
      .authorization((allow) => [allow.authenticated()])
      .secondaryIndexes((index) => [
        index('userId').queryField('testResultsByUserId'),
        index('testPresetId').queryField('testResultsByTestPresetId'),
      ]),
    TestResultCategoryCount: a
      .model({
        testResultId: a.id().required(),
        testResult: a.belongsTo('TestResult', 'testResultId'),
        categoryName: a.string().required(),
        userCount: a.integer().required(),
        testCount: a.integer().required(),
      })
      .authorization((allow) => [allow.authenticated()])
      .identifier(['testResultId', 'categoryName'])
      .secondaryIndexes((index) => [
        index('testResultId').queryField('categoryCountsByTestResultId'),
      ]),
    Shapefile: a
      .model({
        projectId: a.id().required(),
        project: a.belongsTo('Project', 'projectId'),
        //stores shape as poylgon to use with leaflet
        coordinates: a.float().array(),
      })
      .authorization((allow) => [allow.authenticated()])
      .secondaryIndexes((index) => [
        index('projectId').queryField('shapefilesByProjectId'),
      ]),

    ShapefileExclusions: a
      .model({
        projectId: a.id().required(),
        project: a.belongsTo('Project', 'projectId'),
        // stores exclusion polygons as flattened lat,lng pairs
        coordinates: a.float().array(),
      })
      .authorization((allow) => [allow.authenticated()])
      .secondaryIndexes((index) => [
        index('projectId').queryField('shapefileExclusionsByProjectId'),
      ]),
    Camera: a
      .model({
        projectId: a.id().required(),
        project: a.belongsTo('Project', 'projectId'),
        name: a.string().required(),
        focalLengthMm: a.float(),
        sensorWidthMm: a.float(),
        tiltDegrees: a.float(),
        images: a.hasMany('Image', 'cameraId'),
      })
      .authorization((allow) => [allow.authenticated()])
      .secondaryIndexes((index) => [
        index('projectId').queryField('camerasByProjectId'),
      ]),
    CameraOverlap: a
      .model({
        projectId: a.id().required(),
        project: a.belongsTo('Project', 'projectId'),
        cameraAId: a.id().required(),
        cameraBId: a.id().required(),
      })
      .authorization((allow) => [allow.authenticated()])
      .identifier(['cameraAId', 'cameraBId'])
      .secondaryIndexes((index) => [
        index('projectId').queryField('cameraOverlapsByProjectId'),
      ]),
    Transect: a
      .model({
        projectId: a.id().required(),
        project: a.belongsTo('Project', 'projectId'),
        stratumId: a.id().required(),
        stratum: a.belongsTo('Stratum', 'stratumId'),
        images: a.hasMany('Image', 'transectId'),
      })
      .authorization((allow) => [allow.authenticated()])
      .secondaryIndexes((index) => [
        index('projectId').queryField('transectsByProjectId'),
      ]),
    Stratum: a
      .model({
        projectId: a.id().required(),
        project: a.belongsTo('Project', 'projectId'),
        name: a.string().required(),
        transects: a.hasMany('Transect', 'stratumId'),
        area: a.float(),
        baselineLength: a.float(),
        // store polygon coordinates as flattened [lat, lng, ...]
        coordinates: a.float().array(),
      })
      .authorization((allow) => [allow.authenticated()])
      .secondaryIndexes((index) => [
        index('projectId').queryField('strataByProjectId'),
      ]),
    JollyResult: a
      .model({
        surveyId: a.id().required(),
        stratumId: a.id().required(),
        annotationSetId: a.id().required(),
        categoryId: a.id().required(),
        animals: a.integer().required(),
        areaSurveyed: a.float().required(),
        estimate: a.float().required(),
        density: a.float().required(),
        variance: a.float().required(),
        standardError: a.float().required(),
        numSamples: a.integer().required(),
        lowerBound95: a.float().required(),
        upperBound95: a.float().required(),
      })
      .identifier(['surveyId', 'stratumId', 'annotationSetId', 'categoryId'])
      .authorization((allow) => [allow.authenticated()])
      .secondaryIndexes((index) => [
        index('surveyId').queryField('jollyResultsBySurveyId'),
        index('stratumId').queryField('jollyResultsByStratumId'),
      ]),
    addUserToGroup: a
      .mutation()
      .arguments({
        userId: a.string().required(),
        groupName: a.string().required(),
      })
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(addUserToGroup))
      .returns(a.json()),
    removeUserFromGroup: a
      .mutation()
      .arguments({
        userId: a.string().required(),
        groupName: a.string().required(),
      })
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(addUserToGroup))
      .returns(a.json()),
    createGroup: a
      .mutation()
      .arguments({
        groupName: a.string().required(),
      })
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(createGroup))
      .returns(a.json()),
    listUsers: a
      .query()
      .arguments({
        nextToken: a.string(),
      })
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(listUsers))
      .returns(
        a.customType({
          Users: a.ref('UserType').array(),
          NextToken: a.string(),
        })
      ),
    listGroupsForUser: a
      .query()
      .arguments({
        userId: a.string().required(),
        nextToken: a.string(),
      })
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(listGroupsForUser))
      .returns(a.json()),
    // Message publish mutation
    // Message type that's used for this PubSub sample
    Message: a.customType({
      content: a.string().required(),
      channelName: a.string().required(),
    }),
    publish: a
      .mutation()
      .arguments({
        channelName: a.string().required(),
        content: a.string().required(),
      })
      .returns(a.ref('Message'))
      .handler(a.handler.custom({ entry: './publish.js' }))
      .authorization((allow) => [
        allow.authenticated(),
        allow.publicApiKey(),
        allow.custom(),
      ]),
    // Subscribe to incoming messages
    receive: a
      .subscription()
      // subscribes to the 'publish' mutation
      .for(a.ref('publish'))
      // subscription handler to set custom filters
      .handler(
        a.handler.custom({
          entry: './receive.js',
        })
      )
      // authorization rules as to who can subscribe to the data
      .authorization((allow) => [allow.authenticated()]),
    processImages: a
      .mutation()
      .arguments({
        s3key: a.string().required(),
        model: a.string().required(),
        threshold: a.float(),
      })
      .handler(a.handler.function(processImages))
      .returns(a.string())
      .authorization((allow) => [allow.authenticated()]),
    CountType: a.customType({
      count: a.integer().required(),
    }),
    getImageCounts: a
      .query()
      .arguments({
        imageSetId: a.string().required(),
        nextToken: a.string(),
      })
      .returns(a.customType({ count: a.integer(), nextToken: a.string() }))
      .authorization((allow) => [allow.authenticated()])
      .handler(
        a.handler.custom({
          entry: './getImageCounts.js',
          dataSource: a.ref('ImageSetMembership'),
        })
      ),
    //.authorization(allow => [allow.authenticated()])

    // registerImages: a
    //   .mutation()
    //   .arguments({
    //     s3keys: a.string().array().array().required(),
    //     model: a.string().required(),
    //     threshold: a.float(),
    //   }),
    // decimateImageSets: a
    //   .mutation()
    //   .arguments({
    //     imageSetIds: a.string().array().required(),
    //     type: a.string().required(),
    //     level: a.float(),
    //   })
    Organization: a
      .model({
        name: a.string().required(),
        description: a.string(),
        memberships: a.hasMany('OrganizationMembership', 'organizationId'),
        projects: a.hasMany('Project', 'organizationId'),
        invites: a.hasMany('OrganizationInvite', 'organizationId'),
        testPresets: a.hasMany('TestPreset', 'organizationId'),
      })
      .authorization((allow) => [allow.authenticated()]),
    OrganizationMembership: a
      .model({
        organizationId: a.id().required(),
        organization: a.belongsTo('Organization', 'organizationId'),
        userId: a.string().required(),
        isAdmin: a.boolean().default(false),
        isTested: a.boolean().default(false),
      })
      .identifier(['organizationId', 'userId'])
      .authorization((allow) => [allow.authenticated()])
      .secondaryIndexes((index) => [
        index('userId').queryField('organizationsByUserId'),
        index('organizationId').queryField('membershipsByOrganizationId'),
      ]),
    OrganizationInvite: a
      .model({
        organizationId: a.id().required(),
        organization: a.belongsTo('Organization', 'organizationId'),
        username: a.string().required(),
        invitedBy: a.string().required(),
        status: a.string().default('pending'),
      })
      .authorization((allow) => [allow.authenticated()])
      .secondaryIndexes((index) => [
        index('username').queryField('organizationInvitesByUsername'),
      ]),
    OrganizationRegistration: a
      .model({
        organizationName: a.string().required(),
        briefDescription: a.string().required(),
        requestedBy: a.string().required(),
        status: a.string().default('pending'),
      })
      .authorization((allow) => [allow.authenticated()])
      .secondaryIndexes((index) => [
        index('status').queryField('organizationRegistrationsByStatus'),
      ]),
    ResultSharingToken: a
      .model({
        surveyId: a.id().required(),
        annotationSetId: a.id().required(),
        jwt: a.string().required(),
      })
      .identifier(['surveyId', 'annotationSetId'])
      .authorization((allow) => [allow.authenticated()]),
    JollyResultsMembership: a
      .model({
        surveyId: a.id().required(),
        annotationSetId: a.id().required(),
        survey: a.belongsTo('Project', 'surveyId'),
        annotationSet: a.belongsTo('AnnotationSet', 'annotationSetId'),
        userId: a.string().required(),
      })
      .identifier(['surveyId', 'annotationSetId', 'userId'])
      .authorization((allow) => [allow.authenticated()])
      .secondaryIndexes((index) => [
        index('surveyId')
          .queryField('jollyResultsMembershipsBySurveyId')
          .sortKeys(['annotationSetId']),
      ]),
    ClientLog: a
      .model({
        userId: a.string().required(),
        ipAddress: a.string(),
        userAgent: a.string(),
        deviceType: a.string(),
        os: a.string(),
        connectionType: a.string(),
        downlink: a.float(),
        rtt: a.float(),
      })
      .authorization((allow) => [allow.authenticated()])
      .secondaryIndexes((index) => [
        index('userId').queryField('clientLogsByUserId'),
      ]),
    updateProjectMemberships: a
      .mutation()
      .arguments({
        projectId: a.string().required(),
      })
      .returns(a.json())
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(updateProjectMemberships)),
    runImageRegistration: a
      .mutation()
      .arguments({
        projectId: a.string().required(),
        //JSON stringified metadata
        metadata: a.string().required(),
        queueUrl: a.string().required(),
      })
      .returns(a.json())
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(runImageRegistration)),
    runScoutbot: a
      .mutation()
      .arguments({
        projectId: a.string().required(),
        bucket: a.string().required(),
        queueUrl: a.string().required(),
        images: a.string().array(),
        setId: a.string().required(),
      })
      .returns(a.json())
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(runScoutbot)),
    runMadDetector: a
      .mutation()
      .arguments({
        projectId: a.string().required(),
        bucket: a.string().required(),
        queueUrl: a.string().required(),
        images: a.string().array(),
        setId: a.string().required(),
      })
      .returns(a.json())
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(runMadDetector)),
    runHeatmapper: a
      .mutation()
      .arguments({
        images: a.string().array(),
      })
      .returns(a.json())
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(runHeatmapper)),
    deleteProjectInFull: a
      .mutation()
      .arguments({
        projectId: a.string().required(),
      })
      .returns(a.json())
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(deleteProject)),
    generateSurveyResults: a
      .mutation()
      .arguments({
        surveyId: a.string().required(),
        annotationSetId: a.string().required(),
        categoryIds: a.string().array().required(),
      })
      .returns(a.json())
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(generateSurveyResults)),
    getJwtSecret: a
      .mutation()
      .returns(a.string())
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(getJwtSecret)),
  })
  .authorization((allow) => [
    allow.resource(processImages),
    allow.resource(updateUserStats),
    allow.resource(monitorModelProgress),
    allow.resource(updateProjectMemberships),
    allow.resource(cleanupJobs),
    allow.resource(runImageRegistration),
    allow.resource(runScoutbot),
    allow.resource(runHeatmapper),
    allow.resource(runPointFinder),
    allow.resource(runMadDetector),
    allow.resource(deleteProject),
    allow.resource(generateSurveyResults),
    allow.resource(getJwtSecret),
    // allow.resource(consolidateUserStats),
  ]);

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    // API Key is used for a.allow.public() rules
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
