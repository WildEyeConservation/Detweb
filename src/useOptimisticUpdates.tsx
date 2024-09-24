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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useContext} from 'react';
import type { Schema } from "../amplify/data/resource";
import { V6Client } from '@aws-amplify/api-graphql'
import { client } from './main';
import { CreateQueueCommand, DeleteQueueCommand } from '@aws-sdk/client-sqs';
import { makeSafeQueueName } from './utils';
import { GlobalContext, UserContext, ProjectContext } from './Context';

type ClientType = V6Client<Schema>;
// type ModelType = keyof ClientType['models'];

// export function useOptimisticUpdates<T extends ModelType>(modelName: T,
//                                                           listFunction: () => Promise<{data : Schema[T]['type'][]}> = () => client['models'][modelName].list(), 
//                                                           subscriptionFilter?: Parameters<ClientType['models'][T]['onCreate']>[0]
// ) {
//   const queryClient = useQueryClient();
//   const model = client.models[modelName];
//   const queryKey = [modelName, subscriptionFilter];

//   // Query to fetch data
//   const { data, ...queryResult } = useQuery({
//     queryKey,
//     queryFn: async () => {
//       const result = await listFunction();
//       return result.data;
//     },
//   });

//   // Create a separate subscription filter
//   //const subscriptionFilter = filterExpression ? { filter: filterExpression.filter } : undefined;

//   //Subscription effect
//   useEffect(() => {
//     console.log('effect ran')
//     // Subscribe to creation of Todo
//     const createSub = model.onCreate(subscriptionFilter).subscribe({
//       next: (data) => {
//         console.log(data)
//         // queryClient.setQueryData(queryKey, (old: Schema[T]['type'][] = []) => [
//         //   ...old.filter((item) => item.id !== data.id),
//         //   data as Schema[T]['type']
//         // ]);
//       },
//       error: (error) => console.warn(error),
//     });

//     // Subscribe to update of Todo
//     const updateSub = model.onUpdate(subscriptionFilter).subscribe({
//       next: (data) => {
//         console.log(data)
//         // queryClient.setQueryData<BasicType[]>(queryKey, (old:{id:string}[]) => {
//         //   return old.map(item => item.id === data.id ? data : item)
//         // })
//       },
//       error: (error) => console.warn(error),
//     });

//     // Subscribe to deletion of Todo
//     const deleteSub = model.onDelete(subscriptionFilter).subscribe({
//       next: (data) => {
//         console.log(data)
//         // queryClient.setQueryData(queryKey, (old: {id:string}[]) => {  
//         //   return old.filter(item => item.id !== data.id)
//         // })
//       },
//       error: (error) => console.warn(error),
//     });
//     return () => {console.log('unsubscribing')
//       createSub.unsubscribe();
//       updateSub.unsubscribe();
//       deleteSub.unsubscribe();
//     };
//   }, [modelName, queryClient, subscriptionFilter]);

//   // Create mutation
//   const createMutation = useMutation({
//     mutationFn: model.create,
//     onMutate: async (newItem) => {
//       newItem.id ||= crypto.randomUUID(); // If the item does not have an id, we generate a random UUID for it.
//       // Normally we wouldn't need to do this as the server will generate an id for us. But our onCreate subscription will inform us of all newly created items (including
//       // ones created by ourselves). We then need to add them to the cache. But if the newly created item was created by us, it would allready have been added to the cache
//       // by the optimistic update. Avoiding duplicates is trivial if ids are generated client-side, but basically impossible if they are generated on the server.
//       await queryClient.cancelQueries({ queryKey});
//       const previousItems = queryClient.getQueryData([modelName]);
//       queryClient.setQueryData(queryKey, (old: any[] = []) => [...old, newItem]);
//       return { previousItems };
//     },
//     onError: (err, newItem, context) => {
//       console.error(err, newItem, context)
//       queryClient.setQueryData(queryKey, context?.previousItems);
//     }
//   });

