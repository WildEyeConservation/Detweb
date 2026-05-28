import { Modal, Button } from 'react-bootstrap';

interface Props {
  show: boolean;
  onConfirm: () => void;
}

/**
 * Final "you're done" dialog shown when every direct pair is complete AND
 * no actionable reunion candidates remain. Confirming closes the transect
 * on the server and returns the user to Jobs — without this gate the
 * harness silently navigated away, which read as "the app just kicked me
 * out".
 */
export function TransectCompleteDialog({ show, onConfirm }: Props) {
  return (
    <Modal show={show} centered backdrop='static' keyboard={false}>
      <Modal.Header>
        <Modal.Title>Transect complete</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Every image pair is finished and no reunions need review. Closing
        this dialog will finalise the transect and return you to Jobs.
      </Modal.Body>
      <Modal.Footer>
        <Button variant='primary' onClick={onConfirm}>
          Finish transect
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
