import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { useQueryClient } from '@tanstack/react-query';
import { GlobalContext, UserContext } from '../Context';
import { Schema } from '../amplify/client-schema';
import ConfirmationModal from '../ConfirmationModal';
import { logAdminAction } from '../utils/adminActionLogger';
import {
  Page,
  PageHeader,
  TabBar,
  ContentArea,
  Crumb,
  CrumbSep,
} from '../ss/PageShell';
import EditInformation from './EditInformation';
import EditCameras from './EditCameras';
import EditShapeFile from './EditShapeFile';
import DefineTransects from './DefineTransects';
import ManageTiles from './ManageTiles';
import ProcessImages from './ProcessImages';
import ManageUsers from './ManageUsers';
import DeleteImages from './DeleteImages';
import AdvancedOptions from './AdvancedOptions';
import Logs from './Logs';

const PROJECT_SELECTION_SET = [
  'id',
  'name',
  'organizationId',
  'organization.name',
  'status',
  'tiledLocationSetId',
  'annotationSets.id',
  'annotationSets.name',
  'annotationSets.register',
  'queues.id',
  'queues.url',
  'queues.name',
  'queues.tag',
  'imageSets.imageCount',
] as const;

const TABS = [
  { id: 'information', label: 'Information' },
  { id: 'cameras', label: 'Cameras' },
  { id: 'shapefile', label: 'Shapefile' },
  { id: 'transects', label: 'Transects & Strata' },
  { id: 'tiles', label: 'Manage Tiles' },
  { id: 'process', label: 'Process Images' },
  { id: 'users', label: 'Manage Users' },
  { id: 'deleteImages', label: 'Delete Images' },
  { id: 'advanced', label: 'Advanced Options' },
  { id: 'logs', label: 'Logs' },
  { id: 'danger', label: 'Danger Zone' },
];

