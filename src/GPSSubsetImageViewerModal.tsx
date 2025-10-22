import { Card, Button } from 'react-bootstrap';
import { GPSData } from './GPSSubset';

interface ImageData {
  currentImageIndex: number;
  currentFilteredPoints: GPSData[];
  getObjectUrl: (filepath: string) => string | null;
  imageRotation: number;
}

interface ModalHandlers {
  handleCloseModal: () => void;
  handleNextImage: () => void;
  handlePrevImage: () => void;
  handleRotateImage: () => void;
  handleRemoveImage: () => void;
}

interface GPSSubsetImageViewerModalProps {
  showImageModal: boolean;
  imageData: ImageData;
  handlers: ModalHandlers;
}

export default function GPSSubsetImageViewerModal({
  showImageModal,
  imageData,
  handlers,
}: GPSSubsetImageViewerModalProps) {
  const {
    currentImageIndex,
    currentFilteredPoints,
    getObjectUrl,
    imageRotation,
  } = imageData;
  const {
    handleCloseModal,
    handleNextImage,
    handlePrevImage,
    handleRotateImage,
    handleRemoveImage,
  } = handlers;

  if (!showImageModal) return null;

  return (
    <>
      {/* Dark Overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          zIndex: 1050,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={handleCloseModal}
      >
        {/* Custom Card */}
        <Card
          style={{
            height: '80vh',
            width: '70vw',
            zIndex: 1051,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <Card.Header className='d-flex justify-content-between align-items-center p-3'>
            <Card.Title className='mb-0'>
              {currentFilteredPoints[currentImageIndex]?.filepath ||
                'Image Viewer'}
              {imageRotation > 0 && (
                <small className='text-muted ms-2'>({imageRotation}°)</small>
              )}
            </Card.Title>
          </Card.Header>

          {/* Body */}
          <Card.Body
            style={{
              textAlign: 'center',
              padding: '20px',
              overflow: 'hidden',
            }}
          >
            {currentFilteredPoints[currentImageIndex] && (() => {
              const currentPoint = currentFilteredPoints[currentImageIndex];
              const imageUrl = currentPoint.filepath ? getObjectUrl(currentPoint.filepath) : null;
              
              if (!imageUrl) {
                return (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      height: '100%',
                      minHeight: '200px',
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <div>Loading image...</div>
                      <small className="text-muted">
                        {currentPoint.filepath}
                      </small>
                    </div>
                  </div>
                );
              }
              
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    minHeight:
                      imageRotation % 180 === 90 ? '200px' : 'auto',
                  }}
                >
                  <img
                    src={imageUrl}
                    alt={currentPoint.filepath}
                    style={{
                      maxWidth: imageRotation % 180 === 90 ? '65vh' : '95%',
                      maxHeight:
                        imageRotation % 180 === 90 ? '65vw' : '95%',
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      transform: `rotate(${imageRotation}deg)`,
                      transformOrigin: 'center center',
                      transition: 'all 0.3s ease',
                    }}
                  />
                </div>
              );
            })()}
          </Card.Body>

          {/* Footer */}
          <Card.Footer>
            <div className='d-flex justify-content-between w-100'>
              <div>
                <Button
                  variant='primary'
                  onClick={handlePrevImage}
                  disabled={currentFilteredPoints.length <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant='primary'
                  onClick={handleNextImage}
                  disabled={currentFilteredPoints.length <= 1}
                  className='ms-2'
                >
                  Next
                </Button>
                <Button
                  variant='outline-info'
                  onClick={handleRotateImage}
                  className='ms-2'
                  title={`Rotate (${imageRotation}°)`}
                >
                  ↻ Rotate
                </Button>
                <span className='ms-3'>
                  {currentFilteredPoints.length > 0
                    ? `${currentImageIndex + 1} of ${
                        currentFilteredPoints.length
                      }`
                    : '0 of 0'}
                </span>
              </div>
              <div>
                <Button variant='danger' onClick={handleRemoveImage}>
                  Remove Image
                </Button>
                <Button
                  variant='dark'
                  onClick={handleCloseModal}
                  className='ms-2'
                >
                  Close
                </Button>
              </div>
            </div>
          </Card.Footer>
        </Card>
      </div>
    </>
  );
}
