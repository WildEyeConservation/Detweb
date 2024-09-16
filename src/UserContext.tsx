import {useState, useEffect, useCallback, useContext } from "react";
import { useObserveQuery } from './useObserveQuery.tsx'
import {
  SQSClient,
} from "@aws-sdk/client-sqs";
import { LambdaClient} from "@aws-sdk/client-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import { AuthUser, fetchAuthSession } from "aws-amplify/auth";
import { Schema } from '../amplify/data/resource'; // Path to your backend resource definition
import {useUsers} from './apiInterface.tsx'
import {
  GlobalContext, ProjectContext, UserContext, ManagementContext
} from "./Context.tsx";
import { generateClient } from "aws-amplify/api";
import outputs from "../amplify_outputs.json";
import {
  useOptimisticMembership,
  useOptimisticCategory,
  useOptimisticImageSet,
  useOptimisticLocationSet,
  useOptimisticAnnotationSet,
  useQueues
} from "./useOptimisticUpdates.tsx";




export function Project({ children }: { children: React.ReactNode }) {
  const { client } = useContext(GlobalContext)!;
  const [currentProject, setCurrentProject] = useState<Schema['Project']['type'] | undefined>(undefined)
  const { currentPM } = useContext(UserContext)!
  
  const categoriesHook = useOptimisticCategory(
    async () => client.models.Category.list({ filter: { projectId: { eq: currentProject?.id } } }),
    { filter: { projectId: { eq: currentProject?.id } } })

  useEffect(() => {
    if (currentPM) {
      client.models.Project.get({ id: currentPM.projectId }).then(p => setCurrentProject(p.data || undefined));
    } else {
      setCurrentProject(undefined);
    }
  },[currentPM])
  return (
    currentProject && 
    <ProjectContext.Provider value={{
        project: currentProject,
        categoriesHook
    }}>
      {currentProject && children}
    </ProjectContext.Provider>
  )
}


export function User({ user, children }: { user: AuthUser, children: React.ReactNode }) {
  const [jobsCompleted, setJobsCompleted] = useState<number>(0);
  const { client,region } = useContext(GlobalContext)!;
  const [currentPM, setCurrentPM] = useState<Schema['UserProjectMembership']['type'] | undefined>(undefined);
  const [currentProject,setCurrentProject] = useState<Schema['Project']['type'] | undefined>(undefined) 
  const [sqsClient, setSqsClient] = useState<SQSClient | undefined>(undefined);
  const [s3Client, setS3Client] = useState<S3Client | undefined>(undefined);
  const [lambdaClient, setLambdaClient] = useState<LambdaClient | undefined>(undefined);
  //const { items: myMemberships } = useObserveQuery('UserProjectMembership', { filter: { userId: { eq: user!.username } } });
  // const { data: myMemberships } = useOptimisticUpdates(
  //   'UserProjectMembership',
  //   async () => client.models.UserProjectMembership.list({ filter: { userId: { eq: user!.username } } }),
  //   { filter: { userId: { eq: user!.username } } })
  const myMembershipHook = useOptimisticMembership(
    async () => client.models.UserProjectMembership.list({ filter: { userId: { eq: user!.username } } }),
    { filter: { userId: { eq: user!.username } } })
  const { data: myMemberships } = myMembershipHook;

  // useEffect(() => {
  //   const sub = client.models.UserProjectMembership.observeQuery({ filter: { userId: { eq: user!.username } } }).subscribe({
  //     next: async ({ items }) => {
  //       setMyMemberships(items);
  //     },
  //   });
  //   return () => sub.unsubscribe();
  // }, [user.username]);

  const switchProject = useCallback((projectId: String) => {
    const pm = myMemberships?.find((pm) => pm.projectId == projectId);
    if (pm) {
      setCurrentPM(pm);
    }
    else {
      console.error('User tried to switch to a project they are not a member of')
    }
  }, [myMemberships, user.username])
  //const [credentials, setCredentials] = useState<any>(undefined);
  // useEffect(() => {
  //   const { region } = useContext(GlobalContext)!; 
  //   const setup = async () => {
      
  //     const credentials = Auth.essentialCredentials(await Auth.currentCredentials())
  //     setCredentials(credentials);
  //     setLambdaClient(new LambdaClient({ region, credentials }));
  //     setS3Client(new S3Client({ region, credentials }));
  //     setCognitoClient(new CognitoIdentityProviderClient({region:cognitoRegion, credentials}))
  //     setSqsClient(new SQSClient({region, credentials}))
  //   }
  //   setup()
  // },[user])

  useEffect(() => {
    if (currentPM) {
      client.models.Project.get({ id: currentPM.projectId }).then(p => setCurrentProject(p.data || undefined));
    } else {
      setCurrentProject(undefined);
    }
    currentProject;
  },[currentPM])

  useEffect(() => {
    async function refreshCredentials() {
    const { credentials } = await fetchAuthSession();
      //setCredentials(credentials);
      setSqsClient(new SQSClient({ region, credentials }));
      setLambdaClient(new LambdaClient({ region, credentials }));
      setS3Client(new S3Client({ region, credentials }));
    }
    refreshCredentials();
    const timer = setInterval(refreshCredentials, 30 * 60 * 1000); // Refresh credentials every 30 minutes
    return () => clearInterval(timer);
  }, [user]);

  return (
    sqsClient && s3Client && lambdaClient && 
    <UserContext.Provider
      value={{
        user,
        sqsClient,
        jobsCompleted,
        setJobsCompleted,
        s3Client,
        lambdaClient,
        myMembershipHook,
        currentPM,
        switchProject
      }}
      >
            {children}
    </UserContext.Provider>
  );
}


