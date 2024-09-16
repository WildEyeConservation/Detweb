import { useOptimisticUpdates } from './useOptimisticUpdates';
import {useState, useEffect} from 'react';
import { Schema } from '../amplify/data/resource'; // Path to your backend resource definition
import { useContext } from 'react';
import { GlobalContext, UserContext } from './Context';
import { CreateQueueCommand, DeleteQueueCommand } from '@aws-sdk/client-sqs';
import { makeSafeQueueName } from './utils';
import { ProjectContext } from './Context';

export const useProjects = () => useOptimisticUpdates('Project');
// export type ProjectUpdateType = Parameters<typeof client.models.Project.update>[0];
// export type ProjectCreateType = Parameters<typeof client.models.Project.create>[0];
// export type ProjectType = ReturnType<typeof client.models.Project.get>;



export const useProjectMemberships = () => useOptimisticUpdates('UserProjectMembership');
// export type ProjectMembershipUpdateType = Parameters<
//   typeof client.models.UserProjectMembership.update
// >[0];
// export type ProjectMembershipCreateType = Parameters<
//   typeof client.models.UserProjectMembership.create
// >[0];
export type ProjectMembershipType = Schema['UserProjectMembership']['type'];

export const useImageFiles = () => useOptimisticUpdates('ImageFile');
// export type ImageFileUpdateType = Parameters<typeof client.models.ImageFile.update>[0];
// export type ImageFileCreateType = Parameters<typeof client.models.ImageFile.create>[0];
// export type ImageFileType = Schema['ImageFile']['type'];

export const useImages = () => useOptimisticUpdates('Image');
// export type ImageUpdateType = Parameters<typeof client.models.Image.update>[0];
// export type ImageCreateType = Parameters<typeof client.models.Image.create>[0];
//export type ImageType = ReturnType<typeof client.models.Image.get>;

export const useImageSets = () => useOptimisticUpdates('ImageSet');
// export type ImageSetUpdateType = Parameters<typeof client.models.ImageSetMembership.update>[0];
// export type ImageSetCreateType = Parameters<typeof client.models.ImageSetMembership.create>[0];
// export type ImageSetType = ReturnType<typeof client.models.ImageSetMembership.get>;

export const useImageSetmemberships = () => useOptimisticUpdates('ImageSetMembership');
// export type ImageSetMembershipUpdateType = Parameters<
//   typeof client.models.ImageSetMembership.update
// >[0];
// export type ImageSetMembershipCreateType = Parameters<
//   typeof client.models.ImageSetMembership.create
// >[0];
// export type ImageSetMembershipType = ReturnType<typeof client.models.ImageSetMembership.get>;

export const useLocationSets = () => useOptimisticUpdates('LocationSet');
// export type LocationSetUpdateType = Parameters<typeof client.models.LocationSet.update>[0];
// export type LocationSetCreateType = Parameters<typeof client.models.LocationSet.create>[0];
// export type LocationSetType = ReturnType<typeof client.models.LocationSet.get>;

export const useLocations = () => useOptimisticUpdates('Location');
// export type LocationUpdateType = Parameters<typeof client.models.Location.update>[0];
// export type LocationCreateType = Parameters<typeof client.models.Location.create>[0];
// export type LocationType = ReturnType<typeof client.models.Location.get>;

export const useObjects = () => useOptimisticUpdates('Object');
// export type ObjectUpdateType = Parameters<typeof client.models.Object.update>[0];
// export type ObjectCreateType = Parameters<typeof client.models.Object.create>[0];
// export type ObjectType = ReturnType<typeof client.models.Object.get>;

export const useAnnotationSets = () => useOptimisticUpdates('AnnotationSet');
// export type AnnotationSetUpdateType = Parameters<typeof client.models.AnnotationSet.update>[0];
// export type AnnotationSetCreateType = Parameters<typeof client.models.AnnotationSet.create>[0];
// export type AnnotationSetType = ReturnType<typeof client.models.AnnotationSet.get>;

export const useAnnotations = () => useOptimisticUpdates('Annotation');
// export type AnnotationUpdateType = Parameters<typeof client.models.Annotation.update>[0];
// export type AnnotationCreateType = Parameters<typeof client.models.Annotation.create>[0];
// export type AnnotationType = ReturnType<typeof client.models.Annotation.get>;

export const useCategories = () => useOptimisticUpdates('Category');
// export type CategoryUpdateType = Parameters<typeof client.models.Category.update>[0];
// export type CategoryCreateType = Parameters<typeof client.models.Category.create>[0];
// export type CategoryType = ReturnType<typeof client.models.Category.get>;


