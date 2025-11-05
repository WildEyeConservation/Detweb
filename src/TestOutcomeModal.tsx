import { Button, Modal } from 'react-bootstrap';
import { useContext } from 'react';
import { GlobalContext } from './Context';

export default function TestOutcomeModal({
  show,
  onClose,
}: {
  show: boolean;
  onClose: () => void;
}) {
  const { modalToShow } = useContext(GlobalContext)!;

  return (
    <Modal show={show} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Test Outcome</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {modalToShow === 'testFailedModal' && (
          <p>Oh no! You failed a test. Maybe it's time to take a break?</p>
        )}
        {modalToShow === 'testPassedModal' && (
          <p>You passed a test! Good job!</p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant='primary' onClick={onClose}>
          {modalToShow === 'testFailedModal' ? 'Got it' : 'Continue'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
