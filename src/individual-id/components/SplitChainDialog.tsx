import { Modal, Button } from 'react-bootstrap';

interface Props {
  show: boolean;
  splitCount: number;
  retainedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SplitChainDialog({
  show,
  splitCount,
  retainedCount,
  onConfirm,
  onCancel,
}: Props) {
  const newer = Math.max(0, splitCount - 1);
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>Split chain from here?</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        This will make the selected annotation the start of a new identity. The
        {newer > 0 ? (
          <>
            {' '}
            selected annotation and {newer} newer linked sighting
            {newer === 1 ? '' : 's'} will move into the new chain;{' '}
          </>
        ) : (
          <> selected annotation will move into the new chain; </>
        )}
        {retainedCount} older linked sighting
        {retainedCount === 1 ? '' : 's'} will stay in the original chain. This
        is saved immediately.
      </Modal.Body>
      <Modal.Footer>
        <Button variant='secondary' onClick={onCancel}>
          Cancel
        </Button>
        <Button variant='warning' onClick={onConfirm}>
          Split chain
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
