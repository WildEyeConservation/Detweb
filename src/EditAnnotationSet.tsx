import React, { useContext, useEffect, useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import { GlobalContext } from "./Context";

interface EditAnnotationSetModalProps {
  show: boolean;
  handleClose: () => void;
  annotationSet: {id: string, name: string}; 
  setSelectedSets: (sets: string[]) => void;
}

const EditAnnotationSetModal: React.FC<EditAnnotationSetModalProps> = ({
  show,
  handleClose,
  annotationSet,
  setSelectedSets,
}) => {
  const { client } = useContext(GlobalContext)!
  const [newName, setNewName] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  const handleSave = async () => {
    if (annotationSet && newName.trim() !== "") {
      setBusy(true);

      await client.models.AnnotationSet.update({ id: annotationSet.id, name: newName });
      handleClose();
      setSelectedSets([]);

      setBusy(false);
    }
  };

  useEffect(() => {
    setNewName(annotationSet.name);
  }, [annotationSet.name]);

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Edit Annotation Set</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group controlId="annotationSetName"> 
            <Form.Label>Name</Form.Label>
            <Form.Control
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter new name"
            />
          </Form.Group>
        </Form>
        <small className="text-muted">{busy && "Saving..."}</small>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => {handleClose(); setSelectedSets([]); }}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={newName.trim() === "" || busy || annotationSet.name === newName}>
          Save Changes
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default EditAnnotationSetModal;
