import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import MyTable from '../Table';
import { useOptimisticUpdates } from '../useOptimisticUpdates';
import { Schema } from '../../amplify/data/resource';
import { useContext } from 'react';
import { GlobalContext, UserContext } from '../Context';
import { useParams } from 'react-router-dom';
import { useUsers } from '../apiInterface';

export default function Users() {
  const { client } = useContext(GlobalContext)!;
  const { user: authUser } = useContext(UserContext)!;
  const { organizationId } = useParams();
  const { users } = useUsers();

  const membershipHook = useOptimisticUpdates<
    Schema['OrganizationMembership']['type'],
    'OrganizationMembership'
  >('OrganizationMembership', async (nextToken) =>
    client.models.OrganizationMembership.membershipsByOrganizationId({
      organizationId: organizationId,
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
                  organizationId: organizationId,
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
                  organizationId: organizationId,
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const username = formData.get('username') as string;

    if (!username) {
      alert('Please enter a username');
      return;
    }

    const userId = users?.find((user) => user.name === username)?.id;

    if (
      membershipHook.data?.some((membership) => membership.userId === userId)
    ) {
      alert('User is already a member of the organization');
      return;
    }

    const { data: old } =
      await client.models.OrganizationInvite.organizationInvitesByUsername({
        username: username,
      });

    if (
      old.length > 0 &&
      old.some(
        (invite) =>
          invite.status === 'pending' &&
          invite.organizationId === organizationId
      )
    ) {
      alert('User already has a pending invitation');
      return;
    }

    const invite = await client.models.OrganizationInvite.create({
      organizationId: organizationId!,
      username: username,
      invitedBy: authUser.username,
    });

    if (invite) {
      alert('Invite sent!');
    } else {
      alert('Failed to send invite');
    }
  };

  return (
    <div
      className="d-flex flex-column gap-3 align-items-center mt-3"
      style={{
        maxWidth: '960px',
        width: '100%',
      }}
    >
      <Card className="w-100">
        <Card.Body>
          <Card.Title>Invite a user to your organization</Card.Title>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <Form.Label>Username</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter username"
                name="username"
              />
            </Form.Group>
            <Button variant="primary" type="submit">
              Send Invite
            </Button>
            <Form.Text className="d-block mt-2">
              *This will send an invite to the user's ESS inbox. Don't worry,
              the invite will be stored until they sign up{' '}
              <span
                className="text-muted"
                style={{ textDecoration: 'underline', cursor: 'pointer' }}
                onClick={() => {
                  const inviteLink = `https://prod.d2akirfrcp5tqu.amplifyapp.com/`;
                  navigator.clipboard.writeText(inviteLink);
                  alert('Signup link copied to clipboard!');
                }}
              >
                (Copy link to signup page)
              </span>
            </Form.Text>
          </Form>
        </Card.Body>
      </Card>
      <Card className="w-100">
        <Card.Body>
          <Card.Title>Organization Users</Card.Title>
          <MyTable
            tableData={tableData}
            tableHeadings={tableHeadings}
            pagination={true}
          />
        </Card.Body>
      </Card>
    </div>
  );
}
