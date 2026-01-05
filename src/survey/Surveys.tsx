import { useContext, useEffect, useState } from 'react';
import { UserContext, GlobalContext, UploadContext } from '../Context.tsx';
import { Schema } from '../amplify/client-schema.ts';
import { Card, Button, Form } from 'react-bootstrap';
import MyTable from '../Table.tsx';
import NewSurveyModal from './NewSurveyModal.tsx';
import { useNavigate } from 'react-router-dom';
import FilesUploadComponent from '../FilesUploadComponent.tsx';
import ConfirmationModal from '../ConfirmationModal.tsx';
import AnnotationSetResults from '../AnnotationSetResults.tsx';
import AnnotationCountModal from '../AnnotationCountModal.tsx';
import EditAnnotationSetModal from '../EditAnnotationSet.tsx';
import AddAnnotationSetModal from './AddAnnotationSetModal.tsx';
import LaunchAnnotationSetModal from './LaunchAnnotationSetModal.tsx';
import EditSurveyModal from './editSurveyModal.tsx';
import SpatioTemporalSubset from '../SpatioTemporalSubset.tsx';
import SubsampleModal from '../Subsample.tsx';
import FileStructureSubset from '../filestructuresubset.tsx';
import { SquareArrowOutUpRight, X, Pause, Play, Trash, Minimize2, Maximize2 } from 'lucide-react';
import { fetchAllPaginatedResults } from '../utils.tsx';
import { Badge } from 'react-bootstrap';
import { DeleteQueueCommand } from '@aws-sdk/client-sqs';
import localforage from 'localforage';
import UploadIntegrityChecker from '../upload/UploadIntegrityChecker.tsx';
import ProjectProgress from '../user/ProjectProgress.tsx';

const fileStoreUploaded = localforage.createInstance({
  name: 'fileStoreUploaded',
  storeName: 'filesUploaded',
});

const STORAGE_KEYS = {
  ORGANIZATION_FILTER: 'surveysOrganizationFilter',
  SORT_BY: 'surveysSortBy',
  COMPACT_MODE: 'surveysCompactMode',
};

