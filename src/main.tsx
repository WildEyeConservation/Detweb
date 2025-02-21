import ReactDOM from 'react-dom/client';
import App from './App.tsx';
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
import CreateOrganization from './organization/CreateOrganization';
import Surveys from './Surveys';
import Permissions from './Permissions.tsx';
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
});

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
            <App />
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
        path: 'surveys',
        element: <Surveys />,
      },
      {
        path: 'ESSRegisterAdmin',
        element: <RegisterOrganization />,
      },
      {
        path: 'permissions',
        element: <Permissions />,
      },
      {
        path: 'onboarding',
        element: <CreateOrganization />,
      },
      {
        path: ':organizationId?/:projectId?',
        element: <ProjectView />,
        errorElement: <ErrorPage />,
        children: [
          {
            path: 'annotate',
            element: <Annotate />,
          },
          {
            path: 'projectManagement',
            element: <ProjectManagement />,
          },
          {
            path: 'leaderboard',
            element: <UserStats />,
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
          {
            path: 'review',
            element: <Review />,
          },
        ],
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
