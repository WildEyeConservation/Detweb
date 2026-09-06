import { Button } from 'react-bootstrap';
import MyTable from '../Table';
import { Schema } from '../amplify/client-schema';
import { lazy, Suspense, useState, useEffect } from 'react';
import { useSession } from '../session';
import { client } from '../stores/appClient';
import { useDialogRoute } from '../routing/useDialogRoute';
import DialogNotice from '../routing/DialogNotice';
import { useUsers } from '../apiInterface';
const InviteUserModal = lazy(() => import('./InviteUserModal'));
const ExceptionsModal = lazy(() => import('./ExceptionsModal'));
import LabeledToggleSwitch from '../LabeledToggleSwitch';
import ConfirmationModal from '../ConfirmationModal';
import { Minimize2, Maximize2, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

const STORAGE_KEY_COMPACT_MODE = 'usersCompactMode';

export default function Users({
  organization,
  setOnClick,
}: {
  organization: { id: string; name: string };
  setOnClick: (onClick: { name: string; function: () => void } | null) => void;
}) {
  const dialog = useDialogRoute();
  const openDialog = dialog.open;
  const [removingUser, setRemovingUser] = useState(false);
  const { user: authUser } = useSession();
  const { users, refetch: refetchUsers } = useUsers();

  const { data: memberships, isLoading: membershipsLoading, refetch, isFetching } = useQuery<Schema['OrganizationMembership']['type'][]>({
    queryKey: ['OrganizationMembership', organization.id],
    queryFn: async () => {
      const allItems: Schema['OrganizationMembership']['type'][] = [];
      let nextToken: string | undefined;
      do {
        const result = await client.models.OrganizationMembership.membershipsByOrganizationId(
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

  // Initialize compactMode from localStorage or use default
  const getInitialCompactMode = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_COMPACT_MODE);
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
  const [isMutating, setIsMutating] = useState(false);

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

  const tableHeadings = [
    { content: 'Username' },
    { content: 'Email' },
    { content: 'Organisation Admin' },
    { content: 'Permission Exceptions' },
    { content: 'Remove' },
  ];

  const tableData = isLoading
    ? []
    : (memberships ?? []).map((membership) => {
      const user = users.find((user) => user.id === membership.userId);
      return {
        id: membership.organizationId + membership.userId,
        rowData: [
          user?.name,
          user?.email,
          <LabeledToggleSwitch
            className='mb-0'
            leftLabel='No'
            rightLabel='Yes'
            checked={membership.isAdmin ?? false}
            disabled={isMutating || membership.userId === authUser.userId}
            onChange={(checked) => {
              updateUser(membership.userId, checked);
            }}
          />,
          <div className='d-flex justify-content-center'>
            <Button
              size={compactMode ? 'sm' : undefined}
              className='fixed-width-button'
              disabled={
                process.env.NODE_ENV === 'development'
                  ? false
                  : membership.isAdmin
                    ? true
                    : false
              }
              variant={'info'}
              onClick={() => {
                dialog.open('exceptions', { user: membership.userId });
              }}
            >
              Edit
            </Button>
          </div>,
          <div className='d-flex justify-content-center'>
            <Button
              size={compactMode ? 'sm' : undefined}
              className='fixed-width-button'
              variant='danger'
              disabled={isMutating || membership.userId === authUser.userId}
              onClick={() => {
                setUserToEdit({
                  id: user?.id || '',
                  name: user?.name || '',
                  organizationName: organization.name,
                });
                setRemovingUser(true);
              }}
            >
              Remove user
            </Button>
          </div>,
        ],
      };
    });

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
      localStorage.setItem(STORAGE_KEY_COMPACT_MODE, String(compactMode));
    }
  }, [compactMode]);

  useEffect(() => {
    setOnClick({
      name: 'Invite User',
      function: () => openDialog('inviteUser'),
    });
    return () => setOnClick(null);
  }, [openDialog, setOnClick]);

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

  return (
    <>
      <div className={`d-flex flex-column ${compactMode ? 'gap-1' : 'gap-2'} mt-3 w-100 overflow-x-auto overflow-y-visible`}>
        <div className='d-flex justify-content-between align-items-center'>
          <div className='d-flex align-items-center gap-2'>
            {compactMode ? (
              <h6 className='mb-0'>Organisation Users</h6>
            ) : (
              <h5 className='mb-0'>Organisation Users</h5>
            )}
            <Button
              variant='link'
              size='sm'
              className='p-0 text-muted'
              onClick={() => { void refetch(); void refetchUsers(); }}
              disabled={isFetching}
              title='Refresh'
            >
              <RefreshCw size={16} className={isFetching ? 'spinning' : undefined} />
            </Button>
          </div>
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
        <MyTable
          tableData={tableData}
          tableHeadings={tableHeadings}
          pagination={true}
          itemsPerPage={5}
          emptyMessage={isLoading ? 'Loading users...' : 'No users found'}
        />
      </div>
      <Suspense fallback={<DialogNotice message='Loading dialog...' onClose={dialog.close} />}>
        {dialog.name === 'inviteUser' && <InviteUserModal organization={organization} show onClose={dialog.close} />}
        {dialog.name === 'exceptions' && (memberships?.some((row) => row.userId === dialog.get('user')) ? (
          <ExceptionsModal key={dialog.get('user')} show onClose={dialog.close}
            user={{ id: dialog.get('user')!, name: users.find((row) => row.id === dialog.get('user'))?.name ?? dialog.get('user')! }} organization={organization} />
        ) : <DialogNotice message={membershipsLoading ? 'Loading membership...' : 'This user is not a member of the selected organization.'} onClose={dialog.close} />)}
      </Suspense>
      <ConfirmationModal
        show={removingUser}
        onClose={() => {
          setRemovingUser(false);
          setUserToEdit(null);
        }}
        onConfirm={handleRemoveUser}
        title='Remove User'
        body='Are you sure you want to remove this user?'
      />
    </>
  );
}