export default function Surveys() {
  const { client, showModal, modalToShow } = useContext(GlobalContext)!;
  const {
    myMembershipHook: myProjectsHook,
    isOrganizationAdmin,
    getSqsClient,
  } = useContext(UserContext)!;
  const { task, setTask } = useContext(UploadContext)!;
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [projects, setProjects] = useState<Schema['Project']['type'][]>([]);
  const [selectedProject, setSelectedProject] = useState<
    Schema['Project']['type'] | null
  >(null);
  const [fromStaleUpload, setFromStaleUpload] = useState(false);
  const [selectedAnnotationSet, setSelectedAnnotationSet] = useState<
    Schema['AnnotationSet']['type'] | null
  >(null);
  const [search, setSearch] = useState('');
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [hasUploadedFiles, setHasUploadedFiles] = useState<{
    [projectId: string]: boolean;
  }>({});
  
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
  const [organizationFilter, setOrganizationFilter] = useState(getInitialOrganizationFilter);
  
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

  const organizationOptions = Array.from(
    new Map(
      projects.map((project) => [
        project.organizationId,
        project.organization.name,
      ])
    ).entries()
  ).map(([id, name]) => ({ id, name }));

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

  // Persist organizationFilter to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ORGANIZATION_FILTER, organizationFilter);
    }
  }, [organizationFilter]);

  // Persist compactMode to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.COMPACT_MODE, String(compactMode));
    }
  }, [compactMode]);

  useEffect(() => {
    async function getProjects() {
      const myAdminProjects = myProjectsHook.data?.filter(
        (project) => project.isAdmin
      );

      Promise.all(
        myAdminProjects?.map(
          async (project) =>
            (
              await client.models.Project.get(
                { id: project.projectId },
                {
                  selectionSet: [
                    'name',
                    'id',
                    'organizationId',
                    'organization.name',
                    'annotationSets.id',
                    'annotationSets.name',
                    'annotationSets.register',
                    'locationSets.id',
                    'locationSets.name',
                    'annotationSets.categories.id',
                    'annotationSets.categories.name',
                    'annotationSets.categories.shortcutKey',
                    'annotationSets.categories.color',
                    'imageSets.id',
                    'imageSets.name',
                    'queues.id',
                    'queues.url',
                    'status',
                    'updatedAt',
                    'createdAt',
                    'imageSets.imageCount',
                  ],
                }
              )
            ).data
        )
      ).then(async (projects) => {
        const validProjects = projects.filter((project) => project !== null);
        setProjects(validProjects);

        const hasUploadedFiles = await Promise.all(
          validProjects.map(async (project) => {
            const hasUploadedFiles = Boolean(
              await fileStoreUploaded.getItem(project.id)
            );
            return { [project.id]: hasUploadedFiles };
          })
        );
        setHasUploadedFiles(
          hasUploadedFiles.reduce((acc, curr) => ({ ...acc, ...curr }), {})
        );
      });
    }

    getProjects();
  }, [myProjectsHook.data]);

  async function deleteProject(projectId: string) {
    setProjects((projects) =>
      projects.map((project) => {
        if (project.id === projectId) {
          return { ...project, status: 'deleting' };
        }
        return project;
      })
    );

    await client.models.Project.update({
      id: projectId,
      status: 'deleting',
    });

    client.mutations.deleteProjectInFull({ projectId: projectId });
  }

  async function deleteAnnotationSet(
    projectId: string,
    annotationSetId: string
  ) {
    await client.models.AnnotationSet.delete({ id: annotationSetId });
    setProjects(
      projects.map((project) => {
        if (project.id === projectId) {
          return {
            ...project,
            annotationSets: project.annotationSets.filter(
              (set) => set.id !== annotationSetId
            ),
          };
        }
        return project;
      })
    );
  }

  async function handleCancelJob() {
    setProjects(
      projects.map((project) => {
        if (project.id === selectedProject!.id) {
          return { ...project, status: 'updating' };
        }
        return project;
      })
    );

    try {
      // cancel registration job if it exists
      const annotationSet = selectedProject?.annotationSets.find(
        (set) => set.register
      );

      if (annotationSet) {
        await client.models.AnnotationSet.update({
          id: annotationSet.id,
          register: false,
        });
        return;
      }

      const job = selectedProject?.queues[0];

      if (!job?.url) {
        alert('An unknown error occurred. Please try again later.');
        return;
      }

      const sqsClient = await getSqsClient();
      await sqsClient.send(new DeleteQueueCommand({ QueueUrl: job.url }));
      await client.models.Queue.delete({ id: job.id });
    } catch (error) {
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
      !organizationFilter || project.organizationId === organizationFilter;
    const matchesAnnotationSet = project.annotationSets.some((set) =>
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

  function renderAnnotationSetActions(
    project: Schema['Project']['type'],
    annotationSet: Schema['AnnotationSet']['type'],
    disabled: boolean,
    hasJobs: boolean,
    options: { wrap?: boolean; size?: 'sm' } = {}
  ) {
    // Mobile view should never be compact, so ignore compactMode when isMobile is true
    const effectiveCompactMode = isMobile ? false : compactMode;
    const { wrap = false, size = effectiveCompactMode ? 'sm' : undefined } = options;
    const gapClass = effectiveCompactMode ? 'gap-1' : 'gap-2';

    return (
      <div className={`d-flex ${wrap ? 'flex-wrap w-100' : 'flex-wrap'} ${gapClass}`}>
        <Button
          size={size}
          variant='primary'
          onClick={() => {
            setSelectedAnnotationSet(annotationSet);
            showModal('annotationCount');
          }}
          disabled={disabled || hasJobs}
        >
          Details
        </Button>
        <Button
          size={size}
          variant='primary'
          onClick={() => {
            setSelectedProject(project);
            setSelectedAnnotationSet(annotationSet);
            showModal('launchAnnotationSet');
          }}
          disabled={disabled || hasJobs}
        >
          Launch
        </Button>
        <Button
          size={size}
          variant='primary'
          onClick={() => {
            setSelectedProject(project);
            setSelectedAnnotationSet(annotationSet);
            showModal('editAnnotationSet');
          }}
          disabled={disabled || hasJobs}
        >
          Edit
        </Button>
        <Button
          size={size}
          variant='primary'
          onClick={() => {
            setSelectedProject(project);
            setSelectedAnnotationSet({
              id: annotationSet.id,
              name: annotationSet.name,
            });
            showModal('annotationSetResults');
          }}
          disabled={disabled || hasJobs}
        >
          Results
        </Button>
        <Button
          size={size}
          variant='danger'
          onClick={() => {
            setSelectedProject(project);
            setSelectedAnnotationSet(annotationSet);
            showModal('deleteAnnotationSet');
          }}
          disabled={disabled || hasJobs}
        >
          <Trash />
        </Button>
      </div>
    );
  }

  function renderAnnotationSets(
    project: Schema['Project']['type'],
    disabled: boolean,
    hasJobs: boolean,
    options: { wrap?: boolean; size?: 'sm' } = {}
  ) {
    // Mobile view should never be compact, so ignore compactMode when isMobile is true
    const effectiveCompactMode = isMobile ? false : compactMode;
    const { wrap = false, size = effectiveCompactMode ? 'sm' : undefined } = options;
    const sortedAnnotationSets = [...project.annotationSets].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    const gapClass = effectiveCompactMode ? 'gap-1' : 'gap-2';
    const borderClass = effectiveCompactMode ? 'pt-1' : 'pt-2';

    return (
      <div className={`d-flex flex-column ${gapClass} flex-grow-1`}>
        {isMobile && sortedAnnotationSets.length === 0 && (
          <Badge
            bg='secondary'
            style={{ width: 'fit-content', fontSize: '12px' }}
          >
            None
          </Badge>
        )}
        {sortedAnnotationSets.map((annotationSet, i) => (
          <div
            className={`d-flex flex-column ${gapClass} ${
              i === 0 ? '' : `border-top border-light ${borderClass}`
            }`}
            key={annotationSet.id}
          >
            <div className={`d-flex justify-content-between align-items-center ${gapClass} flex-wrap`}>
              <div style={{ fontSize: '16px' }}>{annotationSet.name}</div>
              {!hasJobs &&
                renderAnnotationSetActions(
                  project,
                  annotationSet,
                  disabled,
                  hasJobs,
                  { wrap, size }
                )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderProjectActions(
    project: Schema['Project']['type'],
    disabled: boolean,
    hasJobs: boolean,
    showResumeButton: boolean,
    showPauseButton: boolean,
    isStale: boolean,
    options: { wrap?: boolean; size?: 'sm' } = {}
  ) {
    // Mobile view should never be compact, so ignore compactMode when isMobile is true
    const effectiveCompactMode = isMobile ? false : compactMode;
    const { wrap = false, size = effectiveCompactMode ? 'sm' : undefined } = options;
    const gapClass = effectiveCompactMode ? 'gap-1' : 'gap-2';
    const containerClass = wrap
      ? `d-flex flex-wrap ${gapClass} w-100`
      : `d-flex ${gapClass} flex-wrap`;

    return (
      <div className={containerClass}>
        {project.status !== 'uploading' ? (
          <>
            <Button
              size={size}
              variant='primary'
              onClick={(e) => {
                if (e.ctrlKey) {
                  navigate(`/surveys/${project.id}/manage`);
                } else {
                  setSelectedProject(project);
                  showModal('editSurvey');
                }
              }}
              disabled={
                process.env.NODE_ENV !== 'development' && (disabled || hasJobs)
              }
            >
              Edit
            </Button>
            <Button
              size={size}
              variant='primary'
              onClick={() => {
                setSelectedProject(project);
                showModal('addFiles');
              }}
              disabled={disabled || hasJobs}
            >
              Add files
            </Button>
            <Button
              size={size}
              variant='primary'
              onClick={() => {
                setSelectedProject(project);
                showModal('addAnnotationSet');
              }}
              disabled={disabled || hasJobs}
            >
              Add Annotation Set
            </Button>
            <Button
              size={size}
              variant='danger'
              onClick={() => {
                setSelectedProject(project);
                showModal('deleteSurvey');
              }}
              disabled={disabled || hasJobs}
            >
              <Trash />
            </Button>
          </>
        ) : (
          <>
            {!showPauseButton && (showResumeButton || isStale) && (
              <Button
                size={size}
                variant='info'
                onClick={() => {
                  if (showResumeButton) {
                    setTask((task) => ({
                      ...task,
                      resumeId: project.id,
                    }));
                    return;
                  }

                  setFromStaleUpload(true);
                  setSelectedProject(project);
                  showModal('addFiles');
                }}
              >
                <Play />
              </Button>
            )}
            {isStale && (
              <Button
                size={size}
                variant='danger'
                disabled={
                  task.pauseId === project.id || task.deleteId === project.id
                }
                onClick={() => {
                  setTask((task) => ({
                    ...task,
                    deleteId: project.id,
                  }));
                }}
              >
                <Trash />
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  const tableData = sortedProjects.map((project) => {
    const disabled =
      project.status === 'uploading' ||
      project.status?.includes('processing') ||
      project.status === 'launching' ||
      project.status === 'updating' ||
      project.status === 'deleting';

    const hasJobs =
      project.queues.length > 0 ||
      project.annotationSets.some((set) => set.register);

    const showResumeButton =
      !task.projectId &&
      project.status === 'uploading' &&
      hasUploadedFiles[project.id];

    const showPauseButton =
      task.projectId === project.id && project.status === 'uploading';

    const isStale =
      project.status === 'uploading' &&
      new Date(project.updatedAt).getTime() < Date.now() - 1000 * 60 * 5;

    const gapClass = compactMode ? 'gap-1' : 'gap-2';
    const columnGapClass = compactMode ? 'gap-1' : 'gap-3';
    const badgeFontSize = compactMode ? '11px' : '14px';

    return {
      id: project.id,
      rowData: [
        <div className={`d-flex justify-content-between align-items-start align-items-lg-center ${gapClass} flex-wrap`}>
          <div className={`d-flex flex-column ${compactMode ? 'gap-0' : 'gap-1'}`}>
            {compactMode ? (
              <h6 className={`mb-0 ${isMobile ? 'fw-semibold' : ''}`}>
                {project.name}
              </h6>
            ) : (
              <h5 className={`mb-0 ${isMobile ? 'fw-semibold' : ''}`}>
                {project.name}
              </h5>
            )}
            {!compactMode && (
              <div className='d-flex flex-column'>
                <i style={{ fontSize: '14px' }}>{project.organization.name}</i>
                {project.status !== 'uploading' && (
                  <i style={{ fontSize: '14px' }}>
                    Images: {project.imageSets?.[0]?.imageCount || 0}
                  </i>
                )}
              </div>
            )}
            {project.status !== 'active' && (
              <Badge
                style={{ fontSize: badgeFontSize, width: 'fit-content' }}
                bg={'info'}
              >
                {project.status === 'launching'
                  ? 'Launching - please wait'
                  : project.status.includes('processing')
                  ? 'Processing'
                  : project.status.replace(/\b\w/g, (char) =>
                      char.toUpperCase()
                    )}
              </Badge>
            )}
          </div>
          {renderProjectActions(
            project,
            disabled,
            hasJobs,
            showResumeButton,
            showPauseButton,
            isStale
          )}
        </div>,
        <div className={`d-flex flex-column flex-md-row ${columnGapClass}`}>
          {renderAnnotationSets(project, disabled, hasJobs)}
          {hasJobs && (
            <div
              className={`d-flex flex-row align-items-center ${gapClass} w-100`}
              style={{ maxWidth: '500px' }}
            >
              <div className='flex-grow-1'>
                <ProjectProgress projectId={project.id} />
              </div>
              <div className={`d-flex ${gapClass} flex-wrap justify-content-end`}>
                <Button
                  size={compactMode ? 'sm' : undefined}
                  className='flex align-items-center justify-content-center'
                  disabled={disabled}
                  variant='primary'
                  onClick={() => navigate(`/jobs`)}
                >
                  <SquareArrowOutUpRight />
                </Button>
                <Button
                  size={compactMode ? 'sm' : undefined}
                  className='flex align-items-center justify-content-center'
                  disabled={disabled}
                  variant='danger'
                  onClick={() => {
                    setSelectedProject(project);
                    showModal('deleteJob');
                  }}
                >
                  <X />
                </Button>
              </div>
            </div>
          )}
        </div>,
      ],
    };
  });

  const renderProjectCard = (project: Schema['Project']['type']) => {
    const disabled =
      project.status === 'uploading' ||
      project.status?.includes('processing') ||
      project.status === 'launching' ||
      project.status === 'updating' ||
      project.status === 'deleting';

    const hasJobs =
      project.queues.length > 0 ||
      project.annotationSets.some((set) => set.register);

    const showResumeButton =
      !task.projectId &&
      project.status === 'uploading' &&
      hasUploadedFiles[project.id];

    const showPauseButton =
      task.projectId === project.id && project.status === 'uploading';

    const isStale =
      project.status === 'uploading' &&
      new Date(project.updatedAt).getTime() < Date.now() - 1000 * 60 * 5;

    return (
      <Card
        key={project.id}
        className='shadow-sm'
        style={{ backgroundColor: '#6F7B89', color: '#fff', border: 'none' }}
      >
        <Card.Body className='d-flex flex-column gap-3'>
          <div className='d-flex flex-column gap-2'>
            <div className='d-flex justify-content-between align-items-start align-items-lg-center gap-2 flex-wrap'>
              <div className='d-flex flex-column gap-1'>
                <h5 className={`mb-0 ${isMobile ? 'fw-semibold' : ''}`}>
                  {project.name}
                </h5>
                <div className='text-muted' style={{ fontSize: '14px' }}>
                  {project.organization.name}
                </div>
                {project.status !== 'uploading' && (
                  <div className='text-muted' style={{ fontSize: '14px' }}>
                    Images: {project.imageSets?.[0]?.imageCount || 0}
                  </div>
                )}
                {project.status !== 'active' && (
                  <Badge
                    style={{ fontSize: '14px', width: 'fit-content' }}
                    bg={'info'}
                  >
                    {project.status === 'launching'
                      ? 'Launching - please wait'
                      : project.status.includes('processing')
                      ? 'Processing'
                      : project.status.replace(/\b\w/g, (char) =>
                          char.toUpperCase()
                        )}
                  </Badge>
                )}
              </div>
              {renderProjectActions(
                project,
                disabled,
                hasJobs,
                showResumeButton,
                showPauseButton,
                isStale,
                { wrap: true, size: 'sm' }
              )}
            </div>
            {hasJobs && (
              <div
                className={`d-flex flex-row align-items-center gap-2 ${
                  isMobile ? 'pt-3 border-top border-light' : ''
                }`}
              >
                <div className='flex-grow-1'>
                  <ProjectProgress projectId={project.id} />
                </div>
                <div className='d-flex gap-2 flex-wrap justify-content-end'>
                  <Button
                    size='sm'
                    className='flex align-items-center justify-content-center'
                    disabled={disabled}
                    variant='primary'
                    onClick={() => navigate(`/jobs`)}
                  >
                    <SquareArrowOutUpRight />
                  </Button>
                  <Button
                    size='sm'
                    className='flex align-items-center justify-content-center'
                    disabled={disabled}
                    variant='danger'
                    onClick={() => {
                      setSelectedProject(project);
                      showModal('deleteJob');
                    }}
                  >
                    <X />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div
            className={`d-flex flex-column gap-2 ${
              isMobile ? 'pt-3 border-top border-light' : ''
            }`}
          >
            <div className='fw-semibold'>Annotation Sets</div>
            {renderAnnotationSets(project, disabled, hasJobs, {
              wrap: true,
              size: 'sm',
            })}
          </div>
        </Card.Body>
      </Card>
    );
  };

  const emptyMessage = 'You are not an admin of any surveys.';

  if (projects.length === 0 && !isOrganizationAdmin) {
    return <div>You are not authorized to access this page.</div>;
  }

  return (
    <>
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
            <Card.Title
              className='mb-0 flex-shrink-0'
              style={{ whiteSpace: 'nowrap' }}
            >
              <h4 className='mb-0'>Your Surveys</h4>
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
                <option value='createdAt-reverse'>
                  Created (oldest first)
                </option>
                <option value='name'>Name (A-Z)</option>
                <option value='name-reverse'>Name (Z-A)</option>
              </Form.Select>
              {!isMobile && (
                <Button
                  variant='info'
                  // size='sm'
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
          <Card.Body
            className={
              isMobile
                ? 'd-flex flex-column gap-3 p-3'
                : 'overflow-x-auto overflow-y-visible'
            }
          >
            {isMobile ? (
              sortedProjects.length > 0 ? (
                <div className='d-flex flex-column gap-3'>
                  {sortedProjects.map((project) => renderProjectCard(project))}
                </div>
              ) : (
                <div className='text-center py-3'>
                  <h5 className='mb-0'>{emptyMessage}</h5>
                </div>
              )
            ) : (
              <MyTable
                tableHeadings={[
                  { content: 'Survey', style: { width: '50%' } },
                  { content: 'Annotation Sets', style: { width: '50%' } },
                ]}
                tableData={tableData}
                pagination={true}
                itemsPerPage={5}
                emptyMessage={emptyMessage}
              />
            )}
          </Card.Body>
          {isOrganizationAdmin && (
            <Card.Footer className='d-flex justify-content-center'>
              <Button variant='primary' onClick={() => showModal('newSurvey')}>
                New Survey
              </Button>
            </Card.Footer>
          )}
        </Card>
        {/* {process.env.NODE_ENV === 'development' && <UploadIntegrityChecker />} */}
      </div>
      <NewSurveyModal
        show={modalToShow === 'newSurvey'}
        projects={projects.map((project) => project.name.toLowerCase())}
        onClose={() => showModal(null)}
      />
      <ConfirmationModal
        show={modalToShow === 'deleteSurvey'}
        onClose={() => {
          showModal(null);
          setSelectedProject(null);
        }}
        onConfirm={() => deleteProject(selectedProject!.id)}
        title='Delete Survey'
        body={
          <p className='mb-0'>
            Are you sure you want to delete {selectedProject?.name}?
            <br />
            This action cannot be undone.
          </p>
        }
      />
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
      {selectedProject && (
        <FilesUploadComponent
          show={modalToShow === 'addFiles'}
          fromStaleUpload={fromStaleUpload}
          handleClose={() => {
            showModal(null);
            setSelectedProject(null);
            setFromStaleUpload(false);
          }}
          project={{ id: selectedProject.id, name: selectedProject.name }}
        />
      )}
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
            setProjects(
              projects.map((project) => {
                if (project.id === selectedProject?.id) {
                  return {
                    ...project,
                    annotationSets: project.annotationSets.map((set) =>
                      set.id === annotationSet.id ? annotationSet : set
                    ),
                  };
                }
                return project;
              })
            );
          }}
          setEditSurveyTab={setTab}
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
            setProjects(
              projects.map((project) =>
                project.id === selectedProject?.id
                  ? {
                      ...project,
                      annotationSets: [
                        ...project.annotationSets,
                        {
                          id: annotationSet.id,
                          name: annotationSet.name,
                        },
                      ],
                    }
                  : project
              )
            );
          }}
          categories={selectedProject.categories}
          setTab={setTab}
        />
      )}
      {selectedProject && selectedAnnotationSet && (
        <LaunchAnnotationSetModal
          show={modalToShow === 'launchAnnotationSet'}
          onClose={() => showModal(null)}
          annotationSet={selectedAnnotationSet}
          project={selectedProject}
          onOptimisticStatus={(projectId, status) => {
            setProjects((prevProjects) =>
              prevProjects.map((project) =>
                project.id === projectId ? { ...project, status } : project
              )
            );
            setSelectedProject((prev) =>
              prev && prev.id === projectId ? { ...prev, status } : prev
            );
          }}
        />
      )}
      {selectedProject && (
        <EditSurveyModal
          show={modalToShow === 'editSurvey'}
          onClose={() => {
            showModal(null);
            // setSelectedProject(null);
            // setSelectedSets([]);
          }}
          project={selectedProject}
          openTab={tab}
          setSelectedSets={setSelectedSets}
        />
      )}
      {selectedProject && (
        <>
          <SpatioTemporalSubset
            show={modalToShow == 'SpatiotemporalSubset'}
            handleClose={() => showModal(null)}
            selectedImageSets={selectedSets}
            project={selectedProject}
          />
          <SubsampleModal
            show={modalToShow == 'Subsample'}
            handleClose={() => showModal(null)}
            selectedImageSets={selectedSets}
            setSelectedImageSets={setSelectedSets}
            project={selectedProject}
          />
          <FileStructureSubset
            show={modalToShow == 'FileStructureSubset'}
            handleClose={() => showModal(null)}
            selectedImageSets={selectedSets}
            imageSets={selectedProject.imageSets}
            project={selectedProject}
          />
        </>
      )}
    </>
  );
}
