import { Card } from 'react-bootstrap';
import { useEffect, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useQueueMessageCounts } from '../data/queueCounts';
import { fetchAllPaginatedResults } from '../utils';
import { useMyMemberships, useMyOrganizations } from '../data/memberships';
import { client } from '../stores/appClient';
import { Schema } from '../amplify/client-schema';
import { Spinner, Button, Form } from 'react-bootstrap';
import MyTable from '../Table';
import { useNavigate } from 'react-router-dom';
import ProjectProgress from './ProjectProgress';
import IndividualIdProgress from '../individual-id/IndividualIdProgress';
import { Minimize2, Maximize2 } from 'lucide-react';

const STORAGE_KEYS = {
  COMPACT_MODE: 'jobsCompactMode',
  SORT_BY: 'jobsSortBy',
  ORGANIZATION_FILTER: 'jobsOrganizationFilter',
};

type Project = {
  id: string;
  name: string;
  status: string | null;
  organization: {
    id: string;
    name: string;
  };
  annotationSets: {
    id: string;
  }[];
  createdAt: string;
  queues: Schema['Queue']['type'][];
  // First queue before the hidden-queue filter; drives the progress bar.
  progressQueue?: Schema['Queue']['type'];
};

export default function Jobs() {
  const userProjectMembershipHook = useMyMemberships();
  const myOrganizationHook = useMyOrganizations();
  const navigate = useNavigate();

  const [displayProjects, setDisplayProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [takingJob, setTakingJob] = useState(false);
  const [deletingJob] = useState(false);
  const [scanningProjects, setScanningProjects] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

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

  // Initialize organizationFilter from localStorage or use default
  const getInitialOrganizationFilter = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.ORGANIZATION_FILTER);
      if (stored !== null) {
        return stored;
      }
    }
    return '';
  };

  const [sortBy, setSortBy] = useState(getInitialSortBy);
  const [organizationFilter, setOrganizationFilter] = useState(
    getInitialOrganizationFilter
  );

  // Initialize compactMode from localStorage or use default
  const getInitialCompactMode = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.COMPACT_MODE);
      if (stored !== null) {
        return stored === 'true';
      }
    }
    return false;
  };

  const [compactMode, setCompactMode] = useState(getInitialCompactMode);
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

  // Persist compactMode to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.COMPACT_MODE, String(compactMode));
    }
  }, [compactMode]);

  // Persist sortBy to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SORT_BY, sortBy);
    }
  }, [sortBy]);

  // Persist organizationFilter to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        STORAGE_KEYS.ORGANIZATION_FILTER,
        organizationFilter
      );
    }
  }, [organizationFilter]);

  useEffect(() => {
    let cancelled = false; // cancellation flag

    async function fetchProjectsAndJobs() {
      if (!userProjectMembershipHook.data) return;
      setIsLoading(true);

      const projectPromises = userProjectMembershipHook.data.map((membership) =>
        client.models.Project.get(
          { id: membership.projectId },
          {
            selectionSet: [
              'id',
              'name',
              'status',
              'organization.id',
              'organization.name',
              'annotationSets.id',
              'createdAt',
              'queues.*',
            ],
          }
        )
      );

      const projectResults = await Promise.all(projectPromises);
      
      const validProjects = projectResults
        .map((result) => (result as { data: Project | null }).data)
        .filter(
          (project): project is Project =>
            project !== null && project.status !== 'launching'
        )
        .map((project) => ({
          ...project,
          progressQueue: project.queues[0],
          queues: project.queues.filter(
            (queue) =>
              myOrganizationHook.data?.find(
                (membership) =>
                  membership.organizationId === project.organization.id
              )?.isAdmin || !queue.hidden
          ),
        }));

      if (cancelled) return; // stop if unmounted

      setDisplayProjects(validProjects);
      setIsLoading(false);

    }

    void fetchProjectsAndJobs().catch((error) => {
      if (cancelled) return;
      console.error('Failed to load jobs', error);
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [userProjectMembershipHook.data, myOrganizationHook.data]);

  const iidProjects = displayProjects.filter((project) => !organizationFilter || project.organization.id === organizationFilter);
  const iidQueries = useQueries({ queries: iidProjects.map((project) => ({
    queryKey: ['available-individual-id-jobs', project.id],
    queryFn: async () => fetchAllPaginatedResults(
      client.models.IndividualIdJob.individualIdJobsByProjectId,
      { projectId: project.id, selectionSet: ['id', 'name', 'status', 'totalTransects', 'remainingTransects'] as const }
    ),
    staleTime: 10_000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  })) });
  const individualIdJobs = iidQueries.flatMap((query, index) => {
    const project = iidProjects[index];
    return (query.data ?? []).filter((job) => job.status === 'active').map((job) => ({
      jobId: job.id, projectId: project.id, projectName: project.name,
      organizationId: project.organization.id, organizationName: project.organization.name,
      name: job.name,
      stats: { status: job.status, total: job.totalTransects ?? 0, remaining: job.remainingTransects ?? 0 },
    }));
  });

  const organizationOptions = Array.from(
    new Map(
      displayProjects.map((project) => [
        project.organization.id,
        project.organization.name,
      ])
    ).entries()
  ).map(([id, name]) => ({ id, name }));

  const filteredProjects = displayProjects.filter((project) => {
    const searchLower = search.toLowerCase();
    const matchesOrganization =
      !organizationFilter || project.organization.id === organizationFilter;
    const matchesQueue = project.queues.some((queue) =>
      (queue.tag || '').toLowerCase().includes(searchLower)
    );
    const matchesSearch =
      searchLower === '' ||
      project.name.toLowerCase().includes(searchLower) ||
      project.organization.name.toLowerCase().includes(searchLower) ||
      matchesQueue;

    return matchesOrganization && matchesSearch;
  });

  const jobsRemaining = useQueueMessageCounts(filteredProjects.flatMap((project) => [
    ...project.queues.map((queue) => queue.url), project.progressQueue?.url,
  ]));

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (sortBy === 'createdAt') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === 'createdAt-reverse') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'name-reverse') {
      return b.name.localeCompare(a.name);
    }
    return 0;
  });

  async function handleTakeJob(job: { queueId: string; projectId: string; tag?: string | null }) {
    setTakingJob(true);

    if (job.tag === 'qc-review') {
      navigate(`/surveys/${job.projectId}/qc-review/${job.queueId}`);
      setTakingJob(false);
      return;
    }

    if (job.tag === 'info-tags') {
      navigate(`/surveys/${job.projectId}/info-tags/${job.queueId}`);
      setTakingJob(false);
      return;
    }

    if (job.tag === 'homography') {
      navigate(`/surveys/${job.projectId}/homography/${job.queueId}`);
      setTakingJob(false);
      return;
    }

    const currentMembership = userProjectMembershipHook.data.find(
      (membership) => membership.projectId === job.projectId
    );

    if (!currentMembership) {
      console.warn(`handleTakeJob: no membership found for project ${job.projectId}`);
      setTakingJob(false);
      return;
    }

    userProjectMembershipHook.update({
      id: currentMembership.id,
      queueId: job.queueId,
    });
    navigate(`/surveys/${job.projectId}/annotate`);

    setTakingJob(false);
  }

  // Individual ID is transect-locked, not SQS. The claim lambda atomically
  // assigns one available transect to this user (or re-grants the one they
  // already hold). The harness reads the claimed ids from navigation state.
  async function handleTakeIndividualIdJob(job: {
    jobId: string;
    projectId: string;
  }) {
    setTakingJob(true);
    try {
      const res: any = await (client as any).mutations.claimIndividualIdTransect(
        { jobId: job.jobId },
        { retry: false }
      );
      const result =
        typeof res?.data === 'string' ? JSON.parse(res.data) : res?.data;
      if (!result || result.none || !result.transectId) {
        alert(
          result?.message ||
            'No transects are available right now. Please try again later.'
        );
        setTakingJob(false);
        return;
      }
      navigate(`/surveys/${job.projectId}/individual-id`, {
        state: {
          transectRowId: result.transectRowId,
          transectId: result.transectId,
          categoryId: result.categoryId,
          annotationSetId: result.annotationSetId,
          // Doubles as the Workflow Run id when recording pair completions.
          jobId: result.jobId ?? job.jobId,
        },
      });
    } catch (e) {
      console.error('Failed to claim Individual ID transect', e);
      alert('Failed to take job. Please try again.');
    } finally {
      setTakingJob(false);
    }
  }

  const tableData = [
    ...sortedProjects.flatMap((project) =>
      project.queues
        .map((queue) => {
          const numJobsRemaining = jobsRemaining[queue.url || ''];

          if (
            numJobsRemaining === 0 &&
            !userProjectMembershipHook.data?.find(
              (membership) => membership.projectId === project.id
            )?.isAdmin
          ) {
            return null;
          }

          const paddingClass = compactMode ? 'p-1' : 'p-2';
          const gapClass = compactMode ? 'gap-1' : 'gap-2';
          const rowGapClass = compactMode ? 'gap-1' : 'gap-3';
          const badgeFontSize = compactMode ? '11px' : '14px';
          const typeFontSize = compactMode ? '12px' : '14px';

          return {
            id: queue.id,
            rowData: [
              <div
                className={`d-flex justify-content-between align-items-center ${paddingClass}`}
                key={queue.id}
              >
                <div className={`d-flex flex-row ${rowGapClass} align-items-center`}>
                  <div>
                    {compactMode ? (
                      <h6 className='mb-0'>
                        {queue.tag === 'qc-review' || queue.tag === 'info-tags' || queue.tag === 'homography' ? queue.name : (queue.tag || project.name)}
                      </h6>
                    ) : (
                      <h5 className='mb-0'>
                        {queue.tag === 'qc-review' || queue.tag === 'info-tags' || queue.tag === 'homography' ? queue.name : (queue.tag || project.name)}
                      </h5>
                    )}
                    {!compactMode && (
                      <i style={{ fontSize: '14px', display: 'block' }}>
                        {project.organization.name}
                      </i>
                    )}
                    <p
                      style={{
                        fontSize: typeFontSize,
                        display: 'block',
                        marginBottom: '0px',
                      }}
                    >
                      Type: {queue.tag === 'qc-review' ? 'Review' : queue.tag === 'info-tags' ? 'Info Tags' : queue.tag === 'homography' ? 'Homography' : queue.name}
                    </p>
                  </div>
                  {myOrganizationHook.data?.find(
                    (membership) =>
                      membership.organizationId === project.organization.id
                  )?.isAdmin &&
                    queue.hidden && (
                      <span
                        className='badge bg-secondary'
                        style={{ fontSize: badgeFontSize }}
                      >
                        Hidden
                      </span>
                    )}
                </div>
                <div
                  className={`d-flex flex-row ${gapClass} align-items-center`}
                  style={{ maxWidth: '600px', width: '100%' }}
                >
                  <ProjectProgress
                    queue={project.progressQueue}
                    jobsRemaining={jobsRemaining[project.progressQueue?.url || '']}
                    onScanningChange={(isScanning) => {
                      setScanningProjects(prev => {
                        const next = new Set(prev);
                        isScanning ? next.add(project.id) : next.delete(project.id);
                        return next;
                      });
                    }}
                  />
                  <Button
                    size={compactMode ? 'sm' : undefined}
                    className='ms-1'
                    variant='primary'
                    disabled={
                      takingJob || deletingJob || numJobsRemaining === undefined || numJobsRemaining === 0 || scanningProjects.has(project.id)
                    }
                    onClick={() =>
                      handleTakeJob({
                        queueId: queue.id,
                        projectId: project.id,
                        tag: queue.tag,
                      })
                    }
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Take Job
                  </Button>
                </div>
              </div>,
            ],
          };
        })
        .filter((item) => item !== null)
    ),
    ...individualIdJobs
      .filter((job) => {
        const searchLower = search.toLowerCase();
        const matchesOrganization =
          !organizationFilter || job.organizationId === organizationFilter;
        const matchesSearch =
          searchLower === '' ||
          job.projectName.toLowerCase().includes(searchLower) ||
          job.organizationName.toLowerCase().includes(searchLower) ||
          job.name.toLowerCase().includes(searchLower) ||
          'individual id'.includes(searchLower);
        return matchesOrganization && matchesSearch;
      })
      .map((job) => {
        const paddingClass = compactMode ? 'p-1' : 'p-2';
        const gapClass = compactMode ? 'gap-1' : 'gap-2';
        const rowGapClass = compactMode ? 'gap-1' : 'gap-3';
        const typeFontSize = compactMode ? '12px' : '14px';

        return {
          id: job.jobId,
          rowData: [
            <div
              className={`d-flex justify-content-between align-items-center ${paddingClass}`}
              key={job.jobId}
            >
              <div className={`d-flex flex-row ${rowGapClass} align-items-center`}>
                <div>
                  {compactMode ? (
                    <h6 className='mb-0'>{job.name}</h6>
                  ) : (
                    <h5 className='mb-0'>{job.name}</h5>
                  )}
                  {!compactMode && (
                    <i style={{ fontSize: '14px', display: 'block' }}>
                      {job.organizationName}
                    </i>
                  )}
                  <p
                    style={{
                      fontSize: typeFontSize,
                      display: 'block',
                      marginBottom: '0px',
                    }}
                  >
                    Type: ChainLinker
                  </p>
                </div>
              </div>
              <div
                className={`d-flex flex-row ${gapClass} align-items-center`}
                style={{ maxWidth: '600px', width: '100%' }}
              >
                <div className='flex-grow-1'>
                  <IndividualIdProgress projectId={job.projectId} stats={job.stats} />
                </div>
                <Button
                  size={compactMode ? 'sm' : undefined}
                  className='ms-1'
                  variant='primary'
                  disabled={takingJob}
                  onClick={() =>
                    handleTakeIndividualIdJob({
                      jobId: job.jobId,
                      projectId: job.projectId,
                    })
                  }
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Take Job
                </Button>
              </div>
            </div>,
          ],
        };
      }),
  ];

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1555px',
        marginTop: '16px',
        marginBottom: '16px',
      }}
    >
      <Card>
        <Card.Header className='d-flex flex-column flex-lg-row align-items-lg-center gap-3'>
          <Card.Title className='mb-0 flex-shrink-0' style={{ whiteSpace: 'nowrap' }}>
            <h4 className='mb-0'>Jobs Available</h4>
          </Card.Title>
          <div className='d-flex flex-column flex-lg-row gap-2 w-100 w-lg-auto ms-lg-auto justify-content-lg-end align-items-lg-center'>
            <Form.Control
              className='w-100'
              type='text'
              style={{
                minWidth: 0,
                width: '100%',
                maxWidth: isMobile ? '100%' : '250px',
              }}
              placeholder='Search'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Form.Select
              className='w-100 w-lg-auto'
              value={organizationFilter}
              onChange={(e) => setOrganizationFilter(e.target.value)}
              style={{
                minWidth: 0,
                width: '100%',
                maxWidth: isMobile ? '100%' : '250px',
              }}
            >
              <option value=''>All organisations</option>
              {organizationOptions.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Form.Select>
            <Form.Select
              className='w-100 w-lg-auto'
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                minWidth: 0,
                width: '100%',
                maxWidth: isMobile ? '100%' : '250px',
              }}
            >
              <option value='createdAt'>Created (newest first)</option>
              <option value='createdAt-reverse'>Created (oldest first)</option>
              <option value='name'>Name (A-Z)</option>
              <option value='name-reverse'>Name (Z-A)</option>
            </Form.Select>
            {!isMobile && (
              <Button
                variant='info'
                onClick={() => setCompactMode(!compactMode)}
                title={compactMode ? 'Expand view' : 'Compact view'}
                style={{
                  minWidth: 'fit-content',
                  whiteSpace: 'nowrap',
                }}
              >
                {compactMode ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </Button>
            )}
          </div>
        </Card.Header>
        <Card.Body className='overflow-x-auto'>
          {isLoading ? (
            <Spinner />
          ) : (
            <MyTable
              tableData={tableData}
              pagination={true}
              itemsPerPage={5}
              emptyMessage='No jobs available'
            />
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
