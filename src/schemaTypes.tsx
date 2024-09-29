import type { Schema } from '../amplify/data/resource';

export type ProjectType = Schema["Project"]["type"];
export type CategoryType = Schema["Category"]["type"];
export type ImageFileType = Schema["ImageFile"]["type"];
export type ImageType = Schema["Image"]["type"];
export type AnnotationSetType = Schema["AnnotationSet"]["type"];
export type AnnotationType = Schema["Annotation"]["type"];
export type ObjectType = Schema["Object"]["type"];
export type LocationType = Schema["Location"]["type"];
export type ObservationType = Schema["Observation"]["type"];
export type LocationSetType = Schema["LocationSet"]["type"];
export type ImageSetMembershipType = Schema["ImageSetMembership"]["type"];
export type ImageSetType = Schema["ImageSet"]["type"];
export type ImageNeighbourType = Schema["ImageNeighbour"]["type"];
export type UserProjectMembershipType = Schema["UserProjectMembership"]["type"];
export type QueueType = Schema["Queue"]["type"];

/* Here we add some local that may affect the rendering of a particular annotation, while actually being 
state of the current user session. As such these are not properties that need to be stored in the database,
(which is why they don't appear in the schema, and therefore not in the generated type AnnotationType).*/
export interface ExtendedAnnotationType extends AnnotationType {
    // Whether this annotation is currently selected by the user
    selected?: boolean;
    // Whether the annotation is the current candidate for matching with the selected annotation.
    candidate?: boolean;
    // A temporary object id while the registration pair is being matched, once the user confirms this 
    // match the value gets copied to objectId
    proposedObjectId?: string; 
    // Whether this is a shadow annotation, i.e. one that is created by the algorithm to fill in gaps
    // between images. A shadow annotation is a suggested annotation that the user may accept as is or 
    // adjust. In either event, the shadow annotation becomes a true annotation at that point and is 
    // stored in the database. We should consider replacing this property with a negated check for 
    // the existence of an id field.
    shadow?: boolean;
  }
    