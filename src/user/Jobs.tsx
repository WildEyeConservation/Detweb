import { useContext, useEffect, useState } from 'react';
import { UserContext, GlobalContext } from '../Context';
import { Schema } from '../amplify/client-schema';
import { Spinner, Button, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { type GetQueueAttributesCommandInput } from '@aws-sdk/client-sqs';
import { GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import ProjectProgress from './ProjectProgress';
import IndividualIdProgress from '../individual-id/IndividualIdProgress';
import { useOrg } from '../OrgContext';
import { Page, PageHeader, Toolbar, ContentArea, Spacer } from '../ss/PageShell';

const STORAGE_KEYS = {
  SORT_BY: 'jobsSortBy',
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
    register: boolean;
  }[];
  createdAt: string;
  queues: Schema['Queue']['type'][];
};

type JobRow =
  | {
      kind: 'queue';
      id: string;
      project: Project;
      queue: Schema['Queue']['type'];
      jobsRemaining: number;
      typeLabel: string;
      displayName: string;
      isAdmin: boolean;
    }
  | {
      kind: 'registration';
      id: string;
      project: Project;
      setId: string;
    }
  | {
      kind: 'individual-id';
      id: string;
      jobId: string;
      projectId: string;
      projectName: string;
      organizationId: string;
      organizationName: string;
      name: string;
    };

export default function Jobs() {
  const {
    myMembershipHook: userProjectMembershipHook,
    myOrganizationHook,
    getSqsClient,
  } = useContext(UserContext)!;
  const { client } = useContext(GlobalContext)!;
  const navigate = useNavigate();
  const { currentOrg } = useOrg();

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
  const [individualIdJobs, setIndividualIdJobs] = useState<
    {
      jobId: string;
      projectId: string;
      projectName: string;
      organizationId: string;
      organizationName: string;
      name: string;
    }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [takingJob, setTakingJob] = useState(false);
  const [deletingJob] = useState(false);
  const [scanningProjects, setScanningProjects] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const getInitialSortBy = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.SORT_BY);
      if (stored) return stored;
    }
    return 'createdAt';
  };

  const [sortBy, setSortBy] = useState(getInitialSortBy);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SORT_BY, sortBy);
    }
  }, [sortBy]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let cancelled = false;

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
            project.status !== 'launching' &&
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

      if (cancelled) return;

      setDisplayProjects(validProjects);
      setIsLoading(false);

      // Individual ID jobs live on their own table (no Queue, no register
      // flag) so they are scanned separately. Projects still `launching` are
      // excluded — the project only leaves `launching` once tiling + the
      // transect-update fanout finish, which is exactly when the job becomes
      // claimable.
      const iidScanProjects = projectResults
        .map((result) => (result as { data: Project | null }).data)
        .filter(
          (project): project is Project =>
            project !== null && project.status !== 'launching'
        );

      async function getIndividualIdJobs() {
        if (cancelled) return;
        const entries: {
          jobId: string;
          projectId: string;
          projectName: string;
          organizationId: string;
          organizationName: string;
          name: string;
        }[] = [];
        await Promise.all(
          iidScanProjects.map(async (project) => {
            try {
              const { data } = await (
                client.models as any
              ).IndividualIdJob.individualIdJobsByProjectId(
                { projectId: project.id },
                { selectionSet: ['id', 'name', 'status'] }
              );
              for (const job of data || []) {
                if (job.status === 'active') {
                  entries.push({
                    jobId: job.id,
                    projectId: project.id,
                    projectName: project.name,
                    organizationId: project.organization.id,
                    organizationName: project.organization.name,
                    name: job.name,
                  });
                }
              }
            } catch (e) {
              console.warn(
                'Failed to load Individual ID jobs',
                project.id,
                e
              );
            }
          })
        );
        if (cancelled) return;
        setIndividualIdJobs(entries);
      }

      getIndividualIdJobs();

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

        const registrationJobs = validProjects.flatMap((project) =>
          project.annotationSets.map((set) => ({
            id: set.id,
            projectId: project.id,
            register: set.register || false,
          }))
        );

        setRegistrationJobs(registrationJobs.filter((job) => job.register));

        getIndividualIdJobs();

        const filteredProjects = validProjects.filter(
          (project) =>
            project.queues.length > 0 ||
            project.annotationSets.some((set) => set.register)
        );
        setDisplayProjects(filteredProjects);
      }

      getJobsRemaining();

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

  const filteredProjects = displayProjects.filter((project) => {
    const searchLower = search.toLowerCase();
    const matchesOrganization =
      !!currentOrg?.id && project.organization.id === currentOrg.id;
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

  async function handleTakeJob(job: { queueId: string; projectId: string; tag?: string | null }) {
    setTakingJob(true);

    if (job.tag === 'qc-review') {
      navigate(`/surveys/${job.projectId}/qc-review/${job.queueId}`);
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

    userProjectMembershipHook.update({ id: currentMembership.id, queueId: job.queueId });
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
        },
      });
    } catch (e) {
      console.error('Failed to claim Individual ID transect', e);
      alert('Failed to take job. Please try again.');
    } finally {
      setTakingJob(false);
    }
  }

  const typeLabelFor = (queue: Schema['Queue']['type']): string => {
    if (queue.tag === 'qc-review') return 'Review';
    if (queue.tag === 'homography') return 'Homography';
    return queue.name || 'Annotation';
  };

  const rows: JobRow[] = [
    ...sortedProjects.flatMap((project) =>
      project.queues
        .map((queue): JobRow | null => {
          const numJobsRemaining = Number(jobsRemaining[queue.url || ''] || 0);
          const isAdmin = !!myOrganizationHook.data?.find(
            (membership) => membership.organizationId === project.organization.id
          )?.isAdmin;

          if (numJobsRemaining === 0 && !isAdmin) return null;

          const displayName =
            queue.tag === 'qc-review' || queue.tag === 'homography'
              ? queue.name
              : queue.tag || project.name;

          return {
            kind: 'queue',
            id: queue.id,
            project,
            queue,
            jobsRemaining: numJobsRemaining,
            typeLabel: typeLabelFor(queue),
            displayName,
            isAdmin,
          };
        })
        .filter((row): row is JobRow => row !== null)
    ),
    ...registrationJobs
      .filter((job) => {
        const project = displayProjects.find((p) => p.id === job.projectId);
        if (!project) return false;

        const searchLower = search.toLowerCase();
        const matchesOrganization =
          !!currentOrg?.id && project.organization.id === currentOrg.id;
        const matchesSearch =
          searchLower === '' ||
          project.name.toLowerCase().includes(searchLower) ||
          project.organization.name.toLowerCase().includes(searchLower) ||
          'registration'.includes(searchLower);

        return matchesOrganization && matchesSearch;
      })
      .map((job): JobRow | null => {
        const project = displayProjects.find((p) => p.id === job.projectId);
        if (!project) return null;
        return {
          kind: 'registration',
          id: job.id,
          project,
          setId: job.id,
        };
      })
      .filter((row): row is JobRow => row !== null),
    ...individualIdJobs
      .filter((job) => {
        const searchLower = search.toLowerCase();
        const matchesOrganization =
          !!currentOrg?.id && job.organizationId === currentOrg.id;
        const matchesSearch =
          searchLower === '' ||
          job.projectName.toLowerCase().includes(searchLower) ||
          job.organizationName.toLowerCase().includes(searchLower) ||
          job.name.toLowerCase().includes(searchLower) ||
          'individual id'.includes(searchLower);
        return matchesOrganization && matchesSearch;
      })
      .map(
        (job): JobRow => ({
          kind: 'individual-id',
          id: job.jobId,
          jobId: job.jobId,
          projectId: job.projectId,
          projectName: job.projectName,
          organizationId: job.organizationId,
          organizationName: job.organizationName,
          name: job.name,
        })
      ),
  ];

  const totalPages = Math.max(1, Math.ceil(rows.length / itemsPerPage));
  const pageClamped = Math.min(Math.max(1, page), totalPages);
  const pagedRows = rows.slice(
    (pageClamped - 1) * itemsPerPage,
    pageClamped * itemsPerPage
  );

  return (
    <Page>
      <PageHeader title='Jobs Available' />
      <Toolbar>
        <Form.Control
          type='text'
          style={{ minWidth: 0, maxWidth: 260, flex: '0 1 auto' }}
          placeholder='Search jobs…'
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Form.Select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ minWidth: 0, maxWidth: 220, flex: '0 1 auto' }}
        >
          <option value='createdAt'>Newest first</option>
          <option value='createdAt-reverse'>Oldest first</option>
          <option value='name'>Name (A-Z)</option>
          <option value='name-reverse'>Name (Z-A)</option>
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
          <span>
            Page {pageClamped} of {totalPages}
          </span>
          <Button
            size='sm'
            variant='secondary'
            disabled={pageClamped <= 1}
            onClick={() => setPage(pageClamped - 1)}
          >
            ‹
          </Button>
          <Button
            size='sm'
            variant='secondary'
            disabled={pageClamped >= totalPages}
            onClick={() => setPage(pageClamped + 1)}
          >
            ›
          </Button>
        </div>
      </Toolbar>
      <ContentArea style={{ paddingTop: 12 }}>
        {isLoading ? (
          <div
            className='ss-card'
            style={{
              padding: 40,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Spinner animation='border' />
          </div>
        ) : rows.length === 0 ? (
          <div
            className='ss-card'
            style={{
              padding: 48,
              textAlign: 'center',
              color: 'var(--ss-text-dim)',
              fontSize: 13,
            }}
          >
            No jobs available{currentOrg?.name ? <> for <em>{currentOrg.name}</em></> : ''}
          </div>
        ) : (
          <div className='ss-job-card-list'>
            {pagedRows.map((row) => {
              if (row.kind === 'registration') {
                const goToRegistration = () =>
                  navigate(
                    `/surveys/${row.project.id}/set/${row.setId}/registration`
                  );
                return (
                  <div key={`reg-${row.id}`} className='ss-job-card'>
                    <div className='ss-job-card__main'>
                      <div className='ss-job-card__header'>
                        <span
                          className='ss-job-card__title'
                          onClick={goToRegistration}
                        >
                          {row.project.name}
                        </span>
                        <span className='ss-status ss-status--info'>
                          Registration
                        </span>
                      </div>
                      <div className='ss-job-card__meta'>
                        {row.project.organization.name} · Ready to register
                      </div>
                    </div>
                    <div className='ss-job-card__action'>
                      <Button
                        size='sm'
                        variant='primary'
                        onClick={goToRegistration}
                      >
                        Take Job
                      </Button>
                    </div>
                  </div>
                );
              }

              if (row.kind === 'individual-id') {
                const takeJob = () =>
                  handleTakeIndividualIdJob({
                    jobId: row.jobId,
                    projectId: row.projectId,
                  });
                return (
                  <div key={`iid-${row.id}`} className='ss-job-card'>
                    <div className='ss-job-card__main'>
                      <div className='ss-job-card__header'>
                        <span
                          className='ss-job-card__title'
                          onClick={takeJob}
                        >
                          {row.name}
                        </span>
                        <span className='ss-status ss-status--info'>
                          Individual ID
                        </span>
                      </div>
                      <div className='ss-job-card__meta'>
                        {row.organizationName}
                      </div>
                      <div className='ss-job-progress'>
                        <IndividualIdProgress projectId={row.projectId} />
                      </div>
                    </div>
                    <div className='ss-job-card__action'>
                      <Button
                        size='sm'
                        variant='primary'
                        disabled={takingJob}
                        onClick={takeJob}
                      >
                        Take Job
                      </Button>
                    </div>
                  </div>
                );
              }

              const {
                project,
                queue,
                jobsRemaining: n,
                typeLabel,
                displayName,
                isAdmin,
              } = row;
              const disabled =
                takingJob ||
                deletingJob ||
                n === 0 ||
                scanningProjects.has(project.id);
              const takeJob = () =>
                handleTakeJob({
                  queueId: queue.id,
                  projectId: project.id,
                  tag: queue.tag,
                });

              return (
                <div key={`q-${queue.id}`} className='ss-job-card'>
                  <div className='ss-job-card__main'>
                    <div className='ss-job-card__header'>
                      <span className='ss-job-card__title' onClick={takeJob}>
                        {displayName}
                      </span>
                      <span className='ss-status ss-status--info'>
                        {typeLabel}
                      </span>
                      {isAdmin && queue.hidden && (
                        <span className='ss-status ss-status--draft'>
                          Hidden
                        </span>
                      )}
                    </div>
                    <div className='ss-job-progress'>
                      <ProjectProgress
                        projectId={project.id}
                        prefix={`${project.organization.name} · `}
                        onScanningChange={(isScanning) => {
                          setScanningProjects((prev) => {
                            const next = new Set(prev);
                            isScanning
                              ? next.add(project.id)
                              : next.delete(project.id);
                            return next;
                          });
                        }}
                      />
                    </div>
                  </div>
                  <div className='ss-job-card__action'>
                    <Button
                      size='sm'
                      variant='primary'
                      disabled={disabled}
                      onClick={takeJob}
                    >
                      Take Job
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ContentArea>
    </Page>
  );
}
