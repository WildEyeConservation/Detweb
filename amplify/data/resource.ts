import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { handleUpload } from '../functions/handleUpload/resource'
import { addUserToGroup } from '../functions/add-user-to-group/resource'
import { createGroup } from '../data/create-group/resource'
import { listUsers } from '../data/list-users/resource'
import { listGroupsForUser } from '../data/list-groups-for-user/resource'

/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any user authenticated via an API key can "create", "read",
"update", and "delete" any "Todo" records.
=========================================================================*/
const schema = a.schema({
  // type Project
  // @auth(
  // rules: [
  //     {allow: public, provider: iam},
  //     { allow: private, operations: [read] }, #Signed in users can list projects 
  //     { allow: groups, groups: ["admin"] } #Only admins can create a Project
  // ])
  // @model
  // {
  //     name: String! @primaryKey
  //     categories: [Category] @hasMany(indexName:"byProject", fields:["name"])
  //     annotationSet: [AnnotationSet] @hasMany(indexName:"byProject", fields:["name"])
  //     locationSets: [LocationSet] @hasMany(indexName:"byProject", fields:["name"])
  //     imageSets: [ImageSet] @hasMany(indexName:"byProject", fields:["name"])
  //     queues: [Queue] @hasMany (indexName:"byProject", fields:["name"])
  //     users: [UserProjectMembership] @hasMany (indexName:"byProject",fields:["name"])
  // }
  UserType: a.customType({
    id:a.string().required(),
    name:a.string().required(),
    isAdmin:a.boolean()}),
  Project: a.model({
    name: a.string().required(),
    categories: a.hasMany('Category', 'projectId'),
    images: a.hasMany('Image', 'projectId'),
    imageMetas: a.hasMany('ImageMeta', 'projectId'),
    annotations: a.hasMany('Annotation', 'projectId'),
    objects: a.hasMany('Object', 'projectId'),
    imageSets: a.hasMany('ImageSet', 'projectId'),
    annotationSets: a.hasMany('AnnotationSet', 'projectId'),
    locations: a.hasMany('Location', 'projectId'),
    locationSets: a.hasMany('LocationSet', 'projectId'),
    observations: a.hasMany('Observation', 'projectId'),
    members: a.hasMany('UserProjectMembership', 'projectId'),
    queues: a.hasMany('Queue', 'projectId'),
  }).authorization(allow=>[allow.authenticated()]),
  Category: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    name: a.string().required(),
    color: a.string(),
    shortcutKey: a.string(),
    annotations: a.hasMany('Annotation','categoryId'),
    objects: a.hasMany('Object','categoryId')
  }).authorization(allow => [allow.groupDefinedIn('projectId')])
  .secondaryIndexes((index)=>[index('projectId').queryField('categoriesByProjectId')]),
  ImageMeta: a.model({
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
    timestamp: a.datetime(),
    exifData: a.string(),
    cameraSerial: a.string(),
    images: a.hasMany('Image', 'metaId'),
    locations: a.hasMany('Location', 'metaId'),
    annotations: a.hasMany('Annotation','metaId')
    //   collections: [ImageSet] @manyToMany(relationName: "ImageSetMembership")
    //   leftNeighbours: [ImageNeighbour] @hasMany(indexName:"bySecondNeighbour",fields:["key"]) 
    //   rightNeighbours: [ImageNeighbour] @hasMany(indexName:"byFirstNeighbour",fields:["key"]) 

  }).authorization(allow => [allow.groupDefinedIn('projectId')]),
  Image: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    derivedFrom: a.id(),
    path: a.string().required(),
    metaId: a.id(),
    meta: a.belongsTo('ImageMeta', 'metaId'),
    type: a.string().required(),
    sets: a.hasMany('ImageSetMembership', 'imageId')
  }).authorization(allow => [allow.groupDefinedIn('projectId')])
  .secondaryIndexes((index)=>[index('metaId').queryField('imagesByMetaId')]),
  AnnotationSet: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    name: a.string().required(),
    annotations: a.hasMany('Annotation', 'setId'),
    observations: a.hasMany('Observation', 'annotationSetId')
  }).authorization(allow => [allow.groupDefinedIn('projectId')])
  .secondaryIndexes((index)=>[index('projectId').queryField('annotationSetsByProjectId')]),
  Annotation: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    setId: a.id().required(),
    set: a.belongsTo('AnnotationSet', 'setId'),
    source: a.string().required(),
    categoryId: a.id().required(),
    category: a.belongsTo('Category', 'categoryId'),
    metaId: a.id().required(),
    image : a.belongsTo('ImageMeta','metaId'),
    x: a.integer().required(),
    y: a.integer().required(),
    objectId: a.id(),
    object: a.belongsTo('Object', 'objectId')
  }).authorization(allow => [allow.groupDefinedIn('projectId'), allow.owner()])
  .secondaryIndexes((index)=>[
    index('setId').queryField('annotationsByAnnotationSetId'),
    index('metaId').queryField('annotationsByMetaId'),
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
  }).authorization(allow => [allow.groupDefinedIn('projectId')])
  .secondaryIndexes((index)=>[index('categoryId').queryField('objectsByCategoryId')]),
  Location: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    metaId: a.id(),
    meta: a.belongsTo('ImageMeta', 'metaId'),
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
  }).authorization(allow => [allow.groupDefinedIn('projectId')])
  .secondaryIndexes((index)=>[index('metaId').queryField('locationsByImageKey'), 
    index('setId').queryField('locationsBySetId')
  ]),
  Observation: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    locationId: a.id().required(),
    location: a.belongsTo('Location', 'locationId'),
    annotationSetId: a.id().required(),
    annotationSet: a.belongsTo('AnnotationSet', 'annotationSetId')
  }).authorization(allow => [allow.groupDefinedIn('projectId'), allow.owner()])
  .secondaryIndexes((index)=>[index('locationId').queryField('observationsByLocationId'), 
    index('annotationSetId').queryField('observationsByAnnotationSetId')
  ]),

  LocationSet: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    locations: a.hasMany('Location', 'setId'),
    memberships: a.hasMany('LocationSetMembership', 'locationSetId')
  }).authorization(allow => [allow.groupDefinedIn('projectId')])
  .secondaryIndexes((index)=>[index('projectId').queryField('locationSetsByProjectId')]),
  LocationSetMembership: a.model({
    locationId: a.id().required(),
    locationSetId: a.id().required(),
    location: a.belongsTo('Location', 'locationId'),
    locationSet: a.belongsTo('LocationSet', 'locationSetId')
  }).authorization(allow=>[allow.authenticated()]),
  ImageSetMembership: a.model({
    imageId: a.id().required(),
    imageSetId: a.id().required(),
    image: a.belongsTo('Image', 'imageId'),
    imageSet: a.belongsTo('ImageSet', 'imageSetId'),
  }).authorization(allow=>[allow.authenticated()])
  .secondaryIndexes((index)=>[index('imageSetId').queryField('imageSetMemberShipsByImageSetName')]),
  ImageSet: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    name: a.string().required(),
    images: a.hasMany('ImageSetMembership', 'imageSetId')
  }).authorization(allow => [allow.groupDefinedIn('projectId')])
  .secondaryIndexes((index)=>[index('projectId').queryField('imageSetsByProjectId')]),
  UserProjectMembership: a.model({
    userId: a.string().required(),
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    queueUrl: a.string(),
  }).authorization(allow => [allow.groupDefinedIn('projectId'),allow.group('orgadmin')])
  .secondaryIndexes((index)=>[index('projectId').queryField('userProjectMembershipsByProjectId'),
    index('userId').queryField('userProjectMembershipsByUserId'),
    index('queueUrl').queryField('userProjectMembershipsByQueueUrl')
  ]),
  Queue: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    name: a.string().required(),
    url: a.string().required(),
  }).authorization(allow => [allow.groupDefinedIn('projectId')])
  .secondaryIndexes((index)=>[index('projectId').queryField('queuesByProjectId')]),
  addUserToGroup: a.mutation().arguments({
    userId:a.string().required(), 
    groupName:a.string().required()
  }).authorization(allow=>[allow.group('orgadmin')])
  .handler(a.handler.function(addUserToGroup))
  .returns(a.json()),
  removeUserFromGroup: a.mutation().arguments({
    userId:a.string().required(), 
    groupName:a.string().required()
  }).authorization(allow=>[allow.group('orgadmin')])
  .handler(a.handler.function(addUserToGroup))
  .returns(a.json()),
  createGroup: a.mutation().arguments({
    groupName: a.string().required()
  }).authorization(allow=>[allow.group('orgadmin')])
  .handler(a.handler.function(createGroup))
  .returns(a.json()),
  listUsers: a.query().arguments({
    nextToken: a.string()
  }).authorization(allow=>[allow.group('orgadmin')])
  .handler(a.handler.function(listUsers))
  .returns(a.customType({Users: a.ref('UserType').array(), NextToken: a.string()})),
  listGroupsForUser: a.query().arguments({
    userId: a.string().required(),
    nextToken: a.string()
  }).authorization(allow=>[allow.group('orgadmin')])
  .handler(a.handler.function(listGroupsForUser))
  .returns(a.json()),
}).authorization(allow=>[allow.resource(handleUpload)])

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

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
