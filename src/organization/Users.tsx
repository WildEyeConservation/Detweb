import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import MyTable from '../Table';
import { useOptimisticUpdates } from '../useOptimisticUpdates';
import { Schema } from '../amplify/client-schema';
import { useContext, useState, useEffect } from 'react';
import { GlobalContext, UserContext } from '../Context';
import { useUsers } from '../apiInterface';
import InviteUserModal from './InviteUserModal';
import ExceptionsModal from './ExceptionsModal';
import LabeledToggleSwitch from '../LabeledToggleSwitch';
import { fetchAllPaginatedResults } from '../utils';
import ConfirmationModal from '../ConfirmationModal';
import { Minimize2, Maximize2 } from 'lucide-react';

const STORAGE_KEY_COMPACT_MODE = 'usersCompactMode';

export default function Users({
  organization,
  hook,
  setOnClick,
}: {
  organization: { id: string; name: string };
  hook: ReturnType<
    typeof useOptimisticUpdates<
      Schema['OrganizationMembership']['type'],
      'OrganizationMembership'
    >
  >;
  setOnClick: (onClick: { name: string; function: () => void }) => void;
}) {
  const { client, showModal, modalToShow } = useContext(GlobalContext)!;
  const { user: authUser } = useContext(UserContext)!;
  const { users } = useUsers();

  // Only show users when both users and membership data are loaded
  const isLoading = !users || !hook.data;
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

  async function updateUser(userId: string, isAdmin: boolean) {
    hook.update({
      organizationId: organization.id,
      userId: userId,
      isAdmin: isAdmin,
    });

    const organizationProjects = await fetchAllPaginatedResults(
      client.models.Project.list,
      {
        selectionSet: ['id'],
        filter: {
          organizationId: {
            eq: organization.id,
          },
        },
      }
    );

    const userProjectMemberships = await fetchAllPaginatedResults(
      client.models.UserProjectMembership.userProjectMembershipsByUserId,
      {
        userId: userId,
        selectionSet: ['id', 'projectId', 'isAdmin'],
      }
    );

    const userOrganizationProjectMemberships = userProjectMemberships.filter(
      (membership) =>
        organizationProjects.some(
          (project) => project.id === membership.projectId
        )
    );

    if (isAdmin) {
      await Promise.all(
        organizationProjects.map(async (project) => {
          const userProjectMembership = userOrganizationProjectMemberships.find(
            (membership) => membership.projectId === project.id
          );
          if (userProjectMembership) {
            if (!userProjectMembership.isAdmin) {
              await client.models.UserProjectMembership.update({
                id: userProjectMembership.id,
                isAdmin: true,
              });
            }
          } else {
            await client.models.UserProjectMembership.create({
              userId: userId,
              projectId: project.id,
              isAdmin: true,
              group: organization.id,
            });
          }
        })
      );
    } else {
      await Promise.all(
        userOrganizationProjectMemberships.map(async (membership) => {
          if (membership.isAdmin) {
            await client.models.UserProjectMembership.update({
              id: membership.id,
              isAdmin: false,
            });
          }
        })
      );
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
    : hook.data.map((membership) => {
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
            onChange={(checked) => {
              if (user?.id === authUser.userId) {
                alert('You cannot change your own admin status');
                return;
              }
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
          </div>,
          <div className='d-flex justify-content-center'>
            <OverlayTrigger
              placement='top'
              overlay={<Tooltip id='remove-user-tooltip'>Under maintenance</Tooltip>}
            >
              <div className='d-inline-block'>
                <Button
                  size={compactMode ? 'sm' : undefined}
                  className='fixed-width-button'
                  variant='danger'
                  disabled={true}
                  style={{ pointerEvents: 'none' }}
                  onClick={() => {
                    setUserToEdit({
                      id: user?.id || '',
                      name: user?.name || '',
                      organizationName: organization.name,
                    });
                    showModal('removeUser');
                  }}
                >
                  Remove user
                </Button>
              </div>
            </OverlayTrigger>
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
      function: () => showModal('inviteUser'),
    });
  }, []);

  async function handleRemoveUser() {
    const userProjectMemberships = await fetchAllPaginatedResults(
      client.models.UserProjectMembership.userProjectMembershipsByUserId,
      {
        userId: userToEdit!.id,
        selectionSet: ['id', 'projectId'],
      }
    );

    const organizationProjects = await fetchAllPaginatedResults(
      client.models.Project.list,
      {
        selectionSet: ['id'],
        filter: {
          organizationId: {
            eq: organization.id,
          },
        },
      }
    );

    const userOrganizationProjectMemberships = userProjectMemberships.filter(
      (membership) =>
        organizationProjects.some(
          (project) => project.id === membership.projectId
        )
    );

    await Promise.all(
      userOrganizationProjectMemberships.map(async (membership) => {
        await client.models.UserProjectMembership.delete({
          id: membership.id,
        });
      })
    );

    hook.delete({
      organizationId: organization.id,
      userId: userToEdit!.id,
    });
  }

  return (
    <>
      <div className={`d-flex flex-column ${compactMode ? 'gap-1' : 'gap-2'} mt-3 w-100 overflow-x-auto overflow-y-visible`}>
        <div className='d-flex justify-content-between align-items-center'>
          {compactMode ? (
            <h6 className='mb-0'>Organisation Users</h6>
          ) : (
            <h5 className='mb-0'>Organisation Users</h5>
          )}
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
      <InviteUserModal
        memberships={hook.data}
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
