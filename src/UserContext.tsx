import { useState, useEffect, useContext, useMemo, useCallback } from "react";
import { SQSClient } from "@aws-sdk/client-sqs";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import { AuthUser, fetchAuthSession } from "aws-amplify/auth";
import { Schema } from "../amplify/data/resource"; // Path to your backend resource definition
import { useUsers } from "./apiInterface.tsx";
import {
  GlobalContext,
  ProjectContext,
  UserContext,
  ManagementContext,
  ProgressContext,
  ProgressType,
  OrganizationContext,
  UploadContext,
} from "./Context.tsx";
import { generateClient } from "aws-amplify/api";
import outputs from "../amplify_outputs.json";
import { useOptimisticUpdates, useQueues } from "./useOptimisticUpdates.tsx";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { useQuery } from "@tanstack/react-query";

export function Project({
  children,
  currentPM,
}: {
  children: React.ReactNode;
  currentPM: Schema["UserProjectMembership"]["type"];
}) {
  const { client } = useContext(GlobalContext)!;
  const [expandLegend, setExpandLegend] = useState<boolean>(true);
  const { myMembershipHook } = useContext(UserContext)!;
  const subscriptionFilter = useMemo(
    () => ({
      filter: { projectId: { eq: currentPM?.projectId } },
    }),
    [currentPM?.projectId]
  );
  //const [currentProject, setCurrentProject] = useState<Schema['Project']['type'] | undefined>(undefined)
  const categoriesHook = useOptimisticUpdates<
    Schema["Category"]["type"],
    "Category"
  >(
    "Category",
    async (nextToken) =>
      client.models.Category.list({
        filter: { projectId: { eq: currentPM?.projectId } },
        nextToken,
      }),
    subscriptionFilter
  );
  const [currentCategory, setCurrentCategory] = useState<
    Schema["Category"]["type"] | undefined
  >(categoriesHook.data?.[0]);
  // useEffect(() => {
  // if (currentPM) {
  //   client.models.Project.get({ id: currentPM.projectId }).then(p =>
  //     setCurrentProject(p['data']!));
  // } else {
  //   setCurrentProject(undefined);
  // }
  // }, [currentPM])

  const projectQuery = useQuery({
    queryKey: ["project", currentPM?.projectId],
    queryFn: () => client.models.Project.get({ id: currentPM?.projectId }),
  });

  const currentProject = projectQuery.data?.data;

  useEffect(() => {
    if (!currentCategory) {
      setCurrentCategory(categoriesHook.data?.[0]);
    }
  }, [categoriesHook.data]);

  return (
    currentProject && (
      <ProjectContext.Provider
        value={{
          project: currentProject,
          categoriesHook,
          currentPM: myMembershipHook.data.find(
            (m) => m.projectId == currentProject.id
          ),
          currentCategory,
          setCurrentCategory,
          expandLegend,
          setExpandLegend,
        }}
      >
        {currentProject && children}
      </ProjectContext.Provider>
    )
  );
}

