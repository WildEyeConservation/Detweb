import { useDialogGuard } from '../routing/useDialogGuard';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { Modal } from 'react-bootstrap';
import { useState } from 'react';
import { client } from '../stores/appClient';

export default function InviteUserModal({
  organization,
  show,
  onClose,
}: {
  organization: {
    id: string;
    name: string;
  };
  show: boolean;
  onClose: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const finishNavigation = useDialogGuard({ busy: isSubmitting, dirty });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const email = formData.get('email') as string;

    if (!email) {
      alert('Please enter an email');
      return;
    }

    setIsSubmitting(true);

    try {
      const { errors } = await client.mutations.inviteUserToOrganization({
        organizationId: organization.id,
        email,
      });

      if (errors?.length) {
        alert(errors[0].message);
      } else {
        finishNavigation(onClose);
        setTimeout(() => alert('Invite sent!'), 300);
      }
    } catch (err: any) {
      alert(err.message ?? 'Failed to send invite');
    }

    setIsSubmitting(false);
  };

  return (
    <Modal show={show} onHide={() => onClose()}>
      <Modal.Header closeButton>
        <Modal.Title>Invite a user to {organization.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit} onChangeCapture={() => setDirty(true)}>
          <Form.Group className='mb-3' controlId='formBasicEmail'>
            <Form.Label>Email</Form.Label>
            <Form.Control type='email' placeholder='Enter email' name='email' />
          </Form.Group>
          <Button variant='primary' type='submit' disabled={isSubmitting}>
            Send Invite
          </Button>
          <Form.Text className='d-block mt-3'>
            This will send an invite to the user's SurveyScope inbox.
          </Form.Text>
          <Form.Text className='d-block'>
            If the user doesn't have an account, please contact WildEye support
            with the email of the user that requires an account.
          </Form.Text>
        </Form>
      </Modal.Body>
    </Modal>
  );
}