//   // Update mutation
//   const updateMutation = useMutation({
//     mutationFn: model.update,
//     onMutate: async (updatedItem) => {
//       updatedItem.id ||= crypto.randomUUID(); // If the item does not have an id, we generate a random UUID for it.
//       await queryClient.cancelQueries({ queryKey});
//       const previousItems = queryClient.getQueryData([modelName]);
//       queryClient.setQueryData(queryKey, (old: any[] = []) =>
//         old.map((item) => (item.id === updatedItem.id ? {...item, ...updatedItem} : item))
//       );
//       return { previousItems };
//     },
//     onError: (err, updatedItem, context) => {
//       console.error(err, updatedItem, context)
//       queryClient.setQueryData(queryKey, context?.previousItems);
//     }
//   });

//   // Delete mutation
//   const deleteMutation = useMutation({
//     mutationFn: model.delete,
//     onMutate: async (deletedItem) => {
//       await queryClient.cancelQueries({ queryKey});
//       const previousItems = queryClient.getQueryData(queryKey);
//       queryClient.setQueryData(queryKey, (old: any[] = []) =>
//         old.filter((item) => item.id !== deletedItem.id)
//       );
//       return { previousItems };
//     },
//     onError: (err, deletedItem, context) => {
//       console.error(err, deletedItem, context)
//       queryClient.setQueryData(queryKey, context?.previousItems);
//     }
//   });

//   return {
//     data: data || [],
//     meta : queryResult,
//     create: (item: Parameters<typeof createMutation.mutate>[0]) => {
//       item.id ||= crypto.randomUUID(); // If the item does not have an id, we generate a random UUID for it.
//       createMutation.mutate(item);
//       return item.id;
//     },
//     update: updateMutation.mutate,
//     delete: deleteMutation.mutate,
//   };
// }

type ProjectMembership = Schema['UserProjectMembership']['type'];


export function useOptimisticMembership(
  listFunction: () => Promise<{ data: ProjectMembership[] }> = () => client['models']['UserProjectMembership'].list(), 
  subscriptionFilter?: Parameters<ClientType['models']['UserProjectMembership']['onCreate']>[0]){
  const queryClient = useQueryClient();
  const queryKey = ['UserProjectMembership', subscriptionFilter];
  const model = client.models['UserProjectMembership'];

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
    console.log(`creating subscriptions ${queryClient} ${JSON.stringify(subscriptionFilter)}`)
    const createSub = model.onCreate(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<ProjectMembership[]>(queryKey, (old = []) => [
          ...old.filter((item) => item.id !== data.id)
        ]);
      },
      error: (error) => console.warn(error),
    });

    const updateSub = model.onUpdate(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<ProjectMembership[]>(queryKey, (old = []) => {
          return old.map(item => item.id === data.id ? { ...item, ...data } : item)
        })
      },
      error: (error) => console.warn(error),
    });

    // Subscribe to deletion of Todo
    const deleteSub = model.onDelete(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<ProjectMembership[]>(queryKey, (old = []) => {  
          return old.filter(item => item.id !== data.id)
        })
      },
      error: (error) => console.warn(error),
    });
    return () => {console.log('unsubscribing')
      createSub.unsubscribe();
      updateSub.unsubscribe();
      deleteSub.unsubscribe();
    };
  }, [queryClient, subscriptionFilter]);

// Create mutation
  const createMutation = useMutation({
    mutationFn: model.create,
    onMutate: async (newItem: Parameters<typeof model.create>[0]) => {
      newItem.id||=crypto.randomUUID();// If the item does not have an id, we generate a random UUID for it.
      await queryClient.cancelQueries({ queryKey});
      const previousItems = queryClient.getQueryData(queryKey);
      queryClient.setQueryData<ProjectMembership[]>(queryKey, (old = []) => [...old, newItem as ProjectMembership]);
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
      const previousItems = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any[] = []) =>
        old.map((item) => (item.id === updatedItem.id ? {...item, ...updatedItem} : item))
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
        old.filter((item) => item.id !== deletedItem.id));
      return { previousItems };
    },
    onError: (err, deletedItem, context) => {
      console.error(err, deletedItem, context)
      queryClient.setQueryData(queryKey, context?.previousItems);
    }
  });

  return {
  data: data || [],
  meta : queryResult,
  create: (item: Parameters<typeof createMutation.mutate>[0]) => {
  item.id ||= crypto.randomUUID(); // If the item does not have an id, we generate a random UUID for it.
  createMutation.mutate(item);
  return item.id;
  },
  update: updateMutation.mutate,
  delete: deleteMutation.mutate,
  };
}

