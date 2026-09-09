import { Modal, Button } from 'react-bootstrap';

interface Props {
  show: boolean;
  /** Total number of annotations in the chain (including the clicked one). */
  chainSize: number;
  /** Delete only the clicked annotation; leave the rest of the chain intact. */
  onDeleteOne: () => void;
  /** Delete every annotation sharing this individual's identity. */
  onDeleteChain: () => void;
  onCancel: () => void;
}

/**
 * Shown when the user deletes an annotation that belongs to a chain (i.e. is
 * linked across multiple images as the same individual). Lets the user pick
 * whether to remove just this sighting or the whole identity. A chain of 1
 * skips this dialog entirely and deletes immediately.
 */
export function DeleteAnnotationDialog({
  show,
  chainSize,
  onDeleteOne,
  onDeleteChain,
  onCancel,
}: Props) {
  const others = Math.max(0, chainSize - 1);
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>Delete linked annotation</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        This annotation is linked to {others} other{others === 1 ? '' : 's'} of
        the same individual. Delete just this sighting, or the entire chain of{' '}
        <strong>{chainSize}</strong>?
      </Modal.Body>
      <Modal.Footer>
        <Button variant='secondary' onClick={onCancel}>
          Cancel
        </Button>
        <Button variant='outline-danger' onClick={onDeleteOne}>
          Delete this one
        </Button>
        <Button variant='danger' onClick={onDeleteChain}>
          Delete entire chain
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
