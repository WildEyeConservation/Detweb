/*
This file defines a custom React hook called useOptimisticUpdates that provides optimistic updates for CRUD operations on a specified model. It uses React Query 
for data fetching and caching, and AWS Amplify for the actual API calls and real-time subscriptions.
The hook sets up:
1. A query to fetch data for the specified model
2. Real-time subscriptions for create, update, and delete events
3. Mutation functions for create, update, and delete operations with optimistic updates

The optimistic updates allow the UI to update immediately in response to user actions, while still handling the actual API calls in the background. 
If an error occurs, the changes are rolled back to maintain data consistency. We implicitly assume that every table has a unique identifier field called 'id'.

Example usage of the hook is as follows:
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

*/
import { Amplify } from 'aws-amplify'
import outputs from '../amplify_outputs.json'
Amplify.configure(outputs)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { generateClient } from "aws-amplify/api";
import { Schema } from '../amplify/data/resource'; // Path to your backend resource definition

export const client = generateClient<Schema>({ authMode: 'userPool' });

type ModelType = keyof typeof client.models;
type listType = () => ReturnType<typeof client.models.Category.list>;

export function useOptimisticUpdates<T extends ModelType>(
  modelName: T,
  listFunction: () => ReturnType<client.models[modelName]['list']> = client.models[modelName].list,
  subscriptionFilter: Parameters<typeof client.models[modelName]['onCreate']>[0] = undefined
) {
  const queryClient = useQueryClient();
  const model = client.models[modelName];
  const queryKey = [modelName, subscriptionFilter];

  // Query to fetch data
  const { data, ...queryResult } = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await listFunction();
      return result.data;
    },
  });

  // Create a separate subscription filter
  //const subscriptionFilter = filterExpression ? { filter: filterExpression.filter } : undefined;

  //Subscription effect
  useEffect(() => {
    // Subscribe to creation of Todo
    const createSub = model.onCreate(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData(queryKey, (old: any[] = []) => {
          if (old.map(item => item.id).includes(data.id)){
            return old
          }
          else {
            return [...old, data]
          }
        })
      },
      error: (error) => console.warn(error),
    });

    // Subscribe to update of Todo
    const updateSub = model.onUpdate(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData(queryKey, (old: any[] = []) => {
          return old.map(item => item.id === data.id ? data : item)
        })
      },
      error: (error) => console.warn(error),
    });

    // Subscribe to deletion of Todo
    const deleteSub = model.onDelete(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData(queryKey, (old: any[] = []) => {  
          return old.filter(item => item.id !== data.id)
        })
      },
      error: (error) => console.warn(error),
    });
    return () => {
      createSub.unsubscribe();
      updateSub.unsubscribe();
      deleteSub.unsubscribe();
    };
  }, [modelName, queryClient]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: model.create,
    onMutate: async (newItem) => {
      newItem.id ||= crypto.randomUUID(); // If the item does not have an id, we generate a random UUID for it.
      // Normally we wouldn't need to do this as the server will generate an id for us. But our onCreate subscription will inform us of all newly created items (including
      // ones created by ourselves). We then need to add them to the cache. But if the newly created item was created by us, it would allready have been added to the cache
      // by the optimistic update. Avoiding duplicates is trivial if ids are generated client-side, but basically impossible if they are generated on the server.
      await queryClient.cancelQueries({ queryKey});
      const previousItems = queryClient.getQueryData([modelName]);
      queryClient.setQueryData(queryKey, (old: any[] = []) => [...old, newItem]);
      return { previousItems };
    },
    onError: (err, newItem, context) => {
      console.error(err, newItem, context)
      queryClient.setQueryData(queryKey, context?.previousItems);
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: model.update,
    onMutate: async (updatedItem) => {
      updatedItem.id ||= crypto.randomUUID(); // If the item does not have an id, we generate a random UUID for it.
      await queryClient.cancelQueries({ queryKey});
      const previousItems = queryClient.getQueryData([modelName]);
      queryClient.setQueryData(queryKey, (old: any[] = []) =>
        old.map((item) => (item.id === updatedItem.id ? updatedItem : item))
      );
      return { previousItems };
    },
    onError: (err, updatedItem, context) => {
      console.error(err, updatedItem, context)
      queryClient.setQueryData(queryKey, context?.previousItems);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: model.delete,
    onMutate: async (deletedItem) => {
      await queryClient.cancelQueries({ queryKey});
      const previousItems = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any[] = []) =>
        old.filter((item) => item.id !== deletedItem.id)
      );
      return { previousItems };
    },
    onError: (err, deletedItem, context) => {
      console.error(err, deletedItem, context)
      queryClient.setQueryData(queryKey, context?.previousItems);
    }
  });

  return {
    data: { data, ...queryResult },
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
  };
}

export const useProjects = () => useOptimisticUpdates("Project");
  
export const useProjectMemberships = () => {
  const { data, create, update, delete: remove } = useOptimisticUpdates("UserProjectMembership");
  return {
    projectMemberships: data,
    createProjectMembership: create,
    updateProjectMembership: update,
    deleteProjectMembership: remove,
  };
};

export const useCategories = () => {
  const { data, create, update, delete: remove } = useOptimisticUpdates("Category");
  return {
    categories: data,
    createCategory: create,
    updateCategory: update,
    deleteCategory: remove,
  };
};
