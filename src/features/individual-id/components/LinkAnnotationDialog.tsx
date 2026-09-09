import { Modal, Button } from 'react-bootstrap';

interface Props {
  show: boolean;
  /** Commit the link (immediate — writes the shared objectId). */
  onConfirm: () => void;
  /** Dismiss without linking. */
  onCancel: () => void;
}

/**
 * Shown when the user ctrl+clicks a real marker on the other image while a
 * candidate is active. Confirming asserts the two annotations are the same
 * individual: they get a shared identity and the Munkres shadow proposals on
 * both sides collapse on the next rebuild. This is the deliberate gate — the
 * link is written immediately on confirm.
 */
export function LinkAnnotationDialog({ show, onConfirm, onCancel }: Props) {
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>Link these annotations?</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        This will mark the clicked annotation and the currently active one as
        the same individual, sharing a single identity across both images. The
        proposed shadow markers for this animal will disappear. This is saved
        immediately.
      </Modal.Body>
      <Modal.Footer>
        <Button variant='secondary' onClick={onCancel}>
          Cancel
        </Button>
        <Button variant='primary' onClick={onConfirm}>
          Link
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
