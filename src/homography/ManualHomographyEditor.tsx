import { useCallback, useMemo, useState } from 'react';
import { Matrix, matrix, multiply, transpose, inv } from 'mathjs';
import { Card, Button, Badge } from 'react-bootstrap';
import {
  Trash2,
  Info,
  Save,
  SkipForward,
  Image as ImageIcon,
  Target,
  Circle,
  ChevronDown,
  ChevronUp,
  X,
  SquareDashed,
} from 'lucide-react';
import { POINT_COLORS } from '../maplibre-viewer/MapLibreImageViewer';

export type Point = { id: string; x: number; y: number };

function buildDesignMatrix(points1: Point[], points2: Point[]) {
  // Build A (2N x 8) and b (2N x 1) for least squares with h33 fixed to 1
  const rows: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < Math.min(points1.length, points2.length); i++) {
    const { x, y } = points1[i];
    const { x: xp, y: yp } = points2[i];
    rows.push([x, y, 1, 0, 0, 0, -x * xp, -y * xp]);
    b.push(xp);
    rows.push([0, 0, 0, x, y, 1, -x * yp, -y * yp]);
    b.push(yp);
  }
  return { A: matrix(rows), b: matrix(b) };
}

export const MIN_HOMOGRAPHY_POINTS = 4;

export function solveHomography(points1: Point[], points2: Point[]): Matrix | null {
  if (points1.length < MIN_HOMOGRAPHY_POINTS || points2.length < MIN_HOMOGRAPHY_POINTS) return null;
  const { A, b } = buildDesignMatrix(points1, points2);
  // Normal equations: (A^T A) u = A^T b
  const At = transpose(A) as Matrix;
  const AtA = multiply(At, A) as Matrix;
  const Atb = multiply(At, b) as Matrix;
  // Solve using inverse (sufficient for small 8x8)
  const u = multiply(inv(AtA), Atb) as Matrix; // 8x1

  const h11 = u.get([0]);
  const h12 = u.get([1]);
  const h13 = u.get([2]);
  const h21 = u.get([3]);
  const h22 = u.get([4]);
  const h23 = u.get([5]);
  const h31 = u.get([6]);
  const h32 = u.get([7]);
  const H = matrix([
    [h11, h12, h13],
    [h21, h22, h23],
    [h31, h32, 1],
  ]);
  return H;
}

