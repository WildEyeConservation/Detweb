import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import { useState, useContext } from 'react';
import { GlobalContext } from '../Context';
import { useUsers } from '../apiInterface';

export default function CreateOrganization() {
  const { client } = useContext(GlobalContext);
  const { users } = useUsers();

  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name) {
      alert('Name is required');
      return;
    }

    const user = users.find((user) => user.email === adminEmail);

    if (!user) {
      alert('A user with this email does not exist');
      return;
    }

    setIsSubmitting(true);

    const { data: organization } = await client.models.Organization.create({
      name,
      description,
    });

    if (organization) {
      const { data: membership } =
        await client.models.OrganizationMembership.create({
          organizationId: organization.id,
          userId: user.id,
          isAdmin: true,
        });

      if (membership) {
        alert('Organization ' + name + ' created for ' + adminEmail);
      }
    }

    setIsSubmitting(false);
    handleClear();
  };

  const handleClear = () => {
    setName('');
    setDescription('');
    setAdminEmail('');
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
          <Card.Title>Create Organization</Card.Title>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter organization name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter organization description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Admin Email</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter admin email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
            </Form.Group>
            <div className="d-flex gap-2">
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                Submit
              </Button>
              <Button variant="secondary" type="button" onClick={handleClear}>
                Clear
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
