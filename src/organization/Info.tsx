import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import { useEffect, useState, useContext } from 'react';
import { GlobalContext } from '../Context';
import { Schema } from '../../amplify/data/resource';
import { useParams } from 'react-router-dom';

export default function Info() {
  const { client } = useContext(GlobalContext);
  const { organizationId } = useParams();

  const [organization, setOrganization] = useState<
    Schema['Organization']['type'] | null
  >(null);
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name) {
      alert('Name is required');
      return;
    }

    setIsSaving(true);

    const { data: updatedOrganization } =
      await client.models.Organization.update({
        id: organizationId!,
        name,
        description,
      });

    setIsSaving(false);

    if (updatedOrganization) {
      setOrganization(updatedOrganization);
      alert('Organization updated');
    }
  };

  const handleCancel = () => {
    setName(organization?.name || '');
    setDescription(organization?.description || '');
  };

  useEffect(() => {
    const fetchOrganization = async () => {
      setLoading(true);
      const { data: organization } = await client.models.Organization.get({
        id: organizationId!,
      });
      setOrganization(organization);

      setName(organization?.name || '');
      setDescription(organization?.description || '');
      setLoading(false);
    };

    fetchOrganization();
  }, []);

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
          <Card.Title>Organization Info</Card.Title>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter organization name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <Form.Label>Description</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter organization description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
              />
            </Form.Group>
            <div className="d-flex gap-2">
              <Button variant="primary" type="submit" disabled={isSaving}>
                Save
              </Button>
              <Button variant="secondary" type="button" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
