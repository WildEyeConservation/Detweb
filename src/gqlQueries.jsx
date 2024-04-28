export const getImageSetsInProject = `query getImageSetsInProject ($name: String!,$nextToken:String){
    result1:getProject(name: $name) {
      result2:imageSets(nextToken: $nextToken){
        items {
          name
        }
        nextToken
      }
    }
  }
  `;

export const getLocationSetsInProject = `query getLocationSetsInProject ($name: String!,$nextToken:String){
    result1:getProject(name: $name) {
      result2:locationSets(nextToken: $nextToken){
        items {
          id
          name
        }
        nextToken
      }
    }
  }
  `;
export const getAnnotationSetsInProject = `query getAnnotationSetsInProject ($name: String!,$nextToken:String){
    result1:getProject(name: $name) {
      result2:annotationSet(nextToken: $nextToken){
        items {
          id
          name
        }
        nextToken
      }
    }
  }
  `;
export const getQueuesInProject = `query getQueuesInProject ($name: String!,$nextToken:String){
    result1:getProject(name: $name) {
      result2:queues(nextToken: $nextToken){
        items {
          url
          name
        }
        nextToken
      }
    }
  }
  `;
export const getLocationsInSet = `query getLocationsInSet($id: ID!, $nextToken: String) {
    result1: getLocationSet(id: $id) {
      result2: locations(nextToken: $nextToken) {
        items {
          id
          x
          y
          width
          height
          confidence
          image {
            key
            width
            height
          }
        }
        nextToken
      }
    }
  }
  `;

export const getImagesInSet = `query getImagesInSet ($name: String!,$nextToken:String){
    result1:getImageSet(name: $name) {
        result2:images(nextToken: $nextToken){
        items {
          image{
            key
            width
            height
            timestamp
          }
        }
        nextToken
      }
    }
  }
  `;

export const testLocations = `query MyQuery($setId: ID!, $nextToken: String) {
  testLocations(setId: $setId, nextToken: $nextToken) {
    items {
      id
    }
  }
}
`;
export const latestObservation = `query LatestObservation($owner: String!, $locationId: ID!) {
  observationsByLocationIdAndOwnerAndCreatedAt(locationId: $locationId, ownerCreatedAt: {beginsWith: {owner: $owner}}, sortDirection: DESC, limit: 1) {
    items {
      createdAt
    }
  }
}
`;

/* These createXminimal and update X minimal queries were written because in some cases I ran into trouble because eg. the default createAnnotation
graphQL mutation would also return the annotationSet that the annotation belongs to. This would cause hassles when logged in as a non-admin user 
because non-admin users aren't actually authorised to read from that table (they just know the id of the annotationset that they are working on, 
none of the other metadata). Also in general the graphQL philosophy is build around returning only the data the user is actually interested in.

One gotcha that I ran into shortly after implementing this is that subscriptions are affected by what data you return from the create/update call.
I could not find this cleanly documented anywhere, but it is referred to in several SO and GH threads eg. https://github.com/aws-amplify/amplify-flutter/issues/898
So if you have a subscription on observations created by a particular user (see eg. useTesting), you better return the owner field when you call 
createObservation or the subscription will stop working. Similarly, if you have subscriptions on createAnnotation, updateAnnotation (to keep the 
user's view of the data up to date), then you better return all of the data the subscription is interested in in your create/update call). This 
is not ideal, but something we have to live with for now.*/

export const createAnnotationMinimal = /* GraphQL */ `
  mutation CreateAnnotation(
    $input: CreateAnnotationInput!
    $condition: ModelAnnotationConditionInput
  ) {
    createAnnotation(input: $input, condition: $condition) {
      id
    }
  }
`;

export const updateAnnotationMinimal = /* GraphQL */ `
  mutation UpdateAnnotation(
    $input: UpdateAnnotationInput!
    $condition: ModelAnnotationConditionInput
  ) {
    updateAnnotation(input: $input, condition: $condition) {
      id
      x
      y
      note
      categoryId
      obscured
      objectId
    }
  }
`;
export const deleteAnnotationMinimal = /* GraphQL */ `
  mutation DeleteAnnotation(
    $input: DeleteAnnotationInput!
    $condition: ModelAnnotationConditionInput
  ) {
    deleteAnnotation(input: $input, condition: $condition) {
      id
    }
  }
`;

export const createObservationMinimal = /* GraphQL */ `
  mutation CreateObservation(
    $input: CreateObservationInput!
    $condition: ModelObservationConditionInput
  ) {
    createObservation(input: $input, condition: $condition) {
      id
      locationId
      owner
    }
  }
`;

export const createImageSetMembershipMinimal = /* GraphQL */ `
  mutation CreateImageSetMembership(
    $input: CreateImageSetMembershipInput!
    $condition: ModelImageSetMembershipConditionInput
  ) {
    createImageSetMembership(input: $input, condition: $condition) {
      id
    }
  }
`;
