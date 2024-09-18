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
    showModal: React.Dispatch<React.SetStateAction<string | null>>;
}

export interface UserContextType {
    user: AuthUser,
    sqsClient: SQSClient,
    s3Client: S3Client,
    lambdaClient: LambdaClient,
    myMembershipHook: CRUDhook<'UserProjectMembership'>,
    jobsCompleted: number,
    setJobsCompleted: (jobsCompleted: number) => void,
    } 

export interface ManagementContextType {
    allUsers: Schema['UserType']['type'][],
    projectMembershipHook: CRUDhook<'UserProjectMembership'>,
    annotationSetsHook: CRUDhook<'AnnotationSet'>;
    imageSetsHook: CRUDhook<'ImageSet'>;
    locationSetsHook: CRUDhook<'LocationSet'>; 
    queuesHook: {
        data: Schema['Queue']['type'][],
        create: (arg0: string) => void,
        update: (arg: Parameters<ClientType['models']['Queue']['update']>[0]) => void,
        delete: (arg:{id:string}) => void
    };   
} 
    
export interface ProjectContextType {
    project: Schema['Project']['type'];
    categoriesHook: CRUDhook<'Category'>; 
}

export interface ProgressContextType {
    progress: ProgressType,
    setProgress: React.Dispatch<React.SetStateAction<ProgressType>>,
}
    
export const GlobalContext = createContext<GlobalContextType | null>(null);
export const UserContext = createContext<UserContextType | null>(null);
export const ProjectContext = createContext<ProjectContextType | null>(null);
export const ManagementContext = createContext<ManagementContextType | null>(null);
export const ProgressContext = createContext<ProgressContextType | null>(null);


