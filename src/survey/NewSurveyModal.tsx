import { Button, Form, Modal } from 'react-bootstrap';
import { useState } from 'react';
import { GlobalContext, UserContext } from '../Context';
import { useContext, useEffect } from 'react';
import Select from 'react-select';
import LabeledToggleSwitch from '../LabeledToggleSwitch';
import MyTable from '../Table';
import { useUsers } from '../apiInterface';
import { fetchAllPaginatedResults } from '../utils';

export default function NewSurveyModal({
  show,
  onClose,
}: {
  show: boolean;
  onClose: () => void;
}) {
  const { myOrganizationHook, user } = useContext(UserContext)!;
  const { client } = useContext(GlobalContext)!;
  const { users: allUsers } = useUsers();

  const [name, setName] = useState('');
  const [organization, setOrganization] = useState<{
    label: string;
    value: string;
  } | null>(null);
  const [organizations, setOrganizations] = useState<
    { label: string; value: string }[]
  >([]);
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

  async function handleSave() {
    if (!name || !organization) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);

    const { data: project } = await client.models.Project.create({
      name,
      organizationId: organization.value,
      createdBy: user.userId,
    });

    if (project) {
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
            });
          }
        })
      );

      // users already exclude current user and admins
      const other = users[organization.value].filter(
        (u) => !exceptions.some((e) => e.user.id === u.id)
      );

      if (
        globalAnnotationAccess === null ||
        globalAnnotationAccess?.value === 'Yes'
      ) {
        await Promise.all(
          other.map(async (u) => {
            await client.models.UserProjectMembership.create({
              userId: u.id,
              projectId: project.id,
              isAdmin: false,
            });
          })
        );
      }
    }

    setLoading(false);
    onClose();
  }

  useEffect(() => {
    if (allUsers && myOrganizationHook.data) {
      const adminOrganizations = myOrganizationHook.data.filter(
        (o) => o.isAdmin
      );

      Promise.all(
        adminOrganizations.map(
          async (o) =>
            (
              await client.models.Organization.get(
                {
                  id: o.organizationId,
                },
                {
                  selectionSet: ['name', 'id', 'memberships.*'],
                }
              )
            ).data
        )
      ).then((organizations) => {
        setOrganizations(
          organizations
            .filter((o) => o !== null)
            .map((o) => ({
              label: o.name,
              value: o.id,
            }))
        );

        setUsers(
          organizations
            .filter((o) => o !== null)
            .reduce(
              (acc, o) => ({
                ...acc,
                [o.id]: o.memberships
                  .filter((m) => !m.isAdmin)
                  .map((m) => ({
                    id: m.userId,
                    name: allUsers.find((u) => u.id === m.userId)?.name || '',
                  })),
              }),
              {}
            )
        );
      });
    }
  }, [myOrganizationHook.data, allUsers]);

  useEffect(() => {
    if (!show) {
      setName('');
      setOrganization(null);
      setGlobalAnnotationAccess(null);
      setAddPermissionExceptions(false);
      setPermissionExceptions([]);
    }
  }, [show]);

  return (
    <Modal show={show} onHide={onClose} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>New Survey</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form className="d-flex flex-column gap-2">
          <Form.Group>
            <Form.Label>Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter a unique identifying name for the survey."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Organization</Form.Label>
            <Select
              value={organization}
              options={organizations}
              onChange={(e) => setOrganization(e)}
              styles={{
                valueContainer: (base) => ({
                  ...base,
                  minHeight: '48px',
                  overflowY: 'auto',
                }),
              }}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label className="mb-0">Permissions</Form.Label>
            <span
              className="text-muted d-block mb-1"
              style={{ fontSize: 12, lineHeight: 1.2 }}
            >
              Select the user permissions for non-admin users for this survey
              excluding yourself.
            </span>
            <div className="mb-2">
              <Form.Label style={{ fontSize: 14 }}>
                Annotation Access:
              </Form.Label>
              <Select
                value={globalAnnotationAccess}
                placeholder="Default"
                options={[
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' },
                ]}
                onChange={(e) => setGlobalAnnotationAccess(e)}
                styles={{
                  valueContainer: (base) => ({
                    ...base,
                    minHeight: '48px',
                    overflowY: 'auto',
                  }),
                }}
              />
            </div>
            <Form.Switch
              style={{ fontSize: 14 }}
              id="addPermissionExceptions"
              label="Add Permission Exceptions"
              checked={addPermissionExceptions}
              onChange={(e) => {
                if (!organization) {
                  alert('Please select an organization first');
                  return;
                }
                setAddPermissionExceptions(e.target.checked);
                if (!e.target.checked) {
                  setPermissionExceptions([]);
                }
              }}
            />
            {addPermissionExceptions && (
              <>
                <MyTable
                  tableHeadings={[
                    { content: 'Username' },
                    { content: 'Annotation Access' },
                    { content: 'Remove Exception' },
                  ]}
                  tableData={permissionExceptions.map((exception) => ({
                    id: exception.user.id,
                    rowData: [
                      <Select
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
                        onChange={(selected) => {
                          setPermissionExceptions(
                            permissionExceptions.map((pe) =>
                              pe.user.id === exception.user.id
                                ? {
                                    ...pe,
                                    user: {
                                      ...pe.user,
                                      id: selected?.value || pe.user.id,
                                      name: selected?.label || pe.user.name,
                                    },
                                    temp: false,
                                  }
                                : pe
                            )
                          );
                        }}
                      />,
                      <LabeledToggleSwitch
                        className="mb-0"
                        leftLabel="No"
                        rightLabel="Yes"
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
                      />,
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setPermissionExceptions(
                            permissionExceptions.filter(
                              (e) => e.user.id !== exception.user.id
                            )
                          );
                        }}
                      >
                        Remove
                      </Button>,
                    ],
                  }))}
                />
                <Button
                  variant="info"
                  size="sm"
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
                  +
                </Button>
              </>
            )}
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={loading}>
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
