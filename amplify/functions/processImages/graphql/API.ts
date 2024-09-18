/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type Annotation = {
  __typename: "Annotation",
  categoryId: string,
  createdAt?: string | null,
  id: string,
  imageId: string,
  objectId?: string | null,
  obscured?: number | null,
  projectId: string,
  setId: string,
  source: string,
  updatedAt?: string | null,
  x: number,
  y: number,
};

export type AnnotationSet = {
  __typename: "AnnotationSet",
  createdAt?: string | null,
  id: string,
  name: string,
  projectId: string,
  updatedAt?: string | null,
};

export type Category = {
  __typename: "Category",
  color?: string | null,
  createdAt?: string | null,
  id: string,
  name: string,
  projectId: string,
  shortcutKey?: string | null,
  updatedAt?: string | null,
};

export type Image = {
  __typename: "Image",
  altitude_agl?: number | null,
  altitude_egm96?: number | null,
  altitude_wgs84?: number | null,
  cameraSerial?: string | null,
  createdAt?: string | null,
  exifData?: string | null,
  height: number,
  id: string,
  latitude?: number | null,
  longitude?: number | null,
  pitch?: number | null,
  projectId: string,
  roll?: number | null,
  sets?: ModelImageSetMembershipConnection | null,
  timestamp?: string | null,
  updatedAt?: string | null,
  width: number,
  yaw?: number | null,
};

export type ModelImageSetMembershipConnection = {
  __typename: "ModelImageSetMembershipConnection",
  items:  Array<ImageSetMembership | null >,
  nextToken?: string | null,
};

export type ImageSetMembership = {
  __typename: "ImageSetMembership",
  createdAt?: string | null,
  id: string,
  image?: Image | null,
  imageId: string,
  imageSet?: ImageSet | null,
  imageSetId: string,
  updatedAt?: string | null,
};

export type ImageSet = {
  __typename: "ImageSet",
  createdAt?: string | null,
  id: string,
  images?: ModelImageSetMembershipConnection | null,
  name: string,
  projectId: string,
  updatedAt?: string | null,
};

export type ImageFile = {
  __typename: "ImageFile",
  createdAt?: string | null,
  id: string,
  imageId?: string | null,
  path: string,
  projectId: string,
  s3key: string,
  type: string,
  updatedAt?: string | null,
};

export type Location = {
  __typename: "Location",
  confidence?: number | null,
  createdAt?: string | null,
  height?: number | null,
  id: string,
  imageId?: string | null,
  projectId: string,
  setId: string,
  source: string,
  updatedAt?: string | null,
  width?: number | null,
  x: number,
  y: number,
};

export type LocationSet = {
  __typename: "LocationSet",
  createdAt?: string | null,
  id: string,
  name: string,
  projectId: string,
  updatedAt?: string | null,
};

export type Object = {
  __typename: "Object",
  categoryId: string,
  createdAt?: string | null,
  id: string,
  projectId: string,
  updatedAt?: string | null,
};

export type Observation = {
  __typename: "Observation",
  annotationSetId: string,
  createdAt?: string | null,
  id: string,
  locationId: string,
  projectId: string,
  updatedAt?: string | null,
};

export type Project = {
  __typename: "Project",
  createdAt?: string | null,
  id: string,
  name: string,
  updatedAt?: string | null,
};

export type Queue = {
  __typename: "Queue",
  createdAt?: string | null,
  id: string,
  name: string,
  projectId: string,
  updatedAt?: string | null,
  url: string,
};

export type UserProjectMembership = {
  __typename: "UserProjectMembership",
  createdAt?: string | null,
  id: string,
  isAdmin?: number | null,
  projectId: string,
  queueUrl?: string | null,
  updatedAt?: string | null,
  userId: string,
};

