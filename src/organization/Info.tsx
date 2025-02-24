import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import { useEffect, useState, useContext } from 'react';
import { GlobalContext } from '../Context';
import { Schema } from '../../amplify/data/resource';

export default function Info({ organizationId }: { organizationId: string }) {
  const { client } = useContext(GlobalContext);

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
  }, [organizationId]);

  return (
    <div className="d-flex flex-column gap-2 mt-3 w-100">
      <h5>Organization Info</h5>
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-2" controlId="formBasicEmail">
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
            as="textarea"
            rows={3}
            placeholder="Enter organization description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
          />
        </Form.Group>
        <div className="d-flex gap-2 justify-content-end">
          <Button variant="primary" type="submit" disabled={isSaving}>
            Save
          </Button>
          <Button variant="secondary" type="button" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </Form>
    </div>
  );
}
