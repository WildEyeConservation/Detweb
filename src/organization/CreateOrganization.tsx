import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import { useState, useContext, useEffect } from "react";
import { GlobalContext } from "../Context";
import { useUsers } from "../apiInterface";
import { Modal } from "react-bootstrap";
import { Schema } from "../../amplify/data/resource";

export default function CreateOrganization({
  show,
  onHide,
  request,
}: {
  show: boolean;
  onHide: () => void;
  request?: Schema["OrganizationRegistration"]["type"] & {
    requestedByEmail: string;
  };
}) {
  const { client } = useContext(GlobalContext);
  const { users } = useUsers();

  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name) {
      alert("Name is required");
      return;
    }

    const user = users.find((user) => user.email === adminEmail);

    if (!user) {
      alert("A user with this email does not exist");
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
        if (request) {
          await client.models.OrganizationRegistration.update({
            id: request.id,
            status: "approved",
          });
        }

        alert("Organization " + name + " created for " + adminEmail);
      }
    }

    setIsSubmitting(false);
    handleClear();
    onHide();
  };

  async function handleDeny() {
    if (request) {
      await client.models.OrganizationRegistration.update({
        id: request.id,
        status: "denied",
      });
    }

    onHide();
  }

  const handleClear = () => {
    setName("");
    setDescription("");
    setAdminEmail("");
  };

  useEffect(() => {
    if (request) {
      setName(request.organizationName);
      setDescription(request.briefDescription);
      setAdminEmail(request.requestedByEmail);
    }
    return () => {
      handleClear();
    };
  }, [request]);

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{request ? "Add" : "Create"} Organization</Modal.Title>
      </Modal.Header>
      <Modal.Body>
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
              as="textarea"
              rows={3}
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
          <div
            className={`d-flex gap-2 justify-content-${
              request ? "between" : "end"
            }`}
          >
            {request && (
              <Button variant="danger" onClick={handleDeny}>
                Deny
              </Button>
            )}
            <div>
              <Button
                variant="primary"
                className="me-2"
                type="submit"
                disabled={isSubmitting}
              >
                {request ? "Approve" : "Create"}
              </Button>
              <Button variant="dark" type="button" onClick={onHide}>
                Cancel
              </Button>
            </div>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
}
