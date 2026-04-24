import { Button, Form, Spinner } from 'react-bootstrap';
import { Schema } from '../amplify/client-schema';
import { useContext, useState, useEffect } from 'react';
import { GlobalContext, UserContext } from '../Context';
import { useUsers } from '../apiInterface';
import InviteUserModal from './InviteUserModal';
import ExceptionsModal from './ExceptionsModal';
import LabeledToggleSwitch from '../LabeledToggleSwitch';
import ConfirmationModal from '../ConfirmationModal';
import { RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

const STORAGE_KEYS = {
  SEARCH: 'orgUsersSearch',
  SORT_BY: 'orgUsersSortBy',
  ROWS_PER_PAGE: 'orgUsersRowsPerPage',
};

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function Users({
  organization,
  setOnClick,
}: {
  organization: { id: string; name: string };
  setOnClick: (onClick: { name: string; function: () => void }) => void;
}) {
  const { client, showModal, modalToShow } = useContext(GlobalContext)!;
  const { user: authUser } = useContext(UserContext)!;
  const { users } = useUsers();

  const {
    data: memberships,
    isLoading: membershipsLoading,
    refetch,
    isFetching,
  } = useQuery<Schema['OrganizationMembership']['type'][]>({
    queryKey: ['OrganizationMembership', organization.id],
    queryFn: async () => {
      const allItems: Schema['OrganizationMembership']['type'][] = [];
      let nextToken: string | undefined;
      do {
        const result =
          await client.models.OrganizationMembership.membershipsByOrganizationId(
            { organizationId: organization.id },
            { nextToken }
          );
        allItems.push(...result.data);
        nextToken = result.nextToken ?? undefined;
      } while (nextToken);
      return allItems;
    },
  });

  const isLoading = !users || membershipsLoading;
  const [userToEdit, setUserToEdit] = useState<{
    id: string;
    name: string;
    organizationName: string;
  } | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [page, setPage] = useState(1);

  const getInitialSearch = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.SEARCH);
      if (stored !== null) return stored;
    }
    return '';
  };
  const getInitialSortBy = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.SORT_BY);
      if (stored) return stored;
    }
    return 'name';
  };
  const getInitialRowsPerPage = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.ROWS_PER_PAGE);
      const parsed = stored ? parseInt(stored, 10) : NaN;
      if (ROWS_PER_PAGE_OPTIONS.includes(parsed)) return parsed;
    }
    return 10;
  };

  const [search, setSearch] = useState(getInitialSearch);
  const [sortBy, setSortBy] = useState(getInitialSortBy);
  const [itemsPerPage, setItemsPerPage] = useState(getInitialRowsPerPage);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SEARCH, search);
    }
  }, [search]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SORT_BY, sortBy);
    }
  }, [sortBy]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ROWS_PER_PAGE, String(itemsPerPage));
    }
  }, [itemsPerPage]);

  const getIsMobile = () =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
  const [isMobile, setIsMobile] = useState(getIsMobile);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(getIsMobile());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  async function updateUser(userId: string, isAdmin: boolean) {
    setIsMutating(true);
    try {
      const { errors } = await client.mutations.updateOrganizationMemberAdmin({
        organizationId: organization.id,
        userId,
        isAdmin,
      });

      if (errors?.length) {
        alert(errors[0].message);
        return;
      }
      await refetch();
    } catch (err: any) {
      alert(err.message ?? 'Failed to update admin status');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRemoveUser() {
    setIsMutating(true);
    try {
      const { errors } = await client.mutations.removeUserFromOrganization({
        organizationId: organization.id,
        userId: userToEdit!.id,
      });

      if (errors?.length) {
        alert(errors[0].message);
        return;
      }
      refetch();
    } catch (err: any) {
      alert(err.message ?? 'Failed to remove user');
    } finally {
      setIsMutating(false);
    }
  }

  useEffect(() => {
    setOnClick({
      name: '+ Invite User',
      function: () => showModal('inviteUser'),
    });
  }, []);

  const allRows = (memberships ?? []).map((membership) => {
    const user = users?.find((u) => u.id === membership.userId);
    return { membership, user };
  });

  const searchLower = search.toLowerCase();
  const filteredRows = allRows.filter(({ user }) => {
    if (searchLower === '') return true;
    return (
      (user?.name ?? '').toLowerCase().includes(searchLower) ||
      (user?.email ?? '').toLowerCase().includes(searchLower)
    );
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (sortBy === 'name') {
      return (a.user?.name ?? '').localeCompare(b.user?.name ?? '');
    }
    if (sortBy === 'name-reverse') {
      return (b.user?.name ?? '').localeCompare(a.user?.name ?? '');
    }
    if (sortBy === 'email') {
      return (a.user?.email ?? '').localeCompare(b.user?.email ?? '');
    }
    if (sortBy === 'email-reverse') {
      return (b.user?.email ?? '').localeCompare(a.user?.email ?? '');
    }
    if (sortBy === 'admin') {
      const aAdmin = a.membership.isAdmin ? 1 : 0;
      const bAdmin = b.membership.isAdmin ? 1 : 0;
      if (aAdmin !== bAdmin) return bAdmin - aAdmin;
      return (a.user?.name ?? '').localeCompare(b.user?.name ?? '');
    }
    return 0;
  });

  const rows = sortedRows;
  const totalPages = Math.max(1, Math.ceil(rows.length / itemsPerPage));
  const pageClamped = Math.min(Math.max(1, page), totalPages);
  const pagedRows = rows.slice(
    (pageClamped - 1) * itemsPerPage,
    pageClamped * itemsPerPage
  );

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--ss-text)',
          }}
        >
          Organisation Users
        </h2>
        <Button
          variant='link'
          size='sm'
          style={{
            padding: 0,
            color: 'var(--ss-text-muted)',
            display: 'flex',
            alignItems: 'center',
          }}
          onClick={() => refetch()}
          disabled={isFetching}
          title='Refresh'
        >
          <RefreshCw
            size={14}
            className={isFetching ? 'spinning' : undefined}
          />
        </Button>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <Form.Control
          type='text'
          style={{
            minWidth: 0,
            maxWidth: isMobile ? '100%' : '260px',
            flex: isMobile ? '1 1 100%' : '0 1 auto',
          }}
          placeholder='Search users…'
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
          <option value='name'>Name (A-Z)</option>
          <option value='name-reverse'>Name (Z-A)</option>
          <option value='email'>Email (A-Z)</option>
          <option value='email-reverse'>Email (Z-A)</option>
          <option value='admin'>Admins first</option>
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
      </div>
      <div className='ss-card' style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 48,
              gap: 12,
            }}
          >
            <Spinner animation='border' size='sm' />
            <span style={{ fontSize: 13, color: 'var(--ss-text-dim)' }}>
              Loading users...
            </span>
          </div>
        ) : rows.length === 0 ? (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              color: 'var(--ss-text-dim)',
              fontSize: 13,
            }}
          >
            No users found
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className='ss-data-table'>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Organisation Admin</th>
                  <th>Permission Exceptions</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map(({ membership, user }) => {
                  const isSelf = membership.userId === authUser.userId;
                  return (
                    <tr
                      key={membership.organizationId + membership.userId}
                    >
                      <td style={{ fontWeight: 500 }}>{user?.name}</td>
                      <td style={{ color: 'var(--ss-text-muted)' }}>
                        {user?.email}
                      </td>
                      <td>
                        <LabeledToggleSwitch
                          className='mb-0'
                          leftLabel='No'
                          rightLabel='Yes'
                          checked={membership.isAdmin ?? false}
                          disabled={isMutating || isSelf}
                          onChange={(checked) => {
                            updateUser(membership.userId, checked);
                          }}
                        />
                      </td>
                      <td>
                        <Button
                          size='sm'
                          variant='secondary'
                          disabled={
                            process.env.NODE_ENV !== 'development' &&
                            !!membership.isAdmin
                          }
                          onClick={() => {
                            setUserToEdit({
                              id: user?.id || '',
                              name: user?.name || '',
                              organizationName: organization.name,
                            });
                            showModal('exceptions');
                          }}
                        >
                          Edit
                        </Button>
                      </td>
                      <td>
                        <div className='ss-row-actions'>
                          <Button
                            size='sm'
                            variant='danger'
                            disabled={isMutating || isSelf}
                            onClick={() => {
                              setUserToEdit({
                                id: user?.id || '',
                                name: user?.name || '',
                                organizationName: organization.name,
                              });
                              showModal('removeUser');
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <InviteUserModal
        organization={organization}
        show={modalToShow === 'inviteUser'}
      />
      {userToEdit && (
        <ExceptionsModal
          show={modalToShow === 'exceptions'}
          onClose={() => {
            showModal(null);
            setUserToEdit(null);
          }}
          user={userToEdit}
          organization={organization}
        />
      )}
      <ConfirmationModal
        show={modalToShow === 'removeUser'}
        onClose={() => {
          showModal(null);
          setUserToEdit(null);
        }}
        onConfirm={handleRemoveUser}
        title='Remove User'
        body='Are you sure you want to remove this user?'
      />
    </>
  );
}
