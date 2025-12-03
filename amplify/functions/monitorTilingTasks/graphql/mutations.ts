/* tslint:disable */
/* eslint-disable */
// GraphQL mutations for monitorTilingTasks lambda

export const createQueue = /* GraphQL */ `
  mutation CreateQueue($input: CreateQueueInput!, $condition: ModelQueueConditionInput) {
    createQueue(input: $input, condition: $condition) {
      id
      projectId
      name
      batchSize
      totalBatches
      url
      zoom
      hidden
      approximateSize
      tag
      requeueAt
      updatedAt
      createdAt
    }
  }
`;

export const updateQueue = /* GraphQL */ `
  mutation UpdateQueue($input: UpdateQueueInput!, $condition: ModelQueueConditionInput) {
    updateQueue(input: $input, condition: $condition) {
      id
      projectId
      name
      batchSize
      totalBatches
      url
      zoom
      hidden
      approximateSize
      tag
      requeueAt
      updatedAt
      createdAt
    }
  }
`;

export const createTasksOnAnnotationSet = /* GraphQL */ `
  mutation CreateTasksOnAnnotationSet($input: CreateTasksOnAnnotationSetInput!, $condition: ModelTasksOnAnnotationSetConditionInput) {
    createTasksOnAnnotationSet(input: $input, condition: $condition) {
      id
      annotationSetId
      locationSetId
      createdAt
      updatedAt
    }
  }
`;

export const updateProject = /* GraphQL */ `
  mutation UpdateProject($input: UpdateProjectInput!, $condition: ModelProjectConditionInput) {
    updateProject(input: $input, condition: $condition) {
      id
      name
      status
      hidden
      createdAt
      updatedAt
    }
  }
`;

export const updateProjectMemberships = /* GraphQL */ `
  mutation UpdateProjectMemberships($projectId: String!) {
    updateProjectMemberships(projectId: $projectId)
  }
`;

export const updateTilingTask = /* GraphQL */ `
  mutation UpdateTilingTask($input: UpdateTilingTaskInput!, $condition: ModelTilingTaskConditionInput) {
    updateTilingTask(input: $input, condition: $condition) {
      id
      projectId
      locationSetId
      annotationSetId
      status
      launchConfig
      totalBatches
      completedBatches
      totalLocations
      outputS3Key
      errorMessage
      createdAt
      updatedAt
    }
  }
`;