type Category = Schema['Category']['type'];
export function useOptimisticCategory(
  listFunction: () => Promise<{ data: Category[] }> = () => client['models']['Category'].list(), 
  subscriptionFilter?: Parameters<ClientType['models']['Category']['onCreate']>[0]){
  const queryClient = useQueryClient();
  const queryKey = ['Category', subscriptionFilter];
  const model = client.models['Category'];

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
    console.log(`creating subscriptions ${queryClient} ${JSON.stringify(subscriptionFilter)}`)
    // Subscribe to creation of Todo
    const createSub = model.onCreate(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<Category[]>(queryKey, (old = []) => [
          ...old.filter((item) => item.id !== data.id)
        ]);
      },
      error: (error) => console.warn(error),
    });

    const updateSub = model.onUpdate(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<Category[]>(queryKey, (old = []) => {
          return old.map(item => item.id === data.id ? { ...item, ...data } : item)
        })
      },
      error: (error) => console.warn(error),
    });

    // Subscribe to deletion of Todo
    const deleteSub = model.onDelete(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<Category[]>(queryKey, (old = []) => {  
          return old.filter(item => item.id !== data.id)
        })
      },
      error: (error) => console.warn(error),
    });
    return () => {console.log('unsubscribing')
      createSub.unsubscribe();
      updateSub.unsubscribe();
      deleteSub.unsubscribe();
    };
  }, [queryClient, subscriptionFilter]);

// Create mutation
  const createMutation = useMutation({
    mutationFn: model.create,
    onMutate: async (newItem) => {
      newItem.id ||= crypto.randomUUID(); // If the item does not have an id, we generate a random UUID for it.
      // Normally we wouldn't need to do this as the server will generate an id for us. But our onCreate subscription will inform us of all newly created items (including
      // ones created by ourselves). We then need to add them to the cache. But if the newly created item was created by us, it would allready have been added to the cache
      // by the optimistic update. Avoiding duplicates is trivial if ids are generated client-side, but basically impossible if they are generated on the server.
      await queryClient.cancelQueries({ queryKey});
      const previousItems = queryClient.getQueryData(queryKey);
      queryClient.setQueryData<Category[]>(queryKey, (old = []) => [...old, newItem as Category]);
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
      const previousItems = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any[] = []) =>
        old.map((item) => (item.id === updatedItem.id ? {...item, ...updatedItem} : item))
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
        old.filter((item) => item.id !== deletedItem.id));
      return { previousItems };
    },
    onError: (err, deletedItem, context) => {
      console.error(err, deletedItem, context)
      queryClient.setQueryData(queryKey, context?.previousItems);
      }
  });

  return {
  data: data || [],
  meta : queryResult,
  create: (item: Parameters<typeof createMutation.mutate>[0]) => {
  item.id ||= crypto.randomUUID(); // If the item does not have an id, we generate a random UUID for it.
  createMutation.mutate(item);
  return item.id;
  },
  update: updateMutation.mutate,
  delete: deleteMutation.mutate,
  };
}

