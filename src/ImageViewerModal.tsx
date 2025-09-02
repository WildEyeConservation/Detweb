import { Modal, Button } from 'react-bootstrap';
import LightImageView from './LightImageView';

export default function ImageViewerModal({
  show,
  onClose,
  imageId,
  annotationSetId,
}: {
  show: boolean;
  onClose: () => void;
  imageId: string | null;
  annotationSetId: string;
}) {
  return (
    <Modal show={show} onHide={onClose} size='xl'>
      <Modal.Header closeButton>
        <Modal.Title>View Image</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ height: '75vh' }}>
        {imageId ? (
          <div className='w-100 h-100' style={{ position: 'relative' }}>
            <LightImageView
              imageId={imageId}
              annotationSetId={annotationSetId}
            />
          </div>
        ) : (
          <div>No image selected.</div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant='dark' onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
