import { Modal, Button } from 'react-bootstrap';

interface Props {
  show: boolean;
  /** Where the user is trying to go. Used to label the buttons. */
  destination: 'prev' | 'next' | 'jump';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Shown when the user manually tries to leave a pair that has unsaved
 * (un-accepted) work. Their per-pair drags and locks ARE preserved across
 * pairs (see usePairWorkingState), but we still ask for confirmation so a
 * stray Ctrl+→ doesn't yank them away mid-task.
 */
export function NavigateAwayDialog({
  show,
  destination,
  onConfirm,
  onCancel,
}: Props) {
  const verb =
    destination === 'prev'
      ? 'previous pair'
      : destination === 'next'
      ? 'next pair'
      : 'another pair';
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>Leave this pair?</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        You have un-accepted matches on this pair. Your marker positions will
        be remembered, but no links will be saved. Continue to the {verb}?
      </Modal.Body>
      <Modal.Footer>
        <Button variant='secondary' onClick={onCancel}>
          Stay
        </Button>
        <Button variant='warning' onClick={onConfirm}>
          Leave
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