export function ManualHomographyEditor({
  points1,
  points2,
  setPoints1,
  setPoints2,
  onSave,
  onSkip,
  onAction,
  isSaving = false,
  isSkipping = false,
}: {
  points1: Point[];
  points2: Point[];
  setPoints1: (updater: Point[] | ((prev: Point[]) => Point[])) => void;
  setPoints2: (updater: Point[] | ((prev: Point[]) => Point[])) => void;
  onSave: (H: Matrix) => void;
  onSkip?: () => void;
  onAction?: () => void;
  isSaving?: boolean;
  isSkipping?: boolean;
}) {
  const [moreInformation, setMoreInformation] = useState(false);
  const canCompute =
    points1.length >= MIN_HOMOGRAPHY_POINTS &&
    points2.length >= MIN_HOMOGRAPHY_POINTS &&
    points1.length === points2.length;

  const handleRemovePair = useCallback(
    (index: number) => {
      onAction?.();
      setPoints1((prev) => prev.filter((_, i) => i !== index));
      setPoints2((prev) => prev.filter((_, i) => i !== index));
    },
    [setPoints1, setPoints2, onAction]
  );

  const handleSave = useCallback(() => {
    const H = solveHomography(points1, points2);
    if (!H) return;
    onSave(H);
  }, [points1, points2, onSave]);

  const handleSkip = useCallback(() => {
    onSkip?.();
  }, [onSkip]);

  const handleRemovePoint1 = useCallback(
    (index: number) => {
      onAction?.();
      setPoints1((prev) => prev.filter((_, i) => i !== index));
    },
    [setPoints1, onAction]
  );

  const handleRemovePoint2 = useCallback(
    (index: number) => {
      onAction?.();
      setPoints2((prev) => prev.filter((_, i) => i !== index));
    },
    [setPoints2, onAction]
  );

  const tableRows = useMemo(() => {
    const maxLen = Math.max(points1.length, points2.length);
    return new Array(maxLen).fill(0).map((_, i) => ({
      i,
      p1: points1[i] ?? null,
      p2: points2[i] ?? null,
    }));
  }, [points1, points2]);

  return (
    <Card className='w-100 h-100 border-0 shadow-sm'>
      <Card.Header className='border-bottom border-secondary py-3'>
        <div className='d-flex align-items-center justify-content-between'>
          <Card.Title className='mb-0 d-flex align-items-center gap-2'>
            <SquareDashed size={20} className='text-info' />
            Homography Creation
          </Card.Title>
          <Button
            variant='link'
            className='p-0 text-info text-decoration-none d-flex align-items-center gap-1 small'
            onClick={() => setMoreInformation(!moreInformation)}
          >
            {moreInformation ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {moreInformation ? 'Hide' : 'Help'}
          </Button>
        </div>
        {moreInformation && (
          <div className='mt-3 pt-3 border-top border-secondary'>
            <div className='d-flex align-items-center gap-2 mb-2 text-info'>
              <Info size={16} />
              <span className='fw-bold small'>Instructions</span>
            </div>
            <ul className='small ps-3' style={{ opacity: 0.9, lineHeight: '1.6' }}>
              <li>Select up to 12 corresponding points on both images (min {MIN_HOMOGRAPHY_POINTS}).</li>
              <li>Aim to cover as much area as possible.</li>
              <li>Avoid placing points in straight lines.</li>
              <li>Right-click a marker to remove/swap it or press <b>Esc</b> to close the popup.</li>
              <li>Preview will be available after 4 pairs have been created.</li>
            </ul>
            <div className='d-flex align-items-center gap-2 mb-2 mt-3 text-info'>
              <Target size={14} />
              <span className='fw-bold small'>Shortcuts</span>
            </div>
            <ul className='small mb-0 ps-3 list-unstyled' style={{ lineHeight: '1.6' }}>
              <li><kbd style={{ padding: '2px 4px', borderRadius: '4px', fontSize: '10px' }}>Ctrl + Z</kbd> Undo</li>
              <li><kbd style={{ padding: '2px 4px', borderRadius: '4px', fontSize: '10px' }}>Ctrl + Y</kbd> / <kbd style={{ padding: '2px 4px', borderRadius: '4px', fontSize: '10px' }}>Ctrl+Shift+Z</kbd> Redo</li>
              <li><kbd style={{ padding: '2px 4px', borderRadius: '4px', fontSize: '10px' }}>Esc</kbd> Close context menu</li>
            </ul>
          </div>
        )}
      </Card.Header>
      <Card.Body className='p-0 d-flex flex-column overflow-hidden'>
        <div className='flex-grow-1 overflow-auto p-3'>
          <div className='d-flex flex-column gap-2'>
            {tableRows.map(({ i, p1, p2 }) => {
              const color = POINT_COLORS[i % POINT_COLORS.length];
              return (
                <div
                  key={`pair-${i}`}
                  style={{
                    background: '#5B6977',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderLeft: `4px solid ${color}`,
                    borderRadius: '6px',
                    padding: '10px'
                  }}
                >
                  <div className='d-flex align-items-center justify-content-between mb-2'>
                    <Badge
                      pill
                      bg=''
                      style={{ backgroundColor: color, fontSize: '0.7rem' }}
                    >
                      Pair {i + 1}
                    </Badge>
                    {p1 && p2 && (
                      <Button
                        size='sm'
                        variant='link'
                        className='p-0 text-danger opacity-75 hover-opacity-100'
                        onClick={() => handleRemovePair(i)}
                      >
                        <X size={16} />
                      </Button>
                    )}
                  </div>

                  <div className='d-flex gap-2'>
                    {/* Image 1 Point */}
                    <div className='flex-grow-1 p-2' style={{ background: '#4E5D6C', borderRadius: '4px' }}>
                      <div className='d-flex align-items-center gap-1 mb-1 opacity-75 small'>
                        <ImageIcon size={12} /> <span>1</span>
                      </div>
                      {p1 ? (
                        <div className='d-flex align-items-center justify-content-between'>
                          <span className='small mono'>
                            {Math.round(p1.x)}, {Math.round(p1.y)}
                          </span>
                          <Button
                            size='sm'
                            variant='link'
                            className='p-0 text-muted'
                            onClick={() => handleRemovePoint1(i)}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      ) : (
                        <span className='text-muted small fst-italic'>Pending...</span>
                      )}
                    </div>

                    {/* Image 2 Point */}
                    <div className='flex-grow-1 p-2' style={{ background: '#4E5D6C', borderRadius: '4px' }}>
                      <div className='d-flex align-items-center gap-1 mb-1 opacity-75 small'>
                        <ImageIcon size={12} /> <span>2</span>
                      </div>
                      {p2 ? (
                        <div className='d-flex align-items-center justify-content-between'>
                          <span className='small mono'>
                            {Math.round(p2.x)}, {Math.round(p2.y)}
                          </span>
                          <Button
                            size='sm'
                            variant='link'
                            className='p-0 text-muted'
                            onClick={() => handleRemovePoint2(i)}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      ) : (
                        <span className='text-muted small fst-italic'>Pending...</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {tableRows.length === 0 && (
              <div className='text-center py-4 opacity-50 small'>
                <Circle size={24} className='mb-2 opacity-25' />
                <p className='mb-0'>No points yet. Click on both<br />images to begin matching.</p>
              </div>
            )}
          </div>
        </div>
      </Card.Body>
      <Card.Footer>
        <div className='d-flex flex-column gap-3'>
          <Button
            size='sm'
            onClick={handleSave}
            disabled={!canCompute || isSaving}
            className='w-100 d-flex align-items-center justify-content-center gap-2 py-2 mt-2'
            variant={canCompute ? 'primary' : 'secondary'}
          >
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save Homography'}
          </Button>

          <div className='pt-3 border-top border-secondary'>
            <p className='small opacity-50 mb-2'>No overlap? Skip this pair.</p>
            <Button
              size='sm'
              className='w-100 d-flex align-items-center justify-content-center gap-2 mb-2'
              variant='outline-warning'
              onClick={() => handleSkip()}
              disabled={isSkipping}
            >
              <SkipForward size={14} />
              {isSkipping ? 'Skipping...' : 'Skip Pair'}
            </Button>
          </div>
        </div>
      </Card.Footer>
    </Card>
  );
}
