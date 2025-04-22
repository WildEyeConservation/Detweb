import ReactDOM from 'react-dom/client';
import AppWithAuthenticator from './App.tsx';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Progress } from './UserContext';
import { GlobalContextProvider } from './Context';
import ScratchPad from './ScratchPad';
import ProjectManagement from './ProjectManagement';
import UserStats from './UserStats';
import { LocationLoader } from './LocationLoader';
import { ImageLoader } from './ImageLoader';
import QuickTest from './QuickTest';
import { Review } from './Review';
import { PairLoader } from './PairLoader';
import RegisterOrganization from './RegisterOrganization';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import ErrorPage from './error-page';
import ProjectView from './ProjectView';
import Jobs from './user/Jobs.tsx';
import Surveys from './survey/Surveys.tsx';
import Permissions from './Permissions.tsx';
import Testing from './Testing/Testing';
import { Registration } from "./Registration";
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import Admin from './Admin';

const persister = createSyncStoragePersister({
  storage: window.localStorage,
})

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
});

persistQueryClient({
  queryClient,
  persister,
})

// Define global for browser environment
window.global = window;
let Annotate = ScratchPad();

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <GlobalContextProvider>
        <Progress>
          <QueryClientProvider client={queryClient}>
            <ReactQueryDevtools initialIsOpen={false} />
            <AppWithAuthenticator />
          </QueryClientProvider>
        </Progress>
      </GlobalContextProvider>
    ),
    errorElement: <ErrorPage />,
    children: [
      {
        path: 'jobs',
        element: <Jobs />,
      },
      {
        path: 'surveys/:surveyId',
        element: <ProjectView />,
        children: [
          {
            path: 'annotate',
            element: <Annotate />,
          }, 
          {
            path: 'review',
            element: <Review />,
          },
          {
            path: "registration",
            element: <Registration />
          },
          {
            path: 'manage',
            element: <ProjectManagement />,
          },
          {
            path: 'quickTest',
            element: <QuickTest />,
          },
          {
            path: 'location/:locationId/:annotationSetId',
            element: <LocationLoader />,
          },
          {
            path: 'image/:imageId/:annotationSetId',
            element: <ImageLoader />,
          },
          {
            path: 'register/:image1Id/:image2Id/:selectedSet',
            element: <PairLoader />,
          },
        ],
      },
      {
        path: 'surveys/:surveyId/set/:annotationSetId',
        element: <ProjectView />,
        children: [
          {
            path: 'review',
            element: <Review showAnnotationSetDropdown={false} />,
          },
          {
            path: "registration",
            element: <Registration showAnnotationSetDropdown={false}/>
          },
        ],
      },
      {
        path: 'surveys',
        element: <Surveys />,
      },
      {
        path: 'SSRegisterOrganization',
        element: <RegisterOrganization />,
      },
      {
        path: 'permissions',
        element: <Permissions />,
      },
      {
        path: 'annotation-statistics',
        element: <UserStats />,
      },
      {
        path: 'SSAdmin',
        element: <Admin />,
      },
      {
        path: 'testing',
        element: <Testing />,
      },
    ],
  },
]);

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<RouterProvider router={router} />);
} else {
  console.error('Root element not found');
}