export default function SurveySettings() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const { client } = useContext(GlobalContext)!;
  const { user } = useContext(UserContext)!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [project, setProject] = useState<Schema['Project']['type'] | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<string>('information');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!surveyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await client.models.Project.get(
        { id: surveyId },
        { selectionSet: PROJECT_SELECTION_SET as unknown as string[] }
      );
      if (!cancelled) {
        setProject(data as Schema['Project']['type'] | null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [surveyId, client]);

  const handleDelete = async () => {
    if (!project) return;
    const projectName = project.name;
    const projectId = project.id;

    await client.models.Project.update({
      id: projectId,
      status: 'deleting',
    });

    await logAdminAction(
      client,
      user.userId,
      `Deleted project "${projectName}" (ID: ${projectId})`,
      projectId,
      project.organizationId || ''
    );

    client.mutations
      .deleteProjectInFull({ projectId }, { retry: false })
      .catch(() => {});

    queryClient.invalidateQueries({ queryKey: ['surveys-project-details'] });
    navigate('/surveys');
  };

  const breadcrumb = (
    <>
      <Crumb onClick={() => navigate('/surveys')}>Surveys</Crumb>
      <CrumbSep />
      <Crumb onClick={() => navigate(`/surveys/${surveyId}/detail`)}>
        {project?.name || surveyId}
      </Crumb>
      <CrumbSep />
      <span>Settings</span>
    </>
  );

  if (!project) {
    return (
      <Page>
        <PageHeader title='Survey Settings' breadcrumb={breadcrumb} />
        <ContentArea>
          <div style={{ color: 'var(--ss-text-dim)' }}>Loading…</div>
        </ContentArea>
      </Page>
    );
  }

  const projectId = project.id;
  const organizationId = project.organizationId;

  const renderTab = () => {
    switch (activeTab) {
      case 'information':
        return <EditInformation key={projectId} projectId={projectId} />;
      case 'cameras':
        return (
          <EditCameras
            key={projectId}
            projectId={projectId}
            organizationId={organizationId}
          />
        );
      case 'shapefile':
        return (
          <EditShapeFile
            key={projectId}
            projectId={projectId}
            organizationId={organizationId}
          />
        );
      case 'transects':
        return (
          <DefineTransects
            key={projectId}
            projectId={projectId}
            organizationId={organizationId}
          />
        );
      case 'tiles':
        return <ManageTiles key={projectId} project={project} />;
      case 'process':
        return (
          <ProcessImages
            key={projectId}
            projectId={projectId}
            organizationId={organizationId}
          />
        );
      case 'users':
        return (
          <ManageUsers
            key={projectId}
            projectId={projectId}
            organizationId={organizationId}
          />
        );
      case 'deleteImages':
        return <DeleteImages key={projectId} projectId={projectId} />;
      case 'advanced':
        return <AdvancedOptions key={projectId} projectId={projectId} />;
      case 'logs':
        return <Logs key={projectId} projectId={projectId} />;
      case 'danger':
        return (
          <div
            className='ss-card'
            style={{
              padding: 20,
              borderColor: 'var(--ss-danger, #dc3545)',
              borderWidth: 1,
              borderStyle: 'solid',
            }}
          >
            <h4 style={{ marginTop: 0, marginBottom: 8 }}>Delete Survey</h4>
            <p style={{ color: 'var(--ss-text-dim)', marginBottom: 16 }}>
              Permanently deletes <strong>{project.name}</strong> along with
              all of its images, annotations, and associated jobs. This action
              cannot be undone.
            </p>
            <Button
              variant='danger'
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete this survey
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  // "Active" means status === 'active' AND no active jobs. The Surveys page
  // shows "Launched" as a derived status when queues/register are present,
  // and that counts as not-active for editing here too.
  const hasActiveJob =
    ((project.queues as { id: string }[] | undefined)?.length ?? 0) > 0 ||
    (
      (project.annotationSets as { register?: boolean | null }[] | undefined) ??
      []
    ).some((s) => s.register === true);
  const rawStatus = (project.status || '').toLowerCase();
  const isActive = rawStatus === 'active' && !hasActiveJob;
  const allowedWhenInactive = new Set(['users', 'logs']);
  const lockTab = !isActive && !allowedWhenInactive.has(activeTab);
  const inactiveStatusLabel =
    hasActiveJob && rawStatus === 'active'
      ? 'launched'
      : rawStatus || 'inactive';

  return (
    <>
      <Page>
        <PageHeader title='Survey Settings' breadcrumb={breadcrumb} />
        <TabBar
          tabs={TABS}
          active={activeTab}
          onChange={setActiveTab}
        />
        <ContentArea style={{ paddingTop: 16 }}>
          <div style={{ position: 'relative' }}>
            <div
              aria-hidden={lockTab}
              style={{
                pointerEvents: lockTab ? 'none' : 'auto',
                userSelect: lockTab ? 'none' : 'auto',
              }}
            >
              {renderTab()}
            </div>
            {lockTab && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(255, 255, 255, 0.35)',
                  backdropFilter: 'blur(8px) saturate(120%)',
                  WebkitBackdropFilter: 'blur(8px) saturate(120%)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                }}
              >
                <div
                  style={{
                    maxWidth: 440,
                    padding: '18px 22px',
                    textAlign: 'center',
                    background: 'rgba(255, 255, 255, 0.92)',
                    border: '1px solid var(--ss-border)',
                    borderRadius: 10,
                    boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
                    color: 'var(--ss-text)',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    Survey is {inactiveStatusLabel}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--ss-text-muted)',
                    }}
                  >
                    These settings are only available while the survey is
                    active. You can still use the Manage Users and Logs tabs.
                  </div>
                </div>
              </div>
            )}
          </div>
        </ContentArea>
      </Page>
      <ConfirmationModal
        show={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title='Delete Survey'
        body={
          <p className='mb-0'>
            Are you sure you want to delete {project.name}?
            <br />
            This action cannot be undone.
          </p>
        }
      />
    </>
  );
}
