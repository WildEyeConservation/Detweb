import { surveyDialogRoutes } from '../features/surveys/surveyDialogRoutes';
import AppWithAuthenticator from './App';
import { queryClient } from '../shared/data/queryClient';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import ErrorPage from './error-page';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { Suspense } from 'react';
import { DevActions } from './devActions';


const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

// Define global for browser environment
window.global = window;

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <PersistQueryClientProvider
        client={queryClient}
        // Bump when a persisted query's cached shape changes so restored
        // entries from an older build are discarded instead of served.
        persistOptions={{ persister, buster: 'v2' }}
      >
        <ReactQueryDevtools initialIsOpen={false} />
        <AppWithAuthenticator />
      </PersistQueryClientProvider>
    ),
    errorElement: <ErrorPage />,
    children: [
      {
        path: 'jobs',
        lazy: async () => ({ Component: (await import('../features/account/Jobs')).default }),
      },
      {
        path: 'jolly/:surveyId/:annotationSetId',
        lazy: async () => ({ Component: (await import('../features/results/JollyResults')).default }),
      },
      {
        path: 'shared-results',
        lazy: async () => ({ Component: (await import('../features/results/SharedResults')).default }),
      },
      {
        path: 'shared-chains',
        lazy: async () => ({ Component: (await import('../features/chain-viewer/SharedChains')).default }),
      },
      {
        path: 'shared-chains/:shareId',
        lazy: async () => ({ Component: (await import('../features/chain-viewer/shared/SharedChainViewerPage')).SharedChainViewerPage }),
      },
      {
        path: 'chain-share-admin',
        lazy: async () => ({ Component: (await import('../features/chain-viewer/admin/ChainShareAdminLayout')).default }),
        children: [
          { index: true, element: <Navigate to='shares' replace /> },
          { path: 'shares', lazy: async () => ({ Component: (await import('../features/chain-viewer/admin/ManageShares')).default }) },
          { path: 'results', lazy: async () => ({ Component: (await import('../features/chain-viewer/admin/ChainShareResults')).default }) },
          { path: 'disagreements', lazy: async () => ({ Component: (await import('../features/chain-viewer/admin/DisagreementExplorer')).default }) },
        ],
      },
      {
        path: 'image-neighbour-viewer',
        lazy: async () => ({ Component: (await import('../features/images/ImageNeighbourViewer')).default }),
      },
      {
        path: 'homography-viewer',
        lazy: async () => ({ Component: (await import('../features/homography/HomographyViewer')).default }),
      },
      {
        path: 'surveys/:surveyId',
        lazy: async () => ({ Component: (await import('../features/surveys/ProjectView')).default }),
        children: [
          {
            path: 'annotate',
            lazy: async () => ({ Component: (await import('../features/annotation/AnnotationQueuePage')).default }),
          },
          {
            path: 'review',
            lazy: async () => ({ Component: (await import('../features/review/Review')).Review }),
          },
          {
            // Transect/category are claimed on the Jobs page and passed via
            // navigation state (not the URL). Direct navigation bounces to
            // /jobs.
            path: 'individual-id',
            lazy: async () => ({ Component: (await import('../features/individual-id/IndividualIdTaskPage')).IndividualIdTaskPage }),
          },
          {
            // Single-pair workspace driven entirely by query params
            // (image1Id, image2Id, categoryId, annotationSetId, optional
            // prevHref/nextHref). Bookmarkable / shareable.
            path: 'individual-id-pair',
            lazy: async () => ({ Component: (await import('../features/individual-id/IndividualIdPairTaskPage')).IndividualIdPairTaskPage }),
          },
          {
            path: 'homography/:queueId',
            lazy: async () => ({ Component: (await import('../features/homography/HomographyTask')).default }),
          },
          {
            // Standalone single-pair homography editor. Required query params
            // (image1Id, image2Id); optional annotationSetId, backHref.
            // Linked from the Individual-ID toolbar for ad-hoc fixes.
            path: 'homography-edit',
            lazy: async () => ({ Component: (await import('../features/homography/HomographyEditPage')).default }),
          },
          {
            path: 'location/:locationId/:annotationSetId',
            lazy: async () => ({ Component: (await import('../features/images/LocationLoader')).LocationLoader }),
          },
          {
            path: 'image/:imageId/:annotationSetId',
            lazy: async () => ({ Component: (await import('../features/images/ImageLoader')).ImageLoader }),
          },
          {
            path: 'qc-review/:queueId',
            lazy: async () => ({ Component: (await import('../features/review/QCReviewTask')).default }),
          },
          {
            path: 'info-tags/:queueId',
            lazy: async () => ({ Component: (await import('../features/info-tags/InfoTagTask')).default }),
          },
        ],
      },
      {
        path: 'surveys/:surveyId/set/:annotationSetId',
        lazy: async () => ({ Component: (await import('../features/surveys/ProjectView')).default }),
        children: [
          {
            path: 'review',
            lazy: async () => {
              const { Review } = await import('../features/review/Review');
              return { Component: () => <Review showAnnotationSetDropdown={false} /> };
            },
          },
          {
            path: 'chain-viewer',
            lazy: async () => ({ Component: (await import('../features/chain-viewer/ChainViewerPage')).ChainViewerPage }),
          },
          {
            path: 'chain-review/:primaryId',
            lazy: async () => ({ Component: (await import('../features/chain-viewer/ChainReviewTaskPage')).ChainReviewTaskPage }),
          },
        ],
      },
      {
        path: 'surveys',
        lazy: async () => ({ Component: (await import('../features/surveys/Surveys')).default }),
        children: [
          ...surveyDialogRoutes.map(({ path, kind }) => ({
            path,
            lazy: async () => {
              const { default: Dialog } = await import('../features/surveys/SurveyDialogRoute');
              return { Component: () => <Dialog key={kind} kind={kind} /> };
            },
          })),
          {
            path: ':surveyId/edit/:tab?',
            lazy: async () => ({ Component: (await import('../features/surveys/SurveyEditorRoute')).default }),
          },
        ],
      },
      {
        path: 'SSRegisterOrganization',
        lazy: async () => ({ Component: (await import('../features/organizations/RegisterOrganization')).default }),
      },
      {
        path: 'permissions',
        lazy: async () => ({ Component: (await import('../features/organizations/Permissions')).default }),
      },
      {
        path: 'annotation-statistics',
        lazy: async () => ({ Component: (await import('../features/statistics/UserStats')).default }),
      },
      {
        path: 'workflow-statistics',
        lazy: async () => ({ Component: (await import('../features/statistics/WorkflowStatistics')).default }),
      },
      {
        path: 'SSAdmin',
        lazy: async () => ({ Component: (await import('../features/admin/Admin')).default }),
      },
      {
        path: 'testing',
        lazy: async () => ({ Component: (await import('../features/testing/Testing')).default }),
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