export function Management({ children }: { children: React.ReactNode }) {
  const { client } = useContext(GlobalContext)!;
  const {project} = useContext(ProjectContext)!;
  const { users: allUsers } = useUsers();
  //const {items: projectMemberships} = useObserveQuery('UserProjectMembership',{ filter: { projectId: { eq: project.id } } });
  const projectMembershipHook = useOptimisticMembership(
    async () => client.models.UserProjectMembership.list({ filter: { projectId: { eq: project.id } } }),
    { filter: { projectId: { eq: project.id } } })  
  const imageSetsHook = useOptimisticImageSet(
    async () => client.models.ImageSet.list({ filter: { projectId: { eq: project.id } } }),
    { filter: { projectId: { eq: project.id } } })
  const locationSetsHook = useOptimisticLocationSet(
    async () => client.models.LocationSet.list({ filter: { projectId: { eq: project.id } } }),
    { filter: { projectId: { eq: project.id } } })
  const annotationSetsHook = useOptimisticAnnotationSet(
    async () => client.models.AnnotationSet.list({ filter: { projectId: { eq: project.id } } }),
    { filter: { projectId: { eq: project.id } } })
  const queuesHook = useQueues(
    async () => client.models.Queue.list({ filter: { projectId: { eq: project.id } } }),
    { filter: { projectId: { eq: project.id } } })
  
  return ( 
    <ManagementContext.Provider value={{
      allUsers,
      projectMembershipHook,
      imageSetsHook,
      locationSetsHook,
      annotationSetsHook,
      queuesHook

    }} >
      {allUsers && projectMembershipHook && children}
    </ManagementContext.Provider>)

}

export function Global({ children }: { children: React.ReactNode }) {
  const [modalToShow, showModal] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressContextType>({})
  

  return (
    <GlobalContext.Provider value={{
      backend: outputs,
      region: outputs.auth.aws_region,
      client: generateClient<Schema>({authMode:"userPool"}),
      showModal,
      progress,
      setProgress,
      modalToShow
    }}>
      {children}
    </GlobalContext.Provider>
  );
}
