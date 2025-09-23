import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { Modal } from 'react-bootstrap';
import { useContext } from 'react';
import { GlobalContext, UserContext } from '../Context';
import { useUsers } from '../apiInterface';
import { Schema } from '../amplify/client-schema';

export default function InviteUserModal({
  memberships,
  organization,
  show,
}: {
  memberships: Schema['OrganizationMembership']['type'][];
  organization: {
    id: string;
    name: string;
  };
  show: boolean;
}) {
  const { client, showModal } = useContext(GlobalContext)!;
  const { user: authUser } = useContext(UserContext)!;
  const { users } = useUsers();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const username = formData.get('username') as string;

    if (!username) {
      alert('Please enter a username');
      return;
    }

    const userId = users?.find(
      (user) => user.name === username || user.email === username
    )?.id;
    if (!userId) {
      alert('User not found');
      return;
    }

    if (memberships?.some((membership) => membership.userId === userId)) {
      alert('User is already a member of the organisation');
      return;
    }

    const { data: old } =
      await client.models.OrganizationInvite.organizationInvitesByUsername({
        username: userId,
      });

    if (
      old.length > 0 &&
      old.some(
        (invite) =>
          invite.status === 'pending' &&
          invite.organizationId === organization.id
      )
    ) {
      alert('User already has a pending invitation');
      return;
    }

    const invite = await client.models.OrganizationInvite.create({
      organizationId: organization.id,
      username: userId,
      invitedBy: authUser.username,
    });

    if (invite) {
      alert('Invite sent!');
    } else {
      alert('Failed to send invite');
    }
  };

  return (
    <Modal show={show} onHide={() => showModal(null)}>
      <Modal.Header closeButton>
        <Modal.Title>Invite a user to {organization.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className='mb-3' controlId='formBasicEmail'>
            <Form.Label>Username</Form.Label>
            <Form.Control
              type='text'
              placeholder='Enter username'
              name='username'
            />
          </Form.Group>
          <Button variant='primary' type='submit'>
            Send Invite
          </Button>
          <Form.Text className='d-block mt-2'>
            *This will send an invite to the user's SurveyScope inbox.{' '}
            <span
              className='text-muted'
              style={{ textDecoration: 'underline', cursor: 'pointer' }}
              onClick={() => {
                navigator.clipboard.writeText(window.location.origin);
                alert('Signup link copied to clipboard!');
              }}
            >
              (Copy link to signup page)
            </span>
          </Form.Text>
        </Form>
      </Modal.Body>
    </Modal>
  );
}
