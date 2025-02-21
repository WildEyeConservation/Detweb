import Button from 'react-bootstrap/Button';
import MyTable from '../Table';
import { useOptimisticUpdates } from '../useOptimisticUpdates';
import { Schema } from '../../amplify/data/resource';
import { useContext } from 'react';
import { GlobalContext, UserContext } from '../Context';
import { useUsers } from '../apiInterface';
import InviteUserModal from './InviteUserModal';

export default function Users({ organization }: { organization: { id: string, name: string } }) {
  const { client, showModal, modalToShow } = useContext(GlobalContext)!;
  const { user: authUser } = useContext(UserContext)!;
  const { users } = useUsers();

  const membershipHook = useOptimisticUpdates<
    Schema['OrganizationMembership']['type'],
    'OrganizationMembership'
  >('OrganizationMembership', async (nextToken) =>
    client.models.OrganizationMembership.membershipsByOrganizationId({
      organizationId: organization.id,
      nextToken,
    })
  );

  const tableHeadings = [
    { content: 'Username' },
    { content: 'Administrator' },
    { content: 'Actions' },
  ];

  const tableData = membershipHook.data?.map((membership) => {
    const user = users?.find((user) => user.id === membership.userId);
    return {
      id: user?.id,
      rowData: [
        user?.name,
        membership.isAdmin ? 'Yes' : 'No',
        user?.id !== authUser.userId ? (
          <div className="d-flex gap-2">
            <Button
              variant="danger"
              onClick={() => {
                if (
                  !window.confirm(
                    `Are you sure you want to remove ${user?.name} from the organization?`
                  )
                ) {
                  return;
                }
                client.models.OrganizationMembership.delete({
                  organizationId: organization.id,
                  userId: membership.userId,
                });
              }}
            >
              Remove user
            </Button>
            <Button
              variant={membership.isAdmin ? 'danger' : 'info'}
              onClick={() => {
                client.models.OrganizationMembership.update({
                  organizationId: organization.id,
                  userId: membership.userId,
                  isAdmin: !membership.isAdmin,
                });
              }}
            >
              {membership.isAdmin ? 'Remove Admin' : 'Make Admin'}
            </Button>
          </div>
        ) : (
          <p className="mb-0">Can't change your own admin status</p>
        ),
      ],
    };
  });

  return (
    <>
      <div className="d-flex flex-column gap-2 mt-3 w-100">
        <h5>Organization Users</h5>
        <MyTable
          tableData={tableData}
          tableHeadings={tableHeadings}
          pagination={true}
          itemsPerPage={5}
        />
        <div className="d-flex justify-content-center mt-2 border-top pt-3 border-secondary">
          <Button variant="primary" onClick={() => showModal('inviteUser')}>
            Invite User
          </Button>
        </div>
      </div>
      <InviteUserModal
        memberships={membershipHook.data}
        organization={organization}
        show={modalToShow === 'inviteUser'}
        onClose={() => showModal(null)}
      />
    </>
  );
}
