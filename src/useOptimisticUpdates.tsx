/*
This file defines a custom React hook called useOptimisticUpdates that provides optimistic updates for CRUD operations on a specified model. It uses React Query 
for data fetching and caching, and AWS Amplify for the actual API calls and real-time subscriptions.
The hook sets up:
1. A query to fetch data for the specified model
2. Real-time subscriptions for create, update, and delete events
3. Mutation functions for create, update, and delete operations with optimistic updates

The optimistic updates allow the UI to update immediately in response to user actions, while still handling the actual API calls in the background. 
If an error occurs, the changes are rolled back to maintain data consistency. We implicitly assume that every table has a unique identifier field called 'id'.

This updated version adds an optional `options` parameter that accepts a compositeKey function. When provided, the compositeKey function is used to
derive a unique key for each item (e.g. combining multiple fields into a string) instead of assuming each item has a unique 'id' property.

Example usage:

// Without composite keys
const { data, create, update, delete } = useOptimisticUpdates('Todo'); 
// 'Where Todo' is the name of one of the models in the schema, If we select a nonexistent model, typescript will generate an error.

const newTodo = create({
  name: 'New Todo',
  description: 'Description of the new todo',
  completed: false,
}); // This will create a new todo item and update the data immediately, while the actual API call is made in the background.

update({
  id: '1',
  name: 'Updated Todo',
  description: 'Updated description of the todo',
  completed: true,
}); // This will update the todo item with id '1' and update the data immediately, while the actual API call is made in the background.

delete({
  id: '2',
}); // This will delete the todo item with id '2' and update the data immediately, while the actual API call is made in the background.

// With composite keys:
const compositeKey = (item: OrganizationMembership) => 
    `${item.organizationId}:${item.userId}`;
const { data, create, update, delete } = useOptimisticUpdates(
    'OrganizationMembership', listMemberships, subscriptionFilter, { compositeKey }
);
*/
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useContext, useMemo, useCallback } from 'react';
import type { Schema } from './amplify/client-schema';
import { V6Client } from '@aws-amplify/api-graphql';
import { CreateQueueCommand, DeleteQueueCommand } from '@aws-sdk/client-sqs';
import { makeSafeQueueName } from './utils';
import { GlobalContext, UserContext, ProjectContext } from './Context';

type ClientType = V6Client<Schema>;

// Options interface to optionally pass a composite key resolver
export interface OptimisticOptions<T> {
  compositeKey?: (item: T) => string;
}

export function useOptimisticUpdates<
  T,
  ModelKey extends keyof ClientType['models']
