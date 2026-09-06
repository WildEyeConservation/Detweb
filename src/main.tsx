import { surveyDialogRoutes } from './survey/surveyDialogRoutes';
import ReactDOM from 'react-dom/client';
import AppWithAuthenticator from './App.tsx';
import './index.css';
import { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import ErrorPage from './error-page';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { lazy, Suspense } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const devModules = (import.meta as any).glob('./DevActions.tsx') as Record<string, () => Promise<{ DevActions: React.FC }>>;
const DevActions = devModules['./DevActions.tsx']
  ? lazy(() =>
      devModules['./DevActions.tsx']().then((m) => ({ default: m.DevActions }))
    )
  : null;

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
});

// Define global for browser environment
window.global = window;

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister }}
      >
        <ReactQueryDevtools initialIsOpen={false} />
        <AppWithAuthenticator />
      </PersistQueryClientProvider>
    ),
    errorElement: <ErrorPage />,
    children: [
      { path: 'settings/:tab?', element: null },
      {
        path: 'jobs',
        lazy: async () => ({ Component: (await import('./user/Jobs')).default }),
      },
      {
        path: 'jolly/:surveyId/:annotationSetId',
        lazy: async () => ({ Component: (await import('./JollyResults')).default }),
      },
      {
        path: 'shared-results',
        lazy: async () => ({ Component: (await import('./SharedResults')).default }),
      },
      {
        path: 'shared-chains',
        lazy: async () => ({ Component: (await import('./SharedChains')).default }),
      },
      {
        path: 'shared-chains/:shareId',
        lazy: async () => ({ Component: (await import('./chain-viewer/shared/SharedChainViewerPage')).SharedChainViewerPage }),
      },
      {
        path: 'chain-share-admin',
        lazy: async () => ({ Component: (await import('./chain-viewer/admin/ChainShareAdminLayout')).default }),
        children: [
          { index: true, element: <Navigate to='shares' replace /> },
          { path: 'shares', lazy: async () => ({ Component: (await import('./chain-viewer/admin/ManageShares')).default }) },
          { path: 'results', lazy: async () => ({ Component: (await import('./chain-viewer/admin/ChainShareResults')).default }) },
          { path: 'disagreements', lazy: async () => ({ Component: (await import('./chain-viewer/admin/DisagreementExplorer')).default }) },
        ],
      },
      {
        path: 'image-neighbour-viewer',
        lazy: async () => ({ Component: (await import('./ImageNeighbourViewer')).default }),
      },
      {
        path: 'homography-viewer',
        lazy: async () => ({ Component: (await import('./homography/HomographyViewer')).default }),
      },
      {
        path: 'surveys/:surveyId',
        lazy: async () => ({ Component: (await import('./ProjectView')).default }),
        children: [
          {
            path: 'annotate',
            lazy: async () => ({ Component: (await import('./AnnotationQueuePage')).default }),
          },
          {
            path: 'review',
            lazy: async () => ({ Component: (await import('./Review')).Review }),
          },
          {
            // Transect/category are claimed on the Jobs page and passed via
            // navigation state (not the URL). Direct navigation bounces to
            // /jobs.
            path: 'individual-id',
            lazy: async () => ({ Component: (await import('./individual-id/IndividualIdTaskPage')).IndividualIdTaskPage }),
          },
          {
            // Single-pair workspace driven entirely by query params
            // (image1Id, image2Id, categoryId, annotationSetId, optional
            // prevHref/nextHref). Bookmarkable / shareable.
            path: 'individual-id-pair',
            lazy: async () => ({ Component: (await import('./individual-id/IndividualIdPairTaskPage')).IndividualIdPairTaskPage }),
          },
          {
            path: 'homography/:queueId',
            lazy: async () => ({ Component: (await import('./homography/HomographyTask')).default }),
          },
          {
            // Standalone single-pair homography editor. Required query params
            // (image1Id, image2Id); optional annotationSetId, backHref.
            // Linked from the Individual-ID toolbar for ad-hoc fixes.
            path: 'homography-edit',
            lazy: async () => ({ Component: (await import('./homography/HomographyEditPage')).default }),
          },
          {
            path: 'location/:locationId/:annotationSetId',
            lazy: async () => ({ Component: (await import('./LocationLoader')).LocationLoader }),
          },
          {
            path: 'image/:imageId/:annotationSetId',
            lazy: async () => ({ Component: (await import('./ImageLoader')).ImageLoader }),
          },
          {
            path: 'qc-review/:queueId',
            lazy: async () => ({ Component: (await import('./QCReviewTask')).default }),
          },
          {
            path: 'info-tags/:queueId',
            lazy: async () => ({ Component: (await import('./InfoTagTask')).default }),
          },
        ],
      },
      {
        path: 'surveys/:surveyId/set/:annotationSetId',
        lazy: async () => ({ Component: (await import('./ProjectView')).default }),
        children: [
          {
            path: 'review',
            lazy: async () => {
              const { Review } = await import('./Review');
              return { Component: () => <Review showAnnotationSetDropdown={false} /> };
            },
          },
          {
            path: 'chain-viewer',
            lazy: async () => ({ Component: (await import('./chain-viewer/ChainViewerPage')).ChainViewerPage }),
          },
          {
            path: 'chain-review/:primaryId',
            lazy: async () => ({ Component: (await import('./chain-viewer/ChainReviewTaskPage')).ChainReviewTaskPage }),
          },
        ],
      },
      {
        path: 'surveys',
        lazy: async () => ({ Component: (await import('./survey/Surveys')).default }),
        children: [
          ...surveyDialogRoutes.map(({ path, kind }) => ({
            path,
            lazy: async () => {
              const { default: Dialog } = await import('./survey/SurveyDialogRoute');
              return { Component: () => <Dialog key={kind} kind={kind} /> };
            },
          })),
          {
            path: ':surveyId/edit/:tab?',
            lazy: async () => ({ Component: (await import('./survey/SurveyEditorRoute')).default }),
          },
        ],
      },
      {
        path: 'SSRegisterOrganization',
        lazy: async () => ({ Component: (await import('./RegisterOrganization')).default }),
      },
      {
        path: 'permissions',
        lazy: async () => ({ Component: (await import('./Permissions')).default }),
      },
      {
        path: 'annotation-statistics',
        lazy: async () => ({ Component: (await import('./UserStats')).default }),
      },
      {
        // The screen itself also checks the sysadmin group, so reaching this
        // path directly shows a notice rather than an empty report.
        path: 'workflow-statistics',
        lazy: async () => ({ Component: (await import('./WorkflowStatistics')).default }),
      },
      {
        path: 'SSAdmin',
        lazy: async () => ({ Component: (await import('./Admin')).default }),
      },
      {
        path: 'testing',
        lazy: async () => ({ Component: (await import('./Testing/Testing')).default }),
      },
      ...(DevActions
        ? [
            {
              path: 'dev-actions',
              element: (
                <Suspense fallback={null}>
                  <DevActions />
                </Suspense>
              ),
            },
          ]
        : []),
    ],
  },
]);

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<RouterProvider router={router} />);
} else {
  console.error('Root element not found');
}
