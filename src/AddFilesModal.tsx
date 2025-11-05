import { useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import PropTypes from 'prop-types';

interface AddFilesModalProps {
  show: boolean;
  onSubmit: () => void;
  handleClose: () => void;
}

export default function AddFilesModal({
  show,
  onSubmit,
  handleClose,
}: AddFilesModalProps) {
  const [upload, setUpload] = useState(false);
  const [integrityCheck, setIntegrityCheck] = useState(false);
  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Add files</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group>
            <Form.Check // prettier-ignore
              type='switch'
              id='custom-switch'
              label='Upload files to S3'
              checked={upload}
              onChange={(x) => {
                console.log(x.target.checked);
                setUpload(x.target.checked);
              }}
            />
          </Form.Group>
          <Form.Group>
            <Form.Check // prettier-ignore
              type='switch'
              id='custom-switch'
              label='Do integrity check'
              checked={integrityCheck}
              onChange={(x) => {
                console.log(x.target.checked);
                setIntegrityCheck(x.target.checked);
              }}
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant='primary' onClick={() => onSubmit()}>
          Submit
        </Button>
        <Button variant='primary' onClick={() => handleClose()}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

AddFilesModal.propTypes = {
  show: PropTypes.bool,
  onSubmit: PropTypes.func,
  handleClose: PropTypes.func,
};
