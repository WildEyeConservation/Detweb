import { useContext, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import { onCreateAnnotation, onCreateCategory, onCreateImage, onCreateUser, onCreateQueue,
//   onDeleteAnnotation, onDeleteCategory, onDeleteImage, onDeleteUser,onDeleteQueue,
//   onUpdateAnnotation, onUpdateCategory, onUpdateImage, onUpdateUser, onUpdateQueue } from './graphql/subscriptions';
// import { createAnnotation, createCategory, createImage, createUser,createQueue,
//   deleteAnnotation, deleteCategory, deleteImage, deleteUser,deleteQueue,
//   updateAnnotation, updateCategory, updateImage,updateUser,updateQueue } from './graphql/mutations';
// import { listAnnotations, listCategories, listImages,listQueues } from './graphql/queries';
import * as queries from "./graphql/queries";
import * as subs from "./graphql/subscriptions";
import * as mutations from "./graphql/mutations";
import { getLocationsInSet } from "./gqlQueries";
import { UserContext } from "./UserContext";
import {
  createAnnotationMinimal,
  updateAnnotationMinimal,
  deleteAnnotationMinimal,
} from "./gqlQueries";
import { SQSClient, CreateQueueCommand } from "@aws-sdk/client-sqs";
import { makeSafeQueueName, gqlSend, gqlGetMany } from "./utils";
import { GQL_Client } from "./App";
import type { UserProjectMembershipType, CategoryType, AnnotationType, LocationType, AnnotationSetType, LocationSetType }
  from "./schemaTypes";


/* This utility function is from https://stackoverflow.com/questions/1584370/how-to-merge-two-arrays-in-javascript-and-de-duplicate-items
It is used to merge two arrays of objects, and removing duplicates, for some definition of duplicate. a and b are the 
arrays in question and predicate is a function defining when two objects are considered duplicates. In our case we consider two 
o bjects to be duplicates if their id properties match, so that is the default value of predicate. This allow us to merge 
arrays as follows 
merge([{id: 1}, {id: 2, name:'John'}], [{id: 2, name:'Jack'}, {id: 3}]);
=
[{id: 1}, {id: 2, name:'John'}, {id: 3}]
Note that in the case of duplicates between a and b, a's version will be preferred*/

export interface Identifiable {
  id?: string;
  currentProjectId?: string;
  isAdmin?: boolean;
};

interface SubscriptionEntry {
  listeners: number;
  subs: Array<Promise<any>>;
};

interface UseGqlCachedConfig<T> {
  queryKey: string[];
  listItem: () => Promise<any>;
  createItem: (input: T) => Promise<any>;
  updateItem: (input: T) => Promise<any>;
  deleteItem: (input: T) => Promise<any>;
  onCreate: (subConfig: any) => Promise<any>;
  onDelete: (subConfig: any) => Promise<any>;
  onUpdate: (subConfig: any) => Promise<any>;
};

interface AnnotationsResponse {
  annotationsByImageKey: {
    items: AnnotationType[];
    nextToken: string | null;
  };
};


interface NamedIdentifiable extends Identifiable {
  name: string;
}

const subscriptions: Record<string, SubscriptionEntry> = {};
const mergeById = (a: any, b: any) => a.id === b.id;
const mergeByUrl = (a: any, b: any) => a.url === b.url;

export default function useGqlCached<T>(
  config: UseGqlCachedConfig<T>,
  mergingPredicate: (a: T, b: T) => boolean = mergeById
) {
  const { queryKey, listItem, createItem, updateItem, deleteItem, onCreate, onDelete, onUpdate } = config;
  const stringKey = JSON.stringify(queryKey);
  const queryClient = useQueryClient();

  useEffect(() => {
    const entry = subscriptions?.[stringKey];
    if (entry?.listeners) {
      entry.listeners += 1;
      console.log(`Adding subscriber for ${stringKey}`);
    } else {
      console.log(`creating 3 subscriptions for ${stringKey}`);
      subscriptions[stringKey] = {
        listeners: 1,
        subs: [
          onCreate({
            next: ({ data }: any) => {
              const newItem = Object.values(data)[0] as T;
              console.log(`onCreate callback (${JSON.stringify(queryKey)}`);
              queryClient.setQueryData(queryKey, (old: T[]) => [...old, newItem],
              );
            },
            error: (error: any) => console.warn(error),
          }),
          onUpdate({
            next: ({ data }: any) => {
              const updatedItem = Object.values(data)[0] as T;
              console.log(`onUpdate callback (${JSON.stringify(queryKey)}`);
              queryClient.setQueryData(queryKey, (old: T[]) =>
                old.map((item) => mergingPredicate(item, updatedItem) ? { ...item, ...updatedItem } : item),
              );
            },
            error: (error: any) => console.warn(error),
          }),
          onDelete({
            next: ({ data }: any) => {
              const deletedItem = Object.values(data)[0] as T;
              console.log(`onDelete callback (${JSON.stringify(queryKey)}`);
              queryClient.setQueryData(queryKey, (items: T[]) =>
                items.filter((item) => !mergingPredicate(item,deletedItem)),
              );
            },
            error: (error: any) => console.warn(error),
          }),
        ],
      };
    }
    return () => {
      const entry = subscriptions[stringKey];
      entry.listeners -= 1;
      console.log(`unsubscribing from ${stringKey}`);
      if (entry.listeners === 0) {
        console.log(`canceling 3 subscriptions for ${stringKey}`);
        entry.subs.map((sub) => sub.then((x) => x.unsubscribe()));
      }
    };
  }, [stringKey]);

  /* This effect is purely used for debugging and should be deactivated when not required. 
  It checks (on every render cycle) that the server and client's versions of the data are in sync.
  This defeats the purpose of having a cache, but it is just intended to help us track down issues 
  with the cache*/
  // const traceMismatch= useEffect(()=>{
  //     const f = async ()=>{
  //     const serverData= Object.values((await listItem()).data)[0].items
  //     const clientData = queryClient.getQueryData(queryKey)
  //     /*For now I do a very amateur comparison. I just compare the number of items in each list
  //     In future a more sophisticated deep comparison may be required, but I know from experimentation
  //     with the devtools that at least in some cases, we are getting a missmatch on this high level.*/
  //     if (clientData?.length!=serverData?.length){
  //       console.log(clientData)
  //       console.log(serverData)
  //     }else{
  //       console.log(`${JSON.stringify(queryKey)} matched `)
  //     }
  //   }
  //   f()
  // })

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<T[]> => {
      const result = await listItem();
      const data = result.data as T[] | undefined;
      if (data) {
        return data;
      } else {
        throw new Error("Unexpected data structure or no data returned");
      }
    },
    staleTime: Infinity,
  });
  
  const createMutation = useMutation({
    mutationFn: async (newItem: T) => {
      const result = await createItem(newItem)
      if (result.errors) {
        throw new Error(result.errors[0].message)
      }
      return result
    },
    onMutate: async (newItem: T) => {
      // Cancel any outgoing refetches
      // (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey });
      // Snapshot the previous value
      const oldCategories = queryClient.getQueryData(queryKey);
      // Optimistically update to the new value
      if (oldCategories) {
        console.log(`create optimistic update (${JSON.stringify(queryKey)}`);
        queryClient.setQueryData(queryKey, (old: T[]) => [
          ...old,
          { ...newItem, createdAt: new Date().toISOString() },
        ]);
      }
      // Return a context object with the snapshotted value
      return { oldCategories };
    },
    // If the mutation fails,
    // use the context returned from onMutate to rollback
    onError: (err, newItem, context) => {
      console.error("Error saving record:", err, newItem);
      if (context?.oldCategories) {
        console.log(`create optimistic rollback (${JSON.stringify(queryKey)}`);
        queryClient.setQueryData(queryKey, context.oldCategories);
      }
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async (item: T) =>{const result = await deleteItem(item)
      if (result.errors) {
        throw new Error(result.errors[0].message)
      }
      return result
    },

    onMutate: async (deletedItem: T) => {
      // Cancel any outgoing refetches
      // (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey });
      // Snapshot the previous value
      const oldItems = queryClient.getQueryData(queryKey);
      // Optimistically update to the new value
      queryClient.setQueryData(queryKey, (old: T[]) =>
        old.filter((item) => !mergingPredicate(item,deletedItem)));
      // Return a context object with the snapshotted value
      return { oldItems };
    },
    // If the mutation fails,
    // use the context returned from onMutate to rollback
    onError: (err, newItem, context) => {
      console.error("Error saving record:", err, newItem);
      if (context?.oldItems) {
        queryClient.setQueryData(queryKey, context.oldItems as T[]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
  const updateMutation = useMutation({
    mutationFn: async (updatedItem: T) =>{const result = await updateItem(updatedItem)
      if (result.errors) {
        throw new Error(result.errors[0].message)
      }
      return result
    },
    onMutate: async (editedItem) => {
      console.log(
        `updateMutation.onMutate(${JSON.stringify(editedItem, null, 2)})`,
      );
      // Cancel any outgoing refetches
      // (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey });
      // Snapshot the previous value
      const oldCategories = queryClient.getQueryData(queryKey);
      // // Optimistically update to the new value
      // if (oldCategories) {

      queryClient.setQueryData(queryKey, (old:T[]) =>
          old.map((item) => mergingPredicate(item,editedItem) ? { ...item, ...editedItem } : item),
      );
      // }
      // Return a context object with the snapshotted value
      return { oldCategories };
    },
    // If the mutation fails,
    // use the context returned from onMutate to rollback
    onError: (err, newItem, context) => {
      console.error("Error saving record:", err, newItem);
      if (context?.oldCategories) {
        queryClient.setQueryData(queryKey, context.oldCategories);
      }
    },
  });
  return { query, createMutation, deleteMutation, updateMutation };
}

export const useImages = () => {
  const { query, createMutation, deleteMutation, updateMutation } =
    useGqlCached({
      queryKey: ["images"],
      listItem: async () => await gqlSend(queries.listImages, {}),
      createItem: async (input) =>
        await gqlSend(mutations.createImage, { input }),
      updateItem: async (input) =>
        await gqlSend(mutations.updateImage, { input }),
      deleteItem: async (input) =>
        await gqlSend(mutations.deleteImage, { input }),
      onCreate: (subConfig) =>
        gqlSend(subs.onCreateImage, {}).then((x: any) => x.subscribe(subConfig)),
      onDelete: (subConfig) =>
        gqlSend(subs.onDeleteImage, {}).then((x: any) => x.subscribe(subConfig)),
      onUpdate: (subConfig) =>
        gqlSend(subs.onUpdateImage, {}).then((x: any) => x.subscribe(subConfig)),
    });
  return {
    images: query.data,
    createImage: (newImage: any) => {
      newImage.id = crypto.randomUUID();
      return createMutation.mutate(newImage);
    },
    deleteImage: deleteMutation.mutate,
    updateImage: updateMutation.mutate,
  };
};

export const useImageSets = (currentProject: any) => {
  const { query, createMutation, deleteMutation, updateMutation } =
    useGqlCached<NamedIdentifiable>({
      queryKey: ["imageSets"],
      listItem: async () => await GQL_Client.models.ImageSet.list({filter: {projectId: {eq: currentProject}}}),
      createItem: async (input) =>
        await gqlSend(mutations.createImageSet, { input }),
      updateItem: async (input) =>
        await gqlSend(mutations.updateImageSet, { input }),
      deleteItem: async ({ id }) =>
        await gqlSend(mutations.deleteImageSet, { input: { id } }),
      onCreate: (subConfig) =>
        gqlSend(subs.onCreateImageSet, {}).then((x: any) => x.subscribe(subConfig)),
      onDelete: (subConfig) =>
        gqlSend(subs.onDeleteImageSet, {}).then((x: any) => x.subscribe(subConfig)),
      onUpdate: (subConfig) =>
        gqlSend(subs.onUpdateImageSet, {}).then((x: any) => x.subscribe(subConfig)),
    });
  return {
    imageSets: query.data,
    createImageSet: (newImage: any) => {
      newImage.id = crypto.randomUUID();
      return createMutation.mutate(newImage);
    },
    deleteImageSet: deleteMutation.mutate,
    updateImageSet: updateMutation.mutate,
  };
};

export const useUsers = () => {
  let [result,setResult]=useState<any>(null)
  useEffect(()=>{
    async function f(){
          setResult(await GQL_Client.queries.listUsers({}));
    }
    f()
  },[])
  return {users : result?.data?.Users};
}

export const useCategory = (currentProject: any) => {
  const [currentCategory, setCurrentCategory] = useState<CategoryType|null>(null);
  const { query, createMutation, deleteMutation, updateMutation } =
    useGqlCached<CategoryType>({
      queryKey: ["categories", currentProject],
      listItem: async () => await GQL_Client.models.Category.list({filter: {projectId: {eq: currentProject}}}),
      createItem: async (input) => 
        await GQL_Client.models.Category.create(input)
        ,
      updateItem: async ({ id, name, color, shortcutKey }) =>
        await GQL_Client.models.Category.update({ id: id as string, name, color, shortcutKey, projectId: currentProject as string }),
      deleteItem: async ({ id }) => await GQL_Client.models.Category.delete({id: id as string}),
      onCreate: (subconfig) =>
        gqlSend(subs.onCreateCategory, {}).then((x: any) => x.subscribe(subconfig)),
      onDelete: (subconfig) =>
        gqlSend(subs.onDeleteCategory, {}).then((x: any) => x.subscribe(subconfig)),
      onUpdate: (subconfig) =>
        gqlSend(subs.onUpdateCategory, {}).then((x: any) => x.subscribe(subconfig)),
    });
  useEffect(() => {
    if (currentProject) {
      if (!currentCategory) {
        if (query.data?.[0]?.id) {
          setCurrentCategory(query.data[0].id);
        }
      }
    }
  }, [query.data, currentCategory]);
  
  return {
    categories: (currentProject ? query.data : [] ) as CategoryType[],
    createCategory: (newCategory: any) => {
      newCategory.id = crypto.randomUUID();
      newCategory.projectId = currentProject;
      return createMutation.mutate(newCategory);
    },
    deleteCategory: deleteMutation.mutate,
    updateCategory: updateMutation.mutate,
    currentCategory,
    setCurrentCategory,
  };
};


const listAnnotations = `query MyQuery($imageKey: String!, $setId: ID!, $nextToken: String) {
  annotationsByImageKey(imageKey: $imageKey, nextToken: $nextToken, filter: {annotationSetId: {eq: $setId}}) {
    items {
      id
      categoryId
      x
      y
      obscured
      owner
      objectId
      imageKey
      annotationSetId
      note
    }
    nextToken
  }
}`;
export const useAnnotations = (imageKey: string, setId: string) => {
  const { user } = useContext(UserContext) ?? {};
  const { query, createMutation, deleteMutation, updateMutation } = useGqlCached<AnnotationType>({
    queryKey: ["annotations", `${imageKey}-${setId}`],
    listItem: async () => {
      let nextToken: string | null = null;
      let allItems: AnnotationType[] = [];
      while (nextToken !== null) {
        const response = await gqlSend(listAnnotations, { nextToken, setId, imageKey }) as { data: AnnotationsResponse };
        const la: AnnotationsResponse['annotationsByImageKey'] = response.data.annotationsByImageKey;
        nextToken = la.nextToken;
        allItems = allItems.concat(la.items);
      }
      return { data: { listAnnotations: { items: allItems } } };
    },
    createItem: async (input: AnnotationType) =>
      await gqlSend(createAnnotationMinimal, { input }),
    updateItem: async (input: AnnotationType) =>
      await gqlSend(updateAnnotationMinimal, { input }),
    deleteItem: async ({ id }: { id: string }) =>
      await gqlSend(deleteAnnotationMinimal, { input: { id } }),
    onCreate: (subconfig: any) =>
      gqlSend(subs.onCreateAnnotation, {
        filter: {
          imageKey: { eq: imageKey },
          annotationSetId: { eq: setId },
        },
      }).then((x: any) => x.subscribe(subconfig)),
    onDelete: (subconfig: any) =>
      gqlSend(subs.onDeleteAnnotation, {
        filter: {
          imageKey: { eq: imageKey },
          annotationSetId: { eq: setId },
        },
      }).then((x: any) => x.subscribe(subconfig)),
    onUpdate: (subconfig: any) =>
      gqlSend(subs.onUpdateAnnotation, {
        filter: {
          imageKey: { eq: imageKey },
          annotationSetId: { eq: setId },
        },
      }).then((x: any) => x.subscribe(subconfig)),
  });
  return {
    annotations: query.data,
    createAnnotation: (annotation: Partial<AnnotationType>) => {
      const newAnnotation = {...annotation, id: crypto.randomUUID()};
      if (user) newAnnotation.owner = user.id;
      return createMutation.mutate(newAnnotation);
    },
    deleteAnnotation: deleteMutation.mutate,
    updateAnnotation: (anno: AnnotationType & { shadow?: boolean }) => {
      if (anno.shadow) {
        const newAnnotation: AnnotationType = {...anno, id: crypto.randomUUID()};
        return createMutation.mutate(newAnnotation);
      } else {
        updateMutation.mutate(anno);
      }
    },
  };
};

export const queuesByProjectId = /* GraphQL */ `
  query QueuesByProjectId(
    $projectId: String!
    $sortDirection: ModelSortDirection
    $filter: ModelQueueFilterInput
    $limit: Int
    $nextToken: String
  ) {
    queuesByProjectId(
      projectId: $projectId
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        name
        url
      }
      nextToken
    }
  }
`;

export const useQueues = (project: string) => {
  const { credentials, region } = useContext(UserContext)!;
  const { query, createMutation, deleteMutation, updateMutation } =
    useGqlCached(
      {
        queryKey: ["queues", project],
        listItem: async () =>
          await GQL_Client.models.Queue.list({filter: {projectId: {eq: project}}}),
        createItem: async ({ name, url, id }) => {
          await gqlSend(mutations.createQueue, {
            input: { name, url, id, projectId: project },
          });
        },
        updateItem: async ({ id, name, url }) =>
          await gqlSend(mutations.updateQueue, {
            input: { name, url, id, projectId: project },
          }),
        deleteItem: async ({ id }) =>
          await gqlSend(mutations.deleteQueue, { input: { id } }),
        onCreate: (subconfig) =>
          gqlSend(subs.onCreateQueue, {
            filter: { projectId: { eq: project } },
          }).then((x: any) => x.subscribe(subconfig)),
        onDelete: (subconfig) =>
          gqlSend(subs.onDeleteQueue, {
            filter: { projectId: { eq: project } },
          }).then((x: any) => x.subscribe(subconfig)),
        onUpdate: (subconfig) =>
          gqlSend(subs.onUpdateQueue, {
            filter: { projectId: { eq: project } },
          }).then((x: any) => x.subscribe(subconfig)),
      },
      mergeByUrl,
    );
  return {
    queues: query.data,
    createQueue: async (name: string) => {
      const safeName = makeSafeQueueName(name);
      const { QueueUrl: url } = await new SQSClient({
        region,
        credentials,
      }).send(
        new CreateQueueCommand({
          QueueName: safeName + ".fifo", // required
          Attributes: {
            MessageRetentionPeriod: "1209600", //This value is in seconds. 1209600 corresponds to 14 days and is the maximum AWS supports
            FifoQueue: "true",
          },
        }),
      );
      createMutation.mutate({ name, url });
      return url;
    },
    deleteQueue: deleteMutation.mutate,
    updateQueue: updateMutation.mutate,
  };
};

/*      createItem: async ({ id }) =>
        await GQL_Client.models.AnnotationSetType.create({id, projectId: project}),*/

export const useAnnotationSets = ({ projectId }: { projectId: string }) => {
  const { query, createMutation, deleteMutation, updateMutation } =
    useGqlCached<AnnotationSetType>({
      queryKey: ["annotationSets", projectId],
      listItem: async () =>
        await GQL_Client.models.AnnotationSet.list({filter: {name: {eq: projectId}}}),
      createItem: async ({ name, id }) =>
        await GQL_Client.models.AnnotationSet.create({id, name, projectId: projectId}),
      updateItem: async (input) =>
        await gqlSend(mutations.updateAnnotationSet, { input }),
      deleteItem: async (input) =>
        await gqlSend(mutations.deleteAnnotationSet, { input }),
      onCreate: (subconfig) =>
        gqlSend(subs.onCreateAnnotationSet, {
          filter: { projectName: { eq: projectId } },
        }).then((x: any) => x.subscribe(subconfig)),
      onDelete: (subconfig) =>
        gqlSend(subs.onDeleteAnnotationSet, {
          filter: { projectName: { eq: projectId } },
        }).then((x: any) => x.subscribe(subconfig)),
      onUpdate: (subconfig) =>
        gqlSend(subs.onUpdateAnnotationSet, {
          filter: { projectName: { eq: projectId } },
        }).then((x: any) => x.subscribe(subconfig)),
    });
  return {
    annotationSets: query.data,
    createAnnotationSet: (set: Partial<AnnotationSetType>) => {
      const id = crypto.randomUUID();
      createMutation.mutate({ ...set, id });
      return id;
    },
    deleteAnnotationSet: deleteMutation.mutate,
    updateAnnotationSet: updateMutation.mutate,
  };
};

export const useLocationSets = (projectId: string) => {
  const { query, createMutation, deleteMutation, updateMutation } =
    useGqlCached<typeof GQL_Client.models.LocationSet>({
      queryKey: ["locationSets", projectId],
      listItem: async () =>
        await GQL_Client.models.LocationSet.list({filter: {projectId: {eq: projectId}}}),
      createItem: GQL_Client.models.LocationSet.create,
      updateItem: GQL_Client.models.LocationSet.update,
      deleteItem: GQL_Client.models.LocationSet.delete,
      onCreate: (subconfig) =>
        gqlSend(subs.onCreateLocationSet, {
          filter: { projectName: { eq: projectId } },
        }).then((x: any) => x.subscribe(subconfig)),
      onDelete: (subconfig) =>
        gqlSend(subs.onDeleteLocationSet, {
          filter: { projectName: { eq: projectId } },
        }).then((x: any) => x.subscribe(subconfig)),
      onUpdate: (subconfig) =>
        gqlSend(subs.onUpdateLocationSet, {
          filter: { projectName: { eq: projectId } },
        }).then((x: any) => x.subscribe(subconfig)),
    });
  return {
    locationSets: query.data,
    createLocationSet: (input : Parameters<typeof createMutation.mutate>[0]) => {
      const id = crypto.randomUUID();
      createMutation.mutate({...input, id});
      return id;
    },
    deleteLocationSet: deleteMutation.mutate,
    updateLocationSet: updateMutation.mutate,
  };
};

/*It lookss like useLocations(setId)  is not currently used anywhere. This allows me to do a quick experiment to see if I can build a 
properly syncing useLocations that only tracks a particular locationSet. That in itself is not massively useful, but if the concept 
works we con do the same for annotationSets by project, ImageSets by project, Images by set etc. I can use the hooks once in the 
Project Context and make the data available to all the listeners down the hierarchy. This potentially gets me a nice clean abstraction*/

const createSub = `subscription onCreateLocation {
  onCreateLocation(locationSetLocationId: "60876a09-158a-486c-a39f-5c25737b25ef") {
    x
    y
    width
    height
    id
    imageLocationsId
  }
}`;

export const useLocations = (setId: string) => {
  const { query, createMutation, deleteMutation, updateMutation } =
    useGqlCached<LocationType>({
      queryKey: ["locations", `${setId}`],
      listItem: async () => gqlGetMany(getLocationsInSet, { id: setId }),
      createItem: async (input) =>
        gqlSend(mutations.createLocation, {
          input: { ...input, locationSetLocationsId: setId },
        }),
      updateItem: async (input) => gqlSend(mutations.updateLocation, { input }),
      deleteItem: async ({ id }) =>
        gqlSend(mutations.deleteLocation, { input: { id } }),
      onCreate: (subconfig) =>
        gqlSend(createSub, { setId }).then((x: any) => x.subscribe(subconfig)),
      onDelete: (subconfig) =>
        gqlSend(subs.onDeleteLocation, {
          filter: { locationSetLocationId: { eq: setId } },
        }).then((x: any) => x.subscribe(subconfig)),
      onUpdate: (subconfig) =>
        gqlSend(subs.onUpdateLocation, {
          filter: { locationSetLocationId: { eq: setId } },
        }).then((x: any) => x.subscribe(subconfig)),
    });
  return {
    locations: query.data,
    createLocation: (location: LocationType) => {
      const newLocation = {...location, id: crypto.randomUUID()};
      return createMutation.mutate(newLocation);
    },
    deleteLocation: deleteMutation.mutate,
    updateLocation: updateMutation.mutate,
  };
};

export const useProjects = () => {
  const { query, createMutation, deleteMutation, updateMutation } =
    useGqlCached<NamedIdentifiable>(
      {
        queryKey: ["projects"],
        listItem: async () => await GQL_Client.models.Project.list({}),
        createItem: async (input) => await GQL_Client.models.Project.create(input),
        updateItem: async (input) =>
          await gqlSend(mutations.updateProject, { input }),
        deleteItem: async (input) =>
          await gqlSend(mutations.deleteProject, { input }),
        onCreate: (subconfig) =>
          gqlSend(subs.onCreateProject, {}).then((x: any) => x.subscribe(subconfig)),
        onDelete: (subconfig) =>
          gqlSend(subs.onDeleteProject, {}).then((x: any) => x.subscribe(subconfig)),
        onUpdate: (subconfig) =>
          gqlSend(subs.onUpdateProject, {}).then((x: any) => x.subscribe(subconfig)),
      },
      (a, b) => a.name === b.name,
    );
  return {
    projects: query.data,
    createProject: async (newProject: NamedIdentifiable) => {
      newProject.id = crypto.randomUUID();
      await GQL_Client.mutations.createGroup({
        groupName: newProject.id,
      })
      await GQL_Client.mutations.createGroup({
        groupName: newProject.id+'-admin',
      })
      createMutation.mutate(newProject);
      return newProject;
    },
    deleteProject: deleteMutation.mutate,
    updateProject: updateMutation.mutate,
  };
};

export const useProjectMemberships = () => {
  const { query, createMutation, deleteMutation, updateMutation } =
    useGqlCached<UserProjectMembershipType>({
      queryKey: ["UserProjectMemberships"],
      listItem: async () =>
        await GQL_Client.models.UserProjectMembership.list({}),
      createItem: async (input) =>
        await GQL_Client.models.UserProjectMembership.create(input),
      updateItem: async (input) =>
        await gqlSend(mutations.updateUserProjectMembership, { input }),
      deleteItem: async ({ id }) =>
        await gqlSend(mutations.deleteUserProjectMembership, { input: { id } }),
      onCreate: (subconfig) =>
        gqlSend(subs.onCreateUserProjectMembership, {}).then((x: any) =>
          x.subscribe(subconfig),
        ),
      onDelete: (subconfig) =>
        gqlSend(subs.onDeleteUserProjectMembership, {}).then((x: any) =>
          x.subscribe(subconfig),
        ),
      onUpdate: (subconfig) =>
        gqlSend(subs.onUpdateUserProjectMembership, {}).then((x: any) =>
          x.subscribe(subconfig),
        ),
    });
  return {
    projectMemberships: query.data,
    createProjectMembership: (userProjectMembership: UserProjectMembershipType) => {
      const newUserProjectMembership: UserProjectMembershipType = {...userProjectMembership, id: crypto.randomUUID()};
      GQL_Client.mutations.addUserToGroup({
        userId: newUserProjectMembership.userId,
        groupName: newUserProjectMembership.projectId,
      });
      createMutation.mutate(newUserProjectMembership);
      return newUserProjectMembership.id;
    },
    deleteProjectMembership: (pm: UserProjectMembershipType) => {
      GQL_Client.mutations.removeUserFromGroup({
        userId: pm.userId,
        groupName: pm.projectId,
      });
      deleteMutation.mutate(pm);
    },
    updateProjectMembership: updateMutation.mutate,
  };
};

// export const useUser=(username) => {
//   const {query,createMutation,deleteMutation,updateMutation}=useGqlCached({
//     queryKey:["users",username],
//     listItem  : async () =>
//                 await gqlSend(queries.getUser,{id:username})),
//     createItem: async (input)  =>
//                 await gqlSend(mutations.createUser,{...input,id:username})),
//     updateItem: async (input) =>
//                 await gqlSend(mutations.updateUser,{...input,id:username})),
//     deleteItem: async () =>
//                 await gqlSend(mutations.deleteUser,{input:{id:username}})),
//     onCreate  :  (subConfig) => gqlSend(subs.onCreateUser,{filter:{id:{eq:username}}})).then(x=>x.subscribe(subConfig)),
//     onDelete  :  (subConfig) => gqlSend(subs.onDeleteUser,{filter:{id:{eq:username}}})).then(x=>x.subscribe(subConfig)),
//     onUpdate  :  (subConfig) => gqlSend(subs.onUpdateUser,{filter:{id:{eq:username}}})).then(x=>x.subscribe(subConfig))})
//   return {users:query.data,
//           createUser : (newUser)=>{
//                         newUser.id=crypto.randomUUID();
//                         return createMutation.mutate(newUser)},
//           deleteUser: deleteMutation.mutate,
//           updateUser: updateMutation.mutate}
// }
