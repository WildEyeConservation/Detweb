import { Modal, Button } from 'react-bootstrap';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import LightImageView from './LightImageView';

export default function ImageViewerModal({
  show,
  onClose,
  imageId,
  annotationSetId,
  imageIds,
  onNavigate,
  categoryIds = [],
}: {
  show: boolean;
  onClose: () => void;
  imageId: string | null;
  annotationSetId: string;
  imageIds: string[];
  onNavigate: (imageId: string) => void;
  categoryIds?: string[];
}) {
  const currentIndex = imageId ? imageIds.indexOf(imageId) : -1;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < imageIds.length - 1;

  const handlePrevious = () => {
    if (hasPrevious) {
      onNavigate(imageIds[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      onNavigate(imageIds[currentIndex + 1]);
    }
  };

  return (
    <Modal show={show} onHide={onClose} size='xl'>
      <Modal.Header closeButton>
        <Modal.Title>
          View Image{' '}
          {imageId ? `(${currentIndex + 1} of ${imageIds.length})` : ''}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ height: '75vh' }}>
        {imageId ? (
          <div className='w-100 h-100' style={{ position: 'relative' }}>
            <LightImageView
              imageId={imageId}
              annotationSetId={annotationSetId}
              categoryIds={categoryIds}
            />
          </div>
        ) : (
          <div>No image selected.</div>
        )}
      </Modal.Body>
      <Modal.Footer className='d-flex justify-content-between'>
        <div className='d-flex flex-row gap-2'>
          <Button
            className='d-flex flex-row align-items-center justify-content-center h-100'
            variant='primary'
            onClick={handlePrevious}
            disabled={!hasPrevious}
            style={{ width: '110px' }}
          >
            <ChevronLeft />
            <span className='d-none d-sm-block'>Previous</span>
          </Button>
          <Button
            className='d-flex flex-row align-items-center justify-content-center h-100'
            variant='primary'
            onClick={handleNext}
            disabled={!hasNext}
            style={{ width: '110px' }}
          >
            <span className='d-none d-sm-block'>Next</span>
            <ChevronRight />
          </Button>
        </div>
        <Button variant='dark' onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
