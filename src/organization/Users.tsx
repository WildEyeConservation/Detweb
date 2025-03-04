import Button from 'react-bootstrap/Button';
import MyTable from '../Table';
import { useOptimisticUpdates } from '../useOptimisticUpdates';
import { Schema } from '../../amplify/data/resource';
import { useContext, useState } from 'react';
import { GlobalContext, UserContext } from '../Context';
import { useUsers } from '../apiInterface';
import InviteUserModal from './InviteUserModal';
import ExceptionsModal from './ExceptionsModal';
import LabeledToggleSwitch from '../LabeledToggleSwitch';

export default function Users({
  organization,
  hook,
}: {
  organization: { id: string; name: string };
  hook: ReturnType<
    typeof useOptimisticUpdates<
      Schema['OrganizationMembership']['type'],
      'OrganizationMembership'
    >
  >;
}) {
  const { showModal, modalToShow } = useContext(GlobalContext)!;
  const { user: authUser } = useContext(UserContext)!;
  const { users } = useUsers();
  const [userToEdit, setUserToEdit] = useState<{
    id: string;
    name: string;
    organizationName: string;
  } | null>(null);

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
            hook.update({
              organizationId: organization.id,
              userId: membership.userId,
              isAdmin: checked,
            });
          }}
        />,
        <Button
          className="fixed-width-button"
          disabled={membership.isAdmin ? true : false}
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
            if (
              !window.confirm(
                `Are you sure you want to remove ${user?.name} from the organization?`
              )
            ) {
              return;
            }
            hook.delete({
              organizationId: organization.id,
              userId: membership.userId,
            });
          }}
        >
          Remove user
        </Button>,
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
    </>
  );
}
