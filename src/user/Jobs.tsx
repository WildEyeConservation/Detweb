import { Card } from 'react-bootstrap';
import { useContext, useEffect, useState } from 'react';
import { UserContext, GlobalContext } from '../Context';
import { Schema } from '../amplify/client-schema';
import { Spinner, Button, ProgressBar, Form } from 'react-bootstrap';
import MyTable from '../Table';
import { useNavigate } from 'react-router-dom';
import { type GetQueueAttributesCommandInput } from '@aws-sdk/client-sqs';
import { GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import ConfirmationModal from '../ConfirmationModal';
import ProjectProgress from './ProjectProgress';
import { Minimize2, Maximize2 } from 'lucide-react';

const STORAGE_KEYS = {
  COMPACT_MODE: 'jobsCompactMode',
  SORT_BY: 'jobsSortBy',
  ORGANIZATION_FILTER: 'jobsOrganizationFilter',
};

type Project = {
  id: string;
  name: string;
  organization: {
    id: string;
    name: string;
  };
  annotationSets: {
    id: string;
    register: boolean;
  }[];
  createdAt: string;
  queues: Schema['Queue']['type'][];
};

export default function Jobs() {
  const {
    myMembershipHook: userProjectMembershipHook,
    myOrganizationHook,
    user,
    getSqsClient,
  } = useContext(UserContext)!;
  const { client, showModal, modalToShow } = useContext(GlobalContext)!;
  const navigate = useNavigate();

  const [displayProjects, setDisplayProjects] = useState<Project[]>([]);
  const [jobsRemaining, setJobsRemaining] = useState<Record<string, string>>(
    {}
  );
  const [registrationJobs, setRegistrationJobs] = useState<
    {
      id: string;
      projectId: string;
      register: boolean;
    }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [takingJob, setTakingJob] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<
    Schema['Queue']['type'] | null
  >(null);
  const [deletingJob, setDeletingJob] = useState(false);
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
    let interval: ReturnType<typeof setInterval>;
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
              'organization.id',
              'organization.name',
              'annotationSets.id',
              'annotationSets.register',
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
            project !== null &&
            (project.queues.length > 0 ||
              project.annotationSets.some((set) => set.register))
        )
        .map((project) => ({
          ...project,
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

      async function getJobsRemaining() {
        if (cancelled) return;

        const queueUrls = validProjects.flatMap((project) =>
          project.queues.map((queue) => queue.url || '')
        );

        const jobsRemaining = (
          await Promise.all(
            queueUrls.map(async (queueUrl) => {
              const params: GetQueueAttributesCommandInput = {
                QueueUrl: queueUrl,
                AttributeNames: ['ApproximateNumberOfMessages'],
              };
              const sqsClient = await getSqsClient();
              const result = await sqsClient.send(
                new GetQueueAttributesCommand(params)
              );
              return {
                [queueUrl]:
                  result.Attributes?.ApproximateNumberOfMessages || 'Unknown',
              };
            })
          )
        ).reduce((acc, curr) => ({ ...acc, ...curr }), {});

        if (cancelled) return;

        setJobsRemaining(jobsRemaining);

        // check if registration jobs are available
        const registrationJobs = validProjects.flatMap((project) =>
          project.annotationSets.map((set) => {
            return {
              id: set.id,
              projectId: project.id,
              register: set.register || false,
            };
          })
        );

        setRegistrationJobs(registrationJobs.filter((job) => job.register));

        const filteredProjects = validProjects.filter(
          (project) =>
            project.queues.length > 0 ||
            project.annotationSets.some((set) => set.register)
        );
        setDisplayProjects(filteredProjects);
      }

      // Kick off the first polling call immediately
      getJobsRemaining();

      // Immediately set up the interval (if still mounted)
      if (!cancelled) {
        interval = setInterval(getJobsRemaining, 10000);
      }
    }

    fetchProjectsAndJobs();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userProjectMembershipHook.data]);

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

  async function handleTakeJob(job: { queueId: string; projectId: string }) {
    setTakingJob(true);

    const currentMembership = userProjectMembershipHook.data.filter(
      (membership) => membership.projectId === job.projectId
    )[0];

    if (currentMembership) {
      userProjectMembershipHook.update(
        { id: currentMembership.id, queueId: job.queueId },
        {
          onSuccess: () => {
            navigate(`/surveys/${job.projectId}/annotate`);
          },
          onError: (error) => {
            alert('Failed to take job');
            console.error(error);
          },
        }
      );
    } else {
      userProjectMembershipHook.create(
        { userId: user.userId, projectId: job.projectId, queueId: job.queueId },
        {
          onSuccess: () => {
            navigate(`/surveys/${job.projectId}/annotate`);
          },
          onError: (error) => {
            alert('Failed to take job');
            console.error(error);
          },
        }
      );
    }

    setTakingJob(false);
  }

  const tableData = [
    ...sortedProjects.flatMap((project) =>
      project.queues
        .map((queue) => {
          const numJobsRemaining = Number(jobsRemaining[queue.url || ''] || 0);
          const batchesRemaining = Math.ceil(
            numJobsRemaining / (queue.batchSize || 0)
          );

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
          const titleSize = compactMode ? 'h6' : 'h5';
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
                      <h6 className='mb-0'>{queue.tag || project.name}</h6>
                    ) : (
                      <h5 className='mb-0'>{queue.tag || project.name}</h5>
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
                      Type: {queue.name}
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
                    projectId={project.id}
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
                      takingJob || deletingJob || numJobsRemaining === 0 || scanningProjects.has(project.id)
                    }
                    onClick={() =>
                      handleTakeJob({
                        queueId: queue.id,
                        projectId: project.id,
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
    ...registrationJobs
      .filter((job) => {
        const project = displayProjects.find((p) => p.id === job.projectId);
        if (!project) return false;

        const searchLower = search.toLowerCase();
        const matchesOrganization =
          !organizationFilter || project.organization.id === organizationFilter;
        const matchesSearch =
          searchLower === '' ||
          project.name.toLowerCase().includes(searchLower) ||
          project.organization.name.toLowerCase().includes(searchLower) ||
          'registration'.includes(searchLower);

        return matchesOrganization && matchesSearch;
      })
      .map((job) => {
        const project = displayProjects.find(
          (project) => project.id === job.projectId
        );

        if (!project) {
          return <></>;
        }

        const paddingClass = compactMode ? 'p-1' : 'p-2';
        const gapClass = compactMode ? 'gap-1' : 'gap-2';
        const rowGapClass = compactMode ? 'gap-1' : 'gap-3';
        const titleSize = compactMode ? 'h6' : 'h5';
        const typeFontSize = compactMode ? '12px' : '14px';

        return {
          id: job.id,
          rowData: [
            <div
              className={`d-flex justify-content-between align-items-center ${paddingClass}`}
              key={job.id}
            >
              <div className={`d-flex flex-row ${rowGapClass} align-items-center`}>
                <div>
                  {compactMode ? (
                    <h6 className='mb-0'>{project.name}</h6>
                  ) : (
                    <h5 className='mb-0'>{project.name}</h5>
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
                    Type: Registration
                  </p>
                </div>
              </div>
              <Button
                size={compactMode ? 'sm' : undefined}
                className='ms-1'
                variant='primary'
                onClick={() =>
                  navigate(`/surveys/${project.id}/set/${job.id}/registration`)
                }
              >
                Take Job
              </Button>
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
