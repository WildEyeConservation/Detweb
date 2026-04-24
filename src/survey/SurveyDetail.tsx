import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Card, Spinner } from 'react-bootstrap';
import { Settings } from 'lucide-react';
import { GlobalContext, UserContext } from '../Context';
import {
  Page,
  PageHeader,
  TabBar,
  ContentArea,
  Crumb,
  CrumbSep,
} from '../ss/PageShell';
import AnnotationSetResults from '../AnnotationSetResults';
import AnnotationCountModal from '../AnnotationCountModal';
import ConfirmationModal from '../ConfirmationModal';
import { logAdminAction } from '../utils/adminActionLogger';
import { FilesUploadForm } from '../FilesUploadComponent';
import { fetchAllPaginatedResults } from '../utils';
import { Camera } from './SurveyStructure';
import QueueProgress from '../user/QueueProgress';

type AnnotationSet = { id: string; name: string; register?: boolean | null };
type Queue = {
  id: string;
  name?: string | null;
  tag?: string | null;
  url?: string | null;
  annotationSetId?: string | null;
  launchedCount?: number | null;
  observedCount?: number | null;
  totalBatches?: number | null;
  batchSize?: number | null;
  requeuesCompleted?: number | null;
  emptyQueueTimestamp?: string | null;
};
type ProjectDetail = {
  id: string;
  name: string;
  status: string | null;
  organizationId?: string;
  organization: { id: string; name: string };
  annotationSets: AnnotationSet[];
  imageSets?: { imageCount: number }[];
  queues?: Queue[];
};

type ProjectImage = {
  id: string;
  cameraId?: string | null;
  originalPath?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  altitude_agl?: number | null;
  altitude_wgs84?: number | null;
  timestamp?: number | null;
};

type FlatRow = {
  id: string;
  cameraId: string;
  cameraName: string;
  folder: string;
  filename: string;
  originalPath: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  timestamp: number | null;
};

