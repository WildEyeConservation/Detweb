import { useState, useMemo, useEffect, useCallback } from 'react';
import { inv } from 'mathjs';
import type { Matrix } from 'mathjs';
import { makeTransform } from '../utils';
import type { ImageType } from '../schemaTypes';
import { Form, Button } from 'react-bootstrap';
import { Undo2, Redo2 } from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  ManualHomographyEditor,
  solveHomography,
  MIN_HOMOGRAPHY_POINTS,
  type Point,
} from './ManualHomographyEditor';
import { MapboxPairViewer } from './MapboxPairViewer';

type Props = {
  images: [ImageType, ImageType];
  onSave: (H: Matrix) => void;
  onSkip?: () => void;
  isSaving?: boolean;
  isSkipping?: boolean;
  annotationSetId?: string;
  /** Content rendered above the pair viewer (e.g. pair count, status text) */
  header?: React.ReactNode;
};

export function HomographyWorkbench({
  images,
  onSave,
  onSkip,
  isSaving = false,
  isSkipping = false,
  annotationSetId,
  header,
}: Props) {
  const [points, setPoints] = useState<{ p1: Point[]; p2: Point[] }>({
    p1: [],
    p2: [],
  });
  const [history, setHistory] = useState<{ p1: Point[]; p2: Point[] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ p1: Point[]; p2: Point[] }[]>(
    []
  );
  const [previewHomography, setPreviewHomography] = useState(false);

  const points1 = points.p1;
  const points2 = points.p2;

  const setPoints1 = useCallback(
    (updater: Point[] | ((prev: Point[]) => Point[])) => {
      setPoints((prev) => ({
        ...prev,
        p1: typeof updater === 'function' ? updater(prev.p1) : updater,
      }));
    },
    []
  );

  const setPoints2 = useCallback(
    (updater: Point[] | ((prev: Point[]) => Point[])) => {
      setPoints((prev) => ({
        ...prev,
        p2: typeof updater === 'function' ? updater(prev.p2) : updater,
      }));
    },
    []
  );

  // Undo / redo
  const recordAction = useCallback(() => {
    setHistory((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (last.p1 === points.p1 && last.p2 === points.p2) return prev;
      }
      return [...prev.slice(-49), points];
    });
    setRedoStack([]);
  }, [points]);

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((redo) => [points, ...redo]);
      setPoints(last);
      return prev.slice(0, -1);
    });
  }, [points]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[0];
      setHistory((hist) => [...hist, points]);
      setPoints(next);
      return prev.slice(1);
    });
  }, [points]);

  useHotkeys(
    'ctrl+z, meta+z',
    (e) => {
      e.preventDefault();
      undo();
    },
    { enableOnFormTags: true }
  );

  useHotkeys(
    'ctrl+y, meta+shift+z, ctrl+shift+z',
    (e) => {
      e.preventDefault();
      redo();
    },
    { enableOnFormTags: true }
  );

  // Reset when images change
  useEffect(() => {
    setPoints({ p1: [], p2: [] });
    setHistory([]);
    setRedoStack([]);
    setPreviewHomography(false);
  }, [images[0].id, images[1].id]);

  // Auto-enable preview at minimum point count
  const numPairs = Math.min(points1.length, points2.length);
  useEffect(() => {
    if (
      !previewHomography &&
      numPairs === MIN_HOMOGRAPHY_POINTS &&
      points1.length === points2.length
    ) {
      setPreviewHomography(true);
    }
  }, [numPairs, points1.length, points2.length]);

  const previewTransforms = useMemo(() => {
    if (!previewHomography) return null;
    if (
      points1.length < MIN_HOMOGRAPHY_POINTS ||
      points2.length < MIN_HOMOGRAPHY_POINTS
    )
      return null;
    const H = solveHomography(points1, points2);
    if (!H) return null;
    try {
      return [
        makeTransform(H),
        makeTransform(inv(H)),
      ] as [
        (c: [number, number]) => [number, number],
        (c: [number, number]) => [number, number],
      ];
    } catch {
      return null;
    }
  }, [previewHomography, points1, points2]);

  const canPreview =
    points1.length >= MIN_HOMOGRAPHY_POINTS &&
    points2.length >= MIN_HOMOGRAPHY_POINTS;

  return (
    <div className='w-100 h-100 d-flex flex-column flex-md-row gap-3'>
      {/* Sidebar */}
      <div
        className='d-flex flex-column gap-3 w-100'
        style={{ maxWidth: '360px' }}
      >
        <ManualHomographyEditor
          points1={points1}
          points2={points2}
          setPoints1={setPoints1}
          setPoints2={setPoints2}
          onSave={onSave}
          onSkip={onSkip}
          onAction={recordAction}
          isSaving={isSaving}
          isSkipping={isSkipping}
        />
      </div>

      {/* Main content */}
      <div className='d-flex flex-column align-items-center h-100 w-100'>
        <div className='mb-2 d-flex align-items-center gap-3'>
          {header}
          <Form.Check
            type='switch'
            id='preview-homography'
            label='Preview homography'
            checked={previewHomography}
            onChange={(e) => setPreviewHomography(e.target.checked)}
            disabled={!canPreview}
          />
          {!canPreview && (
            <span className='text-muted' style={{ fontSize: '0.85rem' }}>
              (min {MIN_HOMOGRAPHY_POINTS} point pairs)
            </span>
          )}
          <div className='d-flex align-items-center gap-1 border-start ps-3 border-secondary'>
            <Button
              size='sm'
              variant='outline-secondary'
              onClick={undo}
              disabled={history.length === 0}
              title='Undo (Ctrl+Z)'
              className='p-1 d-flex align-items-center'
            >
              <Undo2 size={16} />
            </Button>
            <Button
              size='sm'
              variant='outline-secondary'
              onClick={redo}
              disabled={redoStack.length === 0}
              title='Redo (Ctrl+Y / Ctrl+Shift+Z)'
              className='p-1 d-flex align-items-center'
            >
              <Redo2 size={16} />
            </Button>
          </div>
        </div>
        <MapboxPairViewer
          key={`mapbox-${images[0].id}::${images[1].id}`}
          images={images}
          points={[points1, points2]}
          setPoints={[setPoints1, setPoints2]}
          previewTransforms={previewTransforms}
          onAction={recordAction}
          annotationSetId={annotationSetId}
        />
      </div>
    </div>
  );
}