export function Upload({ children }: { children: React.ReactNode }) {
  const [task, setTask] = useState<{
    projectId: string;
    files: File[];
    retryDelay: number;
    resumeId?: string;
    deleteId?: string;
    pauseId?: string;
    fromStaleUpload?: boolean;
    newProject: boolean;
  }>({
    projectId: "",
    files: [],
    retryDelay: 0,
    resumeId: undefined,
    deleteId: undefined,
    pauseId: undefined,
    fromStaleUpload: false,
    newProject: false,
  });
  const [progress, setProgress] = useState<{
    processed: number;
    total: number;
    isComplete: boolean;
    error: string | null;
  }>({
    processed: 0,
    total: 0,
    isComplete: false,
    error: null,
  });

  return (
    <UploadContext.Provider
      value={{
        task,
        progress,
        setTask,
        setProgress,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
}

export function User({
  user,
  cognitoGroups,
  children,
}: {
  user: AuthUser;
  cognitoGroups: string[];
  children: React.ReactNode;
}) {
  const [jobsCompleted, setJobsCompleted] = useState<number>(0);
  const [unannotatedJobs, setUnannotatedJobs] = useState<number>(0);
  const [currentTaskTag, setCurrentTaskTag] = useState<string>("");
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [currentAnnoCount, setCurrentAnnoCount] = useState<{
    [key: string]: number;
  }>({});
  const [isAnnotatePath, setIsAnnotatePath] = useState<boolean>(false);
  const { client, region } = useContext(GlobalContext)!;
  //const { items: myMemberships } = useObserveQuery('UserProjectMembership', { filter: { userId: { eq: user!.username } } });
  // const { data: myMemberships } = useOptimisticUpdates(
  //   'UserProjectMembership',
  //   async () => client.models.UserProjectMembership.list({ filter: { userId: { eq: user!.username } } }),
  //   { filter: { userId: { eq: user!.username } } })
  const subscriptionFilter = useMemo(
    () => ({
      filter: { userId: { eq: user.username } },
    }),
    [user.username]
  );

  // const myMembershipHook = useOptimisticMembership(
  //   async (nextToken) => client.models.UserProjectMembership.list({ filter: { userId: { eq: user!.username } },nextToken}),
  //   subscriptionFilter)

  const myMembershipHook = useOptimisticUpdates<
    Schema["UserProjectMembership"]["type"],
    "UserProjectMembership"
  >(
    "UserProjectMembership",
    async (nextToken) =>
      client.models.UserProjectMembership.list({
        filter: { userId: { eq: user!.username } },
        nextToken,
      }),
    subscriptionFilter
  );

  const myOrganizationHook = useOptimisticUpdates<
    Schema["OrganizationMembership"]["type"],
    "OrganizationMembership"
  >(
    "OrganizationMembership",
    async (nextToken) =>
      client.models.OrganizationMembership.list({
        filter: { userId: { eq: user!.username } },
        nextToken,
      }),
    subscriptionFilter,
    {
      compositeKey: (membership) =>
        `${membership.organizationId}:${membership.userId}`,
    }
  );

  const isOrganizationAdmin = myOrganizationHook.data?.some(
    (membership) => membership.isAdmin
  );

  // useEffect(() => {
  //   const sub = client.models.UserProjectMembership.observeQuery({ filter: { userId: { eq: user!.username } } }).subscribe({
  //     next: async ({ items }) => {
  //       setMyMemberships(items);
  //     },
  //   });
  //   return () => sub.unsubscribe();
  // }, [user.username]);
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

  const getSqsClient = useCallback(async () => {
    const { credentials } = await fetchAuthSession();
    return new SQSClient({ region, credentials });
  }, []);

  const getDynamoClient = useCallback(async () => {
    const { credentials } = await fetchAuthSession();
    return new DynamoDBClient({
      region,
      credentials,
    });
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        cognitoGroups,
        getSqsClient,
        jobsCompleted,
        setJobsCompleted,
        unannotatedJobs,
        setUnannotatedJobs,
        currentTaskTag,
        setCurrentTaskTag,
        currentAnnoCount,
        setCurrentAnnoCount,
        isTesting,
        setIsTesting,
        isRegistering,
        setIsRegistering,
        myMembershipHook,
        myOrganizationHook,
        isOrganizationAdmin,
        getDynamoClient,
        isAnnotatePath,
        setIsAnnotatePath,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function Management({ children }: { children: React.ReactNode }) {
  const { client } = useContext(GlobalContext)!;
  const { project } = useContext(ProjectContext)!;
  const { users: allUsers } = useUsers();
  // const subscriptionFilter = useMemo(() => (
  //   { projectId: { eq: project.id } }), [project.id]);
  const subscriptionFilter = useMemo(
    () => ({ filter: { projectId: { eq: project.id } } }),
    [project.id]
  );
  //const {items: projectMemberships} = useObserveQuery('UserProjectMembership',{ filter: { projectId: { eq: project.id } } });
  // const projectMembershipHook = useOptimisticMembership(
  //   async (nextToken) => client.models.UserProjectMembership.list({ filter: subscriptionFilter,nextToken }),
  //   subscriptionFilter)
  const projectMembershipHook = useOptimisticUpdates<
    Schema["UserProjectMembership"]["type"],
    "UserProjectMembership"
  >(
    "UserProjectMembership",
    async (nextToken) =>
      client.models.UserProjectMembership.list({
        filter: subscriptionFilter.filter,
        nextToken,
      }),
    subscriptionFilter
  );
  const imageSetsHook = useOptimisticUpdates<
    Schema["ImageSet"]["type"],
    "ImageSet"
  >(
    "ImageSet",
    async (nextToken) =>
      client.models.ImageSet.list({
        filter: subscriptionFilter.filter,
        nextToken,
      }),
    subscriptionFilter
  );
  const locationSetsHook = useOptimisticUpdates<
    Schema["LocationSet"]["type"],
    "LocationSet"
  >(
    "LocationSet",
    async (nextToken) =>
      client.models.LocationSet.list({
        filter: subscriptionFilter.filter,
        nextToken,
      }),
    subscriptionFilter
  );
  const annotationSetsHook = useOptimisticUpdates<
    Schema["AnnotationSet"]["type"],
    "AnnotationSet"
  >(
    "AnnotationSet",
    async (nextToken) =>
      client.models.AnnotationSet.list({
        filter: subscriptionFilter.filter,
        nextToken,
      }),
    subscriptionFilter
  );
  const queuesHook = useQueues();

  return (
    <ManagementContext.Provider
      value={{
        allUsers,
        projectMembershipHook,
        imageSetsHook,
        locationSetsHook,
        annotationSetsHook,
        queuesHook,
      }}
    >
      {allUsers &&
        projectMembershipHook &&
        imageSetsHook &&
        locationSetsHook &&
        annotationSetsHook &&
        queuesHook &&
        children}
    </ManagementContext.Provider>
  );
}

// export function Global({ children }: { children: React.ReactNode }) {
//   const [modalToShow, showModal] = useState<string | null>(null)

//   return (
//     <GlobalContext.Provider value={{
//       backend: outputs,
//       region: outputs.auth.aws_region,
//       client: generateClient<Schema>({authMode:"userPool"}),
//       showModal,
//       modalToShow
//     }}>
//       {children}
//     </GlobalContext.Provider>
//   );
// }

export function Progress({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<ProgressType>({});
  return (
    <ProgressContext.Provider
      value={{
        progress,
        setProgress,
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
}

// export function Organization({ children }: { children: React.ReactNode }) {
//   const { client } = useContext(GlobalContext)!;
//   const subscriptionFilter = useMemo(
//     () => ({ filter: { organizationId: { eq: project.organizationId } } }),
//     [project.organizationId]
//   );
//   const membershipHook = useOptimisticUpdates<
//     Schema['OrganizationMembership']['type'],
//     'OrganizationMembership'
//   >(
//     'OrganizationMembership',
//     async (nextToken) =>
//       client.models.OrganizationMembership.membershipsByOrganizationId({
//         organizationId: project.organizationId,
//         nextToken,
//       }),
//     subscriptionFilter
//   );

//   return (
//     <OrganizationContext.Provider
//       value={{
//         membershipHook,
//       }}
//     >
//       {children}
//     </OrganizationContext.Provider>
//   );
// }