type LocationSet = Schema['LocationSet']['type'];
export function useOptimisticLocationSet(
  listFunction: () => Promise<{ data: LocationSet[] }> = () => client['models']['LocationSet'].list(), 
  subscriptionFilter?: Parameters<ClientType['models']['LocationSet']['onCreate']>[0]){
  const queryClient = useQueryClient();
  const queryKey = ['LocationSet', subscriptionFilter];
  const model = client.models['LocationSet'];

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
    console.log(`creating subscriptions ${queryClient} ${JSON.stringify(subscriptionFilter)}`)
    // Subscribe to creation of Todo
    const createSub = model.onCreate(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<LocationSet[]>(queryKey, (old = []) => [
          ...old.filter((item) => item.id !== data.id)
        ]);
      },
      error: (error) => console.warn(error),
    });

    const updateSub = model.onUpdate(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<LocationSet[]>(queryKey, (old = []) => {
          return old.map(item => item.id === data.id ? { ...item, ...data } : item)
        })
      },
      error: (error) => console.warn(error),
    });

    // Subscribe to deletion of Todo
    const deleteSub = model.onDelete(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<LocationSet[]>(queryKey, (old = []) => {  
          return old.filter(item => item.id !== data.id)
        })
      },
      error: (error) => console.warn(error),
    });
    return () => {console.log('unsubscribing')
      createSub.unsubscribe();
      updateSub.unsubscribe();
      deleteSub.unsubscribe();
    };
  }, [queryClient, subscriptionFilter]);

// Create mutation
  const createMutation = useMutation({
    mutationFn: model.create,
    onMutate: async (newItem) => {
      newItem.id ||= crypto.randomUUID(); // If the item does not have an id, we generate a random UUID for it.
      // Normally we wouldn't need to do this as the server will generate an id for us. But our onCreate subscription will inform us of all newly created items (including
      // ones created by ourselves). We then need to add them to the cache. But if the newly created item was created by us, it would allready have been added to the cache
      // by the optimistic update. Avoiding duplicates is trivial if ids are generated client-side, but basically impossible if they are generated on the server.
      await queryClient.cancelQueries({ queryKey});
      const previousItems = queryClient.getQueryData(queryKey);
      queryClient.setQueryData<LocationSet[]>(queryKey, (old = []) => [...old, newItem as LocationSet]);
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
      const previousItems = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any[] = []) =>
        old.map((item) => (item.id === updatedItem.id ? {...item, ...updatedItem} : item))
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
        old.filter((item) => item.id !== deletedItem.id));
      return { previousItems };
    },
    onError: (err, deletedItem, context) => {
      console.error(err, deletedItem, context)
      queryClient.setQueryData(queryKey, context?.previousItems);
      }
  });

  return {
  data: data || [],
  meta : queryResult,
  create: (item: Parameters<typeof createMutation.mutate>[0]) => {
  item.id ||= crypto.randomUUID(); // If the item does not have an id, we generate a random UUID for it.
  createMutation.mutate(item);
  return item.id;
  },
  update: updateMutation.mutate,
  delete: deleteMutation.mutate,
  };
}


type ImageSet = Schema['ImageSet']['type'];
export function useOptimisticImageSet(
  listFunction: () => Promise<{ data: ImageSet[] }> = () => client['models']['ImageSet'].list(), 
  subscriptionFilter?: Parameters<ClientType['models']['ImageSet']['onCreate']>[0]){
  const queryClient = useQueryClient();
  const queryKey = ['ImageSet', subscriptionFilter];
  const model = client.models['ImageSet'];

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
    console.log(`creating subscriptions ${queryClient} ${JSON.stringify(subscriptionFilter)}`)
    // Subscribe to creation of Todo
    const createSub = model.onCreate(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<ImageSet[]>(queryKey, (old = []) => [
          ...old.filter((item) => item.id !== data.id)
        ]);
      },
      error: (error) => console.warn(error),
    });

    const updateSub = model.onUpdate(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<ImageSet[]>(queryKey, (old = []) => {
          return old.map(item => item.id === data.id ? { ...item, ...data } : item)
        })
      },
      error: (error) => console.warn(error),
    });

    // Subscribe to deletion of Todo
    const deleteSub = model.onDelete(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<ImageSet[]>(queryKey, (old = []) => {  
          return old.filter(item => item.id !== data.id)
        })
      },
      error: (error) => console.warn(error),
    });
    return () => {console.log('unsubscribing')
      createSub.unsubscribe();
      updateSub.unsubscribe();
      deleteSub.unsubscribe();
    };
  }, [queryClient, subscriptionFilter]);