>(
  modelKey: ModelKey,
  listFunction: (
    nextToken?: string
  ) => Promise<{ data: T[]; nextToken?: string }>,
  subscriptionFilter?: Parameters<
    ClientType['models'][ModelKey]['onCreate']
  >[0],
  options?: OptimisticOptions<T>,
  updateFunction?: (item: T) => Promise<void>
) {
  const { client } = useContext(GlobalContext);
  const queryClient = useQueryClient();
  const queryKey = [modelKey, subscriptionFilter];
  const model = client.models[modelKey];

  // Use the compositeKey function from options if provided, otherwise use id
  const getKey = (item: any) =>
    options && options.compositeKey ? options.compositeKey(item) : item.id;

  const effectiveListFunction = useCallback(
    (nextToken?: string) => {
      return listFunction
        ? listFunction(nextToken)
        : client.models[modelKey].list({ nextToken });
    },
    [listFunction, client, modelKey]
  );

  const { data, ...queryResult } = useQuery({
    queryKey,
    queryFn: async () => {
      let nextToken: string | undefined = undefined;
      const allResults: T[] = [];
      do {
        const result = await effectiveListFunction(nextToken);
        allResults.push(...result.data);
        if (updateFunction) {
          updateFunction(allResults.length);
        }
        nextToken = result.nextToken;
      } while (nextToken);
      return allResults;
    },
  });

  useEffect(() => {
    console.log(
      `creating subscriptions ${queryClient} ${JSON.stringify(
        subscriptionFilter
      )}`
    );

    const createSub = model.onCreate(subscriptionFilter).subscribe({
      next: (data: T) => {
        console.log(data);
        queryClient.setQueryData<T[]>(queryKey, (old = []) => [
          ...old.filter((item) => getKey(item) !== getKey(data)),
          data,
        ]);
      },
      error: (error: unknown) => console.warn(error),
    });

    const updateSub = model.onUpdate(subscriptionFilter).subscribe({
      next: (data: T) => {
        console.log(data);
        queryClient.setQueryData<T[]>(queryKey, (old = []) =>
          old.map((item) =>
            getKey(item) === getKey(data) ? { ...item, ...data } : item
          )
        );
      },
      error: (error: unknown) => console.warn(error),
    });

    const deleteSub = model.onDelete(subscriptionFilter).subscribe({
      next: (data: T) => {
        console.log(data);
        queryClient.setQueryData<T[]>(queryKey, (old = []) =>
          old.filter((item) => getKey(item) !== getKey(data))
        );
      },
      error: (error: unknown) => console.warn(error),
    });

    return () => {
      console.log('unsubscribing');
      createSub.unsubscribe();
      updateSub.unsubscribe();
      deleteSub.unsubscribe();
    };
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionFilter]);

  const createMutation = useMutation({
    mutationFn: model.create,
    onMutate: async (newItem: Parameters<typeof model.create>[0]) => {
      newItem.id ||= crypto.randomUUID(); // If the item does not have an id, generate a random UUID for it.
      await queryClient.cancelQueries({ queryKey });
      const previousItems = queryClient.getQueryData<T[]>(queryKey);
      queryClient.setQueryData<T[]>(queryKey, (old = []) => [
        ...old,
        newItem as T,
      ]);
      return { previousItems };
    },
    onError: (err, newItem, context) => {
      console.error(err, newItem, context);
      queryClient.setQueryData(queryKey, context?.previousItems);
    },
  });

  const updateMutation = useMutation({
    mutationFn: model.update,
    onMutate: async (updatedItem: T) => {
      await queryClient.cancelQueries({ queryKey });
      const previousItems = queryClient.getQueryData<T[]>(queryKey);
      queryClient.setQueryData<T[]>(queryKey, (old = []) =>
        old.map((item) =>
          getKey(item) === getKey(updatedItem)
            ? { ...item, ...updatedItem }
            : item
        )
      );
      return { previousItems };
    },
    onError: (err, updatedItem, context) => {
      console.error(err, updatedItem, context);
      queryClient.setQueryData(queryKey, context?.previousItems);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: model.delete,
    onMutate: async (deletedItem: T) => {
      await queryClient.cancelQueries({ queryKey });
      const previousItems = queryClient.getQueryData<T[]>(queryKey);
      queryClient.setQueryData<T[]>(queryKey, (old = []) =>
        old.filter((item) => getKey(item) !== getKey(deletedItem))
      );
      return { previousItems };
    },
    onError: (err, deletedItem, context) => {
      console.error(err, deletedItem, context);
      queryClient.setQueryData(queryKey, context?.previousItems);
    },
  });

  return {
    data: data || [],
    meta: queryResult,
    create: (item: T) => {
      item.id ||= crypto.randomUUID(); // If the item does not have an id, we generate a random UUID for it.
      createMutation.mutate(item);
      return item.id;
    },
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
  };
}

export const useQueues = () => {
  const { client } = useContext(GlobalContext)!;
  const { getSqsClient } = useContext(UserContext)!;
  const { project } = useContext(ProjectContext)!;
  const subscriptionFilter = useMemo(
    () => ({
      filter: { projectId: { eq: project.id } },
    }),
    [project.id]
  );

  const originalHook = useOptimisticUpdates<Schema['Queue']['type'], 'Queue'>(
    'Queue',
    async (nextToken) =>
      client.models.Queue.list({
        filter: subscriptionFilter.filter,
        nextToken,
      }),
    subscriptionFilter
  );
  const create = (name: string) => {
    const safeName = makeSafeQueueName(name + crypto.randomUUID());
    const id = originalHook.create({ name, projectId: project.id });
    getSqsClient()
      .then((sqsClient) =>
        sqsClient.send(
          new CreateQueueCommand({
            QueueName: safeName + '.fifo',
            Attributes: {
              MessageRetentionPeriod: '1209600', //This value is in seconds. 1209600 corresponds to 14 days and is the maximum AWS supports
              FifoQueue: 'true',
            },
          })
        )
      )
      .then(({ QueueUrl: url }) => {
        originalHook.update({ id, url });
        return id;
      });
  };
  const remove = ({ id }: { id: string }) => {
    const url = originalHook.data.find((x) => x.id == id)?.url;
    if (url) {
      getSqsClient().then((sqsClient) =>
        sqsClient.send(new DeleteQueueCommand({ QueueUrl: url }))
      );
    }
    originalHook.delete({ id });
  };
  return { ...originalHook, create, delete: remove };
};

// // The byProject versions of the useOptimisticUpdates hook work on all classes except project itself
// type ModelTypeByProject = Exclude<keyof typeof client.models, 'Project'>;

// export function useOptimisticUpdatesByProject<T extends ModelTypeByProject>(modelName: T) {
//   return (projectId?: string) => {
//     const { currentPM } = useContext(UserContext);
//     projectId ||= currentPM?.projectId;
//     return useOptimisticUpdates<T>(
//       modelName,
//       () => client.models[modelName].byProject({ projectId }),
//       { filter: { projectId: { eq: projectId } } }
//     );
//   };
// }
