import { createContext, useState } from 'react';
import { Schema } from './amplify/client-schema'; // Path to your backend resource definition
import outputs from '../amplify_outputs.json';
import { AuthUser } from '@aws-amplify/auth';
import { SQSClient } from '@aws-sdk/client-sqs';
import type { DataClient } from '../amplify/shared/data-schema.generated';
import type { UserType } from '../amplify/shared/types';
import { limitedClient } from './limitedClient';


export interface ProgressType {
  [key: string]: { value?: number; detail: JSX.Element };
}

type ClientType = DataClient;
type ModelType = keyof ClientType['models'];
export type CRUDhook<T extends ModelType> = {
  data: Schema[T]['type'][];
  create: (arg: Parameters<ClientType['models'][T]['create']>[0]) => string;
  update: (arg: Parameters<ClientType['models'][T]['update']>[0]) => void;
  delete: (arg: Parameters<ClientType['models'][T]['delete']>[0]) => void;
};
export type AnnotationsHook = CRUDhook<'Annotation'>;

export interface GlobalContextType {
  client: DataClient;
  backend: typeof outputs;
  region: string;
  modalToShow: string | null;
  showModal: React.Dispatch<React.SetStateAction<string | null>>;
}

export interface UploadContextType {
  task: {
    newProject: boolean;
    projectId: string;
    fromStaleUpload?: boolean;
    files: File[];
    retryDelay: number;
    resumeId?: string;
    deleteId?: string;
    pauseId?: string;
  };
  setTask: React.Dispatch<
    React.SetStateAction<{
      newProject: boolean;
      projectId: string;
      fromStaleUpload?: boolean;
      files: File[];
      retryDelay: number;
      resumeId?: string;
      deleteId?: string;
      pauseId?: string;
    }>
  >;
  progress: {
    processed: number;
    total: number;
    isComplete: boolean;
    error: string | null;
  };
  setProgress: React.Dispatch<
    React.SetStateAction<{
      processed: number;
      total: number;
      isComplete: boolean;
      error: string | null;
    }>
  >;
}

export interface UserContextType {
  user: AuthUser;
  getSqsClient: () => Promise<SQSClient>;
  cognitoGroups: string[];
  myMembershipHook: CRUDhook<'UserProjectMembership'>;
  myOrganizationHook: CRUDhook<'OrganizationMembership'>;
  isOrganizationAdmin: boolean;
  jobsCompleted: number;
  setJobsCompleted: React.Dispatch<React.SetStateAction<number>>;
  isAnnotatePath: boolean;
  setIsAnnotatePath: React.Dispatch<React.SetStateAction<boolean>>;

  // user testing - maybe move to own context
  unannotatedJobs: number;
  setUnannotatedJobs: React.Dispatch<React.SetStateAction<number>>;
  currentTaskTag: string;
  setCurrentTaskTag: React.Dispatch<React.SetStateAction<string>>;
  currentAnnoCount: { [key: string]: { x: number; y: number }[] };
  setCurrentAnnoCount: React.Dispatch<
    React.SetStateAction<{ [key: string]: { x: number; y: number }[] }>
  >;
  isRegistering: boolean;
  setIsRegistering: React.Dispatch<React.SetStateAction<boolean>>;
  sessionTestsResults: {
    id: string;
    locationId: string;
    annotationSetId: string;
  }[];
  setSessionTestsResults: React.Dispatch<
    React.SetStateAction<
      { id: string; locationId: string; annotationSetId: string }[]
    >
  >;
}

export interface ManagementContextType {
  allUsers: UserType[];
  projectMembershipHook: CRUDhook<'UserProjectMembership'>;
  annotationSetsHook: CRUDhook<'AnnotationSet'>;
  imageSetsHook: CRUDhook<'ImageSet'>;
  locationSetsHook: CRUDhook<'LocationSet'>;
  queuesHook: {
    data: Schema['Queue']['type'][];
    update: (
      arg: Parameters<ClientType['models']['Queue']['update']>[0]
    ) => void;
    delete: (arg: { id: string }) => void;
  };
}

// export interface OrganizationContextType {
//   organizationHook: CRUDhook<'OrganizationMembership'>;
// }

export interface ProjectContextType {
  currentPM: Schema['UserProjectMembership']['type'];
  annotationsHook: CRUDhook<'Annotation'>;
  project: Schema['Project']['type'];
  categoriesHook: CRUDhook<'Category'>;
  currentCategory: Schema['Category']['type'];
  setCurrentCategory: React.Dispatch<
    React.SetStateAction<Schema['Category']['type']>
  >;
  expandLegend: boolean;
  setExpandLegend: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface ProgressContextType {
  progress: ProgressType;
  setProgress: React.Dispatch<React.SetStateAction<ProgressType>>;
}

// context used for setting up testing as an organization admin (this is not used for actual testing)
export interface TestingContextType {
  organizationId: string;
  organizationProjects: Schema['Project']['type'][];
  organizationTestPresets: Schema['TestPreset']['type'][];
  organizationMembershipsHook: CRUDhook<'OrganizationMembership'>;
}

interface ImageContextType {
  latLng2xy: (
    input: L.LatLng | [number, number] | Array<L.LatLng | [number, number]>
  ) => L.Point | L.Point[];
  xy2latLng: (
    input: L.Point | [number, number] | Array<L.Point | [number, number]>
  ) => L.LatLng | L.LatLng[];
  annotationsHook: AnnotationsHook;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  prevImages:
    | {
        image: Schema['Image']['type'];
        transform: (c1: [number, number]) => [number, number];
      }[]
    | undefined;
  nextImages:
    | {
        image: Schema['Image']['type'];
        transform: (c1: [number, number]) => [number, number];
      }[]
    | undefined;
  queriesComplete: boolean;
}

export const UserContext = createContext<UserContextType | null>(null);
export const ProjectContext = createContext<ProjectContextType | null>(null);
export const ManagementContext = createContext<ManagementContextType | null>(
  null
);
export const ProgressContext = createContext<ProgressContextType | null>(null);
export const ImageContext = createContext<ImageContextType | undefined>(
  undefined
);
export const TestingContext = createContext<TestingContextType | null>(null);
// export const OrganizationContext =
//   createContext<OrganizationContextType | null>(null);
export const UploadContext = createContext<UploadContextType | null>(null);

export const GlobalContext = createContext<GlobalContextType>({
  backend: outputs,
  region: outputs.auth.aws_region,
  client: limitedClient,
  showModal: () => {},
  modalToShow: null,
});

export function GlobalContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [modalToShow, showModal] = useState<string | null>(null);
  return (
    //Return a GlobalContextProvider with all members at their default values except
    //for showModal and modalToShow
    <GlobalContext.Consumer>
      {(value) => (
        <GlobalContext.Provider
          value={{
            ...value,
            showModal,
            modalToShow,
          }}
        >
          {children}
        </GlobalContext.Provider>
      )}
    </GlobalContext.Consumer>
  );
}
