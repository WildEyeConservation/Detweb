
//import { type ClientSchema, a} from "@aws-amplify/backend"
// const schema = a.schema({
//     Annotation: a.model({
//         CategoryId: a.string().required(),
//         category: a.belongsTo("Category", "categoryId"),
//         objectId: a.string(),
//         object: a.belongsTo("Object", "objectId"),
//     }),
//     Category: a.model({
//         name: a.string().required(),
//         users: a.hasMany("User", "projectId"),
//         objects: a.hasMany("Object", "categoryId"),
//     }),
//     Object: a.model({
//         annotations: a.hasMany("Annotation", "objectId"),
//         categoryId: a.string().required(),
//         category: a.belongsTo("Category", "categoryId"),
//     })
// });
//export type Schema = ClientSchema<typeof schema>;

import {Schema} from '../amplify/data/resource'
import { generateClient } from 'aws-amplify/data'

export const client = generateClient<Schema>({authMode:"userPool"});
export const n = client.models.Annotation.list();
export const o = client.models.Category.list();
export const b = client.models.AnnotationSet.list();
export const c = client.models.Location.list();
export const d = client.models.LocationSet.list();
export const e = client.models.Observation.list();
export const f = client.models.Image.list();
export const g = client.models.ImageSet.list();
export const h = client.models.ImageSetMembership.list();
export const i = client.models.ImageFile.list();
export const j = client.models.Queue.list();
export const k = client.models.Object.list();
export const l = client.models.Project.list();
export const m = client.models.UserProjectMembership.list();