// Create mutation
  const createMutation = useMutation({
    mutationFn: model.create,
    onMutate: async (newItem) => {
      newItem.id ||= crypto.randomUUID(); // If the item does not have an id, we generate a random UUID for it.
      // Normally we wouldn't need to do this as the server will generate an id for us. But our onCreate subscription will inform us of all newly created items (including
      // ones created by ourselves). We then need to add them to the cache. But if the newly created item was created by us, it would allready have been added to the cache
      // by the optimistic update. Avoiding duplicates is trivial if ids are generated client-side, but basically impossible if they are generated on the server.
      await queryClient.cancelQueries({ queryKey});
      const previousItems = queryClient.getQueryData(queryKey);
      queryClient.setQueryData<ImageSet[]>(queryKey, (old = []) => [...old, newItem as ImageSet] );
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
      const previousItems = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any[] = []) =>
        old.map((item) => (item.id === updatedItem.id ? {...item, ...updatedItem} : item))
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
        old.filter((item) => item.id !== deletedItem.id));
      return { previousItems };
    },
    onError: (err, deletedItem, context) => {
      console.error(err, deletedItem, context)
      queryClient.setQueryData(queryKey, context?.previousItems);
      }
  });

  return {
  data: data || [],
  meta : queryResult,
  create: (item: Parameters<typeof createMutation.mutate>[0]) => {
  item.id ||= crypto.randomUUID(); // If the item does not have an id, we generate a random UUID for it.
  createMutation.mutate(item);
  return item.id;
  },
  update: updateMutation.mutate,
  delete: deleteMutation.mutate,
  };
}

type Annotation = Schema['Annotation']['type'];
export function useOptimisticAnnotation(
  listFunction: () => Promise<{ data: Annotation[] }> = () => client['models']['Annotation'].list(), 
  subscriptionFilter?: Parameters<ClientType['models']['Annotation']['onCreate']>[0]){
  const queryClient = useQueryClient();
  const queryKey = ['Annotation', subscriptionFilter];
  const model = client.models['Annotation'];

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
    console.log(`creating subscriptions ${queryClient} ${JSON.stringify(subscriptionFilter)}`)
    // Subscribe to creation of Todo
    const createSub = model.onCreate(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<Annotation[]>(queryKey, (old = []) => [
          ...old.filter((item) => item.id !== data.id)
        ]);
      },
      error: (error) => console.warn(error),
    });

    const updateSub = model.onUpdate(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<Annotation[]>(queryKey, (old = []) => {
          return old.map(item => item.id === data.id ? { ...item, ...data } : item)
        })
      },
      error: (error) => console.warn(error),
    });

    // Subscribe to deletion of Todo
    const deleteSub = model.onDelete(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<Annotation[]>(queryKey, (old = []) => {  
          return old.filter(item => item.id !== data.id)
        })
      },
      error: (error) => console.warn(error),
    });
    return () => {console.log('unsubscribing')
      createSub.unsubscribe();
      updateSub.unsubscribe();
      deleteSub.unsubscribe();
    };
  }, [queryClient, subscriptionFilter]);

// Create mutation
  const createMutation = useMutation({
    mutationFn: model.create,
    onMutate: async (newItem) => {
      newItem.id ||= crypto.randomUUID(); // If the item does not have an id, we generate a random UUID for it.
      // Normally we wouldn't need to do this as the server will generate an id for us. But our onCreate subscription will inform us of all newly created items (including
      // ones created by ourselves). We then need to add them to the cache. But if the newly created item was created by us, it would allready have been added to the cache
      // by the optimistic update. Avoiding duplicates is trivial if ids are generated client-side, but basically impossible if they are generated on the server.
      await queryClient.cancelQueries({ queryKey});
      const previousItems = queryClient.getQueryData(queryKey);
      queryClient.setQueryData<Annotation[]>(queryKey, (old = []) => [...old, newItem as Annotation]);
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
      const previousItems = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any[] = []) =>
        old.map((item) => (item.id === updatedItem.id ? {...item, ...updatedItem} : item))
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
        old.filter((item) => item.id !== deletedItem.id));
      return { previousItems };
    },
    onError: (err, deletedItem, context) => {
      console.error(err, deletedItem, context)
      queryClient.setQueryData(queryKey, context?.previousItems);
      }
  });

  return {
  data: data || [],
  meta : queryResult,
  create: (item: Parameters<typeof createMutation.mutate>[0]) => {
  item.id ||= crypto.randomUUID(); // If the item does not have an id, we generate a random UUID for it.
  createMutation.mutate(item);
  return item.id;
  },
  update: updateMutation.mutate,
  delete: deleteMutation.mutate,
  };
}

