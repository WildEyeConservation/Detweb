import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { Button, Form, Card } from 'react-bootstrap';
import ConfirmationModal from '../ConfirmationModal';
import Select from 'react-select';
import { X, Check } from 'lucide-react';
import { GlobalContext, UserContext } from '../Context';
import LabeledToggleSwitch from '../LabeledToggleSwitch';
import { useUsers } from '../apiInterface';
import { useOrg } from '../OrgContext';
import { fetchAllPaginatedResults } from '../utils';
import { FilesUploadForm } from '../FilesUploadComponent';
import { saveShapefileForProject } from '../utils/shapefileUtils';
import { logAdminAction } from '../utils/adminActionLogger';
import {
  Page,
  PageHeader,
  ContentArea,
  Crumb,
  CrumbSep,
} from '../ss/PageShell';

export default function NewSurvey() {
  const navigate = useNavigate();
  const { myOrganizationHook, myMembershipHook, user } =
    useContext(UserContext)!;
  const { client } = useContext(GlobalContext)!;
  const { isCurrentOrgAdmin, currentOrg } = useOrg();
  const { users: allUsers } = useUsers();
  const adminProjectIds = useMemo(
    () =>
      myMembershipHook.data
        ?.filter((m) => m.isAdmin)
        .map((m) => m.projectId) ?? [],
    [myMembershipHook.data]
  );

  // Re-check the upload-in-progress state every time the membership/org
  // selection changes — the button on /surveys is gated the same way, so the
  // route guard must follow exactly. `null` means we don't yet know.
  const [uploadCheck, setUploadCheck] = useState<
    'loading' | 'blocked' | 'allowed'
  >('loading');

  useEffect(() => {
    if (!isCurrentOrgAdmin) {
      // Non-admin: render path will deny; no need to fetch.
      setUploadCheck('allowed');
      return;
    }
    if (adminProjectIds.length === 0) {
      setUploadCheck('allowed');
      return;
    }
    setUploadCheck('loading');
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        adminProjectIds.map((id) =>
          client.models.Project.get(
            { id },
            { selectionSet: ['id', 'status', 'organizationId'] }
          )
        )
      );
      if (cancelled) return;
      // Only one survey may be uploaded from a single client at a time,
      // so check across every admin survey the user has — not just the
      // currently-selected org.
      const hasUploading = results.some(
        (r) => r.data?.status === 'uploading'
      );
      setUploadCheck(hasUploading ? 'blocked' : 'allowed');
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isCurrentOrgAdmin,
    adminProjectIds.join('|'),
    client,
    myOrganizationHook.data,
  ]);

  const accessDenied: string | null = !isCurrentOrgAdmin
    ? 'Only organisation admins can create new surveys.'
    : uploadCheck === 'blocked'
    ? 'Another survey is currently uploading. Please wait until it finishes before creating a new one.'
    : null;
  const accessChecked = isCurrentOrgAdmin
    ? uploadCheck !== 'loading'
    : myOrganizationHook.data.length > 0 ||
      (myOrganizationHook.data.length === 0 && !isCurrentOrgAdmin);

  const [filesReady, setFilesReady] = useState(false);
  const [name, setName] = useState('');
  const organization = currentOrg
    ? { label: currentOrg.name, value: currentOrg.id }
    : null;
  const [globalAnnotationAccess, setGlobalAnnotationAccess] = useState<{
    label: string;
    value: string;
  } | null>(null);
  const [addPermissionExceptions, setAddPermissionExceptions] = useState(false);
  const [permissionExceptions, setPermissionExceptions] = useState<
    {
      user: {
        id: string;
        name: string;
      };
      annotationAccess: boolean;
      temp: boolean;
    }[]
  >([]);
  const [users, setUsers] = useState<
    Record<
      string,
      {
        id: string;
        name: string;
      }[]
    >
  >({});
  const [loading, setLoading] = useState(false);
  const [uploadSubmitFn, setUploadSubmitFn] = useState<
    ((projectId: string) => Promise<void>) | null
  >(null);
  const [gpsReady, setGpsReady] = useState(false);
  const [shapefileLatLngs, setShapefileLatLngs] =
    useState<[number, number][]>();
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false);
  const [selectedModel, setSelectedModel] = useState<{
    label: string;
    value: string;
  } | null>(null);

  const canSubmit = !loading && filesReady && name && organization && gpsReady;

  const isDirty =
    !submitted &&
    !submittedRef.current &&
    (!!name ||
      !!globalAnnotationAccess ||
      addPermissionExceptions ||
      permissionExceptions.length > 0 ||
      filesReady ||
      gpsReady);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty &&
      !submittedRef.current &&
      currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  async function handleSave() {
    if (!organization) return;

    setLoading(true);

    const { data: existing } = await client.models.Project.list({
      filter: {
        name: { eq: name },
        organizationId: { eq: organization.value },
      },
      selectionSet: ['id'],
    });
    if (existing && existing.length > 0) {
      alert('A project with this name already exists');
      setLoading(false);
      return;
    }

    const { data: project } = await client.models.Project.create({
      name,
      organizationId: organization.value,
      createdBy: user.userId,
      status: 'uploading',
      group: organization.value,
    });

    if (!project) {
      alert('Failed to create survey');
      setLoading(false);
      return;
    }

    await logAdminAction(
      client,
      user.userId,
      `Created project "${name}" in organization "${organization.label}"`,
      project.id,
      organization.value
    ).catch(console.error);

    const admins = await fetchAllPaginatedResults(
      client.models.OrganizationMembership.membershipsByOrganizationId,
      {
        organizationId: organization.value,
        filter: { isAdmin: { eq: true } },
        selectionSet: ['userId'],
      }
    );

    await Promise.all(
      admins.map(async (a) => {
        await client.models.UserProjectMembership.create({
          userId: a.userId,
          projectId: project.id,
          isAdmin: true,
          group: organization.value,
        });
      })
    );

    const exceptions = permissionExceptions.filter((pe) => !pe.temp);

    await Promise.all(
      exceptions.map(async (e) => {
        if (e.annotationAccess) {
          await client.models.UserProjectMembership.create({
            userId: e.user.id,
            projectId: project.id,
            isAdmin: false,
            group: organization.value,
          });
        }
      })
    );

    const other = users[organization.value].filter(
      (u) => !exceptions.some((e) => e.user.id === u.id)
    );

    if (globalAnnotationAccess?.value === 'Yes') {
      await Promise.all(
        other.map(async (u) => {
          await client.models.UserProjectMembership.create({
            userId: u.id,
            projectId: project.id,
            isAdmin: false,
            group: organization.value,
          });
        })
      );
    }

    await client.models.ProjectTestConfig.create({
      projectId: project.id,
      testType: 'interval',
      interval: 50,
      accuracy: 50,
      postTestConfirmation: false,
      group: organization.value,
    });

    const { data: testPreset } = await client.models.TestPreset.create({
      name: name,
      organizationId: organization.value,
      group: organization.value,
    });

    if (!testPreset) {
      alert('Failed to create test preset');
      setLoading(false);
      return;
    }

    await client.models.TestPresetProject.create({
      testPresetId: testPreset.id,
      projectId: project.id,
      group: organization.value,
    });

    client.mutations.updateProjectMemberships({
      projectId: project.id,
    });

    if (uploadSubmitFn) {
      await uploadSubmitFn(project.id);
    }

    if (shapefileLatLngs && shapefileLatLngs.length > 0) {
      await saveShapefileForProject(
        client,
        project.id,
        shapefileLatLngs,
        organization.value
      );
    }

    const { data: tiledLocationSet } = await client.models.LocationSet.create({
      name: `${name} - Tiles`,
      projectId: project.id,
      description: JSON.stringify({ mode: 'tiled', global: true }),
      locationCount: 0,
      group: organization.value,
    });

    if (tiledLocationSet?.id) {
      await client.models.Project.update({
        id: project.id,
        tiledLocationSetId: tiledLocationSet.id,
      });
    }

    setLoading(false);
    submittedRef.current = true;
    setSubmitted(true);
    navigate('/surveys');
  }

  useEffect(() => {
    if (!allUsers || !currentOrg?.id) return;
    let cancelled = false;
    (async () => {
      const { data: org } = await client.models.Organization.get(
        { id: currentOrg.id },
        { selectionSet: ['name', 'id', 'memberships.*'] }
      );
      if (cancelled || !org) return;
      setUsers({
        [org.id]: org.memberships
          .filter(
            (m: { isAdmin: boolean | null; userId: string }) => !m.isAdmin
          )
          .map((m: { userId: string }) => ({
            id: m.userId,
            name: allUsers.find((u) => u.id === m.userId)?.name || '',
          })),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrg?.id, allUsers, client]);

  useEffect(() => {
    if (organization) {
      setPermissionExceptions([]);
      setAddPermissionExceptions(false);
    }
  }, [organization]);

  const breadcrumb = (
    <>
      <Crumb onClick={() => navigate('/surveys')}>Surveys</Crumb>
      <CrumbSep />
      <span>New Survey</span>
    </>
  );

  const actions = (
    <Button variant='secondary' onClick={() => navigate('/surveys')}>
      Back
    </Button>
  );

  if (accessDenied) {
    return (
      <Page>
        <PageHeader
          title='New Survey'
          breadcrumb={breadcrumb}
          actions={actions}
        />
        <ContentArea style={{ paddingTop: 16 }}>
          <Card>
            <Card.Body>
              <div style={{ marginBottom: 12 }}>{accessDenied}</div>
              <Button variant='primary' onClick={() => navigate('/surveys')}>
                Back to Surveys
              </Button>
            </Card.Body>
          </Card>
        </ContentArea>
      </Page>
    );
  }

  if (!accessChecked) {
    return (
      <Page>
        <PageHeader
          title='New Survey'
          breadcrumb={breadcrumb}
          actions={actions}
        />
        <ContentArea style={{ paddingTop: 16 }}>
          <div style={{ color: 'var(--ss-text-dim)' }}>Loading…</div>
        </ContentArea>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title='New Survey'
        breadcrumb={breadcrumb}
        actions={actions}
      />
      <ContentArea style={{ paddingTop: 16 }}>
        <div className='d-flex flex-column gap-3'>
          <Card>
            <Card.Header>
              <h5 className='mb-0'>Survey Details</h5>
            </Card.Header>
            <Card.Body>
              <Form.Group className='mb-3'>
                <Form.Label>Name</Form.Label>
                <Form.Control
                  type='text'
                  placeholder='Enter a unique identifying name for the survey.'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Form.Group>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h5 className='mb-0'>Permissions</h5>
            </Card.Header>
            <Card.Body className='p-0'>
              <div
                style={{
                  color: 'var(--ss-text-muted)',
                  fontSize: 12,
                  lineHeight: 1.4,
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--ss-border-soft)',
                }}
              >
                Set the default annotation access for all organisation members
                (excluding yourself and admins). Add per-user exceptions below
                to override the default.
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 16,
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--ss-border-soft)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flex: '0 1 auto',
                  }}
                >
                  <Form.Label className='mb-0' style={{ fontSize: 13 }}>
                    Default Annotation Access
                  </Form.Label>
                  <div style={{ minWidth: 160 }}>
                    <Select
                      className='text-black'
                      value={globalAnnotationAccess}
                      placeholder='Default (No)'
                      options={[
                        { value: 'Yes', label: 'Yes' },
                        { value: 'No', label: 'No' },
                      ]}
                      onChange={(e) => setGlobalAnnotationAccess(e)}
                      menuPortalTarget={
                        typeof document !== 'undefined'
                          ? document.body
                          : undefined
                      }
                      styles={{
                        valueContainer: (base) => ({
                          ...base,
                          overflowY: 'auto',
                        }),
                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                      }}
                    />
                  </div>
                </div>
                <div style={{ flex: 1 }} />
                <Form.Switch
                  style={{ fontSize: 13 }}
                  id='addPermissionExceptions'
                  label='Add permission exceptions'
                  checked={addPermissionExceptions}
                  onChange={(e) => {
                    if (!organization) {
                      alert('Please select an organisation first');
                      return;
                    }
                    setAddPermissionExceptions(e.target.checked);
                    if (!e.target.checked) {
                      setPermissionExceptions([]);
                    }
                  }}
                />
              </div>
              {addPermissionExceptions && (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table className='ss-data-table'>
                      <thead>
                        <tr>
                          <th>Username</th>
                          <th>Annotation Access</th>
                          <th style={{ textAlign: 'right' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {permissionExceptions.map((exception) => (
                          <tr key={exception.user.id}>
                            <td>
                              <Select
                                className='text-black'
                                value={{
                                  label: exception.user.name,
                                  value: exception.user.id,
                                }}
                                options={users[organization?.value || '']
                                  ?.filter(
                                    (u) =>
                                      !permissionExceptions.some(
                                        (pe) => pe.user.id === u.id
                                      )
                                  )
                                  .map((u) => ({
                                    label: u.name,
                                    value: u.id,
                                  }))}
                                menuPortalTarget={
                                  typeof document !== 'undefined'
                                    ? document.body
                                    : undefined
                                }
                                styles={{
                                  menuPortal: (base) => ({
                                    ...base,
                                    zIndex: 9999,
                                  }),
                                }}
                                onChange={(selected) => {
                                  setPermissionExceptions(
                                    permissionExceptions.map((pe) =>
                                      pe.user.id === exception.user.id
                                        ? {
                                            ...pe,
                                            user: {
                                              ...pe.user,
                                              id:
                                                selected?.value || pe.user.id,
                                              name:
                                                selected?.label ||
                                                pe.user.name,
                                            },
                                            temp: false,
                                          }
                                        : pe
                                    )
                                  );
                                }}
                              />
                            </td>
                            <td>
                              <LabeledToggleSwitch
                                className='mb-0'
                                leftLabel='No'
                                rightLabel='Yes'
                                checked={exception.annotationAccess}
                                onChange={(checked) => {
                                  setPermissionExceptions(
                                    permissionExceptions.map((pe) =>
                                      pe.user.id === exception.user.id
                                        ? { ...pe, annotationAccess: checked }
                                        : pe
                                    )
                                  );
                                }}
                              />
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <Button
                                variant='outline-danger'
                                size='sm'
                                onClick={() => {
                                  setPermissionExceptions(
                                    permissionExceptions.filter(
                                      (e) => e.user.id !== exception.user.id
                                    )
                                  );
                                }}
                              >
                                Remove
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {permissionExceptions.length === 0 && (
                          <tr>
                            <td
                              colSpan={3}
                              style={{
                                textAlign: 'center',
                                color: 'var(--ss-text-dim)',
                                padding: '24px',
                              }}
                            >
                              No exceptions added yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div
                    style={{
                      padding: '12px 16px',
                      borderTop: '1px solid var(--ss-border-soft)',
                    }}
                  >
                    <Button
                      variant='secondary'
                      size='sm'
                      onClick={() => {
                        if (permissionExceptions.some((e) => e.temp)) {
                          alert(
                            'Please complete the current permission exception before adding another'
                          );
                          return;
                        }
                        setPermissionExceptions([
                          ...permissionExceptions,
                          {
                            user: {
                              id: crypto.randomUUID(),
                              name: 'Select a user',
                            },
                            annotationAccess: false,
                            temp: true,
                          },
                        ]);
                      }}
                    >
                      + Add exception
                    </Button>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>

          <FilesUploadForm
            setOnSubmit={setUploadSubmitFn}
            setReadyToSubmit={setFilesReady}
            setGpsDataReady={setGpsReady}
            onShapefileParsed={(latLngs) => setShapefileLatLngs(latLngs)}
            onModelChange={setSelectedModel}
          />

          <Card>
            <Card.Header>
              <h5 className='mb-0'>Ready to Submit</h5>
            </Card.Header>
            <Card.Body>
              <ul className='list-unstyled mb-0'>
                <li style={{ color: organization ? 'lime' : 'red' }}>
                  Organisation:{' '}
                  {organization ? (
                    <span style={{ color: 'var(--ss-text)' }}>
                      {organization.label}
                    </span>
                  ) : (
                    <X />
                  )}
                </li>
                <li style={{ color: name ? 'lime' : 'red' }}>
                  Name: {name ? <Check /> : <X />}
                </li>
                <li style={{ color: filesReady ? 'lime' : 'red' }}>
                  Files: {filesReady ? <Check /> : <X />}
                </li>
                <li style={{ color: gpsReady ? 'lime' : 'red' }}>
                  GPS Data: {gpsReady ? <Check /> : <X />}
                </li>
                <li style={{ color: selectedModel ? 'lime' : 'red' }}>
                  Processing Model:{' '}
                  {selectedModel ? (
                    <span style={{ color: 'var(--ss-text)' }}>
                      {selectedModel.label}
                    </span>
                  ) : (
                    <X />
                  )}
                </li>
              </ul>
            </Card.Body>
          </Card>

          <div className='d-flex justify-content-start'>
            <Button
              variant='primary'
              onClick={handleSave}
              disabled={!canSubmit}
            >
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      </ContentArea>
      <ConfirmationModal
        show={blocker.state === 'blocked'}
        onClose={() => blocker.state === 'blocked' && blocker.reset()}
        onConfirm={() => blocker.state === 'blocked' && blocker.proceed()}
        title='Discard new survey?'
        body={
          <p className='mb-0'>
            You have unsaved changes on this page. If you leave now, the
            survey will not be created and any uploaded file progress will be
            lost.
          </p>
        }
      />
    </Page>
  );
}
