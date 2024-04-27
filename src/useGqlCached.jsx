import { useContext, useEffect } from 'react';
import { useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
// import { onCreateAnnotation, onCreateCategory, onCreateImage, onCreateUser, onCreateQueue,
//   onDeleteAnnotation, onDeleteCategory, onDeleteImage, onDeleteUser,onDeleteQueue, 
//   onUpdateAnnotation, onUpdateCategory, onUpdateImage, onUpdateUser, onUpdateQueue } from './graphql/subscriptions';
// import { createAnnotation, createCategory, createImage, createUser,createQueue,
//   deleteAnnotation, deleteCategory, deleteImage, deleteUser,deleteQueue,
//   updateAnnotation, updateCategory, updateImage,updateUser,updateQueue } from './graphql/mutations';
// import { listAnnotations, listCategories, listImages,listQueues } from './graphql/queries';
import * as queries from './graphql/queries'
import * as subs from './graphql/subscriptions'
import * as mutations from './graphql/mutations'
import { getLocationsInSet } from './gqlQueries';
import { UserContext } from './UserContext';
import { createAnnotationMinimal,updateAnnotationMinimal,deleteAnnotationMinimal } from './gqlQueries';
import { SQSClient,CreateQueueCommand } from '@aws-sdk/client-sqs';
import { makeSafeQueueName,gqlSend,gqlGetMany } from './utils';



/* This utility function is from https://stackoverflow.com/questions/1584370/how-to-merge-two-arrays-in-javascript-and-de-duplicate-items
It is used to merge two arrays of objects, and removing duplicates, for some definition of duplicate. a and b are the 
arrays in question and predicate is a function defining when two objects are considered duplicates. In our case we consider two 
o bjects to be duplicates if their id properties match, so that is the default value of predicate. This allow us to merge 
arrays as follows 
merge([{id: 1}, {id: 2, name:'John'}], [{id: 2, name:'Jack'}, {id: 3}]);
=
[{id: 1}, {id: 2, name:'John'}, {id: 3}]
Note that in the case of duplicates between a and b, a's version will be preferred*/

const merge = (a, b, predicate = (a, b) => a.id === b.id) => {
  const c = [...a]; // copy to avoid side effects
  // add all items from B to copy C if they're not already present
  b.forEach((bItem) => (c.some((cItem) => predicate(bItem, cItem)) ? null : c.push(bItem)))
  return c;
}

const subscriptions={}
const mergeById=(a, b) => a.id === b.id
const mergeByUrl=(a, b) => a.url === b.url
export default function useGqlCached({queryKey,listItem,createItem,updateItem,deleteItem,onCreate,onDelete,onUpdate},mergingPredicate=mergeById)
{
  const stringKey=JSON.stringify(queryKey)
  const queryClient=useQueryClient()

  useEffect(()=>{
    const entry=subscriptions?.[stringKey]
    if (entry?.listeners){
      entry.listeners+=1
      console.log(`Adding subscriber for ${stringKey}`)
    }
    else{
      console.log(`creating 3 subscriptions for ${stringKey}`)
      subscriptions[stringKey]={listeners:1,
      subs:[ 
            onCreate({
                    next: ({data}) => {
                        const newItem=Object.values(data)[0]
                        console.log(`onCreate callback (${JSON.stringify(queryKey)}`)
                        queryClient.setQueryData(queryKey, (old) => merge([newItem],old,mergingPredicate));
                      },
                      error: (error) => console.warn(error)
                      }),
            onUpdate({
                  next: ({data}) => {
                    const updatedItem=Object.values(data)[0]
                    console.log(`onUpdate callback (${JSON.stringify(queryKey)}`)
                    queryClient.setQueryData(queryKey, (old) => merge([updatedItem],old))
                },
                error: (error) => console.warn(error)
                }),
            onDelete({
                  next: ({data}) => {
                    const deletedItem=Object.values(data)[0]
                    console.log(`onDelete callback (${JSON.stringify(queryKey)}`)
                    queryClient.setQueryData(queryKey, (items)=>items.filter(item=>item.id!==deletedItem.id))
                  },
              error: (error) => console.warn(error)
            })]}
    }
    return ()=>{
      const entry=subscriptions[stringKey]
      entry.listeners-=1
      console.log(`unsubscribing from ${stringKey}`)
      if (entry.listeners===0){
        console.log(`canceling 3 subscriptions for ${stringKey}`)
        entry.subs.map(sub=>sub.then((x)=>x.unsubscribe()))
      }
    }
  },[stringKey])


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

  console.log(queryKey)

  const query = useQuery({
                        queryKey,
                        queryFn:async ()=>{
                          const {data}=await listItem()
                          return Object.values(data)[0].items
                        },staleTime:Infinity
                      })
  const createMutation = useMutation({
    mutationFn: createItem,
    onMutate: async(newItem)=>{     
      // Cancel any outgoing refetches
      // (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey});
      // Snapshot the previous value
      const oldCategories = queryClient.getQueryData(queryKey);
      // Optimistically update to the new value
      if (oldCategories) {
        console.log(`create optimistic update (${JSON.stringify(queryKey)}`)
          queryClient.setQueryData(queryKey, (old) => [
          ...old,
          {...newItem,createdAt:new Date().toISOString()},
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
        console.log(`create optimistic rollback (${JSON.stringify(queryKey)}`)
        queryClient.setQueryData(
          queryKey,
          context.oldCategories
        );
      }
    }
  });                
  const deleteMutation = useMutation({
    mutationFn: deleteItem,
    onMutate: async({id})=>{     
      // Cancel any outgoing refetches
      // (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey});
      // Snapshot the previous value
      const oldCategories = queryClient.getQueryData(queryKey);
      // Optimistically update to the new value
      if (oldCategories) {
        queryClient.setQueryData(queryKey, old => old.filter(item => item.id!==id));
      }
      // Return a context object with the snapshotted value
      return { oldCategories };
    },
    // If the mutation fails,
    // use the context returned from onMutate to rollback
    onError: (err, newItem, context) => {
      console.error("Error saving record:", err, newItem);
      if (context?.oldCategories) {
        queryClient.setQueryData(
          queryKey,
          context.oldCategories
        );
      }
    }});
  const updateMutation = useMutation({
    mutationFn: updateItem,
    onMutate: async(editedItem)=>{   
      console.log(`updateMutation.onMutate(${JSON.stringify(editedItem,null,2)})`)  
      // Cancel any outgoing refetches
      // (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey});
      // Snapshot the previous value
      const oldCategories = queryClient.getQueryData(queryKey);
      // // Optimistically update to the new value
      // if (oldCategories) {

      queryClient.setQueryData(queryKey, (old)=> old.map(item => item.id===editedItem.id?{...item,...editedItem}:item));
      // }
      // Return a context object with the snapshotted value
      return { oldCategories };
    },
    // If the mutation fails,
    // use the context returned from onMutate to rollback
    onError: (err, newItem, context) => {
      console.error("Error saving record:", err, newItem);
      if (context?.oldCategories) {
        queryClient.setQueryData(
          queryKey,
          context.oldCategories
        );
      }
    }
  })
  return {query,createMutation,deleteMutation,updateMutation}
}

export const useImages=() => {
  const {query,createMutation,deleteMutation,updateMutation}=useGqlCached({
    queryKey:["images"],
    listItem  : async () =>
                await gqlSend(queries.listImages),
    createItem: async (input)  => 
                await gqlSend(mutations.createImage,{input}),
    updateItem: async (input) =>
                await gqlSend(mutations.updateImage,{input}),
    deleteItem: async ({id}) =>
                await gqlSend(mutations.deleteImage,{input:{id}}),
    onCreate  :  (subConfig) => gqlSend(subs.onCreateImage).then(x=>x.subscribe(subConfig)),
    onDelete  :  (subConfig) => gqlSend(subs.onDeleteImage).then(x=>x.subscribe(subConfig)),
    onUpdate  :  (subConfig) => gqlSend(subs.onUpdateImage).then(x=>x.subscribe(subConfig))})
  return {images:query.data,
          createImage : (newImage)=>{
                        newImage.id=crypto.randomUUID();
                        return createMutation.mutate(newImage)},
          deleteImage: deleteMutation.mutate,
          updateImage: updateMutation.mutate} 
}

export const useImageSets=(currentProject) => {
  const filter={filter:{projectName:{eq:currentProject}}}
  const {query,createMutation,deleteMutation,updateMutation}=useGqlCached({
    queryKey:["imageSets"],
    listItem  : async () =>
                await gqlSend(queries.listImageSets,filter),
    createItem: async (input)  => 
                await gqlSend(mutations.createImageSet,{input}),
    updateItem: async (input) =>
                await gqlSend(mutations.updateImageSet,{input}),
    deleteItem: async ({id}) =>
                await gqlSend(mutations.deleteImageSet,{input:{id}}),
    onCreate  :  (subConfig) => gqlSend(subs.onCreateImageSet).then(x=>x.subscribe(subConfig)),
    onDelete  :  (subConfig) => gqlSend(subs.onDeleteImageSet).then(x=>x.subscribe(subConfig)),
    onUpdate  :  (subConfig) => gqlSend(subs.onUpdateImageSet).then(x=>x.subscribe(subConfig))})
  return {imageSets:query.data,
          createImageSet : (newImage)=>{
                        newImage.id=crypto.randomUUID();
                        return createMutation.mutate(newImage)},
          deleteImageSet: deleteMutation.mutate,
          updateImageSet: updateMutation.mutate} 
}


export const useUsers=() => {
  const {query,createMutation,deleteMutation,updateMutation}=useGqlCached({
    queryKey:["users"],
    listItem  : async () =>
                await gqlSend(queries.listUsers,{}),
    createItem: async (input)  => 
                await gqlSend(mutations.createUser,{input}),
    updateItem: async (input) =>
                await gqlSend(mutations.updateUser,{input}),
    deleteItem: async ({id}) =>
                await gqlSend(mutations.deleteUser,{input:{id}}),
    onCreate  :  (subConfig) => gqlSend(subs.onCreateUser).then(x=>x.subscribe(subConfig)),
    onDelete  :  (subConfig) => gqlSend(subs.onDeleteUser).then(x=>x.subscribe(subConfig)),
    onUpdate  :  (subConfig) => gqlSend(subs.onUpdateUser).then(x=>x.subscribe(subConfig))})
  return {users:query.data,
          createUser : (newUser)=>{
                        newUser.id=crypto.randomUUID();
                        return createMutation.mutate(newUser)},
          deleteUser: deleteMutation.mutate,
          updateUser: updateMutation.mutate} 
}


export const useCategory=(currentProject) => { 
  const filter={filter:{projectName:{eq:currentProject}}}
  const {query,createMutation,deleteMutation,updateMutation}=useGqlCached({
    queryKey:["categories",currentProject],
    listItem  : async () => await gqlSend(queries.listCategories,filter),
    createItem: async (input)  => 
                await gqlSend(mutations.createCategory,{input:{...input,projectName:currentProject}}),
    updateItem: async ({id,name,color,shortcutKey}) =>
                await gqlSend(mutations.updateCategory,{input:{id,name,color,shortcutKey,projectName:currentProject}}),
    deleteItem: async ({id}) =>
                await gqlSend(mutations.deleteCategory,{input:{id}}),
    onCreate  :  (subconfig)           => gqlSend(subs.onCreateCategory).then(x=>x. subscribe(subconfig)),
    onDelete  :  (subconfig)           => gqlSend(subs.onDeleteCategory).then(x=>x.subscribe(subconfig)),
    onUpdate  :  (subconfig)           => gqlSend(subs.onUpdateCategory).then(x=>x.subscribe(subconfig))})
  return {categories:query.data,
          createCategory : (newCategory)=>{
                  newCategory.id=crypto.randomUUID();
                  newCategory.projectName=currentProject
                  return createMutation.mutate(newCategory)},
          deleteCategory: deleteMutation.mutate,
          updateCategory: updateMutation.mutate} 
}


const listAnnotations=`query MyQuery($imageKey: String!, $setId: ID!, $nextToken: String) {
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
}`
export const useAnnotations=(imageKey,setId) => {
  const {user}=useContext(UserContext)
  const {query,createMutation,deleteMutation,updateMutation}=useGqlCached({
    queryKey:["annotations",{imageKey,setId}],
    listItem  : async ()            =>{
                    let nextToken=true
                    let allItems=[]
                    while (nextToken){
                      if (nextToken===true) {nextToken=undefined}
                      const {data:{annotationsByImageKey:la}}=await gqlSend(listAnnotations,{nextToken,setId,imageKey})//filter:{imageId:{eq:imageId},setId:{eq:setId}}
                      nextToken=la.nextToken
                      allItems=allItems.concat(la.items)
                    }
                    return {data:{listAnnotations:{items:allItems}}}}
                    ,
    createItem: async ({id,x,y,categoryId,objectId,obscured,imageKey,annotationSetId})     =>await gqlSend(createAnnotationMinimal,{input:{id,x,y,categoryId,objectId,obscured,imageKey,annotationSetId}}),
    updateItem: async ({id,x,y,categoryId,objectId,obscured,imageKey,annotationSetId}) =>
                await gqlSend(updateAnnotationMinimal,{input:{id,x,y,categoryId,objectId,obscured,imageKey,annotationSetId}}),
    deleteItem: async ({id}) =>await gqlSend(deleteAnnotationMinimal,{input:{id}}),
    onCreate  :  (subconfig)           => gqlSend(subs.onCreateAnnotation,{filter:{imageKey:{eq:imageKey},annotationSetId:{eq:setId}}}).then(x=>x.subscribe(subconfig)),
    onDelete  :  (subconfig)           => gqlSend(subs.onDeleteAnnotation,{filter:{imageKey:{eq:imageKey},annotationSetId:{eq:setId}}}).then(x=>x.subscribe(subconfig)),
    onUpdate  :  (subconfig)           => gqlSend(subs.onUpdateAnnotation,{filter:{imageKey:{eq:imageKey},annotationSetId:{eq:setId}}}).then(x=>x.subscribe(subconfig))})
  return {annotations:query.data,
          createAnnotation : (newAnnotation)=>{
                  newAnnotation.id=crypto.randomUUID();
                  newAnnotation.owner=user.id;
                  return createMutation.mutate(newAnnotation)},
          deleteAnnotation: deleteMutation.mutate,
          updateAnnotation: (anno=>{
            if (anno.shadow){
              anno.id=crypto.randomUUID();
              anno.owner=user.id;
              anno.shadow=false
              return createMutation.mutate(anno)
            }else{
              updateMutation.mutate(anno)
            }
          })} 
}


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

export const useQueues=(project) => { 
  const {credentials,region}=useContext(UserContext)
  const {query,createMutation,deleteMutation,updateMutation}=useGqlCached({
    queryKey:["queues",project],
    listItem  : async ()            =>await gqlSend(queuesByProjectId,{projectId:project}),
    createItem: async ({name,url,id})  => {
                await gqlSend(mutations.createQueue,{input:{name,url,id,projectId:project}})},
    updateItem: async ({id,name,url}) =>
                await gqlSend(mutations.updateQueue,{input:{name,url,id,projectId:projectName}}),
    deleteItem: async ({id}) =>
                await gqlSend(mutations.deleteQueue,{input:{id}}),
    onCreate  :  (subconfig)           => gqlSend(subs.onCreateQueue,{filter:{projectId:{eq:project}}}).then(x=>x.subscribe(subconfig)),
    onDelete  :  (subconfig)           => gqlSend(subs.onDeleteQueue,{filter:{projectId:{eq:project}}}).then(x=>x.subscribe(subconfig)),
    onUpdate  :  (subconfig)           => gqlSend(subs.onUpdateQueue,{filter:{projectId:{eq:project}}}).then(x=>x.subscribe(subconfig))},mergeByUrl)
  return {queues:query.data,
          createQueue : async (name)=>{
            const safeName=makeSafeQueueName(name)
            const {QueueUrl:url} = await new SQSClient({region, credentials}).send(new CreateQueueCommand({ 
                                      QueueName: safeName+".fifo", // required
                                      Attributes:{
                                      MessageRetentionPeriod:'1209600',//This value is in seconds. 1209600 corresponds to 14 days and is the maximum AWS supports
                                      FifoQueue : "true"
                                      }
                                    }))
            createMutation.mutate({name,url})
            return url  
                    },
          deleteQueue: deleteMutation.mutate,
          updateQueue: updateMutation.mutate} 
}

export const useAnnotationSets=(project) => { 
  const {query,createMutation,deleteMutation,updateMutation}=useGqlCached({
    queryKey:["annotationSets",project],
    listItem  : async ()            =>await gqlSend(queries.annotationSetsByProjectName,{projectName:project}),
    createItem: async ({name,id})  => 
                await gqlSend(mutations.createAnnotationSet,{input:{id,name,projectName:project}}),
    updateItem: async ({name,id,projectName}) =>
                await gqlSend(mutations.updateAnnotationSet,{input:{id,name,projectName}}),
    deleteItem: async ({id}) =>
                await gqlSend(mutations.deleteAnnotationSet,{input:{id}}),
    onCreate  :  (subconfig)           => gqlSend(subs.onCreateAnnotationSet,{filter:{projectName:{eq:project}}}).then(x=>x.subscribe(subconfig)),
    onDelete  :  (subconfig)           => gqlSend(subs.onDeleteAnnotationSet,{filter:{projectName:{eq:project}}}).then(x=>x.subscribe(subconfig)),
    onUpdate  :  (subconfig)           => gqlSend(subs.onUpdateAnnotationSet,{filter:{projectName:{eq:project}}}).then(x=>x.subscribe(subconfig))})
  return {annotationSets:query.data,
          createAnnotationSet : (name)=>{
                  const id =crypto.randomUUID()
                  createMutation.mutate({name,id})
                  return id
                },
          deleteAnnotationSet: deleteMutation.mutate,
          updateAnnotationSet: updateMutation.mutate} 
}

export const useLocationSets=(projectName) => { 
  const {query,createMutation,deleteMutation,updateMutation}=useGqlCached({
    queryKey:["locationSets",projectName],
    listItem  : async ()            =>await gqlSend(queries.locationSetsByProjectName,{projectName}),
    createItem: async ({id, name})  => 
                await gqlSend(mutations.createLocationSet,{input:{name,id,projectName}}),
    updateItem: async ({id,name,projectName}) =>
                await gqlSend(mutations.updateLocationSet,{input:{name,id,projectName}}),
    deleteItem: async ({id}) =>
                await gqlSend(mutations.deleteLocationSet,{input:{id}}),
    onCreate  :  (subconfig)           => gqlSend(subs.onCreateLocationSet,{filter:{projectName:{eq:projectName}}}).then(x=>x.subscribe(subconfig)),
    onDelete  :  (subconfig)           => gqlSend(subs.onDeleteLocationSet,{filter:{projectName:{eq:projectName}}}).then(x=>x.subscribe(subconfig)),
    onUpdate  :  (subconfig)           => gqlSend(subs.onUpdateLocationSet,{filter:{projectName:{eq:projectName}}}).then(x=>x.subscribe(subconfig))})
  return {locationSets:query.data,
          createLocationSet : (newLocationSet)=>{
                  newLocationSet.id=crypto.randomUUID();
                  createMutation.mutate(newLocationSet)
                  return newLocationSet.id},
          deleteLocationSet: deleteMutation.mutate,
          updateLocationSet: updateMutation.mutate} 
}

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
}`

export const useLocations=(setId) => {
  const {query,createMutation,deleteMutation,updateMutation}=useGqlCached({
    queryKey:["locations",{setId}],
    listItem  : async ()     => gqlGetMany(getLocationsInSet,{id:setId}),
    createItem: async (input)=> gqlSend(createLocation,{input:{...input,locationSetLocationsId:setId}}),
    updateItem: async (input)=> gqlSend(mutations.updateLocation,{input}),
    deleteItem: async ({id}) => gqlSend(mutations.deleteLocation,{input:{id}}),
    onCreate  :  (subconfig)        => gqlSend(createSub,{setId}).then(x=>x.subscribe(subconfig)),
    onDelete  :  (subconfig)        => gqlSend(subs.onDeleteLocation,{filter:{locationSetLocationId:{eq:setId}}}).then(x=>x.subscribe(subconfig)),
    onUpdate  :  (subconfig)        => gqlSend(subs.onUpdateLocation,{filter:{locationSetLocationId:{eq:setId}}}).then(x=>x.subscribe(subconfig))})
  return {locations :query.data,
          createLocation : (newLocation)=>{
                  newLocation.id=crypto.randomUUID();
                  return createMutation.mutate(newLocation)},
          deleteLocation: deleteMutation.mutate,
          updateLocation: updateMutation.mutate} 
}
  

export const useProjects=() => { 
  const {query,createMutation,deleteMutation,updateMutation}=useGqlCached({
    queryKey:["projects"],
    listItem  : async ()            =>await gqlSend(queries.listProjects,{}),
    createItem: async (input)  => 
                await gqlSend(mutations.createProject,{input}),
    updateItem: async (input) =>
                await gqlSend(mutations.updateProject,{input}),
    deleteItem: async (input) =>
                await gqlSend(mutations.deleteProject,{input}),
    onCreate  :  (subconfig)           => gqlSend(subs.onCreateProject).then(x=>x.subscribe(subconfig)),
    onDelete  :  (subconfig)           => gqlSend(subs.onDeleteProject).then(x=>x.subscribe(subconfig)),
    onUpdate  :  (subconfig)           => gqlSend(subs.onUpdateProject).then(x=>x.subscribe(subconfig))},
    (a, b) => a.name === b.name)
  return {projects:query.data,
          createProject : (newProject)=>{
                  return createMutation.mutate(newProject)},
          deleteProject: deleteMutation.mutate,
          updateProject: updateMutation.mutate} 
}

export const useProjectMemberships=() => { 
  const {query,createMutation,deleteMutation,updateMutation}=useGqlCached({
    queryKey:["UserProjectMemberships"],
    listItem  : async ()=>await gqlSend(queries.listUserProjectMemberships,{}),
    createItem: async (input)  => 
                await gqlSend(mutations.createUserProjectMembership,{input}),
    updateItem: async (input) =>
                await gqlSend(mutations.updateUserProjectMembership,{input}),
    deleteItem: async ({id}) =>
                await gqlSend(mutations.deleteUserProjectMembership,{input:{id}}),
    onCreate  :  (subconfig)           => gqlSend(subs.onCreateUserProjectMembership).then(x=>x.subscribe(subconfig)),
    onDelete  :  (subconfig)           => gqlSend(subs.onDeleteUserProjectMembership).then(x=>x.subscribe(subconfig)),
    onUpdate  :  (subconfig)           => gqlSend(subs.onUpdateUserProjectMembership).then(x=>x.subscribe(subconfig))})
  return {projectMemberships:query.data,
          createProjectMembership : (newUserProjectMembership)=>{
                  newUserProjectMembership.id=crypto.randomUUID();
                  createMutation.mutate(newUserProjectMembership)
                  return newUserProjectMembership.id},
          deleteProjectMembership: deleteMutation.mutate,
          updateProjectMembership: updateMutation.mutate} 
}

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
  