type AnnotationSet = Schema['AnnotationSet']['type'];
export function useOptimisticAnnotationSet(
  listFunction: () => Promise<{ data: AnnotationSet[] }> = () => client['models']['AnnotationSet'].list(), 
  subscriptionFilter?: Parameters<ClientType['models']['AnnotationSet']['onCreate']>[0]){
  const queryClient = useQueryClient();
  const queryKey = ['AnnotationSet', subscriptionFilter];
  const model = client.models['AnnotationSet'];

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
    console.log(`creating subscriptions ${queryClient} ${JSON.stringify(subscriptionFilter)}`)
    // Subscribe to creation of Todo
    const createSub = model.onCreate(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<AnnotationSet[]>(queryKey, (old = []) => [
          ...old.filter((item) => item.id !== data.id)
        ]);
      },
      error: (error) => console.warn(error),
    });

    const updateSub = model.onUpdate(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<AnnotationSet[]>(queryKey, (old = []) => {
          return old.map(item => item.id === data.id ? { ...item, ...data } : item)
        })
      },
      error: (error) => console.warn(error),
    });

    // Subscribe to deletion of Todo
    const deleteSub = model.onDelete(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<AnnotationSet[]>(queryKey, (old = []) => {  
          return old.filter(item => item.id !== data.id)
        })
      },
      error: (error) => console.warn(error),
    });
    return () => {console.log('unsubscribing')
      createSub.unsubscribe();
      updateSub.unsubscribe();
      deleteSub.unsubscribe();
    };
  }, [queryClient, subscriptionFilter]);

// Create mutation
  const createMutation = useMutation({
    mutationFn: model.create,
    onMutate: async (newItem) => {
      newItem.id ||= crypto.randomUUID(); // If the item does not have an id, we generate a random UUID for it.
      // Normally we wouldn't need to do this as the server will generate an id for us. But our onCreate subscription will inform us of all newly created items (including
      // ones created by ourselves). We then need to add them to the cache. But if the newly created item was created by us, it would allready have been added to the cache
      // by the optimistic update. Avoiding duplicates is trivial if ids are generated client-side, but basically impossible if they are generated on the server.
      await queryClient.cancelQueries({ queryKey});
      const previousItems = queryClient.getQueryData(queryKey);
      queryClient.setQueryData<AnnotationSet[]>(queryKey, (old = []) => [...old, newItem as AnnotationSet]);
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
      const previousItems = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any[] = []) =>
        old.map((item) => (item.id === updatedItem.id ? {...item, ...updatedItem} : item))
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
        old.filter((item) => item.id !== deletedItem.id));
      return { previousItems };
    },
    onError: (err, deletedItem, context) => {
      console.error(err, deletedItem, context)
      queryClient.setQueryData(queryKey, context?.previousItems);
      }
  });

  return {
  data: data || [],
  meta : queryResult,
  create: (item: Parameters<typeof createMutation.mutate>[0]) => {
  item.id ||= crypto.randomUUID(); // If the item does not have an id, we generate a random UUID for it.
  createMutation.mutate(item);
  return item.id;
  },
  update: updateMutation.mutate,
  delete: deleteMutation.mutate,
  };
}

