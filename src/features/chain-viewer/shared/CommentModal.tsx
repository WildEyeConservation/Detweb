import { useEffect, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';

interface Props {
  show: boolean;
  /** Existing comment text to prefill (empty string when none). */
  initial: string;
  onClose: () => void;
  onSave: (text: string) => void;
}

/**
 * Simple free-text comment editor for a single annotation. Records a reviewer
 * comment opinion (ChainReviewFeedback, kind `comment`) — never touches the
 * snapshot. Prefills any existing comment so the reviewer edits in place.
 */
export function CommentModal({ show, initial, onClose, onSave }: Props) {
  const [text, setText] = useState(initial);

  // Re-seed the field each time the modal opens for a (possibly different)
  // annotation.
  useEffect(() => {
    if (show) setText(initial);
  }, [show, initial]);

  const trimmed = text.trim();
  const unchanged = trimmed === initial.trim();

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Comment</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group>
          <Form.Label>Your note on this annotation</Form.Label>
          <Form.Control
            as='textarea'
            rows={4}
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            placeholder='Add a comment for this annotation…'
          />
          <Form.Text className='text-muted'>
            Recorded as your review feedback; it never changes the original data.
          </Form.Text>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant='secondary' onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant='primary'
          disabled={unchanged}
          onClick={() => onSave(trimmed)}
        >
          Save comment
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
