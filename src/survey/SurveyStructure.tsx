import { Card, Button, Collapse } from 'react-bootstrap';

export type ImageInfo = {
  id: string;
  originalPath: string;
  cameraId?: string;
};

export type Folder = {
  path: string;
  imageCount: number;
  images: ImageInfo[];
};

export type Camera = {
  name: string;
  folders: Folder[];
};

interface TreeNodeProps {
  camera: Camera;
  isOpen: boolean;
  onToggle: () => void;
  expandedFolders: Set<string>;
  onToggleFolder: (folderPath: string) => void;
}

interface FolderNodeProps {
  folder: Folder;
  isOpen: boolean;
  onToggle: () => void;
}

function FolderNode({ folder, isOpen, onToggle }: FolderNodeProps) {
  const getFileName = (path: string) => {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1];
  };

  return (
    <div className='ms-3 mb-2 '>
      <div
        className={`d-flex align-items-center p-2 ${
          isOpen ? 'border-bottom' : ''
        }`}
        style={{
          cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        <span className='me-2'>
          {isOpen ? '📂' : '📁'} {folder.path}
        </span>
        <small className='text-muted'>
          ({folder.images.length} image{folder.images.length !== 1 ? 's' : ''})
        </small>
        <Button
          variant='link'
          size='sm'
          className='p-0 ms-auto text-decoration-none text-dark'
        >
          <span className='fs-6'>{isOpen ? '▼' : '▶'}</span>
        </Button>
      </div>
      <Collapse in={isOpen}>
        <div className='ms-4 mt-2'>
          {folder.images.length === 0 ? (
            <div className='text-muted small fst-italic'>No images</div>
          ) : (
            <div className='d-flex flex-wrap gap-2'>
              {folder.images
                .sort((a, b) => a.originalPath.localeCompare(b.originalPath))
                .map((image) => (
                  <div
                    key={image.id}
                    className='badge p-2 d-flex align-items-center bg-dark'
                    style={{
                      fontSize: '0.75rem',
                      borderRadius: '4px',
                      maxWidth: '200px',
                    }}
                    title={image.originalPath}
                  >
                    <span className='me-1'>🖼️</span>
                    <span className='fw-medium text-truncate'>
                      {getFileName(image.originalPath)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </Collapse>
    </div>
  );
}

export function TreeNode({
  camera,
  isOpen,
  onToggle,
  expandedFolders,
  onToggleFolder,
}: TreeNodeProps) {
  return (
    <Card className='mb-2 shadow-sm'>
      <Card.Header
        className={`d-flex align-items-center justify-content-between p-3 ${
          isOpen ? 'border-bottom' : ''
        }`}
        onClick={onToggle}
        style={{
          cursor: 'pointer',
        }}
      >
        <div className='d-flex align-items-center'>
          <span className='me-2 fs-5'>
            {isOpen ? '📂' : '📁'} {camera.name}
          </span>
          <small className='text-muted fw-semibold'>
            ({camera.folders.length} folder
            {camera.folders.length !== 1 ? 's' : ''},{' '}
            {camera.folders.reduce(
              (sum, folder) => sum + folder.images.length,
              0
            )}{' '}
            images)
          </small>
        </div>
        <Button
          variant='link'
          size='sm'
          className='p-0 text-decoration-none text-dark'
        >
          <span className='fs-6'>{isOpen ? '▼' : '▶'}</span>
        </Button>
      </Card.Header>
      <Collapse in={isOpen}>
        <div>
          <Card.Body className='p-3'>
            {camera.folders.length === 0 ? (
              <div className='text-muted small fst-italic'>No folders</div>
            ) : (
              <div>
                {camera.folders.map((folder, index) => {
                  const folderKey = camera.name + '-' + folder.path;
                  return (
                    <FolderNode
                      key={folderKey + '-' + index}
                      folder={folder}
                      isOpen={expandedFolders.has(folderKey)}
                      onToggle={() => onToggleFolder(folderKey)}
                    />
                  );
                })}
              </div>
            )}
          </Card.Body>
        </div>
      </Collapse>
    </Card>
  );
}
