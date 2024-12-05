import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { addUserToGroup } from '../functions/add-user-to-group/resource'
import { createGroup } from '../data/create-group/resource'
import { listUsers } from '../data/list-users/resource'
import { listGroupsForUser } from '../data/list-groups-for-user/resource'
import {processImages} from '../functions/processImages/resource'
import { getAnnotationCounts } from '../functions/getAnnotationCounts/resource'
import { updateUserStats } from '../functions/updateUserStats/resource'
import { updateAnnotationCounts } from "../functions/updateAnnotationCounts/resource";
/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any user authenticated via an API key can "create", "read",
"update", and "delete" any "Todo" records.
=========================================================================*/
const schema = a.schema({
  UserType: a.customType({
    name: a.string().required(),
    id: a.id().required(),
    email: a.string(),
    isAdmin:a.boolean()}),
  Project: a.model({
    name: a.string().required(),
    categories: a.hasMany('Category', 'projectId'),
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
  }).authorization(allow => [allow.authenticated()]),
    // .authorization(allow => [allow.groupDefinedIn('id').to(['read']),
    // allow.group('orgadmin').to(['create', 'update', 'delete', 'read']),
    // allow.custom()]),
  Category: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    name: a.string().required(),
    color: a.string(),
    shortcutKey: a.string(),
    annotations: a.hasMany('Annotation','categoryId'),
    annotationCount: a.integer().default(0),
    objects: a.hasMany('Object', 'categoryId')
  }).authorization(allow => [allow.authenticated()])
    // .authorization(allow => [allow.groupDefinedIn('projectId')])
    .secondaryIndexes((index)=>[index('projectId').queryField('categoriesByProjectId')]),
  Image: a.model({
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
    // sets: [ImageSet] @manyToMany(relationName: "ImageSetMembership")
    //   leftNeighbours: [ImageNeighbour] @hasMany(indexName:"bySecondNeighbour",fields:["key"]) 
    //   rightNeighbours: [ImageNeighbour] @hasMany(indexName:"byFirstNeighbour",fields:["key"]) 

  }).authorization(allow => [allow.authenticated()]),
    // .authorization(allow => [allow.groupDefinedIn('projectId')]),
  ImageFile: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    path: a.string().required(),
    imageId: a.id(),
    key: a.string().required(),
    image: a.belongsTo('Image', 'imageId'),
    type: a.string().required(),
    // Add this line to define the reverse relationship
    // .authorization(allow => [allow.groupDefinedIn('projectId')])
  }).authorization(allow => [allow.authenticated()])
    .secondaryIndexes((index) => [index('imageId').queryField('imagesByimageId'),
    index('path').queryField('imagesByPath')]),
  AnnotationSet: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    name: a.string().required(),
    annotations: a.hasMany('Annotation', 'setId'),
    annotationCount: a.integer().default(0),
    observations: a.hasMany('Observation', 'annotationSetId'),
    tasks: a.hasMany('TasksOnAnnotationSet', 'annotationSetId')
  }).authorization(allow => [allow.authenticated()])
    // .authorization(allow => [allow.groupDefinedIn('projectId')])
  .secondaryIndexes((index)=>[index('projectId').queryField('annotationSetsByProjectId')]),
  Annotation: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    setId: a.id().required(),
    set: a.belongsTo('AnnotationSet', 'setId'),
    source: a.string().required(),
    categoryId: a.id().required(),
    category: a.belongsTo('Category', 'categoryId'),
    imageId: a.id().required(),
    image : a.belongsTo('Image','imageId'),
    x: a.integer().required(),
    y: a.integer().required(),
    obscured: a.boolean(),
    objectId: a.id(),
    object: a.belongsTo('Object', 'objectId')
  }).authorization(allow => [allow.authenticated(), allow.owner()])
  .secondaryIndexes((index)=>[
    index('setId').queryField('annotationsByAnnotationSetId'),
    index('imageId').sortKeys(['setId']).queryField('annotationsByImageIdAndSetId'),
    index('objectId').queryField('annotationsByObjectId'),
    index('categoryId').queryField('annotationsByCategoryId')
  ])
  ,
  Object: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    annotations: a.hasMany('Annotation', 'objectId'),
    categoryId: a.id().required(),
    category: a.belongsTo('Category', 'categoryId')
  }).authorization(allow => [allow.authenticated()])
    // .authorization(allow => [allow.groupDefinedIn('projectId')])
  .secondaryIndexes((index)=>[index('categoryId').queryField('objectsByCategoryId')]),
  Location: a.model({
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
    observations: a.hasMany('Observation','locationId'),
    sets: a.hasMany('LocationSetMembership', 'locationId')
  }).authorization(allow => [allow.authenticated()])
    // .authorization(allow => [allow.groupDefinedIn('projectId')])
    .secondaryIndexes((index) => [index('imageId').sortKeys(['confidence']).queryField('locationsByImageKey'), 
    index('setId').sortKeys(['confidence']).queryField('locationsBySetIdAndConfidence')
  ]),
  Observation: a.model({
    projectId: a.id().required(),
    owner: a.string().required(),
    project: a.belongsTo('Project', 'projectId'),
    timeTaken: a.float(),
    annotationCount: a.integer(),
    waitingTime: a.float(),
    loadingTime: a.float(),
    locationId: a.id().required(),
    location: a.belongsTo('Location', 'locationId'),
    annotationSetId: a.id().required(),
    annotationSet: a.belongsTo('AnnotationSet', 'annotationSetId'),
    createdAt: a.string().required()
  }).authorization(allow => [allow.authenticated(), allow.owner()])
  .secondaryIndexes((index)=>[
    index('locationId').queryField('observationsByLocationId'), 
    index('annotationSetId').sortKeys(['createdAt']).queryField('observationsByAnnotationSetId'),
    index('owner').queryField('observationsByOwner')
  ]),
  LocationSet: a.model({
    projectId: a.id().required(),
    name: a.string().required(),
    project: a.belongsTo('Project', 'projectId'),
    locations: a.hasMany('Location', 'setId'),
    memberships: a.hasMany('LocationSetMembership', 'locationSetId'),
    locationCount: a.integer().default(0),
    tasks: a.hasMany('TasksOnAnnotationSet', 'locationSetId')
  }).authorization(allow => [allow.authenticated()])
    // .authorization(allow => [allow.groupDefinedIn('projectId')])
  .secondaryIndexes((index)=>[index('projectId').queryField('locationSetsByProjectId')]),
  LocationSetMembership: a.model({
    locationId: a.id().required(),
    locationSetId: a.id().required(),
    location: a.belongsTo('Location', 'locationId'),
    locationSet: a.belongsTo('LocationSet', 'locationSetId')
  }).authorization(allow => [allow.authenticated()]),
  ImageSetMembership: a.model({
    imageId: a.id().required(),
    imageSetId: a.id().required(),
    image: a.belongsTo('Image', 'imageId'),
    imageSet: a.belongsTo('ImageSet', 'imageSetId'),
  }).authorization(allow=>[allow.authenticated()])
  .secondaryIndexes((index)=>[index('imageSetId').queryField('imageSetMembershipsByImageSetId')]),
  ImageSet: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    name: a.string().required(),
    images: a.hasMany('ImageSetMembership', 'imageSetId'),
    imageCount: a.integer().default(0)
  }).authorization(allow => [allow.authenticated()])
    //.authorization(allow => [allow.groupDefinedIn('projectId')])
  .secondaryIndexes((index)=>[index('projectId').queryField('imageSetsByProjectId')]),
  UserProjectMembership: a.model({
    userId: a.string().required(),
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    isAdmin: a.boolean(),
    queueId: a.id(),
    queue: a.belongsTo('Queue', 'queueId')
    // backupQueueId: a.id(),
    // backupQueue: a.belongsTo('Queue', 'backupQueueId')
  }).authorization(allow => [allow.authenticated()])
    //.authorization(allow => [allow.groupDefinedIn('projectId'), allow.group('orgadmin')])
  .secondaryIndexes((index)=>[index('projectId').queryField('userProjectMembershipsByProjectId'),
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
  ImageNeighbour: a.model({
    image1Id: a.id().required(),
    image1: a.belongsTo('Image', 'image1Id'),
    image2Id: a.id().required(),
    image2: a.belongsTo('Image', 'image2Id'),
    homography: a.float().array()
  }).authorization(allow => [allow.authenticated()])
  .identifier(['image1Id', 'image2Id'])
  .secondaryIndexes((index)=>[index('image1Id').queryField('imageNeighboursByImage1key'),
    index('image2Id').queryField('imageNeighboursByImage2key')
  ]),
  Queue: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    name: a.string().required(),
    users: a.hasMany('UserProjectMembership', 'queueId'),
    // backupUsers: a.hasMany('UserProjectMembership', 'backupQueueId'),
    url: a.url(),
  }).authorization(allow => [allow.authenticated()])
    //.authorization(allow => [allow.groupDefinedIn('projectId')])
    .secondaryIndexes((index) => [index('projectId').queryField('queuesByProjectId')]),
  UserStats: a.model({
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
    waitingTime: a.float()
  })
  .identifier(['projectId', 'userId','date','setId'])
  .authorization(allow => [allow.authenticated(), allow.publicApiKey()]),
  TasksOnAnnotationSet: a.model({
    annotationSetId: a.id().required(),
    annotationSet: a.belongsTo('AnnotationSet', 'annotationSetId'),
    locationSetId: a.id().required(),
    locationSet: a.belongsTo('LocationSet', 'locationSetId')
  }).authorization(allow => [allow.authenticated()])
  .secondaryIndexes((index) => [
    index('annotationSetId').queryField('locationSetsByAnnotationSetId'),
  ]),
  addUserToGroup: a.mutation().arguments({
      userId:a.string().required(), 
      groupName:a.string().required()
  }).authorization(allow => [allow.authenticated()])
  .handler(a.handler.function(addUserToGroup))
  .returns(a.json()),
  removeUserFromGroup: a.mutation().arguments({
    userId:a.string().required(), 
    groupName:a.string().required()
  }).authorization(allow => [allow.authenticated()])
  .handler(a.handler.function(addUserToGroup))
  .returns(a.json()),
  createGroup: a.mutation().arguments({
    groupName: a.string().required()
  }).authorization(allow => [allow.authenticated()])
  .handler(a.handler.function(createGroup))
  .returns(a.json()),
  listUsers: a.query().arguments({
    nextToken: a.string()
  }).authorization(allow => [allow.authenticated()])
  .handler(a.handler.function(listUsers))
  .returns(a.customType({Users: a.ref('UserType').array(), NextToken: a.string()})),
  listGroupsForUser: a.query().arguments({
    userId: a.string().required(),
    nextToken: a.string()
  }).authorization(allow => [allow.authenticated()])
  .handler(a.handler.function(listGroupsForUser))
    .returns(a.json()),
  // Message publish mutation
    // Message type that's used for this PubSub sample
  Message: a.customType({
    content: a.string().required(),
    channelName: a.string().required()
  }),
  publish: a.mutation()
    .arguments({
      channelName: a.string().required(),
      content: a.string().required()
    })
    .returns(a.ref('Message'))
    .handler(a.handler.custom({ entry: './publish.js' }))
    .authorization(allow => [
      allow.authenticated(),
      allow.publicApiKey(),
      allow.custom()]),
  // Subscribe to incoming messages
  receive: a.subscription()
    // subscribes to the 'publish' mutation
    .for(a.ref('publish')) 
    // subscription handler to set custom filters
    .handler(a.handler.custom({
      entry: './receive.js'
    })) 
    // authorization rules as to who can subscribe to the data
    .authorization(allow => [allow.authenticated()]),
  processImages: a.mutation().arguments({
      s3key: a.string().required(),
      model: a.string().required(),
      threshold: a.float(),
  }).handler(a.handler.function(processImages)).returns(a.string())
  .authorization(allow => [allow.authenticated()]),
  CountType: a.customType({
    count: a.integer().required(),
  }),
  getImageCounts: a.query()
    .arguments({
      imageSetId: a.string().required(),
      nextToken: a.string()
    })
    .returns(a.customType({count: a.integer(), nextToken: a.string()}))
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.custom({
      entry: './getImageCounts.js',
      dataSource: a.ref('ImageSetMembership'),
    })),
  getAnnotationCounts: a.query()
    .arguments({
      annotationSetId: a.string().required()
    })
    .returns(a.json())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(getAnnotationCounts)),
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
}).authorization(allow => [allow.resource(getAnnotationCounts),
  allow.resource(processImages),
  allow.resource(updateUserStats),
  allow.resource(updateAnnotationCounts)])

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    // API Key is used for a.allow.public() rules
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});

