import { Button, Form, Modal } from 'react-bootstrap';
import { useState } from 'react';
import { GlobalContext, UserContext } from '../Context';
import { useContext, useEffect } from 'react';
import Select from 'react-select';

export default function NewSurveyModal({
  show,
  onClose,
}: {
  show: boolean;
  onClose: () => void;
}) {
  const { myOrganizationHook, user } = useContext(UserContext)!;
  const { client } = useContext(GlobalContext)!;

  const [name, setName] = useState('');
  const [organization, setOrganization] = useState<{
    label: string;
    value: string;
  } | null>(null);
  const [organizations, setOrganizations] = useState<
    { label: string; value: string }[]
  >([]);

  async function handleSave() {
    if (!name || !organization) {
      alert('Please fill in all fields');
      return;
    }

    const {data: project} = await client.models.Project.create({
      name,
      organizationId: organization.value,
      createdBy: user.userId,
    });

    if (project) {
      await client.models.UserProjectMembership.create({
        userId: user.userId,
        projectId: project.id,
        isAdmin: true,
      });
    }

    onClose();
  }

  useEffect(() => {
    if (myOrganizationHook.data) {
      const adminOrganizations = myOrganizationHook.data.filter(
        (o) => o.isAdmin
      );

      Promise.all(
        adminOrganizations.map(
          async (o) =>
            (
              await client.models.Organization.get({
                id: o.organizationId,
              }, {
                selectionSet: ['name', 'id'],
              })
            ).data
        )
      ).then((organizations) => {
        setOrganizations(
          organizations
            .filter((o) => o !== null)
            .map((o) => ({
              label: o.name,
              value: o.id,
            }))
        );
      });
    }
  }, [myOrganizationHook.data]);

  return (
    <Modal show={show} onHide={onClose} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>New Survey</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form className="d-flex flex-column gap-2">
          <Form.Group>
            <Form.Label>Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter a unique identifying name for the survey."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Organization</Form.Label>
            <Select
              value={organization}
              options={organizations}
              onChange={(e) => setOrganization(e)}
              styles={{
                valueContainer: (base) => ({
                  ...base,
                  minHeight: '48px',
                  overflowY: 'auto',
                }),
              }}
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Create
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
