import { Amplify } from 'aws-amplify'
Amplify.configure(outputs)
import { createContext, useState } from "react";
import { Schema } from '../amplify/data/resource'; // Path to your backend resource definition
import outputs from '../amplify_outputs.json'
import { AuthUser } from "@aws-amplify/auth";
import { SQSClient } from "@aws-sdk/client-sqs";
import { S3Client } from "@aws-sdk/client-s3";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { V6Client } from '@aws-amplify/api-graphql'
import { generateClient } from "aws-amplify/api";
import { client,limitedClient } from "./limitedClient";


export interface ProgressType {
    [key: string]: {value?:number, detail:JSX.Element};
}

type ClientType = V6Client<Schema>;
type ModelType = keyof ClientType['models'];
export type CRUDhook<T extends ModelType> = {
    data: Schema[T]['type'][];
    create: (arg: Parameters<ClientType['models'][T]['create']>[0]) => string; 
    update: (arg: Parameters<ClientType['models'][T]['update']>[0]) => void;
    delete: (arg: Parameters<ClientType['models'][T]['delete']>[0]) => void;
}
export type AnnotationsHook = CRUDhook<'Annotation'>;

export interface GlobalContextType {
    client: V6Client<Schema>,
    backend: typeof outputs,
    region: string,
    modalToShow: string | null,
    showModal: React.Dispatch<React.SetStateAction<string | null>>;
}

export interface UserContextType {
    user: AuthUser,
    getSqsClient: () => Promise<SQSClient>,
    getDynamoClient: () => Promise<DynamoDBDocumentClient>,
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
        create: (arg0: string) => string,
        update: (arg: Parameters<ClientType['models']['Queue']['update']>[0]) => void,
        delete: (arg:{id:string}) => void
    };   
} 



export interface ProjectContextType {
    currentPM: Schema['UserProjectMembership']['type'],
    annotationsHook: CRUDhook<'Annotation'>,
    project: Schema['Project']['type'];
    categoriesHook: CRUDhook<'Category'>; 
    currentCategory: Schema['Category']['type'],
    setCurrentCategory: React.Dispatch<React.SetStateAction<Schema['Category']['type']>>
}

export interface ProgressContextType {
    progress: ProgressType,
    setProgress: React.Dispatch<React.SetStateAction<ProgressType>>,
}

interface ImageContextType {
    latLng2xy: (input: L.LatLng | [number, number] | Array<L.LatLng | [number, number]>) => L.Point | L.Point[];
    xy2latLng: (input: L.Point | [number, number] | Array<L.Point | [number, number]>) => L.LatLng | L.LatLng[];
    annotationsHook: AnnotationsHook;
}


export const UserContext = createContext<UserContextType | null>(null);
export const ProjectContext = createContext<ProjectContextType | null>(null);
export const ManagementContext = createContext<ManagementContextType | null>(null);
export const ProgressContext = createContext<ProgressContextType | null>(null);
export const ImageContext = createContext<ImageContextType | undefined>(undefined);

export const GlobalContext = createContext<GlobalContextType>(
    {
        backend: outputs,
        region: outputs.auth.aws_region,
        client: limitedClient,
        showModal: () => { },
        modalToShow: null
    }
);

export function GlobalContextProvider({ children }: { children: React.ReactNode }) {
    const [modalToShow, showModal] = useState<string | null>(null)
    return (
        //Return a GlobalContextProvider with all members at their default values except
        //for showModal and modalToShow
        <GlobalContext.Consumer>
            {(value) => (
                <GlobalContext.Provider value={{
                    ...value,
                    showModal,
                    modalToShow
                }}>
                    {children}
                </GlobalContext.Provider>
            )}
        </GlobalContext.Consumer>
    );
  }