function flattenRows(
  cameras: { id: string; name: string }[],
  images: ProjectImage[]
): FlatRow[] {
  const camMap = new Map<string, string>();
  cameras.forEach((c) => camMap.set(c.id, c.name));
  const rows: FlatRow[] = [];
  for (const img of images) {
    if (!img.originalPath) continue;
    const parts = img.originalPath.split(/[/\\]/).filter((p) => p.length > 0);
    const folder =
      parts.length > 1 ? parts[parts.length - 2] : parts[0] ?? '';
    const filename = parts[parts.length - 1] ?? img.originalPath;
    const cameraId = (img.cameraId ?? '0000') as string;
    rows.push({
      id: String(img.id),
      cameraId,
      cameraName: camMap.get(cameraId) ?? 'Survey Camera',
      folder,
      filename,
      originalPath: img.originalPath,
      latitude: Number.isFinite(img.latitude) ? (img.latitude as number) : null,
      longitude: Number.isFinite(img.longitude) ? (img.longitude as number) : null,
      altitude: Number.isFinite(img.altitude_agl)
        ? (img.altitude_agl as number)
        : Number.isFinite(img.altitude_wgs84)
        ? (img.altitude_wgs84 as number)
        : null,
      timestamp: img.timestamp ?? null,
    });
  }
  return rows;
}

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadCsv(filename: string, rows: FlatRow[]) {
  const header = [
    'id',
    'camera',
    'folder',
    'filename',
    'originalPath',
    'latitude',
    'longitude',
    'altitude_m',
    'timestamp',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.cameraName,
        r.folder,
        r.filename,
        r.originalPath,
        r.latitude ?? '',
        r.longitude ?? '',
        r.altitude ?? '',
        r.timestamp ? new Date(r.timestamp * 1000).toISOString() : '',
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildStructure(
  cameras: { id: string; name: string }[],
  images: ProjectImage[]
): Camera[] {
  const cams = cameras.length === 0
    ? [{ id: '0000', name: 'Survey Camera' }]
    : cameras;

  return cams.map((camera) => {
    const cameraImages =
      camera.id === '0000'
        ? images
        : images.filter((image) => image.cameraId === camera.id);

    const cameraFolders = new Set<string>();
    for (const image of cameraImages) {
      if (image.originalPath) {
        const pathParts = image.originalPath
          .split(/[/\\]/)
          .filter((part) => part.length > 0);
        if (pathParts.length > 1) {
          cameraFolders.add(pathParts[pathParts.length - 2]);
        } else if (pathParts.length === 1) {
          cameraFolders.add(pathParts[0]);
        }
      }
    }

    return {
      name: camera.name,
      folders: Array.from(cameraFolders).map((parentDir) => {
        const folderImages = cameraImages.filter((image) => {
          if (!image.originalPath) return false;
          const pathParts = image.originalPath
            .split(/[/\\]/)
            .filter((part) => part.length > 0);
          if (pathParts.length > 1) {
            return pathParts[pathParts.length - 2] === parentDir;
          } else if (pathParts.length === 1) {
            return pathParts[0] === parentDir;
          }
          return false;
        });

        return {
          path: parentDir,
          imageCount: folderImages.length,
          images: folderImages.map((img) => ({
            id: String(img.id),
            originalPath: (img.originalPath ?? '') as string,
            cameraId: (img.cameraId ?? undefined) as string | undefined,
          })),
        };
      }),
    };
  });
}

export default function SurveyDetail() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const { client, showModal, modalToShow } = useContext(GlobalContext)!;
  const { user, myMembershipHook } = useContext(UserContext)!;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // ?launching=1 is set by LaunchAnnotationSet when navigating back here, so
  // we can show "Launching" instantly for the user who triggered the launch —
  // without waiting for the membership tick + project refetch.
  const optimisticLaunching = searchParams.get('launching') === '1';

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tab, setTab] = useState<'sets' | 'files'>('sets');
  const [selectedSet, setSelectedSet] = useState<AnnotationSet | null>(null);

  const [filesLoaded, setFilesLoaded] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const filesFetchStartedRef = useRef(false);
  const [cameras, setCameras] = useState<{ id: string; name: string }[]>([]);
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [expandedCameras, setExpandedCameras] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'summary' | 'list'>('summary');
  const [sortBy, setSortBy] = useState<'filename' | 'camera' | 'folder' | 'timestamp'>('filename');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const listScrollRef = useRef<HTMLDivElement | null>(null);

  const [uploadSubmitFn, setUploadSubmitFn] = useState<
    ((projectId: string, fromStaleUpload?: boolean) => Promise<any>) | null
  >(null);
  const [readyToSubmit, setReadyToSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellingSetId, setCancellingSetId] = useState<string | null>(null);

  const fetchProject = async (): Promise<ProjectDetail | null> => {
    if (!surveyId) return null;
    const { data } = await client.models.Project.get(
      { id: surveyId },
      {
        selectionSet: [
          'id',
          'name',
          'status',
          'organizationId',
          'organization.id',
          'organization.name',
          'annotationSets.id',
          'annotationSets.name',
          'annotationSets.register',
          'imageSets.imageCount',
          'queues.id',
          'queues.name',
          'queues.tag',
          'queues.url',
          'queues.annotationSetId',
          'queues.launchedCount',
          'queues.observedCount',
          'queues.totalBatches',
          'queues.batchSize',
          'queues.requeuesCompleted',
          'queues.emptyQueueTimestamp',
        ] as unknown as string[],
      }
    );
    return data as ProjectDetail | null;
  };

  // Backend Lambdas (launch, cancel, status changes) call updateProjectMemberships
  // which bumps UserProjectMembership.updatedAt. We derive a "tick" for this project
  // from that and refetch when it changes — no polling needed.
  const membershipTick =
    myMembershipHook.data?.find(
      (m: { projectId: string; updatedAt?: string | null }) =>
        m.projectId === surveyId
    )?.updatedAt ?? '';

  useEffect(() => {
    if (!surveyId) return;
    let cancelled = false;
    (async () => {
      const data = await fetchProject();
      if (!cancelled) setProject(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [surveyId, client, membershipTick]);

  useEffect(() => {
    if (tab !== 'files' || !surveyId) return;
    if (filesFetchStartedRef.current) return;
    filesFetchStartedRef.current = true;
    setLoadingFiles(true);
    (async () => {
      try {
        const [{ data: cams }, imgs] = await Promise.all([
          client.models.Camera.camerasByProjectId({ projectId: surveyId }),
          fetchAllPaginatedResults(client.models.Image.imagesByProjectId, {
            projectId: surveyId,
            limit: 10000,
            selectionSet: [
              'id',
              'cameraId',
              'originalPath',
              'latitude',
              'longitude',
              'altitude_agl',
              'altitude_wgs84',
              'timestamp',
            ],
          } as any),
        ]);
        setCameras(
          (cams ?? []).map((c: any) => ({ id: c.id as string, name: c.name as string }))
        );
        setImages(imgs as ProjectImage[]);
        setFilesLoaded(true);
      } catch (err) {
        console.error('Failed to load survey files', err);
        filesFetchStartedRef.current = false;
      } finally {
        setLoadingFiles(false);
      }
    })();
  }, [tab, surveyId, client]);

  const structure = useMemo(
    () => buildStructure(cameras, images),
    [cameras, images]
  );

  const flatRows = useMemo(() => flattenRows(cameras, images), [cameras, images]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? flatRows.filter(
          (r) =>
            r.filename.toLowerCase().includes(q) ||
            r.folder.toLowerCase().includes(q) ||
            r.cameraName.toLowerCase().includes(q) ||
            r.originalPath.toLowerCase().includes(q)
        )
      : flatRows;
    const sorted = [...base].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'filename') cmp = a.filename.localeCompare(b.filename);
      else if (sortBy === 'camera')
        cmp = a.cameraName.localeCompare(b.cameraName) || a.filename.localeCompare(b.filename);
      else if (sortBy === 'folder')
        cmp = a.folder.localeCompare(b.folder) || a.filename.localeCompare(b.filename);
      else if (sortBy === 'timestamp')
        cmp = (a.timestamp ?? 0) - (b.timestamp ?? 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [flatRows, search, sortBy, sortDir]);

  const effectiveView: 'summary' | 'list' = search.trim() ? 'list' : viewMode;

  const rowVirtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 32,
    overscan: 12,
  });

  useEffect(() => {
    rowVirtualizer.scrollToIndex(0);
  }, [search, sortBy, sortDir, rowVirtualizer]);

  const existingImagesForUpload = useMemo(
    () =>
      images
        .filter(
          (img) =>
            Number.isFinite(img.latitude) && Number.isFinite(img.longitude) && img.originalPath
        )
        .map((img) => ({
          originalPath: img.originalPath as string,
          latitude: img.latitude as number,
          longitude: img.longitude as number,
        })),
    [images]
  );

  const toggleCamera = (cameraName: string) => {
    setExpandedCameras((prev) => {
      const next = new Set(prev);
      if (next.has(cameraName)) next.delete(cameraName);
      else next.add(cameraName);
      return next;
    });
  };

  const breadcrumb = (
    <>
      <Crumb onClick={() => navigate('/surveys')}>Surveys</Crumb>
      <CrumbSep />
      <span>{project?.name || surveyId}</span>
    </>
  );

  const imageCount = project?.imageSets?.[0]?.imageCount ?? 0;
  const sets = project?.annotationSets ?? [];

  function statsFor(setId: string) {
    const qs = (project?.queues ?? []).filter(
      (q) => q.annotationSetId === setId
    );
    const batches = qs.length;
    const launched = qs.reduce((n, q) => n + (q.launchedCount ?? 0), 0);
    const observed = qs.reduce((n, q) => n + (q.observedCount ?? 0), 0);
    const pct = launched > 0 ? Math.min(100, Math.round((observed / launched) * 100)) : 0;
    const label =
      batches === 0 ? 'Not Started' : pct >= 100 ? 'Complete' : 'In Progress';
    return { batches, pct, label, launched, observed };
  }

  function statusPill(label: string) {
    if (label === 'Cancelling')
      return <span className='ss-status ss-status--danger'>{label}</span>;
    if (label === 'Complete')
      return <span className='ss-status ss-status--complete'>{label}</span>;
    if (label === 'In Progress')
      return <span className='ss-status ss-status--active'>{label}</span>;
    if (label === 'Launching')
      return <span className='ss-status ss-status--launching'>{label}</span>;
    if (label === 'Processing')
      return <span className='ss-status ss-status--processing'>{label}</span>;
    if (label === 'Updating')
      return <span className='ss-status ss-status--updating'>{label}</span>;
    if (label === 'Uploading')
      return <span className='ss-status ss-status--uploading'>{label}</span>;
    if (label === 'Deleting')
      return <span className='ss-status ss-status--danger'>{label}</span>;
    return null;
  }

  const projectStatus = (project?.status || '').toLowerCase();
  const liveTransientLabel: string | null =
    projectStatus === 'launching'
      ? 'Launching'
      : projectStatus.includes('processing')
      ? 'Processing'
      : projectStatus === 'updating'
      ? 'Updating'
      : projectStatus === 'uploading'
      ? 'Uploading'
      : projectStatus === 'deleting'
      ? 'Deleting'
      : null;
  // While the optimistic flag is set and live data hasn't caught up, pretend
  // the survey is launching so the user who triggered the launch sees feedback
  // instantly. "Live caught up" = project refetched and reports a transient
  // status OR has at least one queue OR a register flag on any set.
  const liveCaughtUp = Boolean(
    project &&
      (liveTransientLabel ||
        (project.queues?.length ?? 0) > 0 ||
        project.annotationSets.some((s) => s.register))
  );
  const showOptimisticLaunching = optimisticLaunching && !liveCaughtUp;
  const transientStatusLabel: string | null =
    liveTransientLabel ?? (showOptimisticLaunching ? 'Launching' : null);
  const isProjectBusy = transientStatusLabel !== null;
  const busyMessage =
    transientStatusLabel === 'Launching'
      ? 'Launching — preparing images…'
      : transientStatusLabel === 'Processing'
      ? 'Processing images…'
      : transientStatusLabel === 'Updating'
      ? 'Updating…'
      : transientStatusLabel === 'Uploading'
      ? 'Uploading…'
      : transientStatusLabel === 'Deleting'
      ? 'Deleting…'
      : '';

  // Clear the optimistic flag once live data confirms the launch
  // (either status went transient, or the queue/register appeared).
  useEffect(() => {
    if (!optimisticLaunching) return;
    if (!liveCaughtUp) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('launching');
        return next;
      },
      { replace: true }
    );
  }, [optimisticLaunching, liveCaughtUp, setSearchParams]);

  async function handleCancelJob() {
    if (!project || !selectedSet) return;
    setCancellingSetId(selectedSet.id);

    try {
      const registrationSet = project.annotationSets.find((s) => s.register);
      if (registrationSet) {
        await client.models.AnnotationSet.update({
          id: registrationSet.id,
          register: false,
        });
        await logAdminAction(
          client,
          user.userId,
          `Cancelled registration job for annotation set "${registrationSet.name}" in project "${project.name}"`,
          project.id,
          project.organizationId || ''
        );
      } else {
        const job = project.queues?.find((q) => q.annotationSetId === selectedSet.id)
          ?? project.queues?.[0];
        if (!job?.url) {
          alert('An unknown error occurred. Please try again later.');
          return;
        }

        await client.mutations.deleteQueueMutation({ queueId: job.id });
        await logAdminAction(
          client,
          user.userId,
          `Cancelled queue job "${job.tag || job.name || 'Unknown'}" for project "${project.name}"`,
          project.id,
          project.organizationId || ''
        );
      }

      await client.mutations.updateProjectMemberships({ projectId: project.id });
      const refreshed = await fetchProject();
      if (refreshed) setProject(refreshed);
    } catch (error) {
      alert('An unknown error occurred. Please try again later.');
      console.error(error);
    } finally {
      setCancellingSetId(null);
    }
  }

  async function deleteSet() {
    if (!selectedSet) return;
    const id = selectedSet.id;
    await client.models.AnnotationSet.delete({ id });
    setProject((prev) =>
      prev
        ? {
            ...prev,
            annotationSets: prev.annotationSets.filter((s) => s.id !== id),
          }
        : prev
    );
    setSelectedSet(null);
  }

  async function handleUploadSubmit() {
    if (!uploadSubmitFn || !project) return;
    setIsSubmitting(true);
    try {
      try {
        await client.models.Project.update({
          id: project.id,
          status: 'uploading',
        });
        try {
          await client.mutations.updateProjectMemberships({
            projectId: project.id,
          });
        } catch {
          /* noop */
        }
      } catch {
        /* noop */
      }

      await uploadSubmitFn(project.id);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Page>
      <PageHeader
        title={
          <span className='d-inline-flex align-items-center gap-2'>
            <span>{project?.name || 'Survey'}</span>
            {transientStatusLabel && statusPill(transientStatusLabel)}
          </span>
        }
        breadcrumb={breadcrumb}
        actions={
          <Button
            variant='secondary'
            size='sm'
            onClick={() => navigate(`/surveys/${surveyId}/settings`)}
          >
            <Settings size={14} style={{ marginRight: 6 }} />
            Settings
          </Button>
        }
      />
      <TabBar
        tabs={[
          { id: 'sets', label: 'Annotation Sets' },
          { id: 'files', label: 'Files' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as 'sets' | 'files')}
      />
      <ContentArea style={{ paddingTop: 16 }}>
        {tab === 'sets' && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 13, color: 'var(--ss-text-dim)' }}>
                {sets.length} annotation set{sets.length === 1 ? '' : 's'}
              </div>
              <Button
                variant='primary'
                size='sm'
                onClick={() =>
                  navigate(`/surveys/${surveyId}/add-annotation-set`)
                }
              >
                + Add Annotation Set
              </Button>
            </div>
            {/* Only one annotation set may have an in-flight job at a time —
                lock down actions on the others (except Counts). */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(() => {
              const activeQueue = project?.queues?.[0];
              const activeSetId = activeQueue?.annotationSetId ?? null;
              // While project.status is transient (launching/processing), treat
              // the set that's about to get a queue as active even if the queue
              // row hasn't materialised yet — so we never show a misleading
              // "not started" or SQS progress bar while tiling is still running.
              const launchingSetId =
                activeSetId
                  ? null
                  : isProjectBusy && sets.length === 1
                  ? sets[0].id
                  : null;
              return sets.map((a) => {
                const { batches, label } = statsFor(a.id);
                const isCancelling = cancellingSetId === a.id;
                const isActive =
                  activeSetId === a.id || launchingSetId === a.id;
                const inProgress = isActive || label === 'In Progress';
                const displayLabel = isCancelling
                  ? 'Cancelling'
                  : isActive && isProjectBusy
                  ? transientStatusLabel!
                  : inProgress
                  ? 'In Progress'
                  : label;
                const anotherInProgress = sets.some(
                  (s) =>
                    s.id !== a.id &&
                    (statsFor(s.id).label === 'In Progress' ||
                      cancellingSetId === s.id ||
                      (activeSetId && activeSetId === s.id) ||
                      (launchingSetId && launchingSetId === s.id))
                );
                const lockOthers =
                  (anotherInProgress || isProjectBusy) &&
                  !inProgress &&
                  !isCancelling;
                const lockTitle = isProjectBusy
                  ? `Project is ${transientStatusLabel!.toLowerCase()}.`
                  : lockOthers
                  ? 'Another annotation set has an active job. Cancel it first.'
                  : undefined;
                return (
                  <div key={a.id} className='ss-card' style={{ padding: 18 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 16 }}>
                        {a.name}
                      </div>
                      {statusPill(displayLabel)}
                    </div>
                    {isActive && isProjectBusy && !isCancelling && (
                      <div
                        className='d-flex align-items-center gap-2'
                        style={{
                          marginTop: 10,
                          marginBottom: 6,
                          fontSize: 13,
                          color: 'var(--ss-text-dim)',
                        }}
                      >
                        <Spinner animation='border' size='sm' />
                        <span>{busyMessage}</span>
                      </div>
                    )}
                    {isActive &&
                      !isProjectBusy &&
                      activeQueue &&
                      !isCancelling && (
                        <div
                          className='ss-job-progress'
                          style={{ marginTop: 10, marginBottom: 6 }}
                        >
                          <QueueProgress queue={activeQueue} />
                        </div>
                      )}
                    {!isActive && batches > 0 && !isCancelling && (
                      <div
                        style={{
                          marginTop: 10,
                          marginBottom: 6,
                          fontSize: 12,
                          color: 'var(--ss-text-dim)',
                        }}
                      >
                        Previously run · {batches} batch{batches === 1 ? '' : 'es'}
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: '1px solid var(--ss-border)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <Button
                        size='sm'
                        variant='secondary'
                        disabled={isCancelling}
                        onClick={() => {
                          setSelectedSet(a);
                          showModal('annotationCount');
                        }}
                      >
                        Counts
                      </Button>
                      {inProgress ? (
                        <>
                          <Button
                            size='sm'
                            variant='primary'
                            disabled={isCancelling || isProjectBusy}
                            title={
                              isProjectBusy
                                ? `Project is ${transientStatusLabel!.toLowerCase()} — please wait…`
                                : undefined
                            }
                            onClick={() => navigate('/jobs')}
                          >
                            Take to Jobs
                          </Button>
                          <Button
                            size='sm'
                            variant='danger'
                            disabled={isCancelling || isProjectBusy}
                            title={
                              isProjectBusy
                                ? `Project is ${transientStatusLabel!.toLowerCase()} — please wait…`
                                : undefined
                            }
                            onClick={() => {
                              setSelectedSet(a);
                              showModal('cancelJob');
                            }}
                          >
                            {isCancelling ? 'Cancelling…' : 'Cancel Job'}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size='sm'
                            variant='primary'
                            disabled={lockOthers}
                            title={lockTitle}
                            onClick={() =>
                              navigate(
                                `/surveys/${surveyId}/set/${a.id}/launch`
                              )
                            }
                          >
                            Launch
                          </Button>
                          <Button
                            size='sm'
                            variant='secondary'
                            disabled={lockOthers}
                            title={lockTitle}
                            onClick={() =>
                              navigate(
                                `/surveys/${surveyId}/set/${a.id}/edit`
                              )
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            size='sm'
                            variant='secondary'
                            disabled={lockOthers}
                            title={lockTitle}
                            onClick={() => {
                              setSelectedSet(a);
                              showModal('annotationSetResults');
                            }}
                          >
                            Results
                          </Button>
                          <Button
                            size='sm'
                            variant='danger'
                            disabled={lockOthers}
                            title={lockTitle}
                            onClick={() => {
                              setSelectedSet(a);
                              showModal('deleteAnnotationSet');
                            }}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
              {sets.length === 0 && (
                <div
                  className='ss-card'
                  style={{
                    padding: 24,
                    textAlign: 'center',
                    color: 'var(--ss-text-dim)',
                  }}
                >
                  No annotation sets yet.
                </div>
              )}
            </div>
          </div>
        )}
        {tab === 'files' && (
          <div className='d-flex flex-column gap-3'>
            <Card>
              <Card.Header className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
                <h5 className='mb-0'>
                  Survey Structure{' '}
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--ss-text-dim)',
                      fontWeight: 400,
                      marginLeft: 6,
                    }}
                  >
                    {imageCount} image{imageCount === 1 ? '' : 's'}
                  </span>
                </h5>
                <Button
                  variant='secondary'
                  size='sm'
                  disabled={!filesLoaded || filteredRows.length === 0}
                  onClick={() =>
                    downloadCsv(
                      `${project?.name || 'survey'}-images${search.trim() ? '-filtered' : ''}.csv`,
                      filteredRows
                    )
                  }
                  title={
                    search.trim()
                      ? `Export ${filteredRows.length} filtered rows`
                      : `Export all ${flatRows.length} images`
                  }
                >
                  Export CSV
                </Button>
              </Card.Header>
              <Card.Body>
                {loadingFiles || !filesLoaded ? (
                  <div style={{ color: 'var(--ss-text-muted)' }}>
                    <Spinner animation='border' size='sm' /> Loading structure...
                  </div>
                ) : flatRows.length === 0 ? (
                  <div className='text-muted small fst-italic'>
                    No images uploaded yet.
                  </div>
                ) : (
                  <>
                    <div className='mb-3 d-flex gap-2 align-items-center flex-wrap'>
                      <input
                        type='text'
                        className='form-control form-control-sm'
                        placeholder='Search filename, folder, camera, or path…'
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ maxWidth: 360, flex: '1 1 240px' }}
                      />
                      {!search.trim() && (
                        <div
                          className='ms-auto'
                          style={{
                            display: 'inline-flex',
                            gap: 4,
                            padding: 3,
                            background: 'var(--ss-surface-alt)',
                            border: '1px solid var(--ss-border)',
                            borderRadius: 6,
                          }}
                        >
                          {(['summary', 'list'] as const).map((mode) => {
                            const active = viewMode === mode;
                            return (
                              <button
                                key={mode}
                                type='button'
                                onClick={() => setViewMode(mode)}
                                style={{
                                  border: 'none',
                                  background: active ? 'var(--ss-surface)' : 'transparent',
                                  color: active ? 'var(--ss-text)' : 'var(--ss-text-muted)',
                                  fontWeight: active ? 600 : 500,
                                  fontSize: 12,
                                  padding: '4px 12px',
                                  borderRadius: 4,
                                  boxShadow: active
                                    ? '0 1px 2px rgba(0,0,0,0.06)'
                                    : 'none',
                                  cursor: 'pointer',
                                  transition: 'background 0.15s, color 0.15s',
                                }}
                              >
                                {mode === 'summary' ? 'Summary' : 'List'}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {search.trim() && (
                        <>
                          <span style={{ fontSize: 12, color: 'var(--ss-text-dim)' }}>
                            {filteredRows.length} match{filteredRows.length === 1 ? '' : 'es'}
                          </span>
                          <Button
                            variant='link'
                            size='sm'
                            className='p-0'
                            onClick={() => setSearch('')}
                          >
                            Clear
                          </Button>
                        </>
                      )}
                    </div>

                    {effectiveView === 'summary' ? (
                      <div
                        style={{
                          maxHeight: 600,
                          overflowY: 'auto',
                          border: '1px solid var(--ss-border)',
                          borderRadius: 4,
                          fontSize: 13,
                        }}
                      >
                        {structure.map((camera, index) => {
                          const total = camera.folders.reduce(
                            (n, f) => n + f.images.length,
                            0
                          );
                          const isOpen = expandedCameras.has(camera.name);
                          const isLast = index === structure.length - 1;
                          return (
                            <div
                              key={camera.name + index}
                              style={{
                                borderBottom:
                                  !isLast ? '1px solid var(--ss-border-soft)' : 'none',
                              }}
                            >
                              <div
                                onClick={() => toggleCamera(camera.name)}
                                style={{
                                  cursor: 'pointer',
                                  padding: '8px 12px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  background: isOpen ? 'var(--ss-surface-alt)' : 'transparent',
                                }}
                              >
                                <div
                                  style={{
                                    color: 'var(--ss-text)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                  }}
                                >
                                  <span
                                    style={{
                                      color: 'var(--ss-text-dim)',
                                      fontSize: 10,
                                      width: 10,
                                      display: 'inline-block',
                                    }}
                                  >
                                    {isOpen ? '▼' : '▶'}
                                  </span>
                                  {camera.name}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--ss-text-dim)' }}>
                                  {camera.folders.length} folder
                                  {camera.folders.length === 1 ? '' : 's'} · {total} image
                                  {total === 1 ? '' : 's'}
                                </div>
                              </div>
                              {isOpen && (
                                <div style={{ padding: '4px 0' }}>
                                  {camera.folders.length === 0 ? (
                                    <div
                                      style={{
                                        padding: '6px 12px 6px 30px',
                                        color: 'var(--ss-text-dim)',
                                        fontStyle: 'italic',
                                        fontSize: 12,
                                      }}
                                    >
                                      No folders
                                    </div>
                                  ) : (
                                    camera.folders.map((folder) => (
                                      <div
                                        key={folder.path}
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          padding: '6px 12px 6px 30px',
                                          color: 'var(--ss-text-muted)',
                                        }}
                                      >
                                        <span>{folder.path}</span>
                                        <span style={{ color: 'var(--ss-text-dim)' }}>
                                          {folder.imageCount} image
                                          {folder.imageCount === 1 ? '' : 's'}
                                        </span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div>
                        {(() => {
                          const gridCols =
                            'minmax(160px, 2fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(160px, 1.4fr) minmax(160px, 1.2fr) minmax(90px, 0.8fr)';
                          const headers: ReadonlyArray<
                            readonly [
                              'filename' | 'camera' | 'folder' | 'timestamp' | null,
                              string
                            ]
                          > = [
                            ['filename', 'Filename'],
                            ['camera', 'Camera'],
                            ['folder', 'Folder'],
                            ['timestamp', 'Timestamp'],
                            [null, 'GPS'],
                            [null, 'Altitude'],
                          ];
                          return (
                            <div
                              style={{
                                border: '1px solid var(--ss-border)',
                                borderRadius: 4,
                                fontSize: 13,
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: gridCols,
                                  background: 'var(--ss-surface-head)',
                                  borderBottom: '1px solid var(--ss-border)',
                                  fontWeight: 600,
                                  fontSize: 11,
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.4,
                                  color: 'var(--ss-text-muted)',
                                }}
                              >
                                {headers.map(([key, label]) => (
                                  <div
                                    key={label}
                                    onClick={
                                      key
                                        ? () => {
                                            if (sortBy === key)
                                              setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                                            else {
                                              setSortBy(key);
                                              setSortDir('asc');
                                            }
                                          }
                                        : undefined
                                    }
                                    style={{
                                      padding: '8px 12px',
                                      cursor: key ? 'pointer' : 'default',
                                      userSelect: 'none',
                                    }}
                                  >
                                    {label}
                                    {key && sortBy === key
                                      ? sortDir === 'asc'
                                        ? ' ▲'
                                        : ' ▼'
                                      : ''}
                                  </div>
                                ))}
                              </div>
                              <div
                                ref={listScrollRef}
                                style={{ height: 600, overflowY: 'auto' }}
                              >
                                <div
                                  style={{
                                    height: rowVirtualizer.getTotalSize(),
                                    position: 'relative',
                                    width: '100%',
                                  }}
                                >
                                  {rowVirtualizer.getVirtualItems().map((vRow) => {
                                    const r = filteredRows[vRow.index];
                                    return (
                                      <div
                                        key={r.id}
                                        ref={rowVirtualizer.measureElement}
                                        data-index={vRow.index}
                                        style={{
                                          position: 'absolute',
                                          top: 0,
                                          left: 0,
                                          width: '100%',
                                          transform: `translateY(${vRow.start}px)`,
                                          display: 'grid',
                                          gridTemplateColumns: gridCols,
                                          borderBottom:
                                            '1px solid var(--ss-border-soft)',
                                          background:
                                            vRow.index % 2 === 1
                                              ? 'var(--ss-surface-alt)'
                                              : 'transparent',
                                        }}
                                      >
                                        <div
                                          style={{
                                            padding: '6px 12px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                          }}
                                          title={r.originalPath}
                                        >
                                          {r.filename}
                                        </div>
                                        <div style={{ padding: '6px 12px' }}>
                                          {r.cameraName}
                                        </div>
                                        <div style={{ padding: '6px 12px' }}>
                                          {r.folder}
                                        </div>
                                        <div style={{ padding: '6px 12px' }}>
                                          {r.timestamp
                                            ? new Date(r.timestamp * 1000).toLocaleString()
                                            : ''}
                                        </div>
                                        <div
                                          style={{
                                            padding: '6px 12px',
                                            color: 'var(--ss-text-dim)',
                                          }}
                                        >
                                          {r.latitude !== null && r.longitude !== null
                                            ? `${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}`
                                            : '—'}
                                        </div>
                                        <div
                                          style={{
                                            padding: '6px 12px',
                                            color: 'var(--ss-text-dim)',
                                          }}
                                        >
                                          {r.altitude !== null
                                            ? `${r.altitude.toFixed(1)} m`
                                            : '—'}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        <div
                          className='mt-2'
                          style={{ fontSize: 12, color: 'var(--ss-text-dim)' }}
                        >
                          {filteredRows.length.toLocaleString()} row
                          {filteredRows.length === 1 ? '' : 's'}
                        </div>
                        {filteredRows.length === 0 && (
                          <div className='text-muted small fst-italic mt-2'>
                            No images match your search.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <h5 className='mb-0'>Add Files</h5>
              </Card.Header>
              <Card.Body>
                {project && filesLoaded ? (
                  <FilesUploadForm
                    project={{ id: project.id, name: project.name }}
                    setOnSubmit={setUploadSubmitFn}
                    setReadyToSubmit={setReadyToSubmit}
                    newProject={false}
                    existingImages={existingImagesForUpload}
                  />
                ) : (
                  <div style={{ color: 'var(--ss-text-muted)' }}>
                    <Spinner animation='border' size='sm' /> Loading…
                  </div>
                )}
              </Card.Body>
            </Card>
            {project && filesLoaded && (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  variant='primary'
                  disabled={!readyToSubmit || isSubmitting}
                  onClick={handleUploadSubmit}
                >
                  {isSubmitting ? 'Submitting…' : 'Submit'}
                </Button>
              </div>
            )}
          </div>
        )}
      </ContentArea>

      {selectedSet && (
        <AnnotationCountModal
          show={modalToShow === 'annotationCount'}
          handleClose={() => {
            showModal(null);
            setSelectedSet(null);
          }}
          setId={selectedSet.id}
        />
      )}
      {project && selectedSet && (
        <AnnotationSetResults
          show={modalToShow === 'annotationSetResults'}
          onClose={() => {
            showModal(null);
            setSelectedSet(null);
          }}
          annotationSet={selectedSet}
          surveyId={project.id}
        />
      )}
      <ConfirmationModal
        show={modalToShow === 'cancelJob'}
        onClose={() => {
          showModal(null);
          setSelectedSet(null);
        }}
        onConfirm={handleCancelJob}
        title='Cancel Associated Job'
        body={
          <p className='mb-0'>
            Are you sure you want to cancel the job associated with{' '}
            {project?.name}?
            <br />
            You can re-launch the job later.
          </p>
        }
      />
      <ConfirmationModal
        show={modalToShow === 'deleteAnnotationSet'}
        onClose={() => {
          showModal(null);
          setSelectedSet(null);
        }}
        onConfirm={deleteSet}
        title='Delete Annotation Set'
        body={
          <p className='mb-0'>
            Are you sure you want to delete {selectedSet?.name}?
            <br />
            This action cannot be undone.
          </p>
        }
      />
    </Page>
  );
}