export type ModelAnnotationSetFilterInput = {
  and?: Array< ModelAnnotationSetFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  id?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelAnnotationSetFilterInput | null,
  or?: Array< ModelAnnotationSetFilterInput | null > | null,
  projectId?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelStringInput = {
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  contains?: string | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  le?: string | null,
  lt?: string | null,
  ne?: string | null,
  notContains?: string | null,
  size?: ModelSizeInput | null,
};

export enum ModelAttributeTypes {
  _null = "_null",
  binary = "binary",
  binarySet = "binarySet",
  bool = "bool",
  list = "list",
  map = "map",
  number = "number",
  numberSet = "numberSet",
  string = "string",
  stringSet = "stringSet",
}


export type ModelSizeInput = {
  between?: Array< number | null > | null,
  eq?: number | null,
  ge?: number | null,
  gt?: number | null,
  le?: number | null,
  lt?: number | null,
  ne?: number | null,
};

export enum ModelSortDirection {
  ASC = "ASC",
  DESC = "DESC",
}


export type ModelAnnotationSetConnection = {
  __typename: "ModelAnnotationSetConnection",
  items:  Array<AnnotationSet | null >,
  nextToken?: string | null,
};

export type ModelAnnotationFilterInput = {
  and?: Array< ModelAnnotationFilterInput | null > | null,
  categoryId?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  id?: ModelStringInput | null,
  imageId?: ModelStringInput | null,
  not?: ModelAnnotationFilterInput | null,
  objectId?: ModelStringInput | null,
  obscured?: ModelIntInput | null,
  or?: Array< ModelAnnotationFilterInput | null > | null,
  projectId?: ModelStringInput | null,
  setId?: ModelStringInput | null,
  source?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  x?: ModelIntInput | null,
  y?: ModelIntInput | null,
};

export type ModelIntInput = {
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  between?: Array< number | null > | null,
  eq?: number | null,
  ge?: number | null,
  gt?: number | null,
  le?: number | null,
  lt?: number | null,
  ne?: number | null,
};

export type ModelAnnotationConnection = {
  __typename: "ModelAnnotationConnection",
  items:  Array<Annotation | null >,
  nextToken?: string | null,
};

export type ModelCategoryFilterInput = {
  and?: Array< ModelCategoryFilterInput | null > | null,
  color?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  id?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelCategoryFilterInput | null,
  or?: Array< ModelCategoryFilterInput | null > | null,
  projectId?: ModelStringInput | null,
  shortcutKey?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelCategoryConnection = {
  __typename: "ModelCategoryConnection",
  items:  Array<Category | null >,
  nextToken?: string | null,
};

export type ModelImageFileFilterInput = {
  and?: Array< ModelImageFileFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  id?: ModelStringInput | null,
  imageId?: ModelStringInput | null,
  not?: ModelImageFileFilterInput | null,
  or?: Array< ModelImageFileFilterInput | null > | null,
  path?: ModelStringInput | null,
  projectId?: ModelStringInput | null,
  s3key?: ModelStringInput | null,
  type?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelImageFileConnection = {
  __typename: "ModelImageFileConnection",
  items:  Array<ImageFile | null >,
  nextToken?: string | null,
};

export type ModelImageSetMembershipFilterInput = {
  and?: Array< ModelImageSetMembershipFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  id?: ModelStringInput | null,
  imageId?: ModelStringInput | null,
  imageSetId?: ModelStringInput | null,
  not?: ModelImageSetMembershipFilterInput | null,
  or?: Array< ModelImageSetMembershipFilterInput | null > | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelImageSetFilterInput = {
  and?: Array< ModelImageSetFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  id?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelImageSetFilterInput | null,
  or?: Array< ModelImageSetFilterInput | null > | null,
  projectId?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelImageSetConnection = {
  __typename: "ModelImageSetConnection",
  items:  Array<ImageSet | null >,
  nextToken?: string | null,
};

export type ModelImageFilterInput = {
  altitude_agl?: ModelFloatInput | null,
  altitude_egm96?: ModelFloatInput | null,
  altitude_wgs84?: ModelFloatInput | null,
  and?: Array< ModelImageFilterInput | null > | null,
  cameraSerial?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  exifData?: ModelStringInput | null,
  height?: ModelIntInput | null,
  id?: ModelStringInput | null,
  latitude?: ModelFloatInput | null,
  longitude?: ModelFloatInput | null,
  not?: ModelImageFilterInput | null,
  or?: Array< ModelImageFilterInput | null > | null,
  pitch?: ModelFloatInput | null,
  projectId?: ModelStringInput | null,
  roll?: ModelFloatInput | null,
  timestamp?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  width?: ModelIntInput | null,
  yaw?: ModelFloatInput | null,
};

export type ModelFloatInput = {
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  between?: Array< number | null > | null,
  eq?: number | null,
  ge?: number | null,
  gt?: number | null,
  le?: number | null,
  lt?: number | null,
  ne?: number | null,
};

export type ModelImageConnection = {
  __typename: "ModelImageConnection",
  items:  Array<Image | null >,
  nextToken?: string | null,
};

export type ModelLocationSetFilterInput = {
  and?: Array< ModelLocationSetFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  id?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelLocationSetFilterInput | null,
  or?: Array< ModelLocationSetFilterInput | null > | null,
  projectId?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelLocationSetConnection = {
  __typename: "ModelLocationSetConnection",
  items:  Array<LocationSet | null >,
  nextToken?: string | null,
};

export type ModelLocationFilterInput = {
  and?: Array< ModelLocationFilterInput | null > | null,
  confidence?: ModelFloatInput | null,
  createdAt?: ModelStringInput | null,
  height?: ModelIntInput | null,
  id?: ModelStringInput | null,
  imageId?: ModelStringInput | null,
  not?: ModelLocationFilterInput | null,
  or?: Array< ModelLocationFilterInput | null > | null,
  projectId?: ModelStringInput | null,
  setId?: ModelStringInput | null,
  source?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  width?: ModelIntInput | null,
  x?: ModelIntInput | null,
  y?: ModelIntInput | null,
};

export type ModelLocationConnection = {
  __typename: "ModelLocationConnection",
  items:  Array<Location | null >,
  nextToken?: string | null,
};

export type ModelObjectFilterInput = {
  and?: Array< ModelObjectFilterInput | null > | null,
  categoryId?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  id?: ModelStringInput | null,
  not?: ModelObjectFilterInput | null,
  or?: Array< ModelObjectFilterInput | null > | null,
  projectId?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelObjectConnection = {
  __typename: "ModelObjectConnection",
  items:  Array<Object | null >,
  nextToken?: string | null,
};

export type ModelObservationFilterInput = {
  and?: Array< ModelObservationFilterInput | null > | null,
  annotationSetId?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  id?: ModelStringInput | null,
  locationId?: ModelStringInput | null,
  not?: ModelObservationFilterInput | null,
  or?: Array< ModelObservationFilterInput | null > | null,
  projectId?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelObservationConnection = {
  __typename: "ModelObservationConnection",
  items:  Array<Observation | null >,
  nextToken?: string | null,
};

export type ModelProjectFilterInput = {
  and?: Array< ModelProjectFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  id?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelProjectFilterInput | null,
  or?: Array< ModelProjectFilterInput | null > | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelProjectConnection = {
  __typename: "ModelProjectConnection",
  items:  Array<Project | null >,
  nextToken?: string | null,
};

export type ModelQueueFilterInput = {
  and?: Array< ModelQueueFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  id?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelQueueFilterInput | null,
  or?: Array< ModelQueueFilterInput | null > | null,
  projectId?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  url?: ModelStringInput | null,
};

export type ModelQueueConnection = {
  __typename: "ModelQueueConnection",
  items:  Array<Queue | null >,
  nextToken?: string | null,
};

export type ModelUserProjectMembershipFilterInput = {
  and?: Array< ModelUserProjectMembershipFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  id?: ModelStringInput | null,
  isAdmin?: ModelIntInput | null,
  not?: ModelUserProjectMembershipFilterInput | null,
  or?: Array< ModelUserProjectMembershipFilterInput | null > | null,
  projectId?: ModelStringInput | null,
  queueUrl?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  userId?: ModelStringInput | null,
};

export type ModelUserProjectMembershipConnection = {
  __typename: "ModelUserProjectMembershipConnection",
  items:  Array<UserProjectMembership | null >,
  nextToken?: string | null,
};

export type ListUsersReturnType = {
  __typename: "ListUsersReturnType",
  NextToken?: string | null,
  Users?:  Array<UserType | null > | null,
};

export type UserType = {
  __typename: "UserType",
  id: string,
  isAdmin?: number | null,
  name: string,
};

export type countType = {
  __typename: "countType",
  count?: number | null,
};

export type ModelAnnotationConditionInput = {
  and?: Array< ModelAnnotationConditionInput | null > | null,
  categoryId?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  imageId?: ModelStringInput | null,
  not?: ModelAnnotationConditionInput | null,
  objectId?: ModelStringInput | null,
  obscured?: ModelIntInput | null,
  or?: Array< ModelAnnotationConditionInput | null > | null,
  projectId?: ModelStringInput | null,
  setId?: ModelStringInput | null,
  source?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  x?: ModelIntInput | null,
  y?: ModelIntInput | null,
};

export type CreateAnnotationInput = {
  categoryId: string,
  createdAt?: string | null,
  id?: string | null,
  imageId: string,
  objectId?: string | null,
  obscured?: number | null,
  projectId: string,
  setId: string,
  source: string,
  updatedAt?: string | null,
  x: number,
  y: number,
};

export type ModelAnnotationSetConditionInput = {
  and?: Array< ModelAnnotationSetConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelAnnotationSetConditionInput | null,
  or?: Array< ModelAnnotationSetConditionInput | null > | null,
  projectId?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateAnnotationSetInput = {
  createdAt?: string | null,
  id?: string | null,
  name: string,
  projectId: string,
  updatedAt?: string | null,
};

export type ModelCategoryConditionInput = {
  and?: Array< ModelCategoryConditionInput | null > | null,
  color?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelCategoryConditionInput | null,
  or?: Array< ModelCategoryConditionInput | null > | null,
  projectId?: ModelStringInput | null,
  shortcutKey?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateCategoryInput = {
  color?: string | null,
  createdAt?: string | null,
  id?: string | null,
  name: string,
  projectId: string,
  shortcutKey?: string | null,
  updatedAt?: string | null,
};

export type ModelImageConditionInput = {
  altitude_agl?: ModelFloatInput | null,
  altitude_egm96?: ModelFloatInput | null,
  altitude_wgs84?: ModelFloatInput | null,
  and?: Array< ModelImageConditionInput | null > | null,
  cameraSerial?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  exifData?: ModelStringInput | null,
  height?: ModelIntInput | null,
  latitude?: ModelFloatInput | null,
  longitude?: ModelFloatInput | null,
  not?: ModelImageConditionInput | null,
  or?: Array< ModelImageConditionInput | null > | null,
  pitch?: ModelFloatInput | null,
  projectId?: ModelStringInput | null,
  roll?: ModelFloatInput | null,
  timestamp?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  width?: ModelIntInput | null,
  yaw?: ModelFloatInput | null,
};

export type CreateImageInput = {
  altitude_agl?: number | null,
  altitude_egm96?: number | null,
  altitude_wgs84?: number | null,
  cameraSerial?: string | null,
  createdAt?: string | null,
  exifData?: string | null,
  height: number,
  id?: string | null,
  latitude?: number | null,
  longitude?: number | null,
  pitch?: number | null,
  projectId: string,
  roll?: number | null,
  timestamp?: string | null,
  updatedAt?: string | null,
  width: number,
  yaw?: number | null,
};

export type ModelImageFileConditionInput = {
  and?: Array< ModelImageFileConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  imageId?: ModelStringInput | null,
  not?: ModelImageFileConditionInput | null,
  or?: Array< ModelImageFileConditionInput | null > | null,
  path?: ModelStringInput | null,
  projectId?: ModelStringInput | null,
  s3key?: ModelStringInput | null,
  type?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateImageFileInput = {
  createdAt?: string | null,
  id?: string | null,
  imageId?: string | null,
  path: string,
  projectId: string,
  s3key: string,
  type: string,
  updatedAt?: string | null,
};

export type ModelImageSetConditionInput = {
  and?: Array< ModelImageSetConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelImageSetConditionInput | null,
  or?: Array< ModelImageSetConditionInput | null > | null,
  projectId?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateImageSetInput = {
  createdAt?: string | null,
  id?: string | null,
  name: string,
  projectId: string,
  updatedAt?: string | null,
};

export type ModelImageSetMembershipConditionInput = {
  and?: Array< ModelImageSetMembershipConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  imageId?: ModelStringInput | null,
  imageSetId?: ModelStringInput | null,
  not?: ModelImageSetMembershipConditionInput | null,
  or?: Array< ModelImageSetMembershipConditionInput | null > | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateImageSetMembershipInput = {
  createdAt?: string | null,
  id?: string | null,
  imageId: string,
  imageSetId: string,
  updatedAt?: string | null,
};

export type ModelLocationConditionInput = {
  and?: Array< ModelLocationConditionInput | null > | null,
  confidence?: ModelFloatInput | null,
  createdAt?: ModelStringInput | null,
  height?: ModelIntInput | null,
  imageId?: ModelStringInput | null,
  not?: ModelLocationConditionInput | null,
  or?: Array< ModelLocationConditionInput | null > | null,
  projectId?: ModelStringInput | null,
  setId?: ModelStringInput | null,
  source?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  width?: ModelIntInput | null,
  x?: ModelIntInput | null,
  y?: ModelIntInput | null,
};

export type CreateLocationInput = {
  confidence?: number | null,
  createdAt?: string | null,
  height?: number | null,
  id?: string | null,
  imageId?: string | null,
  projectId: string,
  setId: string,
  source: string,
  updatedAt?: string | null,
  width?: number | null,
  x: number,
  y: number,
};

export type ModelLocationSetConditionInput = {
  and?: Array< ModelLocationSetConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelLocationSetConditionInput | null,
  or?: Array< ModelLocationSetConditionInput | null > | null,
  projectId?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateLocationSetInput = {
  createdAt?: string | null,
  id?: string | null,
  name: string,
  projectId: string,
  updatedAt?: string | null,
};

export type ModelObjectConditionInput = {
  and?: Array< ModelObjectConditionInput | null > | null,
  categoryId?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  not?: ModelObjectConditionInput | null,
  or?: Array< ModelObjectConditionInput | null > | null,
  projectId?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateObjectInput = {
  categoryId: string,
  createdAt?: string | null,
  id?: string | null,
  projectId: string,
  updatedAt?: string | null,
};

export type ModelObservationConditionInput = {
  and?: Array< ModelObservationConditionInput | null > | null,
  annotationSetId?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  locationId?: ModelStringInput | null,
  not?: ModelObservationConditionInput | null,
  or?: Array< ModelObservationConditionInput | null > | null,
  projectId?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateObservationInput = {
  annotationSetId: string,
  createdAt?: string | null,
  id?: string | null,
  locationId: string,
  projectId: string,
  updatedAt?: string | null,
};

export type ModelProjectConditionInput = {
  and?: Array< ModelProjectConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelProjectConditionInput | null,
  or?: Array< ModelProjectConditionInput | null > | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateProjectInput = {
  createdAt?: string | null,
  id?: string | null,
  name: string,
  updatedAt?: string | null,
};

export type ModelQueueConditionInput = {
  and?: Array< ModelQueueConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelQueueConditionInput | null,
  or?: Array< ModelQueueConditionInput | null > | null,
  projectId?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  url?: ModelStringInput | null,
};

export type CreateQueueInput = {
  createdAt?: string | null,
  id?: string | null,
  name: string,
  projectId: string,
  updatedAt?: string | null,
  url: string,
};

export type ModelUserProjectMembershipConditionInput = {
  and?: Array< ModelUserProjectMembershipConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  isAdmin?: ModelIntInput | null,
  not?: ModelUserProjectMembershipConditionInput | null,
  or?: Array< ModelUserProjectMembershipConditionInput | null > | null,
  projectId?: ModelStringInput | null,
  queueUrl?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  userId?: ModelStringInput | null,
};

export type CreateUserProjectMembershipInput = {
  createdAt?: string | null,
  id?: string | null,
  isAdmin?: number | null,
  projectId: string,
  queueUrl?: string | null,
  updatedAt?: string | null,
  userId: string,
};

export type DeleteAnnotationInput = {
  id: string,
};

export type DeleteAnnotationSetInput = {
  id: string,
};

export type DeleteCategoryInput = {
  id: string,
};

export type DeleteImageInput = {
  id: string,
};

export type DeleteImageFileInput = {
  id: string,
};

export type DeleteImageSetInput = {
  id: string,
};

export type DeleteImageSetMembershipInput = {
  id: string,
};

export type DeleteLocationInput = {
  id: string,
};

export type DeleteLocationSetInput = {
  id: string,
};

export type DeleteObjectInput = {
  id: string,
};

export type DeleteObservationInput = {
  id: string,
};

export type DeleteProjectInput = {
  id: string,
};

export type DeleteQueueInput = {
  id: string,
};

export type DeleteUserProjectMembershipInput = {
  id: string,
};

export type Message = {
  __typename: "Message",
  channelName: string,
  content: string,
};

export type UpdateAnnotationInput = {
  categoryId?: string | null,
  createdAt?: string | null,
  id: string,
  imageId?: string | null,
  objectId?: string | null,
  obscured?: number | null,
  projectId?: string | null,
  setId?: string | null,
  source?: string | null,
  updatedAt?: string | null,
  x?: number | null,
  y?: number | null,
};

export type UpdateAnnotationSetInput = {
  createdAt?: string | null,
  id: string,
  name?: string | null,
  projectId?: string | null,
  updatedAt?: string | null,
};

export type UpdateCategoryInput = {
  color?: string | null,
  createdAt?: string | null,
  id: string,
  name?: string | null,
  projectId?: string | null,
  shortcutKey?: string | null,
  updatedAt?: string | null,
};

export type UpdateImageInput = {
  altitude_agl?: number | null,
  altitude_egm96?: number | null,
  altitude_wgs84?: number | null,
  cameraSerial?: string | null,
  createdAt?: string | null,
  exifData?: string | null,
  height?: number | null,
  id: string,
  latitude?: number | null,
  longitude?: number | null,
  pitch?: number | null,
  projectId?: string | null,
  roll?: number | null,
  timestamp?: string | null,
  updatedAt?: string | null,
  width?: number | null,
  yaw?: number | null,
};

export type UpdateImageFileInput = {
  createdAt?: string | null,
  id: string,
  imageId?: string | null,
  path?: string | null,
  projectId?: string | null,
  s3key?: string | null,
  type?: string | null,
  updatedAt?: string | null,
};

export type UpdateImageSetInput = {
  createdAt?: string | null,
  id: string,
  name?: string | null,
  projectId?: string | null,
  updatedAt?: string | null,
};

export type UpdateImageSetMembershipInput = {
  createdAt?: string | null,
  id: string,
  imageId?: string | null,
  imageSetId?: string | null,
  updatedAt?: string | null,
};

export type UpdateLocationInput = {
  confidence?: number | null,
  createdAt?: string | null,
  height?: number | null,
  id: string,
  imageId?: string | null,
  projectId?: string | null,
  setId?: string | null,
  source?: string | null,
  updatedAt?: string | null,
  width?: number | null,
  x?: number | null,
  y?: number | null,
};

export type UpdateLocationSetInput = {
  createdAt?: string | null,
  id: string,
  name?: string | null,
  projectId?: string | null,
  updatedAt?: string | null,
};

export type UpdateObjectInput = {
  categoryId?: string | null,
  createdAt?: string | null,
  id: string,
  projectId?: string | null,
  updatedAt?: string | null,
};

export type UpdateObservationInput = {
  annotationSetId?: string | null,
  createdAt?: string | null,
  id: string,
  locationId?: string | null,
  projectId?: string | null,
  updatedAt?: string | null,
};

export type UpdateProjectInput = {
  createdAt?: string | null,
  id: string,
  name?: string | null,
  updatedAt?: string | null,
};

export type UpdateQueueInput = {
  createdAt?: string | null,
  id: string,
  name?: string | null,
  projectId?: string | null,
  updatedAt?: string | null,
  url?: string | null,
};

export type UpdateUserProjectMembershipInput = {
  createdAt?: string | null,
  id: string,
  isAdmin?: number | null,
  projectId?: string | null,
  queueUrl?: string | null,
  updatedAt?: string | null,
  userId?: string | null,
};

export type ModelSubscriptionAnnotationFilterInput = {
  and?: Array< ModelSubscriptionAnnotationFilterInput | null > | null,
  categoryId?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionStringInput | null,
  imageId?: ModelSubscriptionStringInput | null,
  objectId?: ModelSubscriptionStringInput | null,
  obscured?: ModelSubscriptionIntInput | null,
  or?: Array< ModelSubscriptionAnnotationFilterInput | null > | null,
  projectId?: ModelSubscriptionStringInput | null,
  setId?: ModelSubscriptionStringInput | null,
  source?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  x?: ModelSubscriptionIntInput | null,
  y?: ModelSubscriptionIntInput | null,
};

export type ModelSubscriptionStringInput = {
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  contains?: string | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  in?: Array< string | null > | null,
  le?: string | null,
  lt?: string | null,
  ne?: string | null,
  notContains?: string | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionIntInput = {
  between?: Array< number | null > | null,
  eq?: number | null,
  ge?: number | null,
  gt?: number | null,
  in?: Array< number | null > | null,
  le?: number | null,
  lt?: number | null,
  ne?: number | null,
  notIn?: Array< number | null > | null,
};

export type ModelSubscriptionAnnotationSetFilterInput = {
  and?: Array< ModelSubscriptionAnnotationSetFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionStringInput | null,
  name?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionAnnotationSetFilterInput | null > | null,
  projectId?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionCategoryFilterInput = {
  and?: Array< ModelSubscriptionCategoryFilterInput | null > | null,
  color?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionStringInput | null,
  name?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionCategoryFilterInput | null > | null,
  projectId?: ModelSubscriptionStringInput | null,
  shortcutKey?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionImageFilterInput = {
  altitude_agl?: ModelSubscriptionFloatInput | null,
  altitude_egm96?: ModelSubscriptionFloatInput | null,
  altitude_wgs84?: ModelSubscriptionFloatInput | null,
  and?: Array< ModelSubscriptionImageFilterInput | null > | null,
  cameraSerial?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  exifData?: ModelSubscriptionStringInput | null,
  height?: ModelSubscriptionIntInput | null,
  id?: ModelSubscriptionStringInput | null,
  latitude?: ModelSubscriptionFloatInput | null,
  longitude?: ModelSubscriptionFloatInput | null,
  or?: Array< ModelSubscriptionImageFilterInput | null > | null,
  pitch?: ModelSubscriptionFloatInput | null,
  projectId?: ModelSubscriptionStringInput | null,
  roll?: ModelSubscriptionFloatInput | null,
  timestamp?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  width?: ModelSubscriptionIntInput | null,
  yaw?: ModelSubscriptionFloatInput | null,
};

export type ModelSubscriptionFloatInput = {
  between?: Array< number | null > | null,
  eq?: number | null,
  ge?: number | null,
  gt?: number | null,
  in?: Array< number | null > | null,
  le?: number | null,
  lt?: number | null,
  ne?: number | null,
  notIn?: Array< number | null > | null,
};

export type ModelSubscriptionImageFileFilterInput = {
  and?: Array< ModelSubscriptionImageFileFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionStringInput | null,
  imageId?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionImageFileFilterInput | null > | null,
  path?: ModelSubscriptionStringInput | null,
  projectId?: ModelSubscriptionStringInput | null,
  s3key?: ModelSubscriptionStringInput | null,
  type?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionImageSetFilterInput = {
  and?: Array< ModelSubscriptionImageSetFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionStringInput | null,
  name?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionImageSetFilterInput | null > | null,
  projectId?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionImageSetMembershipFilterInput = {
  and?: Array< ModelSubscriptionImageSetMembershipFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionStringInput | null,
  imageId?: ModelSubscriptionStringInput | null,
  imageSetId?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionImageSetMembershipFilterInput | null > | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionLocationFilterInput = {
  and?: Array< ModelSubscriptionLocationFilterInput | null > | null,
  confidence?: ModelSubscriptionFloatInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  height?: ModelSubscriptionIntInput | null,
  id?: ModelSubscriptionStringInput | null,
  imageId?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionLocationFilterInput | null > | null,
  projectId?: ModelSubscriptionStringInput | null,
  setId?: ModelSubscriptionStringInput | null,
  source?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  width?: ModelSubscriptionIntInput | null,
  x?: ModelSubscriptionIntInput | null,
  y?: ModelSubscriptionIntInput | null,
};

export type ModelSubscriptionLocationSetFilterInput = {
  and?: Array< ModelSubscriptionLocationSetFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionStringInput | null,
  name?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionLocationSetFilterInput | null > | null,
  projectId?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionObjectFilterInput = {
  and?: Array< ModelSubscriptionObjectFilterInput | null > | null,
  categoryId?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionObjectFilterInput | null > | null,
  projectId?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionObservationFilterInput = {
  and?: Array< ModelSubscriptionObservationFilterInput | null > | null,
  annotationSetId?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionStringInput | null,
  locationId?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionObservationFilterInput | null > | null,
  projectId?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionProjectFilterInput = {
  and?: Array< ModelSubscriptionProjectFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionStringInput | null,
  name?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionProjectFilterInput | null > | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionQueueFilterInput = {
  and?: Array< ModelSubscriptionQueueFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionStringInput | null,
  name?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionQueueFilterInput | null > | null,
  projectId?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  url?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionUserProjectMembershipFilterInput = {
  and?: Array< ModelSubscriptionUserProjectMembershipFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionStringInput | null,
  isAdmin?: ModelSubscriptionIntInput | null,
  or?: Array< ModelSubscriptionUserProjectMembershipFilterInput | null > | null,
  projectId?: ModelSubscriptionStringInput | null,
  queueUrl?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  userId?: ModelSubscriptionStringInput | null,
};

export type GetAnnotationQueryVariables = {
  id: string,
};

export type GetAnnotationQuery = {
  getAnnotation?:  {
    __typename: "Annotation",
    categoryId: string,
    createdAt?: string | null,
    id: string,
    imageId: string,
    objectId?: string | null,
    obscured?: number | null,
    projectId: string,
    setId: string,
    source: string,
    updatedAt?: string | null,
    x: number,
    y: number,
  } | null,
};

export type GetAnnotationSetQueryVariables = {
  id: string,
};

export type GetAnnotationSetQuery = {
  getAnnotationSet?:  {
    __typename: "AnnotationSet",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type GetCategoryQueryVariables = {
  id: string,
};

export type GetCategoryQuery = {
  getCategory?:  {
    __typename: "Category",
    color?: string | null,
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    shortcutKey?: string | null,
    updatedAt?: string | null,
  } | null,
};

export type GetImageQueryVariables = {
  id: string,
};

export type GetImageQuery = {
  getImage?:  {
    __typename: "Image",
    altitude_agl?: number | null,
    altitude_egm96?: number | null,
    altitude_wgs84?: number | null,
    cameraSerial?: string | null,
    createdAt?: string | null,
    exifData?: string | null,
    height: number,
    id: string,
    latitude?: number | null,
    longitude?: number | null,
    pitch?: number | null,
    projectId: string,
    roll?: number | null,
    sets?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    timestamp?: string | null,
    updatedAt?: string | null,
    width: number,
    yaw?: number | null,
  } | null,
};

export type GetImageFileQueryVariables = {
  id: string,
};

export type GetImageFileQuery = {
  getImageFile?:  {
    __typename: "ImageFile",
    createdAt?: string | null,
    id: string,
    imageId?: string | null,
    path: string,
    projectId: string,
    s3key: string,
    type: string,
    updatedAt?: string | null,
  } | null,
};

export type GetImageSetQueryVariables = {
  id: string,
};

export type GetImageSetQuery = {
  getImageSet?:  {
    __typename: "ImageSet",
    createdAt?: string | null,
    id: string,
    images?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type GetImageSetMembershipQueryVariables = {
  id: string,
};

export type GetImageSetMembershipQuery = {
  getImageSetMembership?:  {
    __typename: "ImageSetMembership",
    createdAt?: string | null,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt?: string | null,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: string | null,
      updatedAt?: string | null,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    imageSet?:  {
      __typename: "ImageSet",
      createdAt?: string | null,
      id: string,
      name: string,
      projectId: string,
      updatedAt?: string | null,
    } | null,
    imageSetId: string,
    updatedAt?: string | null,
  } | null,
};

export type GetLocationQueryVariables = {
  id: string,
};

export type GetLocationQuery = {
  getLocation?:  {
    __typename: "Location",
    confidence?: number | null,
    createdAt?: string | null,
    height?: number | null,
    id: string,
    imageId?: string | null,
    projectId: string,
    setId: string,
    source: string,
    updatedAt?: string | null,
    width?: number | null,
    x: number,
    y: number,
  } | null,
};

export type GetLocationSetQueryVariables = {
  id: string,
};

export type GetLocationSetQuery = {
  getLocationSet?:  {
    __typename: "LocationSet",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type GetObjectQueryVariables = {
  id: string,
};

export type GetObjectQuery = {
  getObject?:  {
    __typename: "Object",
    categoryId: string,
    createdAt?: string | null,
    id: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type GetObservationQueryVariables = {
  id: string,
};

export type GetObservationQuery = {
  getObservation?:  {
    __typename: "Observation",
    annotationSetId: string,
    createdAt?: string | null,
    id: string,
    locationId: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type GetProjectQueryVariables = {
  id: string,
};

export type GetProjectQuery = {
  getProject?:  {
    __typename: "Project",
    createdAt?: string | null,
    id: string,
    name: string,
    updatedAt?: string | null,
  } | null,
};

export type GetQueueQueryVariables = {
  id: string,
};

export type GetQueueQuery = {
  getQueue?:  {
    __typename: "Queue",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
    url: string,
  } | null,
};

export type GetUserProjectMembershipQueryVariables = {
  id: string,
};

export type GetUserProjectMembershipQuery = {
  getUserProjectMembership?:  {
    __typename: "UserProjectMembership",
    createdAt?: string | null,
    id: string,
    isAdmin?: number | null,
    projectId: string,
    queueUrl?: string | null,
    updatedAt?: string | null,
    userId: string,
  } | null,
};

export type ListAnnotationSetsQueryVariables = {
  filter?: ModelAnnotationSetFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListAnnotationSetsQuery = {
  listAnnotationSets?:  {
    __typename: "ModelAnnotationSetConnection",
    items:  Array< {
      __typename: "AnnotationSet",
      createdAt?: string | null,
      id: string,
      name: string,
      projectId: string,
      updatedAt?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListAnnotationsQueryVariables = {
  filter?: ModelAnnotationFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListAnnotationsQuery = {
  listAnnotations?:  {
    __typename: "ModelAnnotationConnection",
    items:  Array< {
      __typename: "Annotation",
      categoryId: string,
      createdAt?: string | null,
      id: string,
      imageId: string,
      objectId?: string | null,
      obscured?: number | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt?: string | null,
      x: number,
      y: number,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListCategoriesQueryVariables = {
  filter?: ModelCategoryFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListCategoriesQuery = {
  listCategories?:  {
    __typename: "ModelCategoryConnection",
    items:  Array< {
      __typename: "Category",
      color?: string | null,
      createdAt?: string | null,
      id: string,
      name: string,
      projectId: string,
      shortcutKey?: string | null,
      updatedAt?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListGroupsForUserQueryVariables = {
  nextToken?: string | null,
  userId: string,
};

export type ListGroupsForUserQuery = {
  listGroupsForUser?: string | null,
};

export type ListImageFilesQueryVariables = {
  filter?: ModelImageFileFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListImageFilesQuery = {
  listImageFiles?:  {
    __typename: "ModelImageFileConnection",
    items:  Array< {
      __typename: "ImageFile",
      createdAt?: string | null,
      id: string,
      imageId?: string | null,
      path: string,
      projectId: string,
      s3key: string,
      type: string,
      updatedAt?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListImageSetMembershipsQueryVariables = {
  filter?: ModelImageSetMembershipFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListImageSetMembershipsQuery = {
  listImageSetMemberships?:  {
    __typename: "ModelImageSetMembershipConnection",
    items:  Array< {
      __typename: "ImageSetMembership",
      createdAt?: string | null,
      id: string,
      imageId: string,
      imageSetId: string,
      updatedAt?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListImageSetsQueryVariables = {
  filter?: ModelImageSetFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListImageSetsQuery = {
  listImageSets?:  {
    __typename: "ModelImageSetConnection",
    items:  Array< {
      __typename: "ImageSet",
      createdAt?: string | null,
      id: string,
      name: string,
      projectId: string,
      updatedAt?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListImagesQueryVariables = {
  filter?: ModelImageFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListImagesQuery = {
  listImages?:  {
    __typename: "ModelImageConnection",
    items:  Array< {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt?: string | null,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: string | null,
      updatedAt?: string | null,
      width: number,
      yaw?: number | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListLocationSetsQueryVariables = {
  filter?: ModelLocationSetFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListLocationSetsQuery = {
  listLocationSets?:  {
    __typename: "ModelLocationSetConnection",
    items:  Array< {
      __typename: "LocationSet",
      createdAt?: string | null,
      id: string,
      name: string,
      projectId: string,
      updatedAt?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListLocationsQueryVariables = {
  filter?: ModelLocationFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListLocationsQuery = {
  listLocations?:  {
    __typename: "ModelLocationConnection",
    items:  Array< {
      __typename: "Location",
      confidence?: number | null,
      createdAt?: string | null,
      height?: number | null,
      id: string,
      imageId?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt?: string | null,
      width?: number | null,
      x: number,
      y: number,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListObjectsQueryVariables = {
  filter?: ModelObjectFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListObjectsQuery = {
  listObjects?:  {
    __typename: "ModelObjectConnection",
    items:  Array< {
      __typename: "Object",
      categoryId: string,
      createdAt?: string | null,
      id: string,
      projectId: string,
      updatedAt?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListObservationsQueryVariables = {
  filter?: ModelObservationFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListObservationsQuery = {
  listObservations?:  {
    __typename: "ModelObservationConnection",
    items:  Array< {
      __typename: "Observation",
      annotationSetId: string,
      createdAt?: string | null,
      id: string,
      locationId: string,
      projectId: string,
      updatedAt?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListProjectsQueryVariables = {
  filter?: ModelProjectFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListProjectsQuery = {
  listProjects?:  {
    __typename: "ModelProjectConnection",
    items:  Array< {
      __typename: "Project",
      createdAt?: string | null,
      id: string,
      name: string,
      updatedAt?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListQueuesQueryVariables = {
  filter?: ModelQueueFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListQueuesQuery = {
  listQueues?:  {
    __typename: "ModelQueueConnection",
    items:  Array< {
      __typename: "Queue",
      createdAt?: string | null,
      id: string,
      name: string,
      projectId: string,
      updatedAt?: string | null,
      url: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListUserProjectMembershipsQueryVariables = {
  filter?: ModelUserProjectMembershipFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListUserProjectMembershipsQuery = {
  listUserProjectMemberships?:  {
    __typename: "ModelUserProjectMembershipConnection",
    items:  Array< {
      __typename: "UserProjectMembership",
      createdAt?: string | null,
      id: string,
      isAdmin?: number | null,
      projectId: string,
      queueUrl?: string | null,
      updatedAt?: string | null,
      userId: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListUsersQueryVariables = {
  nextToken?: string | null,
};

export type ListUsersQuery = {
  listUsers?:  {
    __typename: "ListUsersReturnType",
    NextToken?: string | null,
    Users?:  Array< {
      __typename: "UserType",
      id: string,
      isAdmin?: number | null,
      name: string,
    } | null > | null,
  } | null,
};

export type NumberOfImagesInSetQueryVariables = {
  imageSetId: string,
};

export type NumberOfImagesInSetQuery = {
  numberOfImagesInSet?:  Array< {
    __typename: "countType",
    count?: number | null,
  } | null > | null,
};

export type AddUserToGroupMutationVariables = {
  groupName: string,
  userId: string,
};

export type AddUserToGroupMutation = {
  addUserToGroup?: string | null,
};

export type CreateAnnotationMutationVariables = {
  condition?: ModelAnnotationConditionInput | null,
  input: CreateAnnotationInput,
};

export type CreateAnnotationMutation = {
  createAnnotation?:  {
    __typename: "Annotation",
    categoryId: string,
    createdAt?: string | null,
    id: string,
    imageId: string,
    objectId?: string | null,
    obscured?: number | null,
    projectId: string,
    setId: string,
    source: string,
    updatedAt?: string | null,
    x: number,
    y: number,
  } | null,
};

export type CreateAnnotationSetMutationVariables = {
  condition?: ModelAnnotationSetConditionInput | null,
  input: CreateAnnotationSetInput,
};

export type CreateAnnotationSetMutation = {
  createAnnotationSet?:  {
    __typename: "AnnotationSet",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type CreateCategoryMutationVariables = {
  condition?: ModelCategoryConditionInput | null,
  input: CreateCategoryInput,
};

export type CreateCategoryMutation = {
  createCategory?:  {
    __typename: "Category",
    color?: string | null,
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    shortcutKey?: string | null,
    updatedAt?: string | null,
  } | null,
};

export type CreateGroupMutationVariables = {
  groupName: string,
};

export type CreateGroupMutation = {
  createGroup?: string | null,
};

export type CreateImageMutationVariables = {
  condition?: ModelImageConditionInput | null,
  input: CreateImageInput,
};

export type CreateImageMutation = {
  createImage?:  {
    __typename: "Image",
    altitude_agl?: number | null,
    altitude_egm96?: number | null,
    altitude_wgs84?: number | null,
    cameraSerial?: string | null,
    createdAt?: string | null,
    exifData?: string | null,
    height: number,
    id: string,
    latitude?: number | null,
    longitude?: number | null,
    pitch?: number | null,
    projectId: string,
    roll?: number | null,
    sets?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    timestamp?: string | null,
    updatedAt?: string | null,
    width: number,
    yaw?: number | null,
  } | null,
};

export type CreateImageFileMutationVariables = {
  condition?: ModelImageFileConditionInput | null,
  input: CreateImageFileInput,
};

export type CreateImageFileMutation = {
  createImageFile?:  {
    __typename: "ImageFile",
    createdAt?: string | null,
    id: string,
    imageId?: string | null,
    path: string,
    projectId: string,
    s3key: string,
    type: string,
    updatedAt?: string | null,
  } | null,
};

export type CreateImageSetMutationVariables = {
  condition?: ModelImageSetConditionInput | null,
  input: CreateImageSetInput,
};

export type CreateImageSetMutation = {
  createImageSet?:  {
    __typename: "ImageSet",
    createdAt?: string | null,
    id: string,
    images?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type CreateImageSetMembershipMutationVariables = {
  condition?: ModelImageSetMembershipConditionInput | null,
  input: CreateImageSetMembershipInput,
};

export type CreateImageSetMembershipMutation = {
  createImageSetMembership?:  {
    __typename: "ImageSetMembership",
    createdAt?: string | null,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt?: string | null,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: string | null,
      updatedAt?: string | null,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    imageSet?:  {
      __typename: "ImageSet",
      createdAt?: string | null,
      id: string,
      name: string,
      projectId: string,
      updatedAt?: string | null,
    } | null,
    imageSetId: string,
    updatedAt?: string | null,
  } | null,
};

export type CreateLocationMutationVariables = {
  condition?: ModelLocationConditionInput | null,
  input: CreateLocationInput,
};

export type CreateLocationMutation = {
  createLocation?:  {
    __typename: "Location",
    confidence?: number | null,
    createdAt?: string | null,
    height?: number | null,
    id: string,
    imageId?: string | null,
    projectId: string,
    setId: string,
    source: string,
    updatedAt?: string | null,
    width?: number | null,
    x: number,
    y: number,
  } | null,
};

export type CreateLocationSetMutationVariables = {
  condition?: ModelLocationSetConditionInput | null,
  input: CreateLocationSetInput,
};

export type CreateLocationSetMutation = {
  createLocationSet?:  {
    __typename: "LocationSet",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type CreateObjectMutationVariables = {
  condition?: ModelObjectConditionInput | null,
  input: CreateObjectInput,
};

export type CreateObjectMutation = {
  createObject?:  {
    __typename: "Object",
    categoryId: string,
    createdAt?: string | null,
    id: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type CreateObservationMutationVariables = {
  condition?: ModelObservationConditionInput | null,
  input: CreateObservationInput,
};

export type CreateObservationMutation = {
  createObservation?:  {
    __typename: "Observation",
    annotationSetId: string,
    createdAt?: string | null,
    id: string,
    locationId: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type CreateProjectMutationVariables = {
  condition?: ModelProjectConditionInput | null,
  input: CreateProjectInput,
};

export type CreateProjectMutation = {
  createProject?:  {
    __typename: "Project",
    createdAt?: string | null,
    id: string,
    name: string,
    updatedAt?: string | null,
  } | null,
};

export type CreateQueueMutationVariables = {
  condition?: ModelQueueConditionInput | null,
  input: CreateQueueInput,
};

export type CreateQueueMutation = {
  createQueue?:  {
    __typename: "Queue",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
    url: string,
  } | null,
};

export type CreateUserProjectMembershipMutationVariables = {
  condition?: ModelUserProjectMembershipConditionInput | null,
  input: CreateUserProjectMembershipInput,
};

export type CreateUserProjectMembershipMutation = {
  createUserProjectMembership?:  {
    __typename: "UserProjectMembership",
    createdAt?: string | null,
    id: string,
    isAdmin?: number | null,
    projectId: string,
    queueUrl?: string | null,
    updatedAt?: string | null,
    userId: string,
  } | null,
};

export type DeleteAnnotationMutationVariables = {
  condition?: ModelAnnotationConditionInput | null,
  input: DeleteAnnotationInput,
};

export type DeleteAnnotationMutation = {
  deleteAnnotation?:  {
    __typename: "Annotation",
    categoryId: string,
    createdAt?: string | null,
    id: string,
    imageId: string,
    objectId?: string | null,
    obscured?: number | null,
    projectId: string,
    setId: string,
    source: string,
    updatedAt?: string | null,
    x: number,
    y: number,
  } | null,
};

export type DeleteAnnotationSetMutationVariables = {
  condition?: ModelAnnotationSetConditionInput | null,
  input: DeleteAnnotationSetInput,
};

export type DeleteAnnotationSetMutation = {
  deleteAnnotationSet?:  {
    __typename: "AnnotationSet",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type DeleteCategoryMutationVariables = {
  condition?: ModelCategoryConditionInput | null,
  input: DeleteCategoryInput,
};

export type DeleteCategoryMutation = {
  deleteCategory?:  {
    __typename: "Category",
    color?: string | null,
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    shortcutKey?: string | null,
    updatedAt?: string | null,
  } | null,
};

export type DeleteImageMutationVariables = {
  condition?: ModelImageConditionInput | null,
  input: DeleteImageInput,
};

export type DeleteImageMutation = {
  deleteImage?:  {
    __typename: "Image",
    altitude_agl?: number | null,
    altitude_egm96?: number | null,
    altitude_wgs84?: number | null,
    cameraSerial?: string | null,
    createdAt?: string | null,
    exifData?: string | null,
    height: number,
    id: string,
    latitude?: number | null,
    longitude?: number | null,
    pitch?: number | null,
    projectId: string,
    roll?: number | null,
    sets?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    timestamp?: string | null,
    updatedAt?: string | null,
    width: number,
    yaw?: number | null,
  } | null,
};

export type DeleteImageFileMutationVariables = {
  condition?: ModelImageFileConditionInput | null,
  input: DeleteImageFileInput,
};

export type DeleteImageFileMutation = {
  deleteImageFile?:  {
    __typename: "ImageFile",
    createdAt?: string | null,
    id: string,
    imageId?: string | null,
    path: string,
    projectId: string,
    s3key: string,
    type: string,
    updatedAt?: string | null,
  } | null,
};

export type DeleteImageSetMutationVariables = {
  condition?: ModelImageSetConditionInput | null,
  input: DeleteImageSetInput,
};

export type DeleteImageSetMutation = {
  deleteImageSet?:  {
    __typename: "ImageSet",
    createdAt?: string | null,
    id: string,
    images?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type DeleteImageSetMembershipMutationVariables = {
  condition?: ModelImageSetMembershipConditionInput | null,
  input: DeleteImageSetMembershipInput,
};

export type DeleteImageSetMembershipMutation = {
  deleteImageSetMembership?:  {
    __typename: "ImageSetMembership",
    createdAt?: string | null,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt?: string | null,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: string | null,
      updatedAt?: string | null,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    imageSet?:  {
      __typename: "ImageSet",
      createdAt?: string | null,
      id: string,
      name: string,
      projectId: string,
      updatedAt?: string | null,
    } | null,
    imageSetId: string,
    updatedAt?: string | null,
  } | null,
};

export type DeleteLocationMutationVariables = {
  condition?: ModelLocationConditionInput | null,
  input: DeleteLocationInput,
};

export type DeleteLocationMutation = {
  deleteLocation?:  {
    __typename: "Location",
    confidence?: number | null,
    createdAt?: string | null,
    height?: number | null,
    id: string,
    imageId?: string | null,
    projectId: string,
    setId: string,
    source: string,
    updatedAt?: string | null,
    width?: number | null,
    x: number,
    y: number,
  } | null,
};

export type DeleteLocationSetMutationVariables = {
  condition?: ModelLocationSetConditionInput | null,
  input: DeleteLocationSetInput,
};

export type DeleteLocationSetMutation = {
  deleteLocationSet?:  {
    __typename: "LocationSet",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type DeleteObjectMutationVariables = {
  condition?: ModelObjectConditionInput | null,
  input: DeleteObjectInput,
};

export type DeleteObjectMutation = {
  deleteObject?:  {
    __typename: "Object",
    categoryId: string,
    createdAt?: string | null,
    id: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type DeleteObservationMutationVariables = {
  condition?: ModelObservationConditionInput | null,
  input: DeleteObservationInput,
};

export type DeleteObservationMutation = {
  deleteObservation?:  {
    __typename: "Observation",
    annotationSetId: string,
    createdAt?: string | null,
    id: string,
    locationId: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type DeleteProjectMutationVariables = {
  condition?: ModelProjectConditionInput | null,
  input: DeleteProjectInput,
};

export type DeleteProjectMutation = {
  deleteProject?:  {
    __typename: "Project",
    createdAt?: string | null,
    id: string,
    name: string,
    updatedAt?: string | null,
  } | null,
};

export type DeleteQueueMutationVariables = {
  condition?: ModelQueueConditionInput | null,
  input: DeleteQueueInput,
};

export type DeleteQueueMutation = {
  deleteQueue?:  {
    __typename: "Queue",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
    url: string,
  } | null,
};

export type DeleteUserProjectMembershipMutationVariables = {
  condition?: ModelUserProjectMembershipConditionInput | null,
  input: DeleteUserProjectMembershipInput,
};

export type DeleteUserProjectMembershipMutation = {
  deleteUserProjectMembership?:  {
    __typename: "UserProjectMembership",
    createdAt?: string | null,
    id: string,
    isAdmin?: number | null,
    projectId: string,
    queueUrl?: string | null,
    updatedAt?: string | null,
    userId: string,
  } | null,
};

export type ProcessImagesMutationVariables = {
  model: string,
  s3keys: Array< string | null >,
  threshold?: number | null,
};

export type ProcessImagesMutation = {
  processImages?: string | null,
};

export type PublishMutationVariables = {
  channelName: string,
  content: string,
};

export type PublishMutation = {
  publish?:  {
    __typename: "Message",
    channelName: string,
    content: string,
  } | null,
};

export type RemoveUserFromGroupMutationVariables = {
  groupName: string,
  userId: string,
};

export type RemoveUserFromGroupMutation = {
  removeUserFromGroup?: string | null,
};

export type UpdateAnnotationMutationVariables = {
  condition?: ModelAnnotationConditionInput | null,
  input: UpdateAnnotationInput,
};

export type UpdateAnnotationMutation = {
  updateAnnotation?:  {
    __typename: "Annotation",
    categoryId: string,
    createdAt?: string | null,
    id: string,
    imageId: string,
    objectId?: string | null,
    obscured?: number | null,
    projectId: string,
    setId: string,
    source: string,
    updatedAt?: string | null,
    x: number,
    y: number,
  } | null,
};

export type UpdateAnnotationSetMutationVariables = {
  condition?: ModelAnnotationSetConditionInput | null,
  input: UpdateAnnotationSetInput,
};

export type UpdateAnnotationSetMutation = {
  updateAnnotationSet?:  {
    __typename: "AnnotationSet",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type UpdateCategoryMutationVariables = {
  condition?: ModelCategoryConditionInput | null,
  input: UpdateCategoryInput,
};

export type UpdateCategoryMutation = {
  updateCategory?:  {
    __typename: "Category",
    color?: string | null,
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    shortcutKey?: string | null,
    updatedAt?: string | null,
  } | null,
};

export type UpdateImageMutationVariables = {
  condition?: ModelImageConditionInput | null,
  input: UpdateImageInput,
};

export type UpdateImageMutation = {
  updateImage?:  {
    __typename: "Image",
    altitude_agl?: number | null,
    altitude_egm96?: number | null,
    altitude_wgs84?: number | null,
    cameraSerial?: string | null,
    createdAt?: string | null,
    exifData?: string | null,
    height: number,
    id: string,
    latitude?: number | null,
    longitude?: number | null,
    pitch?: number | null,
    projectId: string,
    roll?: number | null,
    sets?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    timestamp?: string | null,
    updatedAt?: string | null,
    width: number,
    yaw?: number | null,
  } | null,
};

export type UpdateImageFileMutationVariables = {
  condition?: ModelImageFileConditionInput | null,
  input: UpdateImageFileInput,
};

export type UpdateImageFileMutation = {
  updateImageFile?:  {
    __typename: "ImageFile",
    createdAt?: string | null,
    id: string,
    imageId?: string | null,
    path: string,
    projectId: string,
    s3key: string,
    type: string,
    updatedAt?: string | null,
  } | null,
};

export type UpdateImageSetMutationVariables = {
  condition?: ModelImageSetConditionInput | null,
  input: UpdateImageSetInput,
};

export type UpdateImageSetMutation = {
  updateImageSet?:  {
    __typename: "ImageSet",
    createdAt?: string | null,
    id: string,
    images?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type UpdateImageSetMembershipMutationVariables = {
  condition?: ModelImageSetMembershipConditionInput | null,
  input: UpdateImageSetMembershipInput,
};

export type UpdateImageSetMembershipMutation = {
  updateImageSetMembership?:  {
    __typename: "ImageSetMembership",
    createdAt?: string | null,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt?: string | null,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: string | null,
      updatedAt?: string | null,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    imageSet?:  {
      __typename: "ImageSet",
      createdAt?: string | null,
      id: string,
      name: string,
      projectId: string,
      updatedAt?: string | null,
    } | null,
    imageSetId: string,
    updatedAt?: string | null,
  } | null,
};

export type UpdateLocationMutationVariables = {
  condition?: ModelLocationConditionInput | null,
  input: UpdateLocationInput,
};

export type UpdateLocationMutation = {
  updateLocation?:  {
    __typename: "Location",
    confidence?: number | null,
    createdAt?: string | null,
    height?: number | null,
    id: string,
    imageId?: string | null,
    projectId: string,
    setId: string,
    source: string,
    updatedAt?: string | null,
    width?: number | null,
    x: number,
    y: number,
  } | null,
};

export type UpdateLocationSetMutationVariables = {
  condition?: ModelLocationSetConditionInput | null,
  input: UpdateLocationSetInput,
};

export type UpdateLocationSetMutation = {
  updateLocationSet?:  {
    __typename: "LocationSet",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type UpdateObjectMutationVariables = {
  condition?: ModelObjectConditionInput | null,
  input: UpdateObjectInput,
};

export type UpdateObjectMutation = {
  updateObject?:  {
    __typename: "Object",
    categoryId: string,
    createdAt?: string | null,
    id: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type UpdateObservationMutationVariables = {
  condition?: ModelObservationConditionInput | null,
  input: UpdateObservationInput,
};

export type UpdateObservationMutation = {
  updateObservation?:  {
    __typename: "Observation",
    annotationSetId: string,
    createdAt?: string | null,
    id: string,
    locationId: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type UpdateProjectMutationVariables = {
  condition?: ModelProjectConditionInput | null,
  input: UpdateProjectInput,
};

export type UpdateProjectMutation = {
  updateProject?:  {
    __typename: "Project",
    createdAt?: string | null,
    id: string,
    name: string,
    updatedAt?: string | null,
  } | null,
};

export type UpdateQueueMutationVariables = {
  condition?: ModelQueueConditionInput | null,
  input: UpdateQueueInput,
};

export type UpdateQueueMutation = {
  updateQueue?:  {
    __typename: "Queue",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
    url: string,
  } | null,
};

export type UpdateUserProjectMembershipMutationVariables = {
  condition?: ModelUserProjectMembershipConditionInput | null,
  input: UpdateUserProjectMembershipInput,
};

export type UpdateUserProjectMembershipMutation = {
  updateUserProjectMembership?:  {
    __typename: "UserProjectMembership",
    createdAt?: string | null,
    id: string,
    isAdmin?: number | null,
    projectId: string,
    queueUrl?: string | null,
    updatedAt?: string | null,
    userId: string,
  } | null,
};

export type OnCreateAnnotationSubscriptionVariables = {
  filter?: ModelSubscriptionAnnotationFilterInput | null,
};

export type OnCreateAnnotationSubscription = {
  onCreateAnnotation?:  {
    __typename: "Annotation",
    categoryId: string,
    createdAt?: string | null,
    id: string,
    imageId: string,
    objectId?: string | null,
    obscured?: number | null,
    projectId: string,
    setId: string,
    source: string,
    updatedAt?: string | null,
    x: number,
    y: number,
  } | null,
};

export type OnCreateAnnotationSetSubscriptionVariables = {
  filter?: ModelSubscriptionAnnotationSetFilterInput | null,
};

export type OnCreateAnnotationSetSubscription = {
  onCreateAnnotationSet?:  {
    __typename: "AnnotationSet",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type OnCreateCategorySubscriptionVariables = {
  filter?: ModelSubscriptionCategoryFilterInput | null,
};

export type OnCreateCategorySubscription = {
  onCreateCategory?:  {
    __typename: "Category",
    color?: string | null,
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    shortcutKey?: string | null,
    updatedAt?: string | null,
  } | null,
};

export type OnCreateImageSubscriptionVariables = {
  filter?: ModelSubscriptionImageFilterInput | null,
};

export type OnCreateImageSubscription = {
  onCreateImage?:  {
    __typename: "Image",
    altitude_agl?: number | null,
    altitude_egm96?: number | null,
    altitude_wgs84?: number | null,
    cameraSerial?: string | null,
    createdAt?: string | null,
    exifData?: string | null,
    height: number,
    id: string,
    latitude?: number | null,
    longitude?: number | null,
    pitch?: number | null,
    projectId: string,
    roll?: number | null,
    sets?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    timestamp?: string | null,
    updatedAt?: string | null,
    width: number,
    yaw?: number | null,
  } | null,
};

export type OnCreateImageFileSubscriptionVariables = {
  filter?: ModelSubscriptionImageFileFilterInput | null,
};

export type OnCreateImageFileSubscription = {
  onCreateImageFile?:  {
    __typename: "ImageFile",
    createdAt?: string | null,
    id: string,
    imageId?: string | null,
    path: string,
    projectId: string,
    s3key: string,
    type: string,
    updatedAt?: string | null,
  } | null,
};

export type OnCreateImageSetSubscriptionVariables = {
  filter?: ModelSubscriptionImageSetFilterInput | null,
};

export type OnCreateImageSetSubscription = {
  onCreateImageSet?:  {
    __typename: "ImageSet",
    createdAt?: string | null,
    id: string,
    images?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type OnCreateImageSetMembershipSubscriptionVariables = {
  filter?: ModelSubscriptionImageSetMembershipFilterInput | null,
};

export type OnCreateImageSetMembershipSubscription = {
  onCreateImageSetMembership?:  {
    __typename: "ImageSetMembership",
    createdAt?: string | null,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt?: string | null,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: string | null,
      updatedAt?: string | null,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    imageSet?:  {
      __typename: "ImageSet",
      createdAt?: string | null,
      id: string,
      name: string,
      projectId: string,
      updatedAt?: string | null,
    } | null,
    imageSetId: string,
    updatedAt?: string | null,
  } | null,
};

export type OnCreateLocationSubscriptionVariables = {
  filter?: ModelSubscriptionLocationFilterInput | null,
};

export type OnCreateLocationSubscription = {
  onCreateLocation?:  {
    __typename: "Location",
    confidence?: number | null,
    createdAt?: string | null,
    height?: number | null,
    id: string,
    imageId?: string | null,
    projectId: string,
    setId: string,
    source: string,
    updatedAt?: string | null,
    width?: number | null,
    x: number,
    y: number,
  } | null,
};

export type OnCreateLocationSetSubscriptionVariables = {
  filter?: ModelSubscriptionLocationSetFilterInput | null,
};

export type OnCreateLocationSetSubscription = {
  onCreateLocationSet?:  {
    __typename: "LocationSet",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type OnCreateObjectSubscriptionVariables = {
  filter?: ModelSubscriptionObjectFilterInput | null,
};

export type OnCreateObjectSubscription = {
  onCreateObject?:  {
    __typename: "Object",
    categoryId: string,
    createdAt?: string | null,
    id: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type OnCreateObservationSubscriptionVariables = {
  filter?: ModelSubscriptionObservationFilterInput | null,
};

export type OnCreateObservationSubscription = {
  onCreateObservation?:  {
    __typename: "Observation",
    annotationSetId: string,
    createdAt?: string | null,
    id: string,
    locationId: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type OnCreateProjectSubscriptionVariables = {
  filter?: ModelSubscriptionProjectFilterInput | null,
};

export type OnCreateProjectSubscription = {
  onCreateProject?:  {
    __typename: "Project",
    createdAt?: string | null,
    id: string,
    name: string,
    updatedAt?: string | null,
  } | null,
};

export type OnCreateQueueSubscriptionVariables = {
  filter?: ModelSubscriptionQueueFilterInput | null,
};

export type OnCreateQueueSubscription = {
  onCreateQueue?:  {
    __typename: "Queue",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
    url: string,
  } | null,
};

export type OnCreateUserProjectMembershipSubscriptionVariables = {
  filter?: ModelSubscriptionUserProjectMembershipFilterInput | null,
};

export type OnCreateUserProjectMembershipSubscription = {
  onCreateUserProjectMembership?:  {
    __typename: "UserProjectMembership",
    createdAt?: string | null,
    id: string,
    isAdmin?: number | null,
    projectId: string,
    queueUrl?: string | null,
    updatedAt?: string | null,
    userId: string,
  } | null,
};

export type OnDeleteAnnotationSubscriptionVariables = {
  filter?: ModelSubscriptionAnnotationFilterInput | null,
};

export type OnDeleteAnnotationSubscription = {
  onDeleteAnnotation?:  {
    __typename: "Annotation",
    categoryId: string,
    createdAt?: string | null,
    id: string,
    imageId: string,
    objectId?: string | null,
    obscured?: number | null,
    projectId: string,
    setId: string,
    source: string,
    updatedAt?: string | null,
    x: number,
    y: number,
  } | null,
};

export type OnDeleteAnnotationSetSubscriptionVariables = {
  filter?: ModelSubscriptionAnnotationSetFilterInput | null,
};

export type OnDeleteAnnotationSetSubscription = {
  onDeleteAnnotationSet?:  {
    __typename: "AnnotationSet",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type OnDeleteCategorySubscriptionVariables = {
  filter?: ModelSubscriptionCategoryFilterInput | null,
};

export type OnDeleteCategorySubscription = {
  onDeleteCategory?:  {
    __typename: "Category",
    color?: string | null,
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    shortcutKey?: string | null,
    updatedAt?: string | null,
  } | null,
};

export type OnDeleteImageSubscriptionVariables = {
  filter?: ModelSubscriptionImageFilterInput | null,
};

export type OnDeleteImageSubscription = {
  onDeleteImage?:  {
    __typename: "Image",
    altitude_agl?: number | null,
    altitude_egm96?: number | null,
    altitude_wgs84?: number | null,
    cameraSerial?: string | null,
    createdAt?: string | null,
    exifData?: string | null,
    height: number,
    id: string,
    latitude?: number | null,
    longitude?: number | null,
    pitch?: number | null,
    projectId: string,
    roll?: number | null,
    sets?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    timestamp?: string | null,
    updatedAt?: string | null,
    width: number,
    yaw?: number | null,
  } | null,
};

export type OnDeleteImageFileSubscriptionVariables = {
  filter?: ModelSubscriptionImageFileFilterInput | null,
};

export type OnDeleteImageFileSubscription = {
  onDeleteImageFile?:  {
    __typename: "ImageFile",
    createdAt?: string | null,
    id: string,
    imageId?: string | null,
    path: string,
    projectId: string,
    s3key: string,
    type: string,
    updatedAt?: string | null,
  } | null,
};

export type OnDeleteImageSetSubscriptionVariables = {
  filter?: ModelSubscriptionImageSetFilterInput | null,
};

export type OnDeleteImageSetSubscription = {
  onDeleteImageSet?:  {
    __typename: "ImageSet",
    createdAt?: string | null,
    id: string,
    images?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type OnDeleteImageSetMembershipSubscriptionVariables = {
  filter?: ModelSubscriptionImageSetMembershipFilterInput | null,
};

export type OnDeleteImageSetMembershipSubscription = {
  onDeleteImageSetMembership?:  {
    __typename: "ImageSetMembership",
    createdAt?: string | null,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt?: string | null,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: string | null,
      updatedAt?: string | null,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    imageSet?:  {
      __typename: "ImageSet",
      createdAt?: string | null,
      id: string,
      name: string,
      projectId: string,
      updatedAt?: string | null,
    } | null,
    imageSetId: string,
    updatedAt?: string | null,
  } | null,
};

export type OnDeleteLocationSubscriptionVariables = {
  filter?: ModelSubscriptionLocationFilterInput | null,
};

export type OnDeleteLocationSubscription = {
  onDeleteLocation?:  {
    __typename: "Location",
    confidence?: number | null,
    createdAt?: string | null,
    height?: number | null,
    id: string,
    imageId?: string | null,
    projectId: string,
    setId: string,
    source: string,
    updatedAt?: string | null,
    width?: number | null,
    x: number,
    y: number,
  } | null,
};

export type OnDeleteLocationSetSubscriptionVariables = {
  filter?: ModelSubscriptionLocationSetFilterInput | null,
};

export type OnDeleteLocationSetSubscription = {
  onDeleteLocationSet?:  {
    __typename: "LocationSet",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type OnDeleteObjectSubscriptionVariables = {
  filter?: ModelSubscriptionObjectFilterInput | null,
};

export type OnDeleteObjectSubscription = {
  onDeleteObject?:  {
    __typename: "Object",
    categoryId: string,
    createdAt?: string | null,
    id: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type OnDeleteObservationSubscriptionVariables = {
  filter?: ModelSubscriptionObservationFilterInput | null,
};

export type OnDeleteObservationSubscription = {
  onDeleteObservation?:  {
    __typename: "Observation",
    annotationSetId: string,
    createdAt?: string | null,
    id: string,
    locationId: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type OnDeleteProjectSubscriptionVariables = {
  filter?: ModelSubscriptionProjectFilterInput | null,
};

export type OnDeleteProjectSubscription = {
  onDeleteProject?:  {
    __typename: "Project",
    createdAt?: string | null,
    id: string,
    name: string,
    updatedAt?: string | null,
  } | null,
};

export type OnDeleteQueueSubscriptionVariables = {
  filter?: ModelSubscriptionQueueFilterInput | null,
};

export type OnDeleteQueueSubscription = {
  onDeleteQueue?:  {
    __typename: "Queue",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
    url: string,
  } | null,
};

export type OnDeleteUserProjectMembershipSubscriptionVariables = {
  filter?: ModelSubscriptionUserProjectMembershipFilterInput | null,
};

export type OnDeleteUserProjectMembershipSubscription = {
  onDeleteUserProjectMembership?:  {
    __typename: "UserProjectMembership",
    createdAt?: string | null,
    id: string,
    isAdmin?: number | null,
    projectId: string,
    queueUrl?: string | null,
    updatedAt?: string | null,
    userId: string,
  } | null,
};

export type OnUpdateAnnotationSubscriptionVariables = {
  filter?: ModelSubscriptionAnnotationFilterInput | null,
};

export type OnUpdateAnnotationSubscription = {
  onUpdateAnnotation?:  {
    __typename: "Annotation",
    categoryId: string,
    createdAt?: string | null,
    id: string,
    imageId: string,
    objectId?: string | null,
    obscured?: number | null,
    projectId: string,
    setId: string,
    source: string,
    updatedAt?: string | null,
    x: number,
    y: number,
  } | null,
};

export type OnUpdateAnnotationSetSubscriptionVariables = {
  filter?: ModelSubscriptionAnnotationSetFilterInput | null,
};

export type OnUpdateAnnotationSetSubscription = {
  onUpdateAnnotationSet?:  {
    __typename: "AnnotationSet",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type OnUpdateCategorySubscriptionVariables = {
  filter?: ModelSubscriptionCategoryFilterInput | null,
};

export type OnUpdateCategorySubscription = {
  onUpdateCategory?:  {
    __typename: "Category",
    color?: string | null,
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    shortcutKey?: string | null,
    updatedAt?: string | null,
  } | null,
};

export type OnUpdateImageSubscriptionVariables = {
  filter?: ModelSubscriptionImageFilterInput | null,
};

export type OnUpdateImageSubscription = {
  onUpdateImage?:  {
    __typename: "Image",
    altitude_agl?: number | null,
    altitude_egm96?: number | null,
    altitude_wgs84?: number | null,
    cameraSerial?: string | null,
    createdAt?: string | null,
    exifData?: string | null,
    height: number,
    id: string,
    latitude?: number | null,
    longitude?: number | null,
    pitch?: number | null,
    projectId: string,
    roll?: number | null,
    sets?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    timestamp?: string | null,
    updatedAt?: string | null,
    width: number,
    yaw?: number | null,
  } | null,
};

export type OnUpdateImageFileSubscriptionVariables = {
  filter?: ModelSubscriptionImageFileFilterInput | null,
};

export type OnUpdateImageFileSubscription = {
  onUpdateImageFile?:  {
    __typename: "ImageFile",
    createdAt?: string | null,
    id: string,
    imageId?: string | null,
    path: string,
    projectId: string,
    s3key: string,
    type: string,
    updatedAt?: string | null,
  } | null,
};

export type OnUpdateImageSetSubscriptionVariables = {
  filter?: ModelSubscriptionImageSetFilterInput | null,
};

export type OnUpdateImageSetSubscription = {
  onUpdateImageSet?:  {
    __typename: "ImageSet",
    createdAt?: string | null,
    id: string,
    images?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type OnUpdateImageSetMembershipSubscriptionVariables = {
  filter?: ModelSubscriptionImageSetMembershipFilterInput | null,
};

export type OnUpdateImageSetMembershipSubscription = {
  onUpdateImageSetMembership?:  {
    __typename: "ImageSetMembership",
    createdAt?: string | null,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt?: string | null,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: string | null,
      updatedAt?: string | null,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    imageSet?:  {
      __typename: "ImageSet",
      createdAt?: string | null,
      id: string,
      name: string,
      projectId: string,
      updatedAt?: string | null,
    } | null,
    imageSetId: string,
    updatedAt?: string | null,
  } | null,
};

export type OnUpdateLocationSubscriptionVariables = {
  filter?: ModelSubscriptionLocationFilterInput | null,
};

export type OnUpdateLocationSubscription = {
  onUpdateLocation?:  {
    __typename: "Location",
    confidence?: number | null,
    createdAt?: string | null,
    height?: number | null,
    id: string,
    imageId?: string | null,
    projectId: string,
    setId: string,
    source: string,
    updatedAt?: string | null,
    width?: number | null,
    x: number,
    y: number,
  } | null,
};

export type OnUpdateLocationSetSubscriptionVariables = {
  filter?: ModelSubscriptionLocationSetFilterInput | null,
};

export type OnUpdateLocationSetSubscription = {
  onUpdateLocationSet?:  {
    __typename: "LocationSet",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type OnUpdateObjectSubscriptionVariables = {
  filter?: ModelSubscriptionObjectFilterInput | null,
};

export type OnUpdateObjectSubscription = {
  onUpdateObject?:  {
    __typename: "Object",
    categoryId: string,
    createdAt?: string | null,
    id: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type OnUpdateObservationSubscriptionVariables = {
  filter?: ModelSubscriptionObservationFilterInput | null,
};

export type OnUpdateObservationSubscription = {
  onUpdateObservation?:  {
    __typename: "Observation",
    annotationSetId: string,
    createdAt?: string | null,
    id: string,
    locationId: string,
    projectId: string,
    updatedAt?: string | null,
  } | null,
};

export type OnUpdateProjectSubscriptionVariables = {
  filter?: ModelSubscriptionProjectFilterInput | null,
};

export type OnUpdateProjectSubscription = {
  onUpdateProject?:  {
    __typename: "Project",
    createdAt?: string | null,
    id: string,
    name: string,
    updatedAt?: string | null,
  } | null,
};

export type OnUpdateQueueSubscriptionVariables = {
  filter?: ModelSubscriptionQueueFilterInput | null,
};

export type OnUpdateQueueSubscription = {
  onUpdateQueue?:  {
    __typename: "Queue",
    createdAt?: string | null,
    id: string,
    name: string,
    projectId: string,
    updatedAt?: string | null,
    url: string,
  } | null,
};

export type OnUpdateUserProjectMembershipSubscriptionVariables = {
  filter?: ModelSubscriptionUserProjectMembershipFilterInput | null,
};

export type OnUpdateUserProjectMembershipSubscription = {
  onUpdateUserProjectMembership?:  {
    __typename: "UserProjectMembership",
    createdAt?: string | null,
    id: string,
    isAdmin?: number | null,
    projectId: string,
    queueUrl?: string | null,
    updatedAt?: string | null,
    userId: string,
  } | null,
};

export type ReceiveSubscriptionVariables = {
};

export type ReceiveSubscription = {
  receive?:  {
    __typename: "Message",
    channelName: string,
    content: string,
  } | null,
};
