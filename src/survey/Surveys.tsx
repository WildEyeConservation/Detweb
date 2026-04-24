import { useContext, useEffect, useMemo, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { UserContext, GlobalContext } from '../Context.tsx';
import { Schema } from '../amplify/client-schema.ts';
import { Button, Form, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from '../ConfirmationModal.tsx';
import AnnotationSetResults from '../AnnotationSetResults.tsx';
import AnnotationCountModal from '../AnnotationCountModal.tsx';
import EditAnnotationSetModal from '../EditAnnotationSet.tsx';
import AddAnnotationSetModal from './AddAnnotationSetModal.tsx';
import LaunchAnnotationSetModal from './LaunchAnnotationSetModal.tsx';
import { logAdminAction } from '../utils/adminActionLogger.ts';
import { useOrg } from '../OrgContext.tsx';
import { Page, PageHeader, Toolbar, ContentArea, Spacer } from '../ss/PageShell.tsx';
import QueueProgress from '../user/QueueProgress.tsx';

const PROJECT_SELECTION_SET = [
  'id',
  'name',
  'organizationId',
  'organization.name',
  'status',
  'updatedAt',
  'createdAt',
  'tiledLocationSetId',
  'annotationSets.id',
  'annotationSets.name',
  'annotationSets.register',
  'queues.id',
  'queues.url',
  'queues.name',
  'queues.tag',
  'queues.launchedCount',
  'queues.observedCount',
  'queues.totalBatches',
  'queues.batchSize',
  'queues.requeuesCompleted',
  'queues.emptyQueueTimestamp',
  'imageSets.imageCount',
] as const;

const projectQueryKey = (id: string) => ['surveys-project-details', id] as const;

const STORAGE_KEYS = {
  SORT_BY: 'surveysSortBy',
  SEARCH: 'surveysSearch',
  ROWS_PER_PAGE: 'surveysRowsPerPage',
};

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function Surveys() {
  const { client, showModal, modalToShow } = useContext(GlobalContext)!;
  const {
    myMembershipHook: myProjectsHook,
    isOrganizationAdmin,
    user,
  } = useContext(UserContext)!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const [selectedProject, setSelectedProject] = useState<
    Schema['Project']['type'] | null
  >(null);
  const [selectedAnnotationSet, setSelectedAnnotationSet] = useState<
    Schema['AnnotationSet']['type'] | null
  >(null);

  // Initialize search from localStorage or use default
  const getInitialSearch = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.SEARCH);
      if (stored !== null) {
        return stored;
      }
    }
    return '';
  };

  const [search, setSearch] = useState(getInitialSearch);
  const [page, setPage] = useState(1);

  // Initialize sortBy from localStorage or use default
  const getInitialSortBy = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.SORT_BY);
      if (stored) {
        return stored;
      }
    }
    return 'createdAt';
  };

  const [sortBy, setSortBy] = useState(getInitialSortBy);

  const getInitialRowsPerPage = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.ROWS_PER_PAGE);
      const parsed = stored ? parseInt(stored, 10) : NaN;
      if (ROWS_PER_PAGE_OPTIONS.includes(parsed)) {
        return parsed;
      }
    }
    return 10;
  };

  const [itemsPerPage, setItemsPerPage] = useState(getInitialRowsPerPage);

  const getIsMobile = () =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false;

  const [isMobile, setIsMobile] = useState(getIsMobile);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsMobile(getIsMobile());
    };

    handleResize();

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Persist sortBy to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SORT_BY, sortBy);
    }
  }, [sortBy]);

  // Persist search to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SEARCH, search);
    }
  }, [search]);

  // Persist rows per page to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ROWS_PER_PAGE, String(itemsPerPage));
    }
  }, [itemsPerPage]);

  const adminProjectIds = useMemo(
    () =>
      myProjectsHook.data
        ?.filter((project) => project.isAdmin)
        .map((project) => project.projectId) ?? [],
    [myProjectsHook.data]
  );

  // Membership records are updated by backend Lambdas (updateProjectMemberships)
  // whenever server-side project state changes (status, queues, etc.). When those
  // change, invalidate cached project details so the UI picks up the fresh state —
  // matching the original "refetch on every membership tick" behaviour.
  const membershipSignature = useMemo(
    () =>
      myProjectsHook.data
        ?.map((m) => `${m.projectId}:${m.updatedAt}`)
        .sort()
        .join('|') ?? '',
    [myProjectsHook.data]
  );
  useEffect(() => {
    if (!membershipSignature) return;
    queryClient.invalidateQueries({ queryKey: ['surveys-project-details'] });
  }, [membershipSignature, queryClient]);

  const projectQueries = useQueries({
    queries: adminProjectIds.map((id) => ({
      queryKey: projectQueryKey(id),
      queryFn: async () => {
        const { data } = await client.models.Project.get(
          { id },
          { selectionSet: PROJECT_SELECTION_SET as unknown as string[] }
        );
        return data;
      },
      // Poll every 60s while a project is uploading so other viewers see the uploader's heartbeat
      refetchInterval: (query: { state: { data?: Schema['Project']['type'] | null } }) =>
        query.state.data?.status === 'uploading' ? 60000 : false,
    })),
  });

  const projects = useMemo(
    () =>
      projectQueries
        .map((q) => q.data)
        .filter((p): p is Schema['Project']['type'] => p != null),
    [projectQueries]
  );

  // Helper to optimistically update a single project in the React Query cache.
  const updateProjectInCache = (
    projectId: string,
    updater: (
      prev: Schema['Project']['type'] | undefined
    ) => Schema['Project']['type'] | undefined
  ) => {
    queryClient.setQueryData(projectQueryKey(projectId), updater);
  };

  async function deleteAnnotationSet(
    projectId: string,
    annotationSetId: string
  ) {
    const project = projects.find((p) => p.id === projectId);
    const annotationSet = project?.annotationSets.find(
      (set: { id: string }) => set.id === annotationSetId
    );
    const annotationSetName = annotationSet?.name || 'Unknown';
    const projectName = project?.name || 'Unknown';

    await client.models.AnnotationSet.delete({ id: annotationSetId });

    await logAdminAction(
      client,
      user.userId,
      `Deleted annotation set "${annotationSetName}" from project "${projectName}"`,
      projectId,
      project?.organizationId || ''
    );

    updateProjectInCache(projectId, (prev) =>
      prev
        ? {
            ...prev,
            annotationSets: prev.annotationSets.filter(
              (set: { id: string }) => set.id !== annotationSetId
            ),
          }
        : prev
    );
  }

  async function handleCancelJob() {
    const previousStatus = selectedProject!.status;
    updateProjectInCache(selectedProject!.id, (prev) =>
      prev ? { ...prev, status: 'updating' } : prev
    );

    try {
      // cancel registration job if it exists
      const annotationSet = selectedProject?.annotationSets.find(
        (set: { register?: boolean | null }) => set.register
      );

      if (annotationSet) {
        await client.models.AnnotationSet.update({
          id: annotationSet.id,
          register: false,
        });
        await logAdminAction(
          client,
          user.userId,
          `Cancelled registration job for annotation set "${annotationSet.name}" in project "${selectedProject!.name}"`,
          selectedProject!.id,
          selectedProject!.organizationId
        );
        return;
      }

      const job = selectedProject?.queues[0];

      if (!job?.url) {
        alert('An unknown error occurred. Please try again later.');
        return;
      }

      await client.mutations.deleteQueueMutation({ queueId: job.id });
      await logAdminAction(
        client,
        user.userId,
        `Cancelled queue job "${job.tag || job.name || 'Unknown'}" for project "${selectedProject!.name}"`,
        selectedProject!.id,
        selectedProject!.organizationId
      );
    } catch (error) {
      updateProjectInCache(selectedProject!.id, (prev) =>
        prev ? { ...prev, status: previousStatus } : prev
      );
      alert('An unknown error occurred. Please try again later.');
      console.error(error);
    } finally {
      await client.mutations.updateProjectMemberships({
        projectId: selectedProject!.id,
      });
    }
  }

  const filteredProjects = projects.filter((project) => {
    const searchLower = search.toLowerCase();
    const matchesStatus =
      project.status !== 'deleted' && project.status !== 'hidden';
    const matchesOrganization =
      !currentOrg?.id || project.organizationId === currentOrg.id;
    const matchesAnnotationSet = project.annotationSets.some((set: { name: string }) =>
      set.name.toLowerCase().includes(searchLower)
    );
    const matchesSearch =
      searchLower === '' ||
      project.name.toLowerCase().includes(searchLower) ||
      project.organization.name.toLowerCase().includes(searchLower) ||
      matchesAnnotationSet;

    return matchesStatus && matchesOrganization && matchesSearch;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (sortBy === 'createdAt') {
      return new Date(b.createdAt ?? '').getTime() - new Date(a.createdAt ?? '').getTime();
    }
    if (sortBy === 'createdAt-reverse') {
      return new Date(a.createdAt ?? '').getTime() - new Date(b.createdAt ?? '').getTime();
    }
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'name-reverse') {
      return b.name.localeCompare(a.name);
    }
    if (sortBy === 'activeJobs') {
      const hasJobA = a.queues.length > 0 || a.annotationSets.some((set: { register?: boolean | null }) => set.register);
      const hasJobB = b.queues.length > 0 || b.annotationSets.some((set: { register?: boolean | null }) => set.register);
      if (hasJobA !== hasJobB) return hasJobA ? -1 : 1;
      return new Date(b.createdAt ?? '').getTime() - new Date(a.createdAt ?? '').getTime();
    }
    return 0;
  });

  const emptyMessage = 'You are not an admin of any surveys.';

  if (projects.length === 0 && !isOrganizationAdmin) {
    return (
      <Page>
        <PageHeader title='Your Surveys' />
        <ContentArea>
          <div>You are not authorized to access this page.</div>
        </ContentArea>
      </Page>
    );
  }

  const totalPages = Math.max(1, Math.ceil(sortedProjects.length / itemsPerPage));
  const pageClamped = Math.min(Math.max(1, page), totalPages);
  const pagedProjects = sortedProjects.slice(
    (pageClamped - 1) * itemsPerPage,
    pageClamped * itemsPerPage
  );

  const statusDisplay = (status: string | null | undefined) => {
    const s = (status || 'active').toLowerCase();
    if (s === 'active')
      return <span className='ss-status ss-status--active'>Active</span>;
    if (s === 'launched')
      return <span className='ss-status ss-status--launched'>Launched</span>;
    if (s === 'complete' || s === 'completed')
      return <span className='ss-status ss-status--complete'>Complete</span>;
    if (s === 'draft')
      return <span className='ss-status ss-status--draft'>Draft</span>;
    if (s === 'launching')
      return <span className='ss-status ss-status--launching'>Launching</span>;
    if (s === 'uploading')
      return <span className='ss-status ss-status--uploading'>Uploading</span>;
    if (s.includes('processing'))
      return <span className='ss-status ss-status--processing'>Processing</span>;
    if (s === 'updating')
      return <span className='ss-status ss-status--updating'>Updating</span>;
    if (s === 'deleting')
      return <span className='ss-status ss-status--danger'>Deleting</span>;
    return <span className='ss-status ss-status--draft'>{status}</span>;
  };

  const progressCell = (project: Schema['Project']['type']) => {
    const s = (project.status || '').toLowerCase();
    const busyMessage =
      s === 'launching'
        ? 'Launching — preparing images…'
        : s.includes('processing')
        ? 'Processing images…'
        : s === 'updating'
        ? 'Updating…'
        : s === 'uploading'
        ? 'Uploading…'
        : s === 'deleting'
        ? 'Deleting…'
        : null;
    if (busyMessage) {
      return (
        <div
          className='d-flex align-items-center gap-2'
          style={{
            minWidth: 180,
            fontSize: 12,
            color: 'var(--ss-text-dim)',
          }}
        >
          <Spinner animation='border' size='sm' />
          <span>{busyMessage}</span>
        </div>
      );
    }
    const queue = project.queues?.[0];
    if (!queue?.url) {
      return <span style={{ color: 'var(--ss-text-dim)' }}>—</span>;
    }
    return (
      <div className='ss-job-progress' style={{ minWidth: 180 }}>
        <QueueProgress queue={queue} />
      </div>
    );
  };

  return (
    <>
      <Page>
        <PageHeader
          title='Surveys'
          actions={
            isOrganizationAdmin && (
              <Button variant='primary' onClick={() => navigate('/surveys/new')}>
                + New Survey
              </Button>
            )
          }
        />
        <Toolbar>
          <Form.Control
            type='text'
            style={{
              minWidth: 0,
              maxWidth: isMobile ? '100%' : '260px',
              flex: isMobile ? '1 1 100%' : '0 1 auto',
            }}
            placeholder='Search surveys…'
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Form.Select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            style={{
              minWidth: 0,
              maxWidth: isMobile ? '100%' : '200px',
              flex: isMobile ? '1 1 100%' : '0 1 auto',
            }}
          >
            <option value='createdAt'>Newest first</option>
            <option value='createdAt-reverse'>Oldest first</option>
            <option value='name'>Name (A-Z)</option>
            <option value='name-reverse'>Name (Z-A)</option>
            <option value='activeJobs'>Active jobs first</option>
          </Form.Select>
          <Spacer />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: 'var(--ss-text-dim)',
            }}
          >
            <span>Rows</span>
            <Form.Select
              size='sm'
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(parseInt(e.target.value, 10));
                setPage(1);
              }}
              style={{ width: 'auto', padding: '2px 24px 2px 8px' }}
            >
              {ROWS_PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Form.Select>
            <span>
              Page {pageClamped} of {totalPages}
            </span>
            <Button
              size='sm'
              variant='secondary'
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageClamped === 1}
              style={{ padding: '2px 10px' }}
            >
              ‹
            </Button>
            <Button
              size='sm'
              variant='secondary'
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageClamped === totalPages}
              style={{ padding: '2px 10px' }}
            >
              ›
            </Button>
          </div>
        </Toolbar>
        <ContentArea style={{ paddingTop: 12 }}>
          <div className='ss-card' style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className='ss-data-table'>
                <thead>
                  <tr>
                    <th>Survey</th>
                    <th>Images</th>
                    <th>Ann. Sets</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedProjects.map((project) => {
                    const disabled =
                      project.status === 'uploading' ||
                      project.status?.includes('processing') ||
                      project.status === 'launching' ||
                      project.status === 'updating' ||
                      project.status === 'deleting';
                    const hasActiveJob =
                      (project.queues?.length ?? 0) > 0 ||
                      project.annotationSets.some(
                        (set: { register?: boolean | null }) => set.register
                      );
                    const imageCount =
                      project.imageSets?.[0]?.imageCount ?? 0;
                    const setCount = project.annotationSets.length;
                    return (
                      <tr key={project.id}>
                        <td>
                          <a
                            className='ss-row-link'
                            onClick={() =>
                              navigate(`/surveys/${project.id}/detail`)
                            }
                          >
                            {project.name}
                          </a>
                        </td>
                        <td>
                          <span className='ss-pill'>{imageCount}</span>
                        </td>
                        <td>
                          <span className='ss-pill'>{setCount}</span>
                        </td>
                        <td>
                          {(() => {
                            const s = (project.status || '').toLowerCase();
                            const isTransient =
                              s === 'launching' ||
                              s.includes('processing') ||
                              s === 'updating' ||
                              s === 'uploading' ||
                              s === 'deleting';
                            if (isTransient) return statusDisplay(project.status);
                            if (hasActiveJob) return statusDisplay('launched');
                            return statusDisplay(project.status);
                          })()}
                        </td>
                        <td>{progressCell(project)}</td>
                        <td>
                          <div className='ss-row-actions'>
                            {hasActiveJob ? (
                              <>
                                <Button
                                  size='sm'
                                  variant='primary'
                                  style={{ width: 90 }}
                                  onClick={() =>
                                    navigate(`/surveys/${project.id}/detail`)
                                  }
                                >
                                  Open
                                </Button>
                                <Button
                                  size='sm'
                                  variant='warning'
                                  style={{ width: 90 }}
                                  onClick={() => navigate('/jobs')}
                                >
                                  Take to Jobs
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size='sm'
                                  variant='primary'
                                  style={{ width: 90 }}
                                  onClick={() =>
                                    navigate(`/surveys/${project.id}/detail`)
                                  }
                                >
                                  Open
                                </Button>
                                <Button
                                  size='sm'
                                  variant='secondary'
                                  style={{ width: 90 }}
                                  onClick={() =>
                                    navigate(`/surveys/${project.id}/settings`)
                                  }
                                  disabled={
                                    process.env.NODE_ENV !== 'development' &&
                                    disabled
                                  }
                                >
                                  Settings
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pagedProjects.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          textAlign: 'center',
                          color: 'var(--ss-text-dim)',
                          padding: '24px',
                        }}
                      >
                        {emptyMessage}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </ContentArea>
      </Page>
      <ConfirmationModal
        show={modalToShow === 'deleteAnnotationSet'}
        onClose={() => {
          showModal(null);
          setSelectedProject(null);
          setSelectedAnnotationSet(null);
        }}
        onConfirm={() =>
          deleteAnnotationSet(selectedProject!.id, selectedAnnotationSet!.id)
        }
        title='Delete Annotation Set'
        body={
          <p className='mb-0'>
            Are you sure you want to delete {selectedAnnotationSet?.name}?
            <br />
            This action cannot be undone.
          </p>
        }
      />
      <ConfirmationModal
        show={modalToShow === 'deleteJob'}
        title='Cancel Associated Job'
        body={
          <p className='mb-0'>
            Are you sure you want to cancel the job associated with{' '}
            {selectedProject?.name}?
            <br />
            You can re-launch the job later.
          </p>
        }
        onConfirm={() => handleCancelJob()}
        onClose={() => {
          showModal(null);
          setSelectedProject(null);
        }}
      />
      {selectedProject && selectedAnnotationSet && (
        <AnnotationSetResults
          show={modalToShow === 'annotationSetResults'}
          onClose={() => {
            showModal(null);
            setSelectedProject(null);
            setSelectedAnnotationSet(null);
          }}
          annotationSet={selectedAnnotationSet}
          surveyId={selectedProject.id}
        />
      )}
      {selectedAnnotationSet && (
        <AnnotationCountModal
          setId={selectedAnnotationSet.id}
          show={modalToShow === 'annotationCount'}
          handleClose={() => {
            showModal(null);
            setSelectedAnnotationSet(null);
          }}
        />
      )}
      {selectedAnnotationSet && selectedProject && (
        <EditAnnotationSetModal
          show={modalToShow === 'editAnnotationSet'}
          handleClose={() => {
            showModal(null);
            setSelectedProject(null);
            setSelectedAnnotationSet(null);
          }}
          project={selectedProject}
          categories={selectedProject.categories}
          annotationSet={selectedAnnotationSet}
          setAnnotationSet={(annotationSet) => {
            if (!selectedProject) return;
            updateProjectInCache(selectedProject.id, (prev) =>
              prev
                ? {
                    ...prev,
                    annotationSets: prev.annotationSets.map((set: { id: string }) =>
                      set.id === annotationSet.id ? annotationSet : set
                    ),
                  }
                : prev
            );
          }}
          setEditSurveyTab={() => {}}
        />
      )}
      {selectedProject && (
        <AddAnnotationSetModal
          show={modalToShow === 'addAnnotationSet'}
          onClose={() => {
            showModal(null);
            setSelectedProject(null);
          }}
          project={selectedProject}
          allProjects={projects}
          addAnnotationSet={(annotationSet) => {
            if (!selectedProject) return;
            updateProjectInCache(selectedProject.id, (prev) =>
              prev
                ? {
                    ...prev,
                    annotationSets: [
                      ...prev.annotationSets,
                      {
                        id: annotationSet.id,
                        name: annotationSet.name,
                      } as (typeof prev.annotationSets)[number],
                    ],
                  }
                : prev
            );
            // Log asynchronously without blocking
            logAdminAction(
              client,
              user.userId,
              `Added annotation set "${annotationSet.name}" to project "${selectedProject?.name}"`,
              selectedProject?.id || '',
              selectedProject?.organizationId || ''
            ).catch(console.error);
          }}
        />
      )}
      {selectedProject && selectedAnnotationSet && (
        <LaunchAnnotationSetModal
          show={modalToShow === 'launchAnnotationSet'}
          annotationSet={selectedAnnotationSet}
          project={selectedProject}
          onOptimisticStatus={(projectId, status) => {
            updateProjectInCache(projectId, (prev) =>
              prev ? { ...prev, status } : prev
            );
            setSelectedProject((prev) =>
              prev && prev.id === projectId ? { ...prev, status } : prev
            );
          }}
        />
      )}
    </>
  );
}
