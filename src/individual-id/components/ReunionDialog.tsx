import { Modal, Button } from 'react-bootstrap';

interface Props {
  show: boolean;
  /** Number of synthetic pairs the user is about to enter. */
  count: number;
  onConfirm: () => void;
}

/**
 * Shown by the harness once every direct image pair is complete AND the
 * reunion-search pass has surfaced at least one synthetic pair to review.
 * Mandatory — no skip, no dismiss. The static backdrop + disabled keyboard
 * dismiss enforce that.
 */
export function ReunionDialog({ show, count, onConfirm }: Props) {
  return (
    <Modal show={show} centered backdrop='static' keyboard={false}>
      <Modal.Header>
        <Modal.Title>Review reunions</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Every direct image pair is complete. We found{' '}
        <strong>{count}</strong>{' '}
        {count === 1 ? 'image pair' : 'image pairs'} further along the
        transect where an animal may have reappeared after going out of
        view. Review each one to finish the transect.
      </Modal.Body>
      <Modal.Footer>
        <Button variant='primary' onClick={onConfirm}>
          Review {count === 1 ? 'reunion' : 'reunions'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
