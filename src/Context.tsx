import { createContext } from "react";
import { Schema } from '../amplify/data/resource'; // Path to your backend resource definition
import outputs from '../amplify_outputs.json'
import { AuthUser } from "@aws-amplify/auth";
import { SQSClient } from "@aws-sdk/client-sqs";
import { S3Client } from "@aws-sdk/client-s3";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { V6Client } from '@aws-amplify/api-graphql'

export interface ProgressType {
    [key: string]: {value?:number, detail:JSX.Element};
}

type testCreateCategory = Parameters<ClientType['models']['Category']['create']>[0]

type ClientType = V6Client<Schema>;
type ModelType = keyof ClientType['models'];
type CRUDhook<T extends ModelType> = {
    data: Schema[T]['type'][];
    create: (arg: Parameters<ClientType['models'][T]['create']>[0]) => string; 
    update: (arg: Parameters<ClientType['models'][T]['update']>[0]) => void;
    delete: (arg: Parameters<ClientType['models'][T]['delete']>[0]) => void;
}

interface GlobalContextType {
    client: V6Client<Schema>,
    backend: typeof outputs,
    region: string,
    modalToShow: string | null,
    progress: ProgressType,
    setProgress: React.Dispatch<React.SetStateAction<ProgressType>>,
    showModal: React.Dispatch<React.SetStateAction<string | null>>;
}

export interface UserContextType {
    user: AuthUser,
    currentPM: Schema['UserProjectMembership']['type'] | undefined,
    sqsClient: SQSClient,
    s3Client: S3Client,
    lambdaClient: LambdaClient,
    myMembershipHook: CRUDhook<Schema['UserProjectMembership']['type']>,
    switchProject: (projectId: string) => void,
    jobsCompleted: number,
    setJobsCompleted: (jobsCompleted: number) => void,
    } 

export interface ManagementContextType {
    allUsers: Schema['UserType']['type'][],
    projectMembershipHook: CRUDhook<Schema['UserProjectMembership']['type']>,
} 
    
export interface ProjectContextType {
    project: Schema['Project']['type'];
    annotationSetsHook: CRUDhook<Schema['AnnotationSet']['type']>;
    imageSetsHook: CRUDhook<Schema['ImageSet']['type']>;
    locationSetsHook: CRUDhook<Schema['LocationSet']['type']>; 
    categoriesHook: CRUDhook<Schema['Category']['type']>; 
    queuesHook: CRUDhook<Schema['Queue']['type']>; 
}

    
export const GlobalContext = createContext<GlobalContextType | null>(null);
export const UserContext = createContext<UserContextType | null>(null);
export const ProjectContext = createContext<ProjectContextType | null>(null);
export const ManagementContext = createContext<ManagementContextType | null>(null);