export const useQueues = (projectId: string) => {
  const { client } = useContext(GlobalContext)!;
  const { sqsClient } = useContext(UserContext)!;
  const { project }   = useContext(ProjectContext)!;
  const originalHook = useOptimisticUpdates('Queue',
    () => client.models.Queue.list({filter: {projectId: {eq: projectId}}}), 
  {filter: {projectId: {eq: projectId}}});
  const create = async (name: string) => {
    const safeName = makeSafeQueueName(name);
    const { QueueUrl: url } = await sqsClient.send(
      new CreateQueueCommand({
        QueueName: safeName,
        Attributes: {
          MessageRetentionPeriod: '1209600', //This value is in seconds. 1209600 corresponds to 14 days and is the maximum AWS supports
          //FifoQueue: "false",
        },
      })  
    );
    if (url) {
      return originalHook.create({ name, url, projectId: project.id });
    }
    return null;
  };

  const remove = async (queue: Schema['Queue']['type']) => {
    console.log(JSON.stringify(await sqsClient.send(new DeleteQueueCommand({ QueueUrl: queue.url })))); 
    return originalHook.delete(queue);
  };

  return { ...originalHook, create, delete:remove };
}
// export type QueueUpdateType = Parameters<typeof client.models.Queue.update>[0];
// export type QueueCreateType = Parameters<typeof client.models.Queue.create>[0];
// export type QueueType = ReturnType<typeof client.models.Queue.get>;

// export const useProjectMembershipsByUser = ({ userId }: { userId?: string }) => {
//   const { currentPM } = useContext(UserContext);
//   userId ||= currentPM?.userId;
//   return useOptimisticUpdates(
//     'UserProjectMembership',
//     () => client.models.UserProjectMembership.userProjectMembershipsByUser({ userId }),
//     { filter: { userId: { eq: userId } } }
//   );
// };

// export const useCategoryByProject = (projectId?: string) => {
//   const { currentPM } = useContext(UserContext);
//   projectId ||= currentPM?.projectId;
//   return useOptimisticUpdates(
//     'Category',
//     () => client.models.Category.categoriesByProject({ projectId }),
//     { filter: { projectId: { eq: projectId } } }
//   );
// };

// //export const useCategoryByProject = useOptimisticUpdatesByProject('Category');

// export const useImageSetsByProject = (projectId: string) => {
//   const { currentPM } = useContext(UserContext);
//   projectId ||= currentPM?.projectId;
//   useOptimisticUpdates('ImageSet', () => client.models.ImageSet.imageSetsByProject({ projectId }), {
//     filter: { projectId: { eq: projectId } },
//   });
// };

export const useUsers = () => {
  const {client} = useContext(GlobalContext)!;
  let [result, setResult] = useState<Schema['UserType']['type'][]>([]);
  useEffect(() => {
    client.queries.listUsers({}).then(({ data }) => {
      if (data?.Users) setResult(data.Users || []);
    });
  }, []);
  return { users: result };
};

// export const useAnnotationsByImageAndSet = ({
//   metaId,
//   annotationSetId,
// }: {
//   metaId: string;
//   annotationSetId: string;
// }) =>
//   useOptimisticUpdates(
//     'Annotation',
//     () => client.models.Annotation.annotationsByImageAndSet({ metaId, setId: annotationSetId }),
//     {
//       filter: {
//         and: [{ setId: { eq: annotationSetId } }, { metaId: { eq: metaId } }],
//       },
//     }
//   );

// export const useQueuesByProjectId = (projectId: string) => {
//   const { currentPM } = useContext(UserContext);
//   projectId ||= currentPM?.projectId;
//   return useOptimisticUpdates('Queue', () => client.models.Queue.queuesByProjectId({ projectId }), {
//     filter: { projectId: { eq: projectId } },
//   });
// };

// export const useAnnotationSetsByProjectId = (projectId: string) => {
//   const { currentPM } = useContext(UserContext);
//   projectId ||= currentPM?.projectId;
//   return useOptimisticUpdates(
//     'AnnotationSet',
//     () => client.models.AnnotationSet.annotationSetsByProjectId({ projectId }),
//     { filter: { projectId: { eq: projectId } } }
//   );
// };

// export const useLocationSetsByProjectId = ({ projectId }: { projectId: string }) =>
//   useOptimisticUpdates(
//     'LocationSet',
//     () => client.models.LocationSet.locationSetsByProjectId({ projectId }),
//     { filter: { projectId: { eq: projectId } } }
//   );

// export const useLocationsBySetId = ({ setId }: { setId: string }) =>
//   useOptimisticUpdates('Location', () => client.models.Location.locationsBySet({ setId }), {
//     filter: { setId: { eq: setId } },
//   });

// export const useQueuesForProject = ({ projectId }: { projectId: string }) => {
//   const { credentials, region } = useContext(UserContext);
//   const hook = useOptimisticUpdates(
//     'Queue',
//     () => client.models.Queue.queuesByProjectId({ projectId }),
//     { filter: { projectId: { eq: projectId } } }
//   );
//   const create = async (name: string) => {
//     const safeName = makeSafeQueueName(name);
//     const { QueueUrl: url } = await new SQSClient({
//       region,
//       credentials,
//     }).send(
//       new CreateQueueCommand({
//         QueueName: safeName,
//         Attributes: {
//           MessageRetentionPeriod: '1209600', //This value is in seconds. 1209600 corresponds to 14 days and is the maximum AWS supports
//           //FifoQueue: "false",
//         },
//       })
//     );
//     return hook.create({ name, url });
//   };
//   return { ...hook, create };
// };

export function useDataModel<T>(fetcher: () => Promise<{ data: T[] }> = () => Promise.resolve({data: []})){
  const [data, setData] = useState<T[] | undefined>(undefined);
  useEffect(() => {
    fetcher().then(({data}) => setData(data));
  }, [fetcher]);
  return data;
}