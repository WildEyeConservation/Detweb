import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { handleUpload } from '../functions/handleUpload/resource'
import { addUserToGroup } from '../functions/add-user-to-group/resource'
import { createGroup } from '../data/create-group/resource'
import { listUsers } from '../data/list-users/resource'
import { listGroupsForUser } from '../data/list-groups-for-user/resource'
import { schema as generatedSqlSchema } from '../sqldata/schema.sql';

const sqlSchema = generatedSqlSchema.authorization(allow => allow.authenticated())
  // .setRelationships((models) => [
  //   models.Project.relationships({
  //     categories: a.hasMany("Category", "projectId"),
  //     imageSets: a.hasMany("ImageSet", "projectId"),
  //     imageFiles: a.hasMany("ImageFile", "projectId"),
  //     locations: a.hasMany("Location", "projectId"),
  //     locationSets: a.hasMany("LocationSet", "projectId"),
  //     annotations: a.hasMany("Annotation", "projectId"),
  //     annotationSets: a.hasMany("AnnotationSet", "projectId"),
  //     observations: a.hasMany("Observation", "projectId"),
  //     members: a.hasMany("UserProjectMembership", "projectId"),
  //     queues: a.hasMany("Queue", "projectId"),
  //     images: a.hasMany("Image", "projectId"),
  //     objects: a.hasMany("Object", "projectId"),
  //   }),
  //   models.Category.relationships({
  //     project: a.belongsTo("Project", "projectId"),
  //     annotations: a.hasMany("Annotation", "categoryId"),
  //     objects: a.hasMany("Object", "categoryId")
  //   }),
  //   models.ImageSet.relationships({
  //     project: a.belongsTo("Project", "projectId"),
  //     images: a.hasMany("ImageSetMembership", "imageSetId"),
  //   }),
  //   models.Image.relationships({
  //     project: a.belongsTo("Project", "projectId"),
  //     imageFiles: a.hasMany("ImageFile", "imageId"),
  //     locations: a.hasMany("Location", "imageId"),
  //     annotations: a.hasMany("Annotation", "imageId"),
  //     sets: a.hasMany("ImageSetMembership", "imageId"),
  //   }),
  //   models.ImageFile.relationships({
  //     project: a.belongsTo("Project", "projectId"),
  //     image: a.belongsTo("Image", "imageId"),
  //   }),
  //   models.AnnotationSet.relationships({
  //     project: a.belongsTo("Project", "projectId"),
  //     annotations: a.hasMany("Annotation", "setId"),
  //     observations: a.hasMany("Observation", "annotationSetId"),
  //   }),
  //   models.Annotation.relationships({
  //     project: a.belongsTo("Project", "projectId"),
  //     category: a.belongsTo("Category", "categoryId"),
  //     image: a.belongsTo("Image", "imageId"),
  //     object: a.belongsTo("Object", "objectId"),
  //     set: a.belongsTo("AnnotationSet", "setId"),
  //   }),
  //   models.Object.relationships({
  //     project: a.belongsTo("Project", "projectId"),
  //     annotations: a.hasMany("Annotation", "objectId"),
  //     category: a.belongsTo("Category", "categoryId"),
  //   }),
  //   models.Location.relationships({
  //     project: a.belongsTo("Project", "projectId"),
  //     image: a.belongsTo("Image", "imageId"),
  //     set: a.belongsTo("LocationSet", "setId"),
  //     observations: a.hasMany("Observation", "locationId"),
  //   }),
  //   models.Observation.relationships({
  //     project: a.belongsTo("Project", "projectId"),
  //     location: a.belongsTo("Location", "locationId"),
  //     annotationSet: a.belongsTo("AnnotationSet", "annotationSetId"),
  //   }),
  //   models.LocationSet.relationships({
  //     project: a.belongsTo("Project", "projectId"),
  //     locations: a.hasMany("Location", "setId"),
  //   }),
  //   models.UserProjectMembership.relationships({
  //     project: a.belongsTo("Project", "projectId"),
  //   }),
  //   models.Queue.relationships({
  //     project: a.belongsTo("Project", "projectId"),
  //   }),
  //   models.ImageSetMembership.relationships({
  //     image: a.belongsTo("Image", "imageId"),
  //     imageSet: a.belongsTo("ImageSet", "imageSetId"),
  //   })
  // ])
  .addToSchema({
    numberOfImagesInSet: a.query()
      .arguments({
        imageSetId: a.string().required()
      })
      .returns(a.ref('countType').array())
      .handler(a.handler.inlineSql(
        `SELECT
            COUNT(*) AS count
            FROM ImageSetMembership
            WHERE imageSetId = :imageSetId;`
      )),
    countType: a.customType({count: a.integer()})
  })

const schema = a.schema({
  UserType: a.customType({
    name: a.string().required(),
    id : a.string().required(),
    isAdmin:a.integer()}),
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
}).authorization(allow => [allow.resource(handleUpload), allow.authenticated()])

const combinedSchema = a.combine([sqlSchema,schema]);

export type Schema = ClientSchema<typeof combinedSchema>;

export const data = defineData({
  schema: combinedSchema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    // API Key is used for a.allow.public() rules
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});

