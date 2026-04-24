import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Button, Card, Form } from 'react-bootstrap';
import { GlobalContext } from '../Context';
import { useUsers } from '../apiInterface';
import { fetchAllPaginatedResults } from '../utils';
import LabeledToggleSwitch from '../LabeledToggleSwitch';

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];
const ROWS_PER_PAGE_STORAGE_KEY = 'manageUsersRowsPerPage';

type SortOption =
  | 'userName'
  | 'userName-reverse'
  | 'userEmail'
  | 'userEmail-reverse';

type UserPermission = {
  userId: string;
  userName: string;
  userEmail: string;
  membershipId: string | null;
  annotationAccess: boolean;
  isAdmin: boolean;
  isOrgAdmin: boolean;
};

export default function ManageUsers({
  projectId,
  organizationId,
}: {
  projectId: string;
  organizationId: string;
}) {
  const { client } = useContext(GlobalContext)!;
  const { users } = useUsers();

  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [originalPermissions, setOriginalPermissions] = useState<
    UserPermission[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('userName');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const getInitialRowsPerPage = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(ROWS_PER_PAGE_STORAGE_KEY);
      const parsed = stored ? parseInt(stored, 10) : NaN;
      if (ROWS_PER_PAGE_OPTIONS.includes(parsed)) {
        return parsed;
      }
    }
    return 10;
  };

  const [itemsPerPage, setItemsPerPage] = useState(getInitialRowsPerPage);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ROWS_PER_PAGE_STORAGE_KEY, String(itemsPerPage));
    }
  }, [itemsPerPage]);

  const fetchData = useCallback(async function fetchData() {
    if (!users) return;
    setIsLoading(true);

    try {
      const [orgMemberships, projectMemberships] = await Promise.all([
        fetchAllPaginatedResults(
          client.models.OrganizationMembership
            .membershipsByOrganizationId,
          {
            organizationId,
            selectionSet: ['userId', 'isAdmin'] as const,
          }
        ),
        fetchAllPaginatedResults(
          client.models.UserProjectMembership
            .userProjectMembershipsByProjectId,
          {
            projectId,
            selectionSet: ['id', 'userId', 'isAdmin'] as const,
          }
        ),
      ]);

      const userPermissions: UserPermission[] = orgMemberships.map(
        (orgMembership) => {
          const user = users.find((u) => u.id === orgMembership.userId);
          const projectMembership = projectMemberships.find(
            (pm) => pm.userId === orgMembership.userId
          );

          return {
            userId: orgMembership.userId,
            userName: user?.name ?? 'Unknown',
            userEmail: user?.email ?? '',
            membershipId: projectMembership?.id ?? null,
            annotationAccess: !!projectMembership,
            isAdmin: !!projectMembership?.isAdmin,
            isOrgAdmin: !!orgMembership.isAdmin,
          };
        }
      );

      // Sort: org admins first, then alphabetically by name
      userPermissions.sort((a, b) => {
        if (a.isOrgAdmin !== b.isOrgAdmin)
          return a.isOrgAdmin ? -1 : 1;
        return a.userName.localeCompare(b.userName);
      });

      setPermissions(userPermissions);
      setOriginalPermissions(userPermissions);
    } finally {
      setIsLoading(false);
    }
  }, [users, client, projectId, organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasChanges = permissions.some(
    (p) =>
      !originalPermissions.some(
        (op) =>
          op.userId === p.userId &&
          op.annotationAccess === p.annotationAccess &&
          op.isAdmin === p.isAdmin
      )
  );

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const permissionsToUpdate = permissions.filter(
        (p) =>
          !originalPermissions.some(
            (op) =>
              op.userId === p.userId &&
              op.annotationAccess === p.annotationAccess &&
              op.isAdmin === p.isAdmin
          )
      );

      for (const permission of permissionsToUpdate) {
        if (permission.membershipId) {
          if (!permission.isAdmin && !permission.annotationAccess) {
            await client.models.UserProjectMembership.delete({
              id: permission.membershipId,
            });
          } else {
            await client.models.UserProjectMembership.update({
              id: permission.membershipId,
              isAdmin: permission.isAdmin,
            });
          }
        } else if (permission.annotationAccess || permission.isAdmin) {
          const { data: existingRows } =
            await client.models.UserProjectMembership.userProjectMembershipsByUserId(
              { userId: permission.userId },
              { filter: { projectId: { eq: projectId } } }
            );

          if (existingRows && existingRows.length > 0) {
            if (existingRows.length > 1) {
              console.warn(
                `Found ${existingRows.length} memberships for user ${permission.userId} in project ${projectId}`
              );
            }
            await client.models.UserProjectMembership.update({
              id: existingRows[0].id,
              isAdmin: permission.isAdmin,
            });
          } else {
            await client.models.UserProjectMembership.create({
              userId: permission.userId,
              projectId,
              isAdmin: permission.isAdmin,
              group: organizationId,
            });
          }
        }
      }

      // Refetch to get correct membershipIds for created/deleted records
      await fetchData();
    } catch (err: any) {
      alert(err.message ?? 'Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredPermissions = useMemo(() => {
    const searchLower = search.toLowerCase();
    if (searchLower === '') return permissions;
    return permissions.filter(
      (p) =>
        p.userName.toLowerCase().includes(searchLower) ||
        p.userEmail.toLowerCase().includes(searchLower)
    );
  }, [permissions, search]);

  const sortedPermissions = useMemo(() => {
    const sorted = [...filteredPermissions];
    switch (sortBy) {
      case 'userName':
        return sorted.sort((a, b) => a.userName.localeCompare(b.userName));
      case 'userName-reverse':
        return sorted.sort((a, b) => b.userName.localeCompare(a.userName));
      case 'userEmail':
        return sorted.sort((a, b) => a.userEmail.localeCompare(b.userEmail));
      case 'userEmail-reverse':
        return sorted.sort((a, b) => b.userEmail.localeCompare(a.userEmail));
      default:
        return sorted;
    }
  }, [filteredPermissions, sortBy]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedPermissions.length / itemsPerPage)
  );
  const pageClamped = Math.min(Math.max(1, currentPage), totalPages);
  const pagedPermissions = sortedPermissions.slice(
    (pageClamped - 1) * itemsPerPage,
    pageClamped * itemsPerPage
  );

  return (
    <div className='d-flex flex-column gap-3'>
      <Card>
        <Card.Header>
          <h5 className='mb-0'>Manage User Access</h5>
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
            Grant or revoke annotation and admin access for each organisation
            member on this survey. Organisation admins automatically have full
            access and cannot be modified here. Enabling admin access
            automatically grants annotation access.
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid var(--ss-border-soft)',
            }}
          >
            <Form.Control
              type='text'
              placeholder='Search users…'
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                minWidth: 0,
                maxWidth: '260px',
                flex: '0 1 auto',
              }}
            />
            <Form.Select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortOption);
                setCurrentPage(1);
              }}
              style={{
                minWidth: 0,
                maxWidth: '200px',
                flex: '0 1 auto',
              }}
            >
              <option value='userName'>Name (A-Z)</option>
              <option value='userName-reverse'>Name (Z-A)</option>
              <option value='userEmail'>Email (A-Z)</option>
              <option value='userEmail-reverse'>Email (Z-A)</option>
            </Form.Select>
            <div style={{ flex: 1 }} />
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
                  setCurrentPage(1);
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
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={pageClamped === 1}
                style={{ padding: '2px 10px' }}
              >
                ‹
              </Button>
              <Button
                size='sm'
                variant='secondary'
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageClamped === totalPages}
                style={{ padding: '2px 10px' }}
              >
                ›
              </Button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className='ss-data-table'>
              <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Annotation Access</th>
                <th>Admin</th>
              </tr>
            </thead>
            <tbody>
              {pagedPermissions.map((permission) => (
                <tr key={permission.userId}>
                  <td>{permission.userName}</td>
                  <td>{permission.userEmail}</td>
                  <td>
                    <LabeledToggleSwitch
                      className='mb-0'
                      leftLabel='No'
                      rightLabel='Yes'
                      checked={permission.annotationAccess}
                      disabled={permission.isOrgAdmin || isSaving}
                      onChange={(checked) => {
                        if (permission.isAdmin && !checked) {
                          return;
                        }
                        setPermissions(
                          permissions.map((p) =>
                            p.userId === permission.userId
                              ? { ...p, annotationAccess: checked }
                              : p
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
                      checked={permission.isAdmin}
                      disabled={permission.isOrgAdmin || isSaving}
                      onChange={(checked) => {
                        setPermissions(
                          permissions.map((p) =>
                            p.userId === permission.userId
                              ? {
                                  ...p,
                                  isAdmin: checked,
                                  annotationAccess: checked
                                    ? true
                                    : p.annotationAccess,
                                }
                              : p
                          )
                        );
                      }}
                    />
                  </td>
                </tr>
              ))}
              {pagedPermissions.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: 'center',
                      color: 'var(--ss-text-dim)',
                      padding: '24px',
                    }}
                  >
                    {isLoading ? 'Loading...' : 'No users found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </Card.Body>
      </Card>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          variant='primary'
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
