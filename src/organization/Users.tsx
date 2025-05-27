import Button from 'react-bootstrap/Button';
import MyTable from '../Table';
import { useOptimisticUpdates } from '../useOptimisticUpdates';
import { Schema } from '../../amplify/data/resource';
import { useContext, useState, useEffect } from 'react';
import { GlobalContext, UserContext } from '../Context';
import { useUsers } from '../apiInterface';
import InviteUserModal from './InviteUserModal';
import ExceptionsModal from './ExceptionsModal';
import LabeledToggleSwitch from '../LabeledToggleSwitch';
import { fetchAllPaginatedResults } from '../utils';
import ConfirmationModal from '../ConfirmationModal';

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
  const [userToEdit, setUserToEdit] = useState<{
    id: string;
    name: string;
    organizationName: string;
  } | null>(null);

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
    { content: 'Organization Admin' },
    { content: 'Permission Exceptions' },
    { content: 'Remove' },
  ];

  const tableData = hook.data?.map((membership) => {
    const user = users?.find((user) => user.id === membership.userId);
    return {
      id: user?.id,
      rowData: [
        user?.name,
        user?.email,
        <LabeledToggleSwitch
          className="mb-0"
          leftLabel="No"
          rightLabel="Yes"
          checked={membership.isAdmin ?? false}
          onChange={(checked) => {
            if (user?.id === authUser.userId) {
              alert('You cannot change your own admin status');
              return;
            }
            updateUser(membership.userId, checked);
          }}
        />,
        <Button
          className="fixed-width-button"
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
        </Button>,
        <Button
          className="fixed-width-button"
          variant="danger"
          disabled={user?.id === authUser.userId}
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
        </Button>,
      ],
    };
  });

  useEffect(() => {
    setOnClick({
      name: 'Invite User',
      function: () => showModal('inviteUser'),
    });
  }, []);

  return (
    <>
      <div className="d-flex flex-column gap-2 mt-3 w-100 overflow-x-auto overflow-y-visible">
        <h5>Organization Users</h5>
        <MyTable
          tableData={tableData}
          tableHeadings={tableHeadings}
          pagination={true}
          itemsPerPage={5}
          emptyMessage="Loading users..."
        />
      </div>
      <InviteUserModal
        memberships={hook.data}
        organization={organization}
        show={modalToShow === 'inviteUser'}
        onClose={() => showModal(null)}
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
        onConfirm={() => {
          hook.delete({
            organizationId: organization.id,
            userId: userToEdit!.id,
          });
        }}
        title="Remove User"
        body="Are you sure you want to remove this user?"
      />
    </>
  );
}
