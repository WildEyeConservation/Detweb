/* tslint:disable */
/* eslint-disable */
// GraphQL mutations for findAndRequeueMissingLocations lambda

export const updateQueue = /* GraphQL */ `
  mutation UpdateQueue($input: UpdateQueueInput!) {
    updateQueue(input: $input) {
      id
      emptyQueueTimestamp
      requeuesCompleted
    }
  }
`;

export const createAdminActionLog = /* GraphQL */ `
  mutation CreateAdminActionLog($input: CreateAdminActionLogInput!) {
    createAdminActionLog(input: $input) {
      id
      userId
      message
      projectId
      group
      createdAt
    }
  }
`;
