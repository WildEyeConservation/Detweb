/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type ModelAnnotationSetFilterInput = {
  and?: Array< ModelAnnotationSetFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  id?: ModelIDInput | null,
  name?: ModelStringInput | null,
  not?: ModelAnnotationSetFilterInput | null,
  or?: Array< ModelAnnotationSetFilterInput | null > | null,
  projectId?: ModelIDInput | null,
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

export type ModelIDInput = {
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

export enum ModelSortDirection {
  ASC = "ASC",
  DESC = "DESC",
}


export type ModelAnnotationSetConnection = {
  __typename: "ModelAnnotationSetConnection",
  items:  Array<AnnotationSet | null >,
  nextToken?: string | null,
};

export type AnnotationSet = {
  __typename: "AnnotationSet",
  annotations?: ModelAnnotationConnection | null,
  createdAt: string,
  id: string,
  name: string,
  observations?: ModelObservationConnection | null,
  project?: Project | null,
  projectId: string,
  updatedAt: string,
};

export type ModelAnnotationConnection = {
  __typename: "ModelAnnotationConnection",
  items:  Array<Annotation | null >,
  nextToken?: string | null,
};

export type Annotation = {
  __typename: "Annotation",
  category?: Category | null,
  categoryId: string,
  createdAt: string,
  id: string,
  image?: Image | null,
  imageId: string,
  object?: Object | null,
  objectId?: string | null,
  obscured?: boolean | null,
  owner?: string | null,
  project?: Project | null,
  projectId: string,
  set?: AnnotationSet | null,
  setId: string,
  source: string,
  updatedAt: string,
  x: number,
  y: number,
};

export type Category = {
  __typename: "Category",
  annotations?: ModelAnnotationConnection | null,
  color?: string | null,
  createdAt: string,
  id: string,
  name: string,
  objects?: ModelObjectConnection | null,
  project?: Project | null,
  projectId: string,
  shortcutKey?: string | null,
  updatedAt: string,
};

export type ModelObjectConnection = {
  __typename: "ModelObjectConnection",
  items:  Array<Object | null >,
  nextToken?: string | null,
};

export type Object = {
  __typename: "Object",
  annotations?: ModelAnnotationConnection | null,
  category?: Category | null,
  categoryId: string,
  createdAt: string,
  id: string,
  project?: Project | null,
  projectId: string,
  updatedAt: string,
};

export type Project = {
  __typename: "Project",
  annotationSets?: ModelAnnotationSetConnection | null,
  annotations?: ModelAnnotationConnection | null,
  categories?: ModelCategoryConnection | null,
  createdAt: string,
  id: string,
  imageFiles?: ModelImageFileConnection | null,
  imageSets?: ModelImageSetConnection | null,
  images?: ModelImageConnection | null,
  locationSets?: ModelLocationSetConnection | null,
  locations?: ModelLocationConnection | null,
  members?: ModelUserProjectMembershipConnection | null,
  name: string,
  objects?: ModelObjectConnection | null,
  observations?: ModelObservationConnection | null,
  queues?: ModelQueueConnection | null,
  updatedAt: string,
};

export type ModelCategoryConnection = {
  __typename: "ModelCategoryConnection",
  items:  Array<Category | null >,
  nextToken?: string | null,
};

export type ModelImageFileConnection = {
  __typename: "ModelImageFileConnection",
  items:  Array<ImageFile | null >,
  nextToken?: string | null,
};

export type ImageFile = {
  __typename: "ImageFile",
  createdAt: string,
  id: string,
  image?: Image | null,
  imageId?: string | null,
  key: string,
  path: string,
  project?: Project | null,
  projectId: string,
  type: string,
  updatedAt: string,
};

export type Image = {
  __typename: "Image",
  altitude_agl?: number | null,
  altitude_egm96?: number | null,
  altitude_wgs84?: number | null,
  annotations?: ModelAnnotationConnection | null,
  cameraSerial?: string | null,
  createdAt: string,
  exifData?: string | null,
  files?: ModelImageFileConnection | null,
  height: number,
  id: string,
  latitude?: number | null,
  leftNeighbours?: ModelImageNeighbourConnection | null,
  locations?: ModelLocationConnection | null,
  longitude?: number | null,
  memberships?: ModelImageSetMembershipConnection | null,
  originalPath?: string | null,
  pitch?: number | null,
  project?: Project | null,
  projectId: string,
  rightNeighbours?: ModelImageNeighbourConnection | null,
  roll?: number | null,
  timestamp?: number | null,
  updatedAt: string,
  width: number,
  yaw?: number | null,
};

export type ModelImageNeighbourConnection = {
  __typename: "ModelImageNeighbourConnection",
  items:  Array<ImageNeighbour | null >,
  nextToken?: string | null,
};

export type ImageNeighbour = {
  __typename: "ImageNeighbour",
  createdAt: string,
  homography?: Array< number | null > | null,
  image1?: Image | null,
  image1Id: string,
  image2?: Image | null,
  image2Id: string,
  updatedAt: string,
};

export type ModelLocationConnection = {
  __typename: "ModelLocationConnection",
  items:  Array<Location | null >,
  nextToken?: string | null,
};

export type Location = {
  __typename: "Location",
  confidence?: number | null,
  createdAt: string,
  height?: number | null,
  id: string,
  image?: Image | null,
  imageId?: string | null,
  observations?: ModelObservationConnection | null,
  project?: Project | null,
  projectId: string,
  set?: LocationSet | null,
  setId: string,
  sets?: ModelLocationSetMembershipConnection | null,
  source: string,
  updatedAt: string,
  width?: number | null,
  x: number,
  y: number,
};

export type ModelObservationConnection = {
  __typename: "ModelObservationConnection",
  items:  Array<Observation | null >,
  nextToken?: string | null,
};

export type Observation = {
  __typename: "Observation",
  annotationSet?: AnnotationSet | null,
  annotationSetId: string,
  createdAt: string,
  id: string,
  location?: Location | null,
  locationId: string,
  owner?: string | null,
  project?: Project | null,
  projectId: string,
  updatedAt: string,
};

export type LocationSet = {
  __typename: "LocationSet",
  createdAt: string,
  id: string,
  locations?: ModelLocationConnection | null,
  memberships?: ModelLocationSetMembershipConnection | null,
  name: string,
  project?: Project | null,
  projectId: string,
  updatedAt: string,
};

export type ModelLocationSetMembershipConnection = {
  __typename: "ModelLocationSetMembershipConnection",
  items:  Array<LocationSetMembership | null >,
  nextToken?: string | null,
};

export type LocationSetMembership = {
  __typename: "LocationSetMembership",
  createdAt: string,
  id: string,
  location?: Location | null,
  locationId: string,
  locationSet?: LocationSet | null,
  locationSetId: string,
  updatedAt: string,
};

export type ModelImageSetMembershipConnection = {
  __typename: "ModelImageSetMembershipConnection",
  items:  Array<ImageSetMembership | null >,
  nextToken?: string | null,
};

export type ImageSetMembership = {
  __typename: "ImageSetMembership",
  createdAt: string,
  id: string,
  image?: Image | null,
  imageId: string,
  imageSet?: ImageSet | null,
  imageSetId: string,
  updatedAt: string,
};

export type ImageSet = {
  __typename: "ImageSet",
  createdAt: string,
  id: string,
  images?: ModelImageSetMembershipConnection | null,
  name: string,
  project?: Project | null,
  projectId: string,
  updatedAt: string,
};

export type ModelImageSetConnection = {
  __typename: "ModelImageSetConnection",
  items:  Array<ImageSet | null >,
  nextToken?: string | null,
};

export type ModelImageConnection = {
  __typename: "ModelImageConnection",
  items:  Array<Image | null >,
  nextToken?: string | null,
};

export type ModelLocationSetConnection = {
  __typename: "ModelLocationSetConnection",
  items:  Array<LocationSet | null >,
  nextToken?: string | null,
};

export type ModelUserProjectMembershipConnection = {
  __typename: "ModelUserProjectMembershipConnection",
  items:  Array<UserProjectMembership | null >,
  nextToken?: string | null,
};

export type UserProjectMembership = {
  __typename: "UserProjectMembership",
  createdAt: string,
  id: string,
  isAdmin?: boolean | null,
  project?: Project | null,
  projectId: string,
  queue?: Queue | null,
  queueId?: string | null,
  updatedAt: string,
  userId: string,
};

export type Queue = {
  __typename: "Queue",
  createdAt: string,
  id: string,
  name: string,
  project?: Project | null,
  projectId: string,
  updatedAt: string,
  url?: string | null,
  users?: ModelUserProjectMembershipConnection | null,
};

export type ModelQueueConnection = {
  __typename: "ModelQueueConnection",
  items:  Array<Queue | null >,
  nextToken?: string | null,
};

export type ModelAnnotationFilterInput = {
  and?: Array< ModelAnnotationFilterInput | null > | null,
  categoryId?: ModelIDInput | null,
  createdAt?: ModelStringInput | null,
  id?: ModelIDInput | null,
  imageId?: ModelIDInput | null,
  not?: ModelAnnotationFilterInput | null,
  objectId?: ModelIDInput | null,
  obscured?: ModelBooleanInput | null,
  or?: Array< ModelAnnotationFilterInput | null > | null,
  owner?: ModelStringInput | null,
  projectId?: ModelIDInput | null,
  setId?: ModelIDInput | null,
  source?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  x?: ModelIntInput | null,
  y?: ModelIntInput | null,
};

export type ModelBooleanInput = {
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  eq?: boolean | null,
  ne?: boolean | null,
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

export type ModelIDKeyConditionInput = {
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  le?: string | null,
  lt?: string | null,
};

export type ModelCategoryFilterInput = {
  and?: Array< ModelCategoryFilterInput | null > | null,
  color?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  id?: ModelIDInput | null,
  name?: ModelStringInput | null,
  not?: ModelCategoryFilterInput | null,
  or?: Array< ModelCategoryFilterInput | null > | null,
  projectId?: ModelIDInput | null,
  shortcutKey?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type UserObservationStats = {
  __typename: "UserObservationStats",
  activeTime?: number | null,
  count: number,
  createdAt: string,
  lastUpdated?: number | null,
  projectId: string,
  updatedAt: string,
  userId: string,
};

export type UserStats = {
  __typename: "UserStats",
  activeTime: number,
  annotationCount: number,
  createdAt: string,
  date: string,
  observationCount: number,
  projectId: string,
  setId: string,
  updatedAt: string,
  userId: string,
};

export type ModelImageNeighbourFilterInput = {
  and?: Array< ModelImageNeighbourFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  homography?: ModelFloatInput | null,
  id?: ModelIDInput | null,
  image1Id?: ModelIDInput | null,
  image2Id?: ModelIDInput | null,
  not?: ModelImageNeighbourFilterInput | null,
  or?: Array< ModelImageNeighbourFilterInput | null > | null,
  updatedAt?: ModelStringInput | null,
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

export type ModelImageSetMembershipFilterInput = {
  and?: Array< ModelImageSetMembershipFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  id?: ModelIDInput | null,
  imageId?: ModelIDInput | null,
  imageSetId?: ModelIDInput | null,
  not?: ModelImageSetMembershipFilterInput | null,
  or?: Array< ModelImageSetMembershipFilterInput | null > | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelImageSetFilterInput = {
  and?: Array< ModelImageSetFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  id?: ModelIDInput | null,
  name?: ModelStringInput | null,
  not?: ModelImageSetFilterInput | null,
  or?: Array< ModelImageSetFilterInput | null > | null,
  projectId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelImageFileFilterInput = {
  and?: Array< ModelImageFileFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  id?: ModelIDInput | null,
  imageId?: ModelIDInput | null,
  key?: ModelStringInput | null,
  not?: ModelImageFileFilterInput | null,
  or?: Array< ModelImageFileFilterInput | null > | null,
  path?: ModelStringInput | null,
  projectId?: ModelIDInput | null,
  type?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
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
  id?: ModelIDInput | null,
  latitude?: ModelFloatInput | null,
  longitude?: ModelFloatInput | null,
  not?: ModelImageFilterInput | null,
  or?: Array< ModelImageFilterInput | null > | null,
  originalPath?: ModelStringInput | null,
  pitch?: ModelFloatInput | null,
  projectId?: ModelIDInput | null,
  roll?: ModelFloatInput | null,
  timestamp?: ModelIntInput | null,
  updatedAt?: ModelStringInput | null,
  width?: ModelIntInput | null,
  yaw?: ModelFloatInput | null,
};

export type ModelLocationSetMembershipFilterInput = {
  and?: Array< ModelLocationSetMembershipFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  id?: ModelIDInput | null,
  locationId?: ModelIDInput | null,
  locationSetId?: ModelIDInput | null,
  not?: ModelLocationSetMembershipFilterInput | null,
  or?: Array< ModelLocationSetMembershipFilterInput | null > | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelLocationSetFilterInput = {
  and?: Array< ModelLocationSetFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  id?: ModelIDInput | null,
  name?: ModelStringInput | null,
  not?: ModelLocationSetFilterInput | null,
  or?: Array< ModelLocationSetFilterInput | null > | null,
  projectId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelLocationFilterInput = {
  and?: Array< ModelLocationFilterInput | null > | null,
  confidence?: ModelFloatInput | null,
  createdAt?: ModelStringInput | null,
  height?: ModelIntInput | null,
  id?: ModelIDInput | null,
  imageId?: ModelIDInput | null,
  not?: ModelLocationFilterInput | null,
  or?: Array< ModelLocationFilterInput | null > | null,
  projectId?: ModelIDInput | null,
  setId?: ModelIDInput | null,
  source?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  width?: ModelIntInput | null,
  x?: ModelIntInput | null,
  y?: ModelIntInput | null,
};

export type ModelObjectFilterInput = {
  and?: Array< ModelObjectFilterInput | null > | null,
  categoryId?: ModelIDInput | null,
  createdAt?: ModelStringInput | null,
  id?: ModelIDInput | null,
  not?: ModelObjectFilterInput | null,
  or?: Array< ModelObjectFilterInput | null > | null,
  projectId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelObservationFilterInput = {
  and?: Array< ModelObservationFilterInput | null > | null,
  annotationSetId?: ModelIDInput | null,
  createdAt?: ModelStringInput | null,
  id?: ModelIDInput | null,
  locationId?: ModelIDInput | null,
  not?: ModelObservationFilterInput | null,
  or?: Array< ModelObservationFilterInput | null > | null,
  owner?: ModelStringInput | null,
  projectId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelProjectFilterInput = {
  and?: Array< ModelProjectFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  id?: ModelIDInput | null,
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
  id?: ModelIDInput | null,
  name?: ModelStringInput | null,
  not?: ModelQueueFilterInput | null,
  or?: Array< ModelQueueFilterInput | null > | null,
  projectId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
  url?: ModelStringInput | null,
};

export type ModelUserObservationStatsFilterInput = {
  activeTime?: ModelIntInput | null,
  and?: Array< ModelUserObservationStatsFilterInput | null > | null,
  count?: ModelIntInput | null,
  createdAt?: ModelStringInput | null,
  id?: ModelIDInput | null,
  lastUpdated?: ModelIntInput | null,
  not?: ModelUserObservationStatsFilterInput | null,
  or?: Array< ModelUserObservationStatsFilterInput | null > | null,
  projectId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
  userId?: ModelIDInput | null,
};

export type ModelUserObservationStatsConnection = {
  __typename: "ModelUserObservationStatsConnection",
  items:  Array<UserObservationStats | null >,
  nextToken?: string | null,
};

export type ModelUserProjectMembershipFilterInput = {
  and?: Array< ModelUserProjectMembershipFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  id?: ModelIDInput | null,
  isAdmin?: ModelBooleanInput | null,
  not?: ModelUserProjectMembershipFilterInput | null,
  or?: Array< ModelUserProjectMembershipFilterInput | null > | null,
  projectId?: ModelIDInput | null,
  queueId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
  userId?: ModelStringInput | null,
};

export type ModelUserStatsFilterInput = {
  activeTime?: ModelFloatInput | null,
  and?: Array< ModelUserStatsFilterInput | null > | null,
  annotationCount?: ModelIntInput | null,
  createdAt?: ModelStringInput | null,
  date?: ModelStringInput | null,
  id?: ModelIDInput | null,
  not?: ModelUserStatsFilterInput | null,
  observationCount?: ModelIntInput | null,
  or?: Array< ModelUserStatsFilterInput | null > | null,
  projectId?: ModelIDInput | null,
  setId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
  userId?: ModelIDInput | null,
};

export type ModelUserStatsPrimaryCompositeKeyConditionInput = {
  beginsWith?: ModelUserStatsPrimaryCompositeKeyInput | null,
  between?: Array< ModelUserStatsPrimaryCompositeKeyInput | null > | null,
  eq?: ModelUserStatsPrimaryCompositeKeyInput | null,
  ge?: ModelUserStatsPrimaryCompositeKeyInput | null,
  gt?: ModelUserStatsPrimaryCompositeKeyInput | null,
  le?: ModelUserStatsPrimaryCompositeKeyInput | null,
  lt?: ModelUserStatsPrimaryCompositeKeyInput | null,
};

export type ModelUserStatsPrimaryCompositeKeyInput = {
  date?: string | null,
  setId?: string | null,
  userId?: string | null,
};

export type ModelUserStatsConnection = {
  __typename: "ModelUserStatsConnection",
  items:  Array<UserStats | null >,
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
  isAdmin?: boolean | null,
  name: string,
};

export type ModelFloatKeyConditionInput = {
  between?: Array< number | null > | null,
  eq?: number | null,
  ge?: number | null,
  gt?: number | null,
  le?: number | null,
  lt?: number | null,
};

export type ModelAnnotationConditionInput = {
  and?: Array< ModelAnnotationConditionInput | null > | null,
  categoryId?: ModelIDInput | null,
  createdAt?: ModelStringInput | null,
  imageId?: ModelIDInput | null,
  not?: ModelAnnotationConditionInput | null,
  objectId?: ModelIDInput | null,
  obscured?: ModelBooleanInput | null,
  or?: Array< ModelAnnotationConditionInput | null > | null,
  owner?: ModelStringInput | null,
  projectId?: ModelIDInput | null,
  setId?: ModelIDInput | null,
  source?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  x?: ModelIntInput | null,
  y?: ModelIntInput | null,
};

export type CreateAnnotationInput = {
  categoryId: string,
  id?: string | null,
  imageId: string,
  objectId?: string | null,
  obscured?: boolean | null,
  projectId: string,
  setId: string,
  source: string,
  x: number,
  y: number,
};

export type ModelAnnotationSetConditionInput = {
  and?: Array< ModelAnnotationSetConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelAnnotationSetConditionInput | null,
  or?: Array< ModelAnnotationSetConditionInput | null > | null,
  projectId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateAnnotationSetInput = {
  id?: string | null,
  name: string,
  projectId: string,
};

export type ModelCategoryConditionInput = {
  and?: Array< ModelCategoryConditionInput | null > | null,
  color?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelCategoryConditionInput | null,
  or?: Array< ModelCategoryConditionInput | null > | null,
  projectId?: ModelIDInput | null,
  shortcutKey?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateCategoryInput = {
  color?: string | null,
  id?: string | null,
  name: string,
  projectId: string,
  shortcutKey?: string | null,
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
  originalPath?: ModelStringInput | null,
  pitch?: ModelFloatInput | null,
  projectId?: ModelIDInput | null,
  roll?: ModelFloatInput | null,
  timestamp?: ModelIntInput | null,
  updatedAt?: ModelStringInput | null,
  width?: ModelIntInput | null,
  yaw?: ModelFloatInput | null,
};

export type CreateImageInput = {
  altitude_agl?: number | null,
  altitude_egm96?: number | null,
  altitude_wgs84?: number | null,
  cameraSerial?: string | null,
  exifData?: string | null,
  height: number,
  id?: string | null,
  latitude?: number | null,
  longitude?: number | null,
  originalPath?: string | null,
  pitch?: number | null,
  projectId: string,
  roll?: number | null,
  timestamp?: number | null,
  width: number,
  yaw?: number | null,
};

export type ModelImageFileConditionInput = {
  and?: Array< ModelImageFileConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  imageId?: ModelIDInput | null,
  key?: ModelStringInput | null,
  not?: ModelImageFileConditionInput | null,
  or?: Array< ModelImageFileConditionInput | null > | null,
  path?: ModelStringInput | null,
  projectId?: ModelIDInput | null,
  type?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateImageFileInput = {
  id?: string | null,
  imageId?: string | null,
  key: string,
  path: string,
  projectId: string,
  type: string,
};

export type ModelImageNeighbourConditionInput = {
  and?: Array< ModelImageNeighbourConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  homography?: ModelFloatInput | null,
  not?: ModelImageNeighbourConditionInput | null,
  or?: Array< ModelImageNeighbourConditionInput | null > | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateImageNeighbourInput = {
  homography?: Array< number | null > | null,
  image1Id: string,
  image2Id: string,
};

export type ModelImageSetConditionInput = {
  and?: Array< ModelImageSetConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelImageSetConditionInput | null,
  or?: Array< ModelImageSetConditionInput | null > | null,
  projectId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateImageSetInput = {
  id?: string | null,
  name: string,
  projectId: string,
};

export type ModelImageSetMembershipConditionInput = {
  and?: Array< ModelImageSetMembershipConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  imageId?: ModelIDInput | null,
  imageSetId?: ModelIDInput | null,
  not?: ModelImageSetMembershipConditionInput | null,
  or?: Array< ModelImageSetMembershipConditionInput | null > | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateImageSetMembershipInput = {
  id?: string | null,
  imageId: string,
  imageSetId: string,
};

export type ModelLocationConditionInput = {
  and?: Array< ModelLocationConditionInput | null > | null,
  confidence?: ModelFloatInput | null,
  createdAt?: ModelStringInput | null,
  height?: ModelIntInput | null,
  imageId?: ModelIDInput | null,
  not?: ModelLocationConditionInput | null,
  or?: Array< ModelLocationConditionInput | null > | null,
  projectId?: ModelIDInput | null,
  setId?: ModelIDInput | null,
  source?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  width?: ModelIntInput | null,
  x?: ModelIntInput | null,
  y?: ModelIntInput | null,
};

export type CreateLocationInput = {
  confidence?: number | null,
  height?: number | null,
  id?: string | null,
  imageId?: string | null,
  projectId: string,
  setId: string,
  source: string,
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
  projectId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateLocationSetInput = {
  id?: string | null,
  name: string,
  projectId: string,
};

export type ModelLocationSetMembershipConditionInput = {
  and?: Array< ModelLocationSetMembershipConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  locationId?: ModelIDInput | null,
  locationSetId?: ModelIDInput | null,
  not?: ModelLocationSetMembershipConditionInput | null,
  or?: Array< ModelLocationSetMembershipConditionInput | null > | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateLocationSetMembershipInput = {
  id?: string | null,
  locationId: string,
  locationSetId: string,
};

export type ModelObjectConditionInput = {
  and?: Array< ModelObjectConditionInput | null > | null,
  categoryId?: ModelIDInput | null,
  createdAt?: ModelStringInput | null,
  not?: ModelObjectConditionInput | null,
  or?: Array< ModelObjectConditionInput | null > | null,
  projectId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateObjectInput = {
  categoryId: string,
  id?: string | null,
  projectId: string,
};

export type ModelObservationConditionInput = {
  and?: Array< ModelObservationConditionInput | null > | null,
  annotationSetId?: ModelIDInput | null,
  createdAt?: ModelStringInput | null,
  locationId?: ModelIDInput | null,
  not?: ModelObservationConditionInput | null,
  or?: Array< ModelObservationConditionInput | null > | null,
  owner?: ModelStringInput | null,
  projectId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateObservationInput = {
  annotationSetId: string,
  id?: string | null,
  locationId: string,
  projectId: string,
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
  id?: string | null,
  name: string,
};

export type ModelQueueConditionInput = {
  and?: Array< ModelQueueConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelQueueConditionInput | null,
  or?: Array< ModelQueueConditionInput | null > | null,
  projectId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
  url?: ModelStringInput | null,
};

export type CreateQueueInput = {
  id?: string | null,
  name: string,
  projectId: string,
  url?: string | null,
};

export type ModelUserObservationStatsConditionInput = {
  activeTime?: ModelIntInput | null,
  and?: Array< ModelUserObservationStatsConditionInput | null > | null,
  count?: ModelIntInput | null,
  createdAt?: ModelStringInput | null,
  lastUpdated?: ModelIntInput | null,
  not?: ModelUserObservationStatsConditionInput | null,
  or?: Array< ModelUserObservationStatsConditionInput | null > | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateUserObservationStatsInput = {
  activeTime?: number | null,
  count: number,
  lastUpdated?: number | null,
  projectId: string,
  userId: string,
};

export type ModelUserProjectMembershipConditionInput = {
  and?: Array< ModelUserProjectMembershipConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  isAdmin?: ModelBooleanInput | null,
  not?: ModelUserProjectMembershipConditionInput | null,
  or?: Array< ModelUserProjectMembershipConditionInput | null > | null,
  projectId?: ModelIDInput | null,
  queueId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
  userId?: ModelStringInput | null,
};

export type CreateUserProjectMembershipInput = {
  id?: string | null,
  isAdmin?: boolean | null,
  projectId: string,
  queueId?: string | null,
  userId: string,
};

export type ModelUserStatsConditionInput = {
  activeTime?: ModelFloatInput | null,
  and?: Array< ModelUserStatsConditionInput | null > | null,
  annotationCount?: ModelIntInput | null,
  createdAt?: ModelStringInput | null,
  not?: ModelUserStatsConditionInput | null,
  observationCount?: ModelIntInput | null,
  or?: Array< ModelUserStatsConditionInput | null > | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateUserStatsInput = {
  activeTime: number,
  annotationCount: number,
  date: string,
  observationCount: number,
  projectId: string,
  setId: string,
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

export type DeleteImageNeighbourInput = {
  image1Id: string,
  image2Id: string,
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

export type DeleteLocationSetMembershipInput = {
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

export type DeleteUserObservationStatsInput = {
  projectId: string,
  userId: string,
};

export type DeleteUserProjectMembershipInput = {
  id: string,
};

export type DeleteUserStatsInput = {
  date: string,
  projectId: string,
  setId: string,
  userId: string,
};

export type Message = {
  __typename: "Message",
  channelName: string,
  content: string,
};

export type UpdateAnnotationInput = {
  categoryId?: string | null,
  id: string,
  imageId?: string | null,
  objectId?: string | null,
  obscured?: boolean | null,
  projectId?: string | null,
  setId?: string | null,
  source?: string | null,
  x?: number | null,
  y?: number | null,
};

export type UpdateAnnotationSetInput = {
  id: string,
  name?: string | null,
  projectId?: string | null,
};

export type UpdateCategoryInput = {
  color?: string | null,
  id: string,
  name?: string | null,
  projectId?: string | null,
  shortcutKey?: string | null,
};

export type UpdateImageInput = {
  altitude_agl?: number | null,
  altitude_egm96?: number | null,
  altitude_wgs84?: number | null,
  cameraSerial?: string | null,
  exifData?: string | null,
  height?: number | null,
  id: string,
  latitude?: number | null,
  longitude?: number | null,
  originalPath?: string | null,
  pitch?: number | null,
  projectId?: string | null,
  roll?: number | null,
  timestamp?: number | null,
  width?: number | null,
  yaw?: number | null,
};

export type UpdateImageFileInput = {
  id: string,
  imageId?: string | null,
  key?: string | null,
  path?: string | null,
  projectId?: string | null,
  type?: string | null,
};

export type UpdateImageNeighbourInput = {
  homography?: Array< number | null > | null,
  image1Id: string,
  image2Id: string,
};

export type UpdateImageSetInput = {
  id: string,
  name?: string | null,
  projectId?: string | null,
};

export type UpdateImageSetMembershipInput = {
  id: string,
  imageId?: string | null,
  imageSetId?: string | null,
};

export type UpdateLocationInput = {
  confidence?: number | null,
  height?: number | null,
  id: string,
  imageId?: string | null,
  projectId?: string | null,
  setId?: string | null,
  source?: string | null,
  width?: number | null,
  x?: number | null,
  y?: number | null,
};

export type UpdateLocationSetInput = {
  id: string,
  name?: string | null,
  projectId?: string | null,
};

export type UpdateLocationSetMembershipInput = {
  id: string,
  locationId?: string | null,
  locationSetId?: string | null,
};

export type UpdateObjectInput = {
  categoryId?: string | null,
  id: string,
  projectId?: string | null,
};

export type UpdateObservationInput = {
  annotationSetId?: string | null,
  id: string,
  locationId?: string | null,
  projectId?: string | null,
};

export type UpdateProjectInput = {
  id: string,
  name?: string | null,
};

export type UpdateQueueInput = {
  id: string,
  name?: string | null,
  projectId?: string | null,
  url?: string | null,
};

export type UpdateUserObservationStatsInput = {
  activeTime?: number | null,
  count?: number | null,
  lastUpdated?: number | null,
  projectId: string,
  userId: string,
};

export type UpdateUserProjectMembershipInput = {
  id: string,
  isAdmin?: boolean | null,
  projectId?: string | null,
  queueId?: string | null,
  userId?: string | null,
};

export type UpdateUserStatsInput = {
  activeTime?: number | null,
  annotationCount?: number | null,
  date: string,
  observationCount?: number | null,
  projectId: string,
  setId: string,
  userId: string,
};

export type ModelSubscriptionAnnotationFilterInput = {
  and?: Array< ModelSubscriptionAnnotationFilterInput | null > | null,
  categoryId?: ModelSubscriptionIDInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  imageId?: ModelSubscriptionIDInput | null,
  objectId?: ModelSubscriptionIDInput | null,
  obscured?: ModelSubscriptionBooleanInput | null,
  or?: Array< ModelSubscriptionAnnotationFilterInput | null > | null,
  owner?: ModelStringInput | null,
  projectId?: ModelSubscriptionIDInput | null,
  setId?: ModelSubscriptionIDInput | null,
  source?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  x?: ModelSubscriptionIntInput | null,
  y?: ModelSubscriptionIntInput | null,
};

export type ModelSubscriptionIDInput = {
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

export type ModelSubscriptionBooleanInput = {
  eq?: boolean | null,
  ne?: boolean | null,
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
  id?: ModelSubscriptionIDInput | null,
  name?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionAnnotationSetFilterInput | null > | null,
  projectId?: ModelSubscriptionIDInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionCategoryFilterInput = {
  and?: Array< ModelSubscriptionCategoryFilterInput | null > | null,
  color?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  name?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionCategoryFilterInput | null > | null,
  projectId?: ModelSubscriptionIDInput | null,
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
  id?: ModelSubscriptionIDInput | null,
  latitude?: ModelSubscriptionFloatInput | null,
  longitude?: ModelSubscriptionFloatInput | null,
  or?: Array< ModelSubscriptionImageFilterInput | null > | null,
  originalPath?: ModelSubscriptionStringInput | null,
  pitch?: ModelSubscriptionFloatInput | null,
  projectId?: ModelSubscriptionIDInput | null,
  roll?: ModelSubscriptionFloatInput | null,
  timestamp?: ModelSubscriptionIntInput | null,
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
  id?: ModelSubscriptionIDInput | null,
  imageId?: ModelSubscriptionIDInput | null,
  key?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionImageFileFilterInput | null > | null,
  path?: ModelSubscriptionStringInput | null,
  projectId?: ModelSubscriptionIDInput | null,
  type?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionImageNeighbourFilterInput = {
  and?: Array< ModelSubscriptionImageNeighbourFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  homography?: ModelSubscriptionFloatInput | null,
  id?: ModelSubscriptionIDInput | null,
  image1Id?: ModelSubscriptionIDInput | null,
  image2Id?: ModelSubscriptionIDInput | null,
  or?: Array< ModelSubscriptionImageNeighbourFilterInput | null > | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionImageSetFilterInput = {
  and?: Array< ModelSubscriptionImageSetFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  name?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionImageSetFilterInput | null > | null,
  projectId?: ModelSubscriptionIDInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionImageSetMembershipFilterInput = {
  and?: Array< ModelSubscriptionImageSetMembershipFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  imageId?: ModelSubscriptionIDInput | null,
  imageSetId?: ModelSubscriptionIDInput | null,
  or?: Array< ModelSubscriptionImageSetMembershipFilterInput | null > | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionLocationFilterInput = {
  and?: Array< ModelSubscriptionLocationFilterInput | null > | null,
  confidence?: ModelSubscriptionFloatInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  height?: ModelSubscriptionIntInput | null,
  id?: ModelSubscriptionIDInput | null,
  imageId?: ModelSubscriptionIDInput | null,
  or?: Array< ModelSubscriptionLocationFilterInput | null > | null,
  projectId?: ModelSubscriptionIDInput | null,
  setId?: ModelSubscriptionIDInput | null,
  source?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  width?: ModelSubscriptionIntInput | null,
  x?: ModelSubscriptionIntInput | null,
  y?: ModelSubscriptionIntInput | null,
};

export type ModelSubscriptionLocationSetFilterInput = {
  and?: Array< ModelSubscriptionLocationSetFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  name?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionLocationSetFilterInput | null > | null,
  projectId?: ModelSubscriptionIDInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionLocationSetMembershipFilterInput = {
  and?: Array< ModelSubscriptionLocationSetMembershipFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  locationId?: ModelSubscriptionIDInput | null,
  locationSetId?: ModelSubscriptionIDInput | null,
  or?: Array< ModelSubscriptionLocationSetMembershipFilterInput | null > | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionObjectFilterInput = {
  and?: Array< ModelSubscriptionObjectFilterInput | null > | null,
  categoryId?: ModelSubscriptionIDInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  or?: Array< ModelSubscriptionObjectFilterInput | null > | null,
  projectId?: ModelSubscriptionIDInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionObservationFilterInput = {
  and?: Array< ModelSubscriptionObservationFilterInput | null > | null,
  annotationSetId?: ModelSubscriptionIDInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  locationId?: ModelSubscriptionIDInput | null,
  or?: Array< ModelSubscriptionObservationFilterInput | null > | null,
  owner?: ModelStringInput | null,
  projectId?: ModelSubscriptionIDInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionProjectFilterInput = {
  and?: Array< ModelSubscriptionProjectFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  name?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionProjectFilterInput | null > | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionQueueFilterInput = {
  and?: Array< ModelSubscriptionQueueFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  name?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionQueueFilterInput | null > | null,
  projectId?: ModelSubscriptionIDInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  url?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionUserObservationStatsFilterInput = {
  activeTime?: ModelSubscriptionIntInput | null,
  and?: Array< ModelSubscriptionUserObservationStatsFilterInput | null > | null,
  count?: ModelSubscriptionIntInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  lastUpdated?: ModelSubscriptionIntInput | null,
  or?: Array< ModelSubscriptionUserObservationStatsFilterInput | null > | null,
  projectId?: ModelSubscriptionIDInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  userId?: ModelSubscriptionIDInput | null,
};

export type ModelSubscriptionUserProjectMembershipFilterInput = {
  and?: Array< ModelSubscriptionUserProjectMembershipFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  isAdmin?: ModelSubscriptionBooleanInput | null,
  or?: Array< ModelSubscriptionUserProjectMembershipFilterInput | null > | null,
  projectId?: ModelSubscriptionIDInput | null,
  queueId?: ModelSubscriptionIDInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  userId?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionUserStatsFilterInput = {
  activeTime?: ModelSubscriptionFloatInput | null,
  and?: Array< ModelSubscriptionUserStatsFilterInput | null > | null,
  annotationCount?: ModelSubscriptionIntInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  date?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  observationCount?: ModelSubscriptionIntInput | null,
  or?: Array< ModelSubscriptionUserStatsFilterInput | null > | null,
  projectId?: ModelSubscriptionIDInput | null,
  setId?: ModelSubscriptionIDInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  userId?: ModelSubscriptionIDInput | null,
};

export type AnnotationSetsByProjectIdQueryVariables = {
  filter?: ModelAnnotationSetFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  projectId: string,
  sortDirection?: ModelSortDirection | null,
};

export type AnnotationSetsByProjectIdQuery = {
  annotationSetsByProjectId?:  {
    __typename: "ModelAnnotationSetConnection",
    items:  Array< {
      __typename: "AnnotationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type AnnotationsByAnnotationSetIdQueryVariables = {
  filter?: ModelAnnotationFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  setId: string,
  sortDirection?: ModelSortDirection | null,
};

export type AnnotationsByAnnotationSetIdQuery = {
  annotationsByAnnotationSetId?:  {
    __typename: "ModelAnnotationConnection",
    items:  Array< {
      __typename: "Annotation",
      categoryId: string,
      createdAt: string,
      id: string,
      imageId: string,
      objectId?: string | null,
      obscured?: boolean | null,
      owner?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      x: number,
      y: number,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type AnnotationsByCategoryIdQueryVariables = {
  categoryId: string,
  filter?: ModelAnnotationFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type AnnotationsByCategoryIdQuery = {
  annotationsByCategoryId?:  {
    __typename: "ModelAnnotationConnection",
    items:  Array< {
      __typename: "Annotation",
      categoryId: string,
      createdAt: string,
      id: string,
      imageId: string,
      objectId?: string | null,
      obscured?: boolean | null,
      owner?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      x: number,
      y: number,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type AnnotationsByImageIdAndSetIdQueryVariables = {
  filter?: ModelAnnotationFilterInput | null,
  imageId: string,
  limit?: number | null,
  nextToken?: string | null,
  setId?: ModelIDKeyConditionInput | null,
  sortDirection?: ModelSortDirection | null,
};

export type AnnotationsByImageIdAndSetIdQuery = {
  annotationsByImageIdAndSetId?:  {
    __typename: "ModelAnnotationConnection",
    items:  Array< {
      __typename: "Annotation",
      categoryId: string,
      createdAt: string,
      id: string,
      imageId: string,
      objectId?: string | null,
      obscured?: boolean | null,
      owner?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      x: number,
      y: number,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type AnnotationsByObjectIdQueryVariables = {
  filter?: ModelAnnotationFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  objectId: string,
  sortDirection?: ModelSortDirection | null,
};

export type AnnotationsByObjectIdQuery = {
  annotationsByObjectId?:  {
    __typename: "ModelAnnotationConnection",
    items:  Array< {
      __typename: "Annotation",
      categoryId: string,
      createdAt: string,
      id: string,
      imageId: string,
      objectId?: string | null,
      obscured?: boolean | null,
      owner?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      x: number,
      y: number,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type CategoriesByProjectIdQueryVariables = {
  filter?: ModelCategoryFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  projectId: string,
  sortDirection?: ModelSortDirection | null,
};

export type CategoriesByProjectIdQuery = {
  categoriesByProjectId?:  {
    __typename: "ModelCategoryConnection",
    items:  Array< {
      __typename: "Category",
      color?: string | null,
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      shortcutKey?: string | null,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetAnnotationQueryVariables = {
  id: string,
};

export type GetAnnotationQuery = {
  getAnnotation?:  {
    __typename: "Annotation",
    category?:  {
      __typename: "Category",
      color?: string | null,
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      shortcutKey?: string | null,
      updatedAt: string,
    } | null,
    categoryId: string,
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    object?:  {
      __typename: "Object",
      categoryId: string,
      createdAt: string,
      id: string,
      projectId: string,
      updatedAt: string,
    } | null,
    objectId?: string | null,
    obscured?: boolean | null,
    owner?: string | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    set?:  {
      __typename: "AnnotationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    setId: string,
    source: string,
    updatedAt: string,
    x: number,
    y: number,
  } | null,
};

export type GetAnnotationCountsQueryVariables = {
  annotationSetId: string,
};

export type GetAnnotationCountsQuery = {
  getAnnotationCounts?: string | null,
};

export type GetAnnotationSetQueryVariables = {
  id: string,
};

export type GetAnnotationSetQuery = {
  getAnnotationSet?:  {
    __typename: "AnnotationSet",
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    name: string,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type GetCategoryQueryVariables = {
  id: string,
};

export type GetCategoryQuery = {
  getCategory?:  {
    __typename: "Category",
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    color?: string | null,
    createdAt: string,
    id: string,
    name: string,
    objects?:  {
      __typename: "ModelObjectConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    shortcutKey?: string | null,
    updatedAt: string,
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
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    cameraSerial?: string | null,
    createdAt: string,
    exifData?: string | null,
    files?:  {
      __typename: "ModelImageFileConnection",
      nextToken?: string | null,
    } | null,
    height: number,
    id: string,
    latitude?: number | null,
    leftNeighbours?:  {
      __typename: "ModelImageNeighbourConnection",
      nextToken?: string | null,
    } | null,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    longitude?: number | null,
    memberships?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    originalPath?: string | null,
    pitch?: number | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    rightNeighbours?:  {
      __typename: "ModelImageNeighbourConnection",
      nextToken?: string | null,
    } | null,
    roll?: number | null,
    timestamp?: number | null,
    updatedAt: string,
    width: number,
    yaw?: number | null,
  } | null,
};

export type GetImageCountsQueryVariables = {
  imageSetId: string,
};

export type GetImageCountsQuery = {
  getImageCounts?: number | null,
};

export type GetImageFileQueryVariables = {
  id: string,
};

export type GetImageFileQuery = {
  getImageFile?:  {
    __typename: "ImageFile",
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId?: string | null,
    key: string,
    path: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    type: string,
    updatedAt: string,
  } | null,
};

export type GetImageNeighbourQueryVariables = {
  image1Id: string,
  image2Id: string,
};

export type GetImageNeighbourQuery = {
  getImageNeighbour?:  {
    __typename: "ImageNeighbour",
    createdAt: string,
    homography?: Array< number | null > | null,
    image1?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    image1Id: string,
    image2?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    image2Id: string,
    updatedAt: string,
  } | null,
};

export type GetImageSetQueryVariables = {
  id: string,
};

export type GetImageSetQuery = {
  getImageSet?:  {
    __typename: "ImageSet",
    createdAt: string,
    id: string,
    images?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type GetImageSetMembershipQueryVariables = {
  id: string,
};

export type GetImageSetMembershipQuery = {
  getImageSetMembership?:  {
    __typename: "ImageSetMembership",
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    imageSet?:  {
      __typename: "ImageSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    imageSetId: string,
    updatedAt: string,
  } | null,
};

export type GetLocationQueryVariables = {
  id: string,
};

export type GetLocationQuery = {
  getLocation?:  {
    __typename: "Location",
    confidence?: number | null,
    createdAt: string,
    height?: number | null,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId?: string | null,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    set?:  {
      __typename: "LocationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    setId: string,
    sets?:  {
      __typename: "ModelLocationSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    source: string,
    updatedAt: string,
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
    createdAt: string,
    id: string,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    memberships?:  {
      __typename: "ModelLocationSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type GetLocationSetMembershipQueryVariables = {
  id: string,
};

export type GetLocationSetMembershipQuery = {
  getLocationSetMembership?:  {
    __typename: "LocationSetMembership",
    createdAt: string,
    id: string,
    location?:  {
      __typename: "Location",
      confidence?: number | null,
      createdAt: string,
      height?: number | null,
      id: string,
      imageId?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      width?: number | null,
      x: number,
      y: number,
    } | null,
    locationId: string,
    locationSet?:  {
      __typename: "LocationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    locationSetId: string,
    updatedAt: string,
  } | null,
};

export type GetObjectQueryVariables = {
  id: string,
};

export type GetObjectQuery = {
  getObject?:  {
    __typename: "Object",
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    category?:  {
      __typename: "Category",
      color?: string | null,
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      shortcutKey?: string | null,
      updatedAt: string,
    } | null,
    categoryId: string,
    createdAt: string,
    id: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type GetObservationQueryVariables = {
  id: string,
};

export type GetObservationQuery = {
  getObservation?:  {
    __typename: "Observation",
    annotationSet?:  {
      __typename: "AnnotationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    annotationSetId: string,
    createdAt: string,
    id: string,
    location?:  {
      __typename: "Location",
      confidence?: number | null,
      createdAt: string,
      height?: number | null,
      id: string,
      imageId?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      width?: number | null,
      x: number,
      y: number,
    } | null,
    locationId: string,
    owner?: string | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type GetProjectQueryVariables = {
  id: string,
};

export type GetProjectQuery = {
  getProject?:  {
    __typename: "Project",
    annotationSets?:  {
      __typename: "ModelAnnotationSetConnection",
      nextToken?: string | null,
    } | null,
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    categories?:  {
      __typename: "ModelCategoryConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    imageFiles?:  {
      __typename: "ModelImageFileConnection",
      nextToken?: string | null,
    } | null,
    imageSets?:  {
      __typename: "ModelImageSetConnection",
      nextToken?: string | null,
    } | null,
    images?:  {
      __typename: "ModelImageConnection",
      nextToken?: string | null,
    } | null,
    locationSets?:  {
      __typename: "ModelLocationSetConnection",
      nextToken?: string | null,
    } | null,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    members?:  {
      __typename: "ModelUserProjectMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    objects?:  {
      __typename: "ModelObjectConnection",
      nextToken?: string | null,
    } | null,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    queues?:  {
      __typename: "ModelQueueConnection",
      nextToken?: string | null,
    } | null,
    updatedAt: string,
  } | null,
};

export type GetQueueQueryVariables = {
  id: string,
};

export type GetQueueQuery = {
  getQueue?:  {
    __typename: "Queue",
    createdAt: string,
    id: string,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
    url?: string | null,
    users?:  {
      __typename: "ModelUserProjectMembershipConnection",
      nextToken?: string | null,
    } | null,
  } | null,
};

export type GetUserObservationStatsQueryVariables = {
  projectId: string,
  userId: string,
};

export type GetUserObservationStatsQuery = {
  getUserObservationStats?:  {
    __typename: "UserObservationStats",
    activeTime?: number | null,
    count: number,
    createdAt: string,
    lastUpdated?: number | null,
    projectId: string,
    updatedAt: string,
    userId: string,
  } | null,
};

export type GetUserProjectMembershipQueryVariables = {
  id: string,
};

export type GetUserProjectMembershipQuery = {
  getUserProjectMembership?:  {
    __typename: "UserProjectMembership",
    createdAt: string,
    id: string,
    isAdmin?: boolean | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    queue?:  {
      __typename: "Queue",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
      url?: string | null,
    } | null,
    queueId?: string | null,
    updatedAt: string,
    userId: string,
  } | null,
};

export type GetUserStatsQueryVariables = {
  date: string,
  projectId: string,
  setId: string,
  userId: string,
};

export type GetUserStatsQuery = {
  getUserStats?:  {
    __typename: "UserStats",
    activeTime: number,
    annotationCount: number,
    createdAt: string,
    date: string,
    observationCount: number,
    projectId: string,
    setId: string,
    updatedAt: string,
    userId: string,
  } | null,
};

export type ImageNeighboursByImage1keyQueryVariables = {
  filter?: ModelImageNeighbourFilterInput | null,
  image1Id: string,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ImageNeighboursByImage1keyQuery = {
  imageNeighboursByImage1key?:  {
    __typename: "ModelImageNeighbourConnection",
    items:  Array< {
      __typename: "ImageNeighbour",
      createdAt: string,
      homography?: Array< number | null > | null,
      image1Id: string,
      image2Id: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ImageNeighboursByImage2keyQueryVariables = {
  filter?: ModelImageNeighbourFilterInput | null,
  image2Id: string,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ImageNeighboursByImage2keyQuery = {
  imageNeighboursByImage2key?:  {
    __typename: "ModelImageNeighbourConnection",
    items:  Array< {
      __typename: "ImageNeighbour",
      createdAt: string,
      homography?: Array< number | null > | null,
      image1Id: string,
      image2Id: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ImageSetMembershipsByImageSetIdQueryVariables = {
  filter?: ModelImageSetMembershipFilterInput | null,
  imageSetId: string,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ImageSetMembershipsByImageSetIdQuery = {
  imageSetMembershipsByImageSetId?:  {
    __typename: "ModelImageSetMembershipConnection",
    items:  Array< {
      __typename: "ImageSetMembership",
      createdAt: string,
      id: string,
      imageId: string,
      imageSetId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ImageSetsByProjectIdQueryVariables = {
  filter?: ModelImageSetFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  projectId: string,
  sortDirection?: ModelSortDirection | null,
};

export type ImageSetsByProjectIdQuery = {
  imageSetsByProjectId?:  {
    __typename: "ModelImageSetConnection",
    items:  Array< {
      __typename: "ImageSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ImagesByPathQueryVariables = {
  filter?: ModelImageFileFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  path: string,
  sortDirection?: ModelSortDirection | null,
};

export type ImagesByPathQuery = {
  imagesByPath?:  {
    __typename: "ModelImageFileConnection",
    items:  Array< {
      __typename: "ImageFile",
      createdAt: string,
      id: string,
      imageId?: string | null,
      key: string,
      path: string,
      projectId: string,
      type: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ImagesByimageIdQueryVariables = {
  filter?: ModelImageFileFilterInput | null,
  imageId: string,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ImagesByimageIdQuery = {
  imagesByimageId?:  {
    __typename: "ModelImageFileConnection",
    items:  Array< {
      __typename: "ImageFile",
      createdAt: string,
      id: string,
      imageId?: string | null,
      key: string,
      path: string,
      projectId: string,
      type: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListAnnotationSetsQueryVariables = {
  filter?: ModelAnnotationSetFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListAnnotationSetsQuery = {
  listAnnotationSets?:  {
    __typename: "ModelAnnotationSetConnection",
    items:  Array< {
      __typename: "AnnotationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListAnnotationsQueryVariables = {
  filter?: ModelAnnotationFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListAnnotationsQuery = {
  listAnnotations?:  {
    __typename: "ModelAnnotationConnection",
    items:  Array< {
      __typename: "Annotation",
      categoryId: string,
      createdAt: string,
      id: string,
      imageId: string,
      objectId?: string | null,
      obscured?: boolean | null,
      owner?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      x: number,
      y: number,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListCategoriesQueryVariables = {
  filter?: ModelCategoryFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListCategoriesQuery = {
  listCategories?:  {
    __typename: "ModelCategoryConnection",
    items:  Array< {
      __typename: "Category",
      color?: string | null,
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      shortcutKey?: string | null,
      updatedAt: string,
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
  limit?: number | null,
  nextToken?: string | null,
};

export type ListImageFilesQuery = {
  listImageFiles?:  {
    __typename: "ModelImageFileConnection",
    items:  Array< {
      __typename: "ImageFile",
      createdAt: string,
      id: string,
      imageId?: string | null,
      key: string,
      path: string,
      projectId: string,
      type: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListImageNeighboursQueryVariables = {
  filter?: ModelImageNeighbourFilterInput | null,
  image1Id?: string | null,
  image2Id?: ModelIDKeyConditionInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListImageNeighboursQuery = {
  listImageNeighbours?:  {
    __typename: "ModelImageNeighbourConnection",
    items:  Array< {
      __typename: "ImageNeighbour",
      createdAt: string,
      homography?: Array< number | null > | null,
      image1Id: string,
      image2Id: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListImageSetMembershipsQueryVariables = {
  filter?: ModelImageSetMembershipFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListImageSetMembershipsQuery = {
  listImageSetMemberships?:  {
    __typename: "ModelImageSetMembershipConnection",
    items:  Array< {
      __typename: "ImageSetMembership",
      createdAt: string,
      id: string,
      imageId: string,
      imageSetId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListImageSetsQueryVariables = {
  filter?: ModelImageSetFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListImageSetsQuery = {
  listImageSets?:  {
    __typename: "ModelImageSetConnection",
    items:  Array< {
      __typename: "ImageSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListImagesQueryVariables = {
  filter?: ModelImageFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
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
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListLocationSetMembershipsQueryVariables = {
  filter?: ModelLocationSetMembershipFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListLocationSetMembershipsQuery = {
  listLocationSetMemberships?:  {
    __typename: "ModelLocationSetMembershipConnection",
    items:  Array< {
      __typename: "LocationSetMembership",
      createdAt: string,
      id: string,
      locationId: string,
      locationSetId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListLocationSetsQueryVariables = {
  filter?: ModelLocationSetFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListLocationSetsQuery = {
  listLocationSets?:  {
    __typename: "ModelLocationSetConnection",
    items:  Array< {
      __typename: "LocationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListLocationsQueryVariables = {
  filter?: ModelLocationFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListLocationsQuery = {
  listLocations?:  {
    __typename: "ModelLocationConnection",
    items:  Array< {
      __typename: "Location",
      confidence?: number | null,
      createdAt: string,
      height?: number | null,
      id: string,
      imageId?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      width?: number | null,
      x: number,
      y: number,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListObjectsQueryVariables = {
  filter?: ModelObjectFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListObjectsQuery = {
  listObjects?:  {
    __typename: "ModelObjectConnection",
    items:  Array< {
      __typename: "Object",
      categoryId: string,
      createdAt: string,
      id: string,
      projectId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListObservationsQueryVariables = {
  filter?: ModelObservationFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListObservationsQuery = {
  listObservations?:  {
    __typename: "ModelObservationConnection",
    items:  Array< {
      __typename: "Observation",
      annotationSetId: string,
      createdAt: string,
      id: string,
      locationId: string,
      owner?: string | null,
      projectId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListProjectsQueryVariables = {
  filter?: ModelProjectFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListProjectsQuery = {
  listProjects?:  {
    __typename: "ModelProjectConnection",
    items:  Array< {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListQueuesQueryVariables = {
  filter?: ModelQueueFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListQueuesQuery = {
  listQueues?:  {
    __typename: "ModelQueueConnection",
    items:  Array< {
      __typename: "Queue",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
      url?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListUserObservationStatsQueryVariables = {
  filter?: ModelUserObservationStatsFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  projectId?: string | null,
  sortDirection?: ModelSortDirection | null,
  userId?: ModelIDKeyConditionInput | null,
};

export type ListUserObservationStatsQuery = {
  listUserObservationStats?:  {
    __typename: "ModelUserObservationStatsConnection",
    items:  Array< {
      __typename: "UserObservationStats",
      activeTime?: number | null,
      count: number,
      createdAt: string,
      lastUpdated?: number | null,
      projectId: string,
      updatedAt: string,
      userId: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListUserProjectMembershipsQueryVariables = {
  filter?: ModelUserProjectMembershipFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListUserProjectMembershipsQuery = {
  listUserProjectMemberships?:  {
    __typename: "ModelUserProjectMembershipConnection",
    items:  Array< {
      __typename: "UserProjectMembership",
      createdAt: string,
      id: string,
      isAdmin?: boolean | null,
      projectId: string,
      queueId?: string | null,
      updatedAt: string,
      userId: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListUserStatsQueryVariables = {
  filter?: ModelUserStatsFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  projectId?: string | null,
  sortDirection?: ModelSortDirection | null,
  userIdDateSetId?: ModelUserStatsPrimaryCompositeKeyConditionInput | null,
};

export type ListUserStatsQuery = {
  listUserStats?:  {
    __typename: "ModelUserStatsConnection",
    items:  Array< {
      __typename: "UserStats",
      activeTime: number,
      annotationCount: number,
      createdAt: string,
      date: string,
      observationCount: number,
      projectId: string,
      setId: string,
      updatedAt: string,
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
      isAdmin?: boolean | null,
      name: string,
    } | null > | null,
  } | null,
};

export type LocationSetsByProjectIdQueryVariables = {
  filter?: ModelLocationSetFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  projectId: string,
  sortDirection?: ModelSortDirection | null,
};

export type LocationSetsByProjectIdQuery = {
  locationSetsByProjectId?:  {
    __typename: "ModelLocationSetConnection",
    items:  Array< {
      __typename: "LocationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type LocationsByImageKeyQueryVariables = {
  confidence?: ModelFloatKeyConditionInput | null,
  filter?: ModelLocationFilterInput | null,
  imageId: string,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type LocationsByImageKeyQuery = {
  locationsByImageKey?:  {
    __typename: "ModelLocationConnection",
    items:  Array< {
      __typename: "Location",
      confidence?: number | null,
      createdAt: string,
      height?: number | null,
      id: string,
      imageId?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      width?: number | null,
      x: number,
      y: number,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type LocationsBySetIdAndConfidenceQueryVariables = {
  confidence?: ModelFloatKeyConditionInput | null,
  filter?: ModelLocationFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  setId: string,
  sortDirection?: ModelSortDirection | null,
};

export type LocationsBySetIdAndConfidenceQuery = {
  locationsBySetIdAndConfidence?:  {
    __typename: "ModelLocationConnection",
    items:  Array< {
      __typename: "Location",
      confidence?: number | null,
      createdAt: string,
      height?: number | null,
      id: string,
      imageId?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      width?: number | null,
      x: number,
      y: number,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ObjectsByCategoryIdQueryVariables = {
  categoryId: string,
  filter?: ModelObjectFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ObjectsByCategoryIdQuery = {
  objectsByCategoryId?:  {
    __typename: "ModelObjectConnection",
    items:  Array< {
      __typename: "Object",
      categoryId: string,
      createdAt: string,
      id: string,
      projectId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ObservationsByAnnotationSetIdQueryVariables = {
  annotationSetId: string,
  filter?: ModelObservationFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ObservationsByAnnotationSetIdQuery = {
  observationsByAnnotationSetId?:  {
    __typename: "ModelObservationConnection",
    items:  Array< {
      __typename: "Observation",
      annotationSetId: string,
      createdAt: string,
      id: string,
      locationId: string,
      owner?: string | null,
      projectId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ObservationsByLocationIdQueryVariables = {
  filter?: ModelObservationFilterInput | null,
  limit?: number | null,
  locationId: string,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ObservationsByLocationIdQuery = {
  observationsByLocationId?:  {
    __typename: "ModelObservationConnection",
    items:  Array< {
      __typename: "Observation",
      annotationSetId: string,
      createdAt: string,
      id: string,
      locationId: string,
      owner?: string | null,
      projectId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type QueuesByProjectIdQueryVariables = {
  filter?: ModelQueueFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  projectId: string,
  sortDirection?: ModelSortDirection | null,
};

export type QueuesByProjectIdQuery = {
  queuesByProjectId?:  {
    __typename: "ModelQueueConnection",
    items:  Array< {
      __typename: "Queue",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
      url?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type UserProjectMembershipsByProjectIdQueryVariables = {
  filter?: ModelUserProjectMembershipFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  projectId: string,
  sortDirection?: ModelSortDirection | null,
};

export type UserProjectMembershipsByProjectIdQuery = {
  userProjectMembershipsByProjectId?:  {
    __typename: "ModelUserProjectMembershipConnection",
    items:  Array< {
      __typename: "UserProjectMembership",
      createdAt: string,
      id: string,
      isAdmin?: boolean | null,
      projectId: string,
      queueId?: string | null,
      updatedAt: string,
      userId: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type UserProjectMembershipsByQueueIdQueryVariables = {
  filter?: ModelUserProjectMembershipFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  queueId: string,
  sortDirection?: ModelSortDirection | null,
};

export type UserProjectMembershipsByQueueIdQuery = {
  userProjectMembershipsByQueueId?:  {
    __typename: "ModelUserProjectMembershipConnection",
    items:  Array< {
      __typename: "UserProjectMembership",
      createdAt: string,
      id: string,
      isAdmin?: boolean | null,
      projectId: string,
      queueId?: string | null,
      updatedAt: string,
      userId: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type UserProjectMembershipsByUserIdQueryVariables = {
  filter?: ModelUserProjectMembershipFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
  userId: string,
};

export type UserProjectMembershipsByUserIdQuery = {
  userProjectMembershipsByUserId?:  {
    __typename: "ModelUserProjectMembershipConnection",
    items:  Array< {
      __typename: "UserProjectMembership",
      createdAt: string,
      id: string,
      isAdmin?: boolean | null,
      projectId: string,
      queueId?: string | null,
      updatedAt: string,
      userId: string,
    } | null >,
    nextToken?: string | null,
  } | null,
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
    category?:  {
      __typename: "Category",
      color?: string | null,
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      shortcutKey?: string | null,
      updatedAt: string,
    } | null,
    categoryId: string,
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    object?:  {
      __typename: "Object",
      categoryId: string,
      createdAt: string,
      id: string,
      projectId: string,
      updatedAt: string,
    } | null,
    objectId?: string | null,
    obscured?: boolean | null,
    owner?: string | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    set?:  {
      __typename: "AnnotationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    setId: string,
    source: string,
    updatedAt: string,
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
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    name: string,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type CreateCategoryMutationVariables = {
  condition?: ModelCategoryConditionInput | null,
  input: CreateCategoryInput,
};

export type CreateCategoryMutation = {
  createCategory?:  {
    __typename: "Category",
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    color?: string | null,
    createdAt: string,
    id: string,
    name: string,
    objects?:  {
      __typename: "ModelObjectConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    shortcutKey?: string | null,
    updatedAt: string,
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
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    cameraSerial?: string | null,
    createdAt: string,
    exifData?: string | null,
    files?:  {
      __typename: "ModelImageFileConnection",
      nextToken?: string | null,
    } | null,
    height: number,
    id: string,
    latitude?: number | null,
    leftNeighbours?:  {
      __typename: "ModelImageNeighbourConnection",
      nextToken?: string | null,
    } | null,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    longitude?: number | null,
    memberships?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    originalPath?: string | null,
    pitch?: number | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    rightNeighbours?:  {
      __typename: "ModelImageNeighbourConnection",
      nextToken?: string | null,
    } | null,
    roll?: number | null,
    timestamp?: number | null,
    updatedAt: string,
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
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId?: string | null,
    key: string,
    path: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    type: string,
    updatedAt: string,
  } | null,
};

export type CreateImageNeighbourMutationVariables = {
  condition?: ModelImageNeighbourConditionInput | null,
  input: CreateImageNeighbourInput,
};

export type CreateImageNeighbourMutation = {
  createImageNeighbour?:  {
    __typename: "ImageNeighbour",
    createdAt: string,
    homography?: Array< number | null > | null,
    image1?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    image1Id: string,
    image2?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    image2Id: string,
    updatedAt: string,
  } | null,
};

export type CreateImageSetMutationVariables = {
  condition?: ModelImageSetConditionInput | null,
  input: CreateImageSetInput,
};

export type CreateImageSetMutation = {
  createImageSet?:  {
    __typename: "ImageSet",
    createdAt: string,
    id: string,
    images?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type CreateImageSetMembershipMutationVariables = {
  condition?: ModelImageSetMembershipConditionInput | null,
  input: CreateImageSetMembershipInput,
};

export type CreateImageSetMembershipMutation = {
  createImageSetMembership?:  {
    __typename: "ImageSetMembership",
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    imageSet?:  {
      __typename: "ImageSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    imageSetId: string,
    updatedAt: string,
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
    createdAt: string,
    height?: number | null,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId?: string | null,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    set?:  {
      __typename: "LocationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    setId: string,
    sets?:  {
      __typename: "ModelLocationSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    source: string,
    updatedAt: string,
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
    createdAt: string,
    id: string,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    memberships?:  {
      __typename: "ModelLocationSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type CreateLocationSetMembershipMutationVariables = {
  condition?: ModelLocationSetMembershipConditionInput | null,
  input: CreateLocationSetMembershipInput,
};

export type CreateLocationSetMembershipMutation = {
  createLocationSetMembership?:  {
    __typename: "LocationSetMembership",
    createdAt: string,
    id: string,
    location?:  {
      __typename: "Location",
      confidence?: number | null,
      createdAt: string,
      height?: number | null,
      id: string,
      imageId?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      width?: number | null,
      x: number,
      y: number,
    } | null,
    locationId: string,
    locationSet?:  {
      __typename: "LocationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    locationSetId: string,
    updatedAt: string,
  } | null,
};

export type CreateObjectMutationVariables = {
  condition?: ModelObjectConditionInput | null,
  input: CreateObjectInput,
};

export type CreateObjectMutation = {
  createObject?:  {
    __typename: "Object",
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    category?:  {
      __typename: "Category",
      color?: string | null,
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      shortcutKey?: string | null,
      updatedAt: string,
    } | null,
    categoryId: string,
    createdAt: string,
    id: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type CreateObservationMutationVariables = {
  condition?: ModelObservationConditionInput | null,
  input: CreateObservationInput,
};

export type CreateObservationMutation = {
  createObservation?:  {
    __typename: "Observation",
    annotationSet?:  {
      __typename: "AnnotationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    annotationSetId: string,
    createdAt: string,
    id: string,
    location?:  {
      __typename: "Location",
      confidence?: number | null,
      createdAt: string,
      height?: number | null,
      id: string,
      imageId?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      width?: number | null,
      x: number,
      y: number,
    } | null,
    locationId: string,
    owner?: string | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type CreateProjectMutationVariables = {
  condition?: ModelProjectConditionInput | null,
  input: CreateProjectInput,
};

export type CreateProjectMutation = {
  createProject?:  {
    __typename: "Project",
    annotationSets?:  {
      __typename: "ModelAnnotationSetConnection",
      nextToken?: string | null,
    } | null,
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    categories?:  {
      __typename: "ModelCategoryConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    imageFiles?:  {
      __typename: "ModelImageFileConnection",
      nextToken?: string | null,
    } | null,
    imageSets?:  {
      __typename: "ModelImageSetConnection",
      nextToken?: string | null,
    } | null,
    images?:  {
      __typename: "ModelImageConnection",
      nextToken?: string | null,
    } | null,
    locationSets?:  {
      __typename: "ModelLocationSetConnection",
      nextToken?: string | null,
    } | null,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    members?:  {
      __typename: "ModelUserProjectMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    objects?:  {
      __typename: "ModelObjectConnection",
      nextToken?: string | null,
    } | null,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    queues?:  {
      __typename: "ModelQueueConnection",
      nextToken?: string | null,
    } | null,
    updatedAt: string,
  } | null,
};

export type CreateQueueMutationVariables = {
  condition?: ModelQueueConditionInput | null,
  input: CreateQueueInput,
};

export type CreateQueueMutation = {
  createQueue?:  {
    __typename: "Queue",
    createdAt: string,
    id: string,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
    url?: string | null,
    users?:  {
      __typename: "ModelUserProjectMembershipConnection",
      nextToken?: string | null,
    } | null,
  } | null,
};

export type CreateUserObservationStatsMutationVariables = {
  condition?: ModelUserObservationStatsConditionInput | null,
  input: CreateUserObservationStatsInput,
};

export type CreateUserObservationStatsMutation = {
  createUserObservationStats?:  {
    __typename: "UserObservationStats",
    activeTime?: number | null,
    count: number,
    createdAt: string,
    lastUpdated?: number | null,
    projectId: string,
    updatedAt: string,
    userId: string,
  } | null,
};

export type CreateUserProjectMembershipMutationVariables = {
  condition?: ModelUserProjectMembershipConditionInput | null,
  input: CreateUserProjectMembershipInput,
};

export type CreateUserProjectMembershipMutation = {
  createUserProjectMembership?:  {
    __typename: "UserProjectMembership",
    createdAt: string,
    id: string,
    isAdmin?: boolean | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    queue?:  {
      __typename: "Queue",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
      url?: string | null,
    } | null,
    queueId?: string | null,
    updatedAt: string,
    userId: string,
  } | null,
};

export type CreateUserStatsMutationVariables = {
  condition?: ModelUserStatsConditionInput | null,
  input: CreateUserStatsInput,
};

export type CreateUserStatsMutation = {
  createUserStats?:  {
    __typename: "UserStats",
    activeTime: number,
    annotationCount: number,
    createdAt: string,
    date: string,
    observationCount: number,
    projectId: string,
    setId: string,
    updatedAt: string,
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
    category?:  {
      __typename: "Category",
      color?: string | null,
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      shortcutKey?: string | null,
      updatedAt: string,
    } | null,
    categoryId: string,
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    object?:  {
      __typename: "Object",
      categoryId: string,
      createdAt: string,
      id: string,
      projectId: string,
      updatedAt: string,
    } | null,
    objectId?: string | null,
    obscured?: boolean | null,
    owner?: string | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    set?:  {
      __typename: "AnnotationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    setId: string,
    source: string,
    updatedAt: string,
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
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    name: string,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type DeleteCategoryMutationVariables = {
  condition?: ModelCategoryConditionInput | null,
  input: DeleteCategoryInput,
};

export type DeleteCategoryMutation = {
  deleteCategory?:  {
    __typename: "Category",
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    color?: string | null,
    createdAt: string,
    id: string,
    name: string,
    objects?:  {
      __typename: "ModelObjectConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    shortcutKey?: string | null,
    updatedAt: string,
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
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    cameraSerial?: string | null,
    createdAt: string,
    exifData?: string | null,
    files?:  {
      __typename: "ModelImageFileConnection",
      nextToken?: string | null,
    } | null,
    height: number,
    id: string,
    latitude?: number | null,
    leftNeighbours?:  {
      __typename: "ModelImageNeighbourConnection",
      nextToken?: string | null,
    } | null,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    longitude?: number | null,
    memberships?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    originalPath?: string | null,
    pitch?: number | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    rightNeighbours?:  {
      __typename: "ModelImageNeighbourConnection",
      nextToken?: string | null,
    } | null,
    roll?: number | null,
    timestamp?: number | null,
    updatedAt: string,
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
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId?: string | null,
    key: string,
    path: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    type: string,
    updatedAt: string,
  } | null,
};

export type DeleteImageNeighbourMutationVariables = {
  condition?: ModelImageNeighbourConditionInput | null,
  input: DeleteImageNeighbourInput,
};

export type DeleteImageNeighbourMutation = {
  deleteImageNeighbour?:  {
    __typename: "ImageNeighbour",
    createdAt: string,
    homography?: Array< number | null > | null,
    image1?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    image1Id: string,
    image2?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    image2Id: string,
    updatedAt: string,
  } | null,
};

export type DeleteImageSetMutationVariables = {
  condition?: ModelImageSetConditionInput | null,
  input: DeleteImageSetInput,
};

export type DeleteImageSetMutation = {
  deleteImageSet?:  {
    __typename: "ImageSet",
    createdAt: string,
    id: string,
    images?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type DeleteImageSetMembershipMutationVariables = {
  condition?: ModelImageSetMembershipConditionInput | null,
  input: DeleteImageSetMembershipInput,
};

export type DeleteImageSetMembershipMutation = {
  deleteImageSetMembership?:  {
    __typename: "ImageSetMembership",
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    imageSet?:  {
      __typename: "ImageSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    imageSetId: string,
    updatedAt: string,
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
    createdAt: string,
    height?: number | null,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId?: string | null,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    set?:  {
      __typename: "LocationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    setId: string,
    sets?:  {
      __typename: "ModelLocationSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    source: string,
    updatedAt: string,
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
    createdAt: string,
    id: string,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    memberships?:  {
      __typename: "ModelLocationSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type DeleteLocationSetMembershipMutationVariables = {
  condition?: ModelLocationSetMembershipConditionInput | null,
  input: DeleteLocationSetMembershipInput,
};

export type DeleteLocationSetMembershipMutation = {
  deleteLocationSetMembership?:  {
    __typename: "LocationSetMembership",
    createdAt: string,
    id: string,
    location?:  {
      __typename: "Location",
      confidence?: number | null,
      createdAt: string,
      height?: number | null,
      id: string,
      imageId?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      width?: number | null,
      x: number,
      y: number,
    } | null,
    locationId: string,
    locationSet?:  {
      __typename: "LocationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    locationSetId: string,
    updatedAt: string,
  } | null,
};

export type DeleteObjectMutationVariables = {
  condition?: ModelObjectConditionInput | null,
  input: DeleteObjectInput,
};

export type DeleteObjectMutation = {
  deleteObject?:  {
    __typename: "Object",
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    category?:  {
      __typename: "Category",
      color?: string | null,
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      shortcutKey?: string | null,
      updatedAt: string,
    } | null,
    categoryId: string,
    createdAt: string,
    id: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type DeleteObservationMutationVariables = {
  condition?: ModelObservationConditionInput | null,
  input: DeleteObservationInput,
};

export type DeleteObservationMutation = {
  deleteObservation?:  {
    __typename: "Observation",
    annotationSet?:  {
      __typename: "AnnotationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    annotationSetId: string,
    createdAt: string,
    id: string,
    location?:  {
      __typename: "Location",
      confidence?: number | null,
      createdAt: string,
      height?: number | null,
      id: string,
      imageId?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      width?: number | null,
      x: number,
      y: number,
    } | null,
    locationId: string,
    owner?: string | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type DeleteProjectMutationVariables = {
  condition?: ModelProjectConditionInput | null,
  input: DeleteProjectInput,
};

export type DeleteProjectMutation = {
  deleteProject?:  {
    __typename: "Project",
    annotationSets?:  {
      __typename: "ModelAnnotationSetConnection",
      nextToken?: string | null,
    } | null,
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    categories?:  {
      __typename: "ModelCategoryConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    imageFiles?:  {
      __typename: "ModelImageFileConnection",
      nextToken?: string | null,
    } | null,
    imageSets?:  {
      __typename: "ModelImageSetConnection",
      nextToken?: string | null,
    } | null,
    images?:  {
      __typename: "ModelImageConnection",
      nextToken?: string | null,
    } | null,
    locationSets?:  {
      __typename: "ModelLocationSetConnection",
      nextToken?: string | null,
    } | null,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    members?:  {
      __typename: "ModelUserProjectMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    objects?:  {
      __typename: "ModelObjectConnection",
      nextToken?: string | null,
    } | null,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    queues?:  {
      __typename: "ModelQueueConnection",
      nextToken?: string | null,
    } | null,
    updatedAt: string,
  } | null,
};

export type DeleteQueueMutationVariables = {
  condition?: ModelQueueConditionInput | null,
  input: DeleteQueueInput,
};

export type DeleteQueueMutation = {
  deleteQueue?:  {
    __typename: "Queue",
    createdAt: string,
    id: string,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
    url?: string | null,
    users?:  {
      __typename: "ModelUserProjectMembershipConnection",
      nextToken?: string | null,
    } | null,
  } | null,
};

export type DeleteUserObservationStatsMutationVariables = {
  condition?: ModelUserObservationStatsConditionInput | null,
  input: DeleteUserObservationStatsInput,
};

export type DeleteUserObservationStatsMutation = {
  deleteUserObservationStats?:  {
    __typename: "UserObservationStats",
    activeTime?: number | null,
    count: number,
    createdAt: string,
    lastUpdated?: number | null,
    projectId: string,
    updatedAt: string,
    userId: string,
  } | null,
};

export type DeleteUserProjectMembershipMutationVariables = {
  condition?: ModelUserProjectMembershipConditionInput | null,
  input: DeleteUserProjectMembershipInput,
};

export type DeleteUserProjectMembershipMutation = {
  deleteUserProjectMembership?:  {
    __typename: "UserProjectMembership",
    createdAt: string,
    id: string,
    isAdmin?: boolean | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    queue?:  {
      __typename: "Queue",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
      url?: string | null,
    } | null,
    queueId?: string | null,
    updatedAt: string,
    userId: string,
  } | null,
};

export type DeleteUserStatsMutationVariables = {
  condition?: ModelUserStatsConditionInput | null,
  input: DeleteUserStatsInput,
};

export type DeleteUserStatsMutation = {
  deleteUserStats?:  {
    __typename: "UserStats",
    activeTime: number,
    annotationCount: number,
    createdAt: string,
    date: string,
    observationCount: number,
    projectId: string,
    setId: string,
    updatedAt: string,
    userId: string,
  } | null,
};

export type ProcessImagesMutationVariables = {
  model: string,
  s3key: string,
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
    category?:  {
      __typename: "Category",
      color?: string | null,
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      shortcutKey?: string | null,
      updatedAt: string,
    } | null,
    categoryId: string,
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    object?:  {
      __typename: "Object",
      categoryId: string,
      createdAt: string,
      id: string,
      projectId: string,
      updatedAt: string,
    } | null,
    objectId?: string | null,
    obscured?: boolean | null,
    owner?: string | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    set?:  {
      __typename: "AnnotationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    setId: string,
    source: string,
    updatedAt: string,
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
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    name: string,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type UpdateCategoryMutationVariables = {
  condition?: ModelCategoryConditionInput | null,
  input: UpdateCategoryInput,
};

export type UpdateCategoryMutation = {
  updateCategory?:  {
    __typename: "Category",
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    color?: string | null,
    createdAt: string,
    id: string,
    name: string,
    objects?:  {
      __typename: "ModelObjectConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    shortcutKey?: string | null,
    updatedAt: string,
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
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    cameraSerial?: string | null,
    createdAt: string,
    exifData?: string | null,
    files?:  {
      __typename: "ModelImageFileConnection",
      nextToken?: string | null,
    } | null,
    height: number,
    id: string,
    latitude?: number | null,
    leftNeighbours?:  {
      __typename: "ModelImageNeighbourConnection",
      nextToken?: string | null,
    } | null,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    longitude?: number | null,
    memberships?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    originalPath?: string | null,
    pitch?: number | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    rightNeighbours?:  {
      __typename: "ModelImageNeighbourConnection",
      nextToken?: string | null,
    } | null,
    roll?: number | null,
    timestamp?: number | null,
    updatedAt: string,
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
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId?: string | null,
    key: string,
    path: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    type: string,
    updatedAt: string,
  } | null,
};

export type UpdateImageNeighbourMutationVariables = {
  condition?: ModelImageNeighbourConditionInput | null,
  input: UpdateImageNeighbourInput,
};

export type UpdateImageNeighbourMutation = {
  updateImageNeighbour?:  {
    __typename: "ImageNeighbour",
    createdAt: string,
    homography?: Array< number | null > | null,
    image1?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    image1Id: string,
    image2?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    image2Id: string,
    updatedAt: string,
  } | null,
};

export type UpdateImageSetMutationVariables = {
  condition?: ModelImageSetConditionInput | null,
  input: UpdateImageSetInput,
};

export type UpdateImageSetMutation = {
  updateImageSet?:  {
    __typename: "ImageSet",
    createdAt: string,
    id: string,
    images?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type UpdateImageSetMembershipMutationVariables = {
  condition?: ModelImageSetMembershipConditionInput | null,
  input: UpdateImageSetMembershipInput,
};

export type UpdateImageSetMembershipMutation = {
  updateImageSetMembership?:  {
    __typename: "ImageSetMembership",
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    imageSet?:  {
      __typename: "ImageSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    imageSetId: string,
    updatedAt: string,
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
    createdAt: string,
    height?: number | null,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId?: string | null,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    set?:  {
      __typename: "LocationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    setId: string,
    sets?:  {
      __typename: "ModelLocationSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    source: string,
    updatedAt: string,
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
    createdAt: string,
    id: string,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    memberships?:  {
      __typename: "ModelLocationSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type UpdateLocationSetMembershipMutationVariables = {
  condition?: ModelLocationSetMembershipConditionInput | null,
  input: UpdateLocationSetMembershipInput,
};

export type UpdateLocationSetMembershipMutation = {
  updateLocationSetMembership?:  {
    __typename: "LocationSetMembership",
    createdAt: string,
    id: string,
    location?:  {
      __typename: "Location",
      confidence?: number | null,
      createdAt: string,
      height?: number | null,
      id: string,
      imageId?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      width?: number | null,
      x: number,
      y: number,
    } | null,
    locationId: string,
    locationSet?:  {
      __typename: "LocationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    locationSetId: string,
    updatedAt: string,
  } | null,
};

export type UpdateObjectMutationVariables = {
  condition?: ModelObjectConditionInput | null,
  input: UpdateObjectInput,
};

export type UpdateObjectMutation = {
  updateObject?:  {
    __typename: "Object",
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    category?:  {
      __typename: "Category",
      color?: string | null,
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      shortcutKey?: string | null,
      updatedAt: string,
    } | null,
    categoryId: string,
    createdAt: string,
    id: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type UpdateObservationMutationVariables = {
  condition?: ModelObservationConditionInput | null,
  input: UpdateObservationInput,
};

export type UpdateObservationMutation = {
  updateObservation?:  {
    __typename: "Observation",
    annotationSet?:  {
      __typename: "AnnotationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    annotationSetId: string,
    createdAt: string,
    id: string,
    location?:  {
      __typename: "Location",
      confidence?: number | null,
      createdAt: string,
      height?: number | null,
      id: string,
      imageId?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      width?: number | null,
      x: number,
      y: number,
    } | null,
    locationId: string,
    owner?: string | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type UpdateProjectMutationVariables = {
  condition?: ModelProjectConditionInput | null,
  input: UpdateProjectInput,
};

export type UpdateProjectMutation = {
  updateProject?:  {
    __typename: "Project",
    annotationSets?:  {
      __typename: "ModelAnnotationSetConnection",
      nextToken?: string | null,
    } | null,
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    categories?:  {
      __typename: "ModelCategoryConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    imageFiles?:  {
      __typename: "ModelImageFileConnection",
      nextToken?: string | null,
    } | null,
    imageSets?:  {
      __typename: "ModelImageSetConnection",
      nextToken?: string | null,
    } | null,
    images?:  {
      __typename: "ModelImageConnection",
      nextToken?: string | null,
    } | null,
    locationSets?:  {
      __typename: "ModelLocationSetConnection",
      nextToken?: string | null,
    } | null,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    members?:  {
      __typename: "ModelUserProjectMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    objects?:  {
      __typename: "ModelObjectConnection",
      nextToken?: string | null,
    } | null,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    queues?:  {
      __typename: "ModelQueueConnection",
      nextToken?: string | null,
    } | null,
    updatedAt: string,
  } | null,
};

export type UpdateQueueMutationVariables = {
  condition?: ModelQueueConditionInput | null,
  input: UpdateQueueInput,
};

export type UpdateQueueMutation = {
  updateQueue?:  {
    __typename: "Queue",
    createdAt: string,
    id: string,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
    url?: string | null,
    users?:  {
      __typename: "ModelUserProjectMembershipConnection",
      nextToken?: string | null,
    } | null,
  } | null,
};

export type UpdateUserObservationStatsMutationVariables = {
  condition?: ModelUserObservationStatsConditionInput | null,
  input: UpdateUserObservationStatsInput,
};

export type UpdateUserObservationStatsMutation = {
  updateUserObservationStats?:  {
    __typename: "UserObservationStats",
    activeTime?: number | null,
    count: number,
    createdAt: string,
    lastUpdated?: number | null,
    projectId: string,
    updatedAt: string,
    userId: string,
  } | null,
};

export type UpdateUserProjectMembershipMutationVariables = {
  condition?: ModelUserProjectMembershipConditionInput | null,
  input: UpdateUserProjectMembershipInput,
};

export type UpdateUserProjectMembershipMutation = {
  updateUserProjectMembership?:  {
    __typename: "UserProjectMembership",
    createdAt: string,
    id: string,
    isAdmin?: boolean | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    queue?:  {
      __typename: "Queue",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
      url?: string | null,
    } | null,
    queueId?: string | null,
    updatedAt: string,
    userId: string,
  } | null,
};

export type UpdateUserStatsMutationVariables = {
  condition?: ModelUserStatsConditionInput | null,
  input: UpdateUserStatsInput,
};

export type UpdateUserStatsMutation = {
  updateUserStats?:  {
    __typename: "UserStats",
    activeTime: number,
    annotationCount: number,
    createdAt: string,
    date: string,
    observationCount: number,
    projectId: string,
    setId: string,
    updatedAt: string,
    userId: string,
  } | null,
};

export type OnCreateAnnotationSubscriptionVariables = {
  filter?: ModelSubscriptionAnnotationFilterInput | null,
  owner?: string | null,
};

export type OnCreateAnnotationSubscription = {
  onCreateAnnotation?:  {
    __typename: "Annotation",
    category?:  {
      __typename: "Category",
      color?: string | null,
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      shortcutKey?: string | null,
      updatedAt: string,
    } | null,
    categoryId: string,
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    object?:  {
      __typename: "Object",
      categoryId: string,
      createdAt: string,
      id: string,
      projectId: string,
      updatedAt: string,
    } | null,
    objectId?: string | null,
    obscured?: boolean | null,
    owner?: string | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    set?:  {
      __typename: "AnnotationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    setId: string,
    source: string,
    updatedAt: string,
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
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    name: string,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type OnCreateCategorySubscriptionVariables = {
  filter?: ModelSubscriptionCategoryFilterInput | null,
};

export type OnCreateCategorySubscription = {
  onCreateCategory?:  {
    __typename: "Category",
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    color?: string | null,
    createdAt: string,
    id: string,
    name: string,
    objects?:  {
      __typename: "ModelObjectConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    shortcutKey?: string | null,
    updatedAt: string,
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
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    cameraSerial?: string | null,
    createdAt: string,
    exifData?: string | null,
    files?:  {
      __typename: "ModelImageFileConnection",
      nextToken?: string | null,
    } | null,
    height: number,
    id: string,
    latitude?: number | null,
    leftNeighbours?:  {
      __typename: "ModelImageNeighbourConnection",
      nextToken?: string | null,
    } | null,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    longitude?: number | null,
    memberships?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    originalPath?: string | null,
    pitch?: number | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    rightNeighbours?:  {
      __typename: "ModelImageNeighbourConnection",
      nextToken?: string | null,
    } | null,
    roll?: number | null,
    timestamp?: number | null,
    updatedAt: string,
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
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId?: string | null,
    key: string,
    path: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    type: string,
    updatedAt: string,
  } | null,
};

export type OnCreateImageNeighbourSubscriptionVariables = {
  filter?: ModelSubscriptionImageNeighbourFilterInput | null,
};

export type OnCreateImageNeighbourSubscription = {
  onCreateImageNeighbour?:  {
    __typename: "ImageNeighbour",
    createdAt: string,
    homography?: Array< number | null > | null,
    image1?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    image1Id: string,
    image2?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    image2Id: string,
    updatedAt: string,
  } | null,
};

export type OnCreateImageSetSubscriptionVariables = {
  filter?: ModelSubscriptionImageSetFilterInput | null,
};

export type OnCreateImageSetSubscription = {
  onCreateImageSet?:  {
    __typename: "ImageSet",
    createdAt: string,
    id: string,
    images?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type OnCreateImageSetMembershipSubscriptionVariables = {
  filter?: ModelSubscriptionImageSetMembershipFilterInput | null,
};

export type OnCreateImageSetMembershipSubscription = {
  onCreateImageSetMembership?:  {
    __typename: "ImageSetMembership",
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    imageSet?:  {
      __typename: "ImageSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    imageSetId: string,
    updatedAt: string,
  } | null,
};

export type OnCreateLocationSubscriptionVariables = {
  filter?: ModelSubscriptionLocationFilterInput | null,
};

export type OnCreateLocationSubscription = {
  onCreateLocation?:  {
    __typename: "Location",
    confidence?: number | null,
    createdAt: string,
    height?: number | null,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId?: string | null,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    set?:  {
      __typename: "LocationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    setId: string,
    sets?:  {
      __typename: "ModelLocationSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    source: string,
    updatedAt: string,
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
    createdAt: string,
    id: string,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    memberships?:  {
      __typename: "ModelLocationSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type OnCreateLocationSetMembershipSubscriptionVariables = {
  filter?: ModelSubscriptionLocationSetMembershipFilterInput | null,
};

export type OnCreateLocationSetMembershipSubscription = {
  onCreateLocationSetMembership?:  {
    __typename: "LocationSetMembership",
    createdAt: string,
    id: string,
    location?:  {
      __typename: "Location",
      confidence?: number | null,
      createdAt: string,
      height?: number | null,
      id: string,
      imageId?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      width?: number | null,
      x: number,
      y: number,
    } | null,
    locationId: string,
    locationSet?:  {
      __typename: "LocationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    locationSetId: string,
    updatedAt: string,
  } | null,
};

export type OnCreateObjectSubscriptionVariables = {
  filter?: ModelSubscriptionObjectFilterInput | null,
};

export type OnCreateObjectSubscription = {
  onCreateObject?:  {
    __typename: "Object",
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    category?:  {
      __typename: "Category",
      color?: string | null,
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      shortcutKey?: string | null,
      updatedAt: string,
    } | null,
    categoryId: string,
    createdAt: string,
    id: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type OnCreateObservationSubscriptionVariables = {
  filter?: ModelSubscriptionObservationFilterInput | null,
  owner?: string | null,
};

export type OnCreateObservationSubscription = {
  onCreateObservation?:  {
    __typename: "Observation",
    annotationSet?:  {
      __typename: "AnnotationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    annotationSetId: string,
    createdAt: string,
    id: string,
    location?:  {
      __typename: "Location",
      confidence?: number | null,
      createdAt: string,
      height?: number | null,
      id: string,
      imageId?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      width?: number | null,
      x: number,
      y: number,
    } | null,
    locationId: string,
    owner?: string | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type OnCreateProjectSubscriptionVariables = {
  filter?: ModelSubscriptionProjectFilterInput | null,
};

export type OnCreateProjectSubscription = {
  onCreateProject?:  {
    __typename: "Project",
    annotationSets?:  {
      __typename: "ModelAnnotationSetConnection",
      nextToken?: string | null,
    } | null,
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    categories?:  {
      __typename: "ModelCategoryConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    imageFiles?:  {
      __typename: "ModelImageFileConnection",
      nextToken?: string | null,
    } | null,
    imageSets?:  {
      __typename: "ModelImageSetConnection",
      nextToken?: string | null,
    } | null,
    images?:  {
      __typename: "ModelImageConnection",
      nextToken?: string | null,
    } | null,
    locationSets?:  {
      __typename: "ModelLocationSetConnection",
      nextToken?: string | null,
    } | null,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    members?:  {
      __typename: "ModelUserProjectMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    objects?:  {
      __typename: "ModelObjectConnection",
      nextToken?: string | null,
    } | null,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    queues?:  {
      __typename: "ModelQueueConnection",
      nextToken?: string | null,
    } | null,
    updatedAt: string,
  } | null,
};

export type OnCreateQueueSubscriptionVariables = {
  filter?: ModelSubscriptionQueueFilterInput | null,
};

export type OnCreateQueueSubscription = {
  onCreateQueue?:  {
    __typename: "Queue",
    createdAt: string,
    id: string,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
    url?: string | null,
    users?:  {
      __typename: "ModelUserProjectMembershipConnection",
      nextToken?: string | null,
    } | null,
  } | null,
};

export type OnCreateUserObservationStatsSubscriptionVariables = {
  filter?: ModelSubscriptionUserObservationStatsFilterInput | null,
};

export type OnCreateUserObservationStatsSubscription = {
  onCreateUserObservationStats?:  {
    __typename: "UserObservationStats",
    activeTime?: number | null,
    count: number,
    createdAt: string,
    lastUpdated?: number | null,
    projectId: string,
    updatedAt: string,
    userId: string,
  } | null,
};

export type OnCreateUserProjectMembershipSubscriptionVariables = {
  filter?: ModelSubscriptionUserProjectMembershipFilterInput | null,
};

export type OnCreateUserProjectMembershipSubscription = {
  onCreateUserProjectMembership?:  {
    __typename: "UserProjectMembership",
    createdAt: string,
    id: string,
    isAdmin?: boolean | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    queue?:  {
      __typename: "Queue",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
      url?: string | null,
    } | null,
    queueId?: string | null,
    updatedAt: string,
    userId: string,
  } | null,
};

export type OnCreateUserStatsSubscriptionVariables = {
  filter?: ModelSubscriptionUserStatsFilterInput | null,
};

export type OnCreateUserStatsSubscription = {
  onCreateUserStats?:  {
    __typename: "UserStats",
    activeTime: number,
    annotationCount: number,
    createdAt: string,
    date: string,
    observationCount: number,
    projectId: string,
    setId: string,
    updatedAt: string,
    userId: string,
  } | null,
};

export type OnDeleteAnnotationSubscriptionVariables = {
  filter?: ModelSubscriptionAnnotationFilterInput | null,
  owner?: string | null,
};

export type OnDeleteAnnotationSubscription = {
  onDeleteAnnotation?:  {
    __typename: "Annotation",
    category?:  {
      __typename: "Category",
      color?: string | null,
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      shortcutKey?: string | null,
      updatedAt: string,
    } | null,
    categoryId: string,
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    object?:  {
      __typename: "Object",
      categoryId: string,
      createdAt: string,
      id: string,
      projectId: string,
      updatedAt: string,
    } | null,
    objectId?: string | null,
    obscured?: boolean | null,
    owner?: string | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    set?:  {
      __typename: "AnnotationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    setId: string,
    source: string,
    updatedAt: string,
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
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    name: string,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteCategorySubscriptionVariables = {
  filter?: ModelSubscriptionCategoryFilterInput | null,
};

export type OnDeleteCategorySubscription = {
  onDeleteCategory?:  {
    __typename: "Category",
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    color?: string | null,
    createdAt: string,
    id: string,
    name: string,
    objects?:  {
      __typename: "ModelObjectConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    shortcutKey?: string | null,
    updatedAt: string,
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
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    cameraSerial?: string | null,
    createdAt: string,
    exifData?: string | null,
    files?:  {
      __typename: "ModelImageFileConnection",
      nextToken?: string | null,
    } | null,
    height: number,
    id: string,
    latitude?: number | null,
    leftNeighbours?:  {
      __typename: "ModelImageNeighbourConnection",
      nextToken?: string | null,
    } | null,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    longitude?: number | null,
    memberships?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    originalPath?: string | null,
    pitch?: number | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    rightNeighbours?:  {
      __typename: "ModelImageNeighbourConnection",
      nextToken?: string | null,
    } | null,
    roll?: number | null,
    timestamp?: number | null,
    updatedAt: string,
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
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId?: string | null,
    key: string,
    path: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    type: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteImageNeighbourSubscriptionVariables = {
  filter?: ModelSubscriptionImageNeighbourFilterInput | null,
};

export type OnDeleteImageNeighbourSubscription = {
  onDeleteImageNeighbour?:  {
    __typename: "ImageNeighbour",
    createdAt: string,
    homography?: Array< number | null > | null,
    image1?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    image1Id: string,
    image2?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    image2Id: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteImageSetSubscriptionVariables = {
  filter?: ModelSubscriptionImageSetFilterInput | null,
};

export type OnDeleteImageSetSubscription = {
  onDeleteImageSet?:  {
    __typename: "ImageSet",
    createdAt: string,
    id: string,
    images?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteImageSetMembershipSubscriptionVariables = {
  filter?: ModelSubscriptionImageSetMembershipFilterInput | null,
};

export type OnDeleteImageSetMembershipSubscription = {
  onDeleteImageSetMembership?:  {
    __typename: "ImageSetMembership",
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    imageSet?:  {
      __typename: "ImageSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    imageSetId: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteLocationSubscriptionVariables = {
  filter?: ModelSubscriptionLocationFilterInput | null,
};

export type OnDeleteLocationSubscription = {
  onDeleteLocation?:  {
    __typename: "Location",
    confidence?: number | null,
    createdAt: string,
    height?: number | null,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId?: string | null,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    set?:  {
      __typename: "LocationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    setId: string,
    sets?:  {
      __typename: "ModelLocationSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    source: string,
    updatedAt: string,
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
    createdAt: string,
    id: string,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    memberships?:  {
      __typename: "ModelLocationSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteLocationSetMembershipSubscriptionVariables = {
  filter?: ModelSubscriptionLocationSetMembershipFilterInput | null,
};

export type OnDeleteLocationSetMembershipSubscription = {
  onDeleteLocationSetMembership?:  {
    __typename: "LocationSetMembership",
    createdAt: string,
    id: string,
    location?:  {
      __typename: "Location",
      confidence?: number | null,
      createdAt: string,
      height?: number | null,
      id: string,
      imageId?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      width?: number | null,
      x: number,
      y: number,
    } | null,
    locationId: string,
    locationSet?:  {
      __typename: "LocationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    locationSetId: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteObjectSubscriptionVariables = {
  filter?: ModelSubscriptionObjectFilterInput | null,
};

export type OnDeleteObjectSubscription = {
  onDeleteObject?:  {
    __typename: "Object",
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    category?:  {
      __typename: "Category",
      color?: string | null,
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      shortcutKey?: string | null,
      updatedAt: string,
    } | null,
    categoryId: string,
    createdAt: string,
    id: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteObservationSubscriptionVariables = {
  filter?: ModelSubscriptionObservationFilterInput | null,
  owner?: string | null,
};

export type OnDeleteObservationSubscription = {
  onDeleteObservation?:  {
    __typename: "Observation",
    annotationSet?:  {
      __typename: "AnnotationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    annotationSetId: string,
    createdAt: string,
    id: string,
    location?:  {
      __typename: "Location",
      confidence?: number | null,
      createdAt: string,
      height?: number | null,
      id: string,
      imageId?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      width?: number | null,
      x: number,
      y: number,
    } | null,
    locationId: string,
    owner?: string | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteProjectSubscriptionVariables = {
  filter?: ModelSubscriptionProjectFilterInput | null,
};

export type OnDeleteProjectSubscription = {
  onDeleteProject?:  {
    __typename: "Project",
    annotationSets?:  {
      __typename: "ModelAnnotationSetConnection",
      nextToken?: string | null,
    } | null,
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    categories?:  {
      __typename: "ModelCategoryConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    imageFiles?:  {
      __typename: "ModelImageFileConnection",
      nextToken?: string | null,
    } | null,
    imageSets?:  {
      __typename: "ModelImageSetConnection",
      nextToken?: string | null,
    } | null,
    images?:  {
      __typename: "ModelImageConnection",
      nextToken?: string | null,
    } | null,
    locationSets?:  {
      __typename: "ModelLocationSetConnection",
      nextToken?: string | null,
    } | null,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    members?:  {
      __typename: "ModelUserProjectMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    objects?:  {
      __typename: "ModelObjectConnection",
      nextToken?: string | null,
    } | null,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    queues?:  {
      __typename: "ModelQueueConnection",
      nextToken?: string | null,
    } | null,
    updatedAt: string,
  } | null,
};

export type OnDeleteQueueSubscriptionVariables = {
  filter?: ModelSubscriptionQueueFilterInput | null,
};

export type OnDeleteQueueSubscription = {
  onDeleteQueue?:  {
    __typename: "Queue",
    createdAt: string,
    id: string,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
    url?: string | null,
    users?:  {
      __typename: "ModelUserProjectMembershipConnection",
      nextToken?: string | null,
    } | null,
  } | null,
};

export type OnDeleteUserObservationStatsSubscriptionVariables = {
  filter?: ModelSubscriptionUserObservationStatsFilterInput | null,
};

export type OnDeleteUserObservationStatsSubscription = {
  onDeleteUserObservationStats?:  {
    __typename: "UserObservationStats",
    activeTime?: number | null,
    count: number,
    createdAt: string,
    lastUpdated?: number | null,
    projectId: string,
    updatedAt: string,
    userId: string,
  } | null,
};

export type OnDeleteUserProjectMembershipSubscriptionVariables = {
  filter?: ModelSubscriptionUserProjectMembershipFilterInput | null,
};

export type OnDeleteUserProjectMembershipSubscription = {
  onDeleteUserProjectMembership?:  {
    __typename: "UserProjectMembership",
    createdAt: string,
    id: string,
    isAdmin?: boolean | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    queue?:  {
      __typename: "Queue",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
      url?: string | null,
    } | null,
    queueId?: string | null,
    updatedAt: string,
    userId: string,
  } | null,
};

export type OnDeleteUserStatsSubscriptionVariables = {
  filter?: ModelSubscriptionUserStatsFilterInput | null,
};

export type OnDeleteUserStatsSubscription = {
  onDeleteUserStats?:  {
    __typename: "UserStats",
    activeTime: number,
    annotationCount: number,
    createdAt: string,
    date: string,
    observationCount: number,
    projectId: string,
    setId: string,
    updatedAt: string,
    userId: string,
  } | null,
};

export type OnUpdateAnnotationSubscriptionVariables = {
  filter?: ModelSubscriptionAnnotationFilterInput | null,
  owner?: string | null,
};

export type OnUpdateAnnotationSubscription = {
  onUpdateAnnotation?:  {
    __typename: "Annotation",
    category?:  {
      __typename: "Category",
      color?: string | null,
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      shortcutKey?: string | null,
      updatedAt: string,
    } | null,
    categoryId: string,
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    object?:  {
      __typename: "Object",
      categoryId: string,
      createdAt: string,
      id: string,
      projectId: string,
      updatedAt: string,
    } | null,
    objectId?: string | null,
    obscured?: boolean | null,
    owner?: string | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    set?:  {
      __typename: "AnnotationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    setId: string,
    source: string,
    updatedAt: string,
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
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    name: string,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateCategorySubscriptionVariables = {
  filter?: ModelSubscriptionCategoryFilterInput | null,
};

export type OnUpdateCategorySubscription = {
  onUpdateCategory?:  {
    __typename: "Category",
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    color?: string | null,
    createdAt: string,
    id: string,
    name: string,
    objects?:  {
      __typename: "ModelObjectConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    shortcutKey?: string | null,
    updatedAt: string,
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
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    cameraSerial?: string | null,
    createdAt: string,
    exifData?: string | null,
    files?:  {
      __typename: "ModelImageFileConnection",
      nextToken?: string | null,
    } | null,
    height: number,
    id: string,
    latitude?: number | null,
    leftNeighbours?:  {
      __typename: "ModelImageNeighbourConnection",
      nextToken?: string | null,
    } | null,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    longitude?: number | null,
    memberships?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    originalPath?: string | null,
    pitch?: number | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    rightNeighbours?:  {
      __typename: "ModelImageNeighbourConnection",
      nextToken?: string | null,
    } | null,
    roll?: number | null,
    timestamp?: number | null,
    updatedAt: string,
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
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId?: string | null,
    key: string,
    path: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    type: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateImageNeighbourSubscriptionVariables = {
  filter?: ModelSubscriptionImageNeighbourFilterInput | null,
};

export type OnUpdateImageNeighbourSubscription = {
  onUpdateImageNeighbour?:  {
    __typename: "ImageNeighbour",
    createdAt: string,
    homography?: Array< number | null > | null,
    image1?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    image1Id: string,
    image2?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    image2Id: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateImageSetSubscriptionVariables = {
  filter?: ModelSubscriptionImageSetFilterInput | null,
};

export type OnUpdateImageSetSubscription = {
  onUpdateImageSet?:  {
    __typename: "ImageSet",
    createdAt: string,
    id: string,
    images?:  {
      __typename: "ModelImageSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateImageSetMembershipSubscriptionVariables = {
  filter?: ModelSubscriptionImageSetMembershipFilterInput | null,
};

export type OnUpdateImageSetMembershipSubscription = {
  onUpdateImageSetMembership?:  {
    __typename: "ImageSetMembership",
    createdAt: string,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId: string,
    imageSet?:  {
      __typename: "ImageSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    imageSetId: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateLocationSubscriptionVariables = {
  filter?: ModelSubscriptionLocationFilterInput | null,
};

export type OnUpdateLocationSubscription = {
  onUpdateLocation?:  {
    __typename: "Location",
    confidence?: number | null,
    createdAt: string,
    height?: number | null,
    id: string,
    image?:  {
      __typename: "Image",
      altitude_agl?: number | null,
      altitude_egm96?: number | null,
      altitude_wgs84?: number | null,
      cameraSerial?: string | null,
      createdAt: string,
      exifData?: string | null,
      height: number,
      id: string,
      latitude?: number | null,
      longitude?: number | null,
      originalPath?: string | null,
      pitch?: number | null,
      projectId: string,
      roll?: number | null,
      timestamp?: number | null,
      updatedAt: string,
      width: number,
      yaw?: number | null,
    } | null,
    imageId?: string | null,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    set?:  {
      __typename: "LocationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    setId: string,
    sets?:  {
      __typename: "ModelLocationSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    source: string,
    updatedAt: string,
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
    createdAt: string,
    id: string,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    memberships?:  {
      __typename: "ModelLocationSetMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateLocationSetMembershipSubscriptionVariables = {
  filter?: ModelSubscriptionLocationSetMembershipFilterInput | null,
};

export type OnUpdateLocationSetMembershipSubscription = {
  onUpdateLocationSetMembership?:  {
    __typename: "LocationSetMembership",
    createdAt: string,
    id: string,
    location?:  {
      __typename: "Location",
      confidence?: number | null,
      createdAt: string,
      height?: number | null,
      id: string,
      imageId?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      width?: number | null,
      x: number,
      y: number,
    } | null,
    locationId: string,
    locationSet?:  {
      __typename: "LocationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    locationSetId: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateObjectSubscriptionVariables = {
  filter?: ModelSubscriptionObjectFilterInput | null,
};

export type OnUpdateObjectSubscription = {
  onUpdateObject?:  {
    __typename: "Object",
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    category?:  {
      __typename: "Category",
      color?: string | null,
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      shortcutKey?: string | null,
      updatedAt: string,
    } | null,
    categoryId: string,
    createdAt: string,
    id: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateObservationSubscriptionVariables = {
  filter?: ModelSubscriptionObservationFilterInput | null,
  owner?: string | null,
};

export type OnUpdateObservationSubscription = {
  onUpdateObservation?:  {
    __typename: "Observation",
    annotationSet?:  {
      __typename: "AnnotationSet",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
    } | null,
    annotationSetId: string,
    createdAt: string,
    id: string,
    location?:  {
      __typename: "Location",
      confidence?: number | null,
      createdAt: string,
      height?: number | null,
      id: string,
      imageId?: string | null,
      projectId: string,
      setId: string,
      source: string,
      updatedAt: string,
      width?: number | null,
      x: number,
      y: number,
    } | null,
    locationId: string,
    owner?: string | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateProjectSubscriptionVariables = {
  filter?: ModelSubscriptionProjectFilterInput | null,
};

export type OnUpdateProjectSubscription = {
  onUpdateProject?:  {
    __typename: "Project",
    annotationSets?:  {
      __typename: "ModelAnnotationSetConnection",
      nextToken?: string | null,
    } | null,
    annotations?:  {
      __typename: "ModelAnnotationConnection",
      nextToken?: string | null,
    } | null,
    categories?:  {
      __typename: "ModelCategoryConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    imageFiles?:  {
      __typename: "ModelImageFileConnection",
      nextToken?: string | null,
    } | null,
    imageSets?:  {
      __typename: "ModelImageSetConnection",
      nextToken?: string | null,
    } | null,
    images?:  {
      __typename: "ModelImageConnection",
      nextToken?: string | null,
    } | null,
    locationSets?:  {
      __typename: "ModelLocationSetConnection",
      nextToken?: string | null,
    } | null,
    locations?:  {
      __typename: "ModelLocationConnection",
      nextToken?: string | null,
    } | null,
    members?:  {
      __typename: "ModelUserProjectMembershipConnection",
      nextToken?: string | null,
    } | null,
    name: string,
    objects?:  {
      __typename: "ModelObjectConnection",
      nextToken?: string | null,
    } | null,
    observations?:  {
      __typename: "ModelObservationConnection",
      nextToken?: string | null,
    } | null,
    queues?:  {
      __typename: "ModelQueueConnection",
      nextToken?: string | null,
    } | null,
    updatedAt: string,
  } | null,
};

export type OnUpdateQueueSubscriptionVariables = {
  filter?: ModelSubscriptionQueueFilterInput | null,
};

export type OnUpdateQueueSubscription = {
  onUpdateQueue?:  {
    __typename: "Queue",
    createdAt: string,
    id: string,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    updatedAt: string,
    url?: string | null,
    users?:  {
      __typename: "ModelUserProjectMembershipConnection",
      nextToken?: string | null,
    } | null,
  } | null,
};

export type OnUpdateUserObservationStatsSubscriptionVariables = {
  filter?: ModelSubscriptionUserObservationStatsFilterInput | null,
};

export type OnUpdateUserObservationStatsSubscription = {
  onUpdateUserObservationStats?:  {
    __typename: "UserObservationStats",
    activeTime?: number | null,
    count: number,
    createdAt: string,
    lastUpdated?: number | null,
    projectId: string,
    updatedAt: string,
    userId: string,
  } | null,
};

export type OnUpdateUserProjectMembershipSubscriptionVariables = {
  filter?: ModelSubscriptionUserProjectMembershipFilterInput | null,
};

export type OnUpdateUserProjectMembershipSubscription = {
  onUpdateUserProjectMembership?:  {
    __typename: "UserProjectMembership",
    createdAt: string,
    id: string,
    isAdmin?: boolean | null,
    project?:  {
      __typename: "Project",
      createdAt: string,
      id: string,
      name: string,
      updatedAt: string,
    } | null,
    projectId: string,
    queue?:  {
      __typename: "Queue",
      createdAt: string,
      id: string,
      name: string,
      projectId: string,
      updatedAt: string,
      url?: string | null,
    } | null,
    queueId?: string | null,
    updatedAt: string,
    userId: string,
  } | null,
};

export type OnUpdateUserStatsSubscriptionVariables = {
  filter?: ModelSubscriptionUserStatsFilterInput | null,
};

export type OnUpdateUserStatsSubscription = {
  onUpdateUserStats?:  {
    __typename: "UserStats",
    activeTime: number,
    annotationCount: number,
    createdAt: string,
    date: string,
    observationCount: number,
    projectId: string,
    setId: string,
    updatedAt: string,
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
