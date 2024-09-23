import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { addUserToGroup } from '../functions/add-user-to-group/resource'
import { createGroup } from '../data/create-group/resource'
import { listUsers } from '../data/list-users/resource'
import { listGroupsForUser } from '../data/list-groups-for-user/resource'
import {processImages} from '../functions/processImages/resource'

/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any user authenticated via an API key can "create", "read",
"update", and "delete" any "Todo" records.
=========================================================================*/
const schema = a.schema({
  UserType: a.customType({
    name: a.string().required(),
    id : a.id().required(),
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
    timestamp: a.timestamp(),
    exifData: a.string(),
    cameraSerial: a.string(),
    files: a.hasMany('ImageFile', 'imageId'),
    locations: a.hasMany('Location', 'imageId'),
    annotations: a.hasMany('Annotation', 'imageId'),
    memberships: a.hasMany('ImageSetMembership', 'imageId')

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
  .secondaryIndexes((index)=>[index('imageId').queryField('imagesByimageId')]),
  AnnotationSet: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    name: a.string().required(),
    annotations: a.hasMany('Annotation', 'setId'),
    observations: a.hasMany('Observation', 'annotationSetId')
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
  }).authorization(allow => [allow.authenticated()])
    // .authorization(allow => [allow.groupDefinedIn('projectId'), allow.owner()])
  .secondaryIndexes((index)=>[
    index('setId').queryField('annotationsByAnnotationSetId'),
    index('imageId').queryField('annotationsByimageId'),
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
  .secondaryIndexes((index)=>[index('imageId').queryField('locationsByImageKey'), 
    index('setId').queryField('locationsBySetId')
  ]),
  Observation: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    locationId: a.id().required(),
    location: a.belongsTo('Location', 'locationId'),
    annotationSetId: a.id().required(),
    annotationSet: a.belongsTo('AnnotationSet', 'annotationSetId')
  }).authorization(allow => [allow.authenticated()])
    // .authorization(allow => [allow.groupDefinedIn('projectId'), allow.owner()])
  .secondaryIndexes((index)=>[index('locationId').queryField('observationsByLocationId'), 
    index('annotationSetId').queryField('observationsByAnnotationSetId')
  ]),

  LocationSet: a.model({
    projectId: a.id().required(),
    name: a.string().required(),
    project: a.belongsTo('Project', 'projectId'),
    locations: a.hasMany('Location', 'setId'),
    memberships: a.hasMany('LocationSetMembership', 'locationSetId')
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
    images: a.hasMany('ImageSetMembership', 'imageSetId')
  }).authorization(allow => [allow.authenticated()])
    //.authorization(allow => [allow.groupDefinedIn('projectId')])
  .secondaryIndexes((index)=>[index('projectId').queryField('imageSetsByProjectId')]),
  UserProjectMembership: a.model({
    userId: a.string().required(),
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    isAdmin: a.boolean(),
    queueUrl: a.string(),
  }).authorization(allow => [allow.authenticated()])
    //.authorization(allow => [allow.groupDefinedIn('projectId'), allow.group('orgadmin')])
  .secondaryIndexes((index)=>[index('projectId').queryField('userProjectMembershipsByProjectId'),
    index('userId').queryField('userProjectMembershipsByUserId'),
    index('queueUrl').queryField('userProjectMembershipsByQueueUrl')
  ]),
  Queue: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    name: a.string().required(),
    url: a.url().required(),
  }).authorization(allow => [allow.authenticated()])
    //.authorization(allow => [allow.groupDefinedIn('projectId')])
  .secondaryIndexes((index)=>[index('projectId').queryField('queuesByProjectId')]),
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
      imageSetId: a.string().required()
    })
    .returns(a.integer())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.custom({
      entry: './getImageCounts.js',
      dataSource: a.ref('ImageSetMembership'),
    })),
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
}).authorization(allow => [
  allow.resource(processImages)])
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