type Queue = Schema['Queue']['type'];
function useOptimisticQueue(
  listFunction: () => Promise<{ data: Queue[] }> = () => client['models']['Queue'].list(), 
  subscriptionFilter?: Parameters<ClientType['models']['Queue']['onCreate']>[0]){
  const queryClient = useQueryClient();
  const queryKey = ['Queue', subscriptionFilter];
  const model = client.models['Queue'];

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
    console.log(`creating subscriptions ${queryClient} ${JSON.stringify(subscriptionFilter)}`)
    // Subscribe to creation of Todo
    const createSub = model.onCreate(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<Queue[]>(queryKey, (old = []) => [
          ...old.filter((item) => item.id !== data.id)
        ]);
      },
      error: (error) => console.warn(error),
    });

    const updateSub = model.onUpdate(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<Queue[]>(queryKey, (old = []) => {
          return old.map(item => item.id === data.id ? { ...item, ...data } : item)
        })
      },
      error: (error) => console.warn(error),
    });

    // Subscribe to deletion of Todo
    const deleteSub = model.onDelete(subscriptionFilter).subscribe({
      next: (data) => {
        console.log(data)
        queryClient.setQueryData<Queue[]>(queryKey, (old = []) => {  
          return old.filter(item => item.id !== data.id)
        })
      },
      error: (error) => console.warn(error),
    });
    return () => {console.log('unsubscribing')
      createSub.unsubscribe();
      updateSub.unsubscribe();
      deleteSub.unsubscribe();
    };
  }, [queryClient, subscriptionFilter]);

// Create mutation
  const createMutation = useMutation({
    mutationFn: model.create,
    onMutate: async (newItem) => {
      newItem.id ||= crypto.randomUUID(); // If the item does not have an id, we generate a random UUID for it.
      // Normally we wouldn't need to do this as the server will generate an id for us. But our onCreate subscription will inform us of all newly created items (including
      // ones created by ourselves). We then need to add them to the cache. But if the newly created item was created by us, it would allready have been added to the cache
      // by the optimistic update. Avoiding duplicates is trivial if ids are generated client-side, but basically impossible if they are generated on the server.
      await queryClient.cancelQueries({ queryKey});
      const previousItems = queryClient.getQueryData(queryKey);
      queryClient.setQueryData<Queue[]>(queryKey, (old = []) => [...old, newItem as Queue]);
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
      const previousItems = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any[] = []) =>
        old.map((item) => (item.id === updatedItem.id ? {...item, ...updatedItem} : item))
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
        old.filter((item) => item.id !== deletedItem.id));
      return { previousItems };
    },
    onError: (err, deletedItem, context) => {
      console.error(err, deletedItem, context)
      queryClient.setQueryData(queryKey, context?.previousItems);
      }
  });

  return {
  data: data || [],
  meta : queryResult,
  create: (item: Parameters<typeof createMutation.mutate>[0]) => {
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
  const { sqsClient } = useContext(UserContext)!;
  const { project }   = useContext(ProjectContext)!;
  const originalHook = useOptimisticQueue(() => client.models.Queue.list({filter: {projectId: {eq: project.id}}}), 
    { filter: { projectId: { eq: project.id } } });
  const create = (name: string) => {
    const safeName = makeSafeQueueName(name);
    const id = originalHook.create({ name: safeName, projectId: project.id});
    sqsClient.send(new CreateQueueCommand({
      QueueName: safeName,
      Attributes: {
        MessageRetentionPeriod: '1209600', //This value is in seconds. 1209600 corresponds to 14 days and is the maximum AWS supports      //FifoQueue: "false",
      },
    })
    ).then(({ QueueUrl: url }) => {
      originalHook.update({ id, url });
      return id;
    })
  }
  const remove = ({ id }: { id: string }) => {
    const url = originalHook.data.find((x) => x.id == id)?.url;
    if (url) {
      sqsClient.send(new DeleteQueueCommand({ QueueUrl: url })); 
      originalHook.delete({ id });
    }
  }
  return { ...originalHook, create, delete:remove };
}

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
  
