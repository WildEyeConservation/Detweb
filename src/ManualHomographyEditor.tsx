import { useCallback, useContext, useMemo, useState } from 'react';
import { Marker, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { GlobalContext, ImageContext } from './Context';
import type { ImageType } from './schemaTypes';
import { Matrix, inv, matrix, multiply, transpose } from 'mathjs';
import { Card, Button, Form } from 'react-bootstrap';
import { useQueryClient } from '@tanstack/react-query';

type Point = { id: string; x: number; y: number };

const MIN_POINT_DISTANCE = 20; // Minimum pixel distance between points

function useClickToAddPoint(
  onAdd: (xy: { x: number; y: number }) => void,
  existingPoints: Point[]
) {
  const { latLng2xy } = useContext(ImageContext)!;
  useMapEvents({
    click: (e) => {
      const p = latLng2xy(e.latlng) as L.Point;
      
      // Check if click is too close to an existing point
      const isTooClose = existingPoints.some((existing) => {
        const dx = existing.x - p.x;
        const dy = existing.y - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < MIN_POINT_DISTANCE;
      });
      
      if (isTooClose) {
        return; // Don't add point if too close to existing one
      }
      
      onAdd({ x: p.x, y: p.y });
    },
    dblclick: (e) => {
      // Prevent double-click zoom from also adding points
      L.DomEvent.stopPropagation(e);
    },
  });
  return null;
}

function createDotIcon(index: number) {
  return L.divIcon({
    className: 'manual-homography-point',
    html: `<div style="width:14px;height:14px;border-radius:7px;background:#ff3b3b;border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;box-shadow:0 0 2px rgba(0,0,0,0.6)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export function PointsOverlay({
  points,
  setPoints,
}: {
  points: Point[];
  setPoints: (pts: Point[] | ((prev: Point[]) => Point[])) => void;
}) {
  const { xy2latLng, latLng2xy } = useContext(ImageContext)!;

  const handleAdd = useCallback(
    ({ x, y }: { x: number; y: number }) => {
      setPoints((prev) => prev.concat([{ id: crypto.randomUUID(), x, y }]));
    },
    [setPoints]
  );

  const handleRemovePoint = useCallback(
    (pointId: string) => {
      setPoints((prev) => prev.filter((p) => p.id !== pointId));
    },
    [setPoints]
  );

  useClickToAddPoint(handleAdd, points);

  return (
    <>
      {points.map((p, idx) => (
        <Marker
          key={p.id}
          position={xy2latLng([p.x, p.y]) as any}
          draggable={true}
          icon={createDotIcon(idx)}
          eventHandlers={{
            dragend: (e) => {
              const latlng = (e.target as L.Marker).getLatLng();
              const pt = latLng2xy(latlng) as L.Point;
              setPoints((prev) =>
                prev.map((q) =>
                  q.id === p.id ? { ...q, x: pt.x, y: pt.y } : q
                )
              );
            },
            contextmenu: (e) => {
              L.DomEvent.stopPropagation(e);
              L.DomEvent.preventDefault(e);
              handleRemovePoint(p.id);
            },
          }}
        >
          <Tooltip direction='top' offset={[0, -10]} opacity={0.9} permanent>
            {idx + 1}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}

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

function solveHomography(points1: Point[], points2: Point[]): Matrix | null {
  if (points1.length < 12 || points2.length < 12) return null;
  const { A, b } = buildDesignMatrix(points1, points2);
  // Normal equations: (A^T A) u = A^T b
  const At = transpose(A) as Matrix;
  const AtA = multiply(At, A) as Matrix;
  const Atb = multiply(At, b) as Matrix;
  // Solve using inverse (sufficient for small 8x8)
  const u = multiply(inv(AtA), Atb) as Matrix; // 8x1

  const h11 = (u as any).get([0]);
  const h12 = (u as any).get([1]);
  const h13 = (u as any).get([2]);
  const h21 = (u as any).get([3]);
  const h22 = (u as any).get([4]);
  const h23 = (u as any).get([5]);
  const h31 = (u as any).get([6]);
  const h32 = (u as any).get([7]);
  const H = matrix([
    [h11, h12, h13],
    [h21, h22, h23],
    [h31, h32, 1],
  ]);
  return H;
}

export function ManualHomographyEditor({
  images,
  points1,
  points2,
  setPoints1,
  setPoints2,
  onSaved,
  onSkipped,
}: {
  images: [ImageType, ImageType];
  points1: Point[];
  points2: Point[];
  setPoints1: (updater: Point[] | ((prev: Point[]) => Point[])) => void;
  setPoints2: (updater: Point[] | ((prev: Point[]) => Point[])) => void;
  onSaved: (H: Matrix) => void;
  onSkipped?: () => void;
}) {
  const { client } = useContext(GlobalContext)!;
  const [moreInformation, setMoreInformation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const queryClient = useQueryClient();
  const canCompute =
    points1.length >= 12 &&
    points2.length >= 12 &&
    points1.length === points2.length;

  const handleRemovePair = useCallback(
    (index: number) => {
      setPoints1((prev) => prev.filter((_, i) => i !== index));
      setPoints2((prev) => prev.filter((_, i) => i !== index));
    },
    [setPoints1, setPoints2]
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    const H = solveHomography(points1, points2) as Matrix;
    if (!H) return;

    const flat: number[] = (H.toArray() as number[][]).flat();
    const flatInverse: number[] = (inv(H).toArray() as number[][]).flat();

    // determine keys order
    const nb1Resp: any = await (client.models.ImageNeighbour.get as any)({
      image1Id: images[0].id,
      image2Id: images[1].id,
    });
    const nb1 = nb1Resp?.data;

    await client.models.ImageNeighbour.update({
      image1Id: images[nb1 ? 0 : 1].id,
      image2Id: images[nb1 ? 1 : 0].id,
      homography: nb1 ? flat : flatInverse,
      homographySource: 'manual',
    });

    // Force-refetch neighbours for both images so Registration and BaseImage overlays recompute
    await Promise.all([
      // Registration's aggregate neighbours
      queryClient.refetchQueries({
        queryKey: ['imageNeighbours', images[0].id],
      }),
      queryClient.refetchQueries({
        queryKey: ['imageNeighbours', images[1].id],
      }),
      // ImageContext overlays
      queryClient.refetchQueries({
        queryKey: ['prevNeighbours', images[0].id],
      }),
      queryClient.refetchQueries({
        queryKey: ['prevNeighbours', images[1].id],
      }),
      queryClient.refetchQueries({
        queryKey: ['nextNeighbours', images[0].id],
      }),
      queryClient.refetchQueries({
        queryKey: ['nextNeighbours', images[1].id],
      }),
    ]);

    setIsSaving(false);
    onSaved(H);
  }, [client, images, points1, points2, onSaved]);

  // remove image neighbour record if the images aren't actually neighbours
  const handleUnlink = useCallback(async () => {
    if (!window.confirm('Are you sure you want to unlink these images?'))
      return;

    const nb1Resp: any = await (client.models.ImageNeighbour.get as any)({
      image1Id: images[0].id,
      image2Id: images[1].id,
    });
    const nb1 = nb1Resp?.data;

    await client.models.ImageNeighbour.delete({
      image1Id: images[nb1 ? 0 : 1].id,
      image2Id: images[nb1 ? 1 : 0].id,
    });

    // Force-refetch neighbours for both images so Registration and BaseImage overlays recompute
    await Promise.all([
      // Registration's aggregate neighbours
      queryClient.refetchQueries({
        queryKey: ['imageNeighbours', images[0].id],
      }),
      queryClient.refetchQueries({
        queryKey: ['imageNeighbours', images[1].id],
      }),
      // ImageContext overlays
      queryClient.refetchQueries({
        queryKey: ['prevNeighbours', images[0].id],
      }),
      queryClient.refetchQueries({
        queryKey: ['prevNeighbours', images[1].id],
      }),
      queryClient.refetchQueries({
        queryKey: ['nextNeighbours', images[0].id],
      }),
      queryClient.refetchQueries({
        queryKey: ['nextNeighbours', images[1].id],
      }),
    ]);
  }, [client, images, queryClient]);

  // Skip this image pair - mark as skipped so it won't be shown again
  const handleSkip = useCallback(async () => {
    if (
      !window.confirm(
        'Are you sure you want to skip this pair? The images will remain neighbours but won\'t require registration.'
      )
    )
      return;

    setIsSkipping(true);

    const nb1Resp: any = await (client.models.ImageNeighbour.get as any)({
      image1Id: images[0].id,
      image2Id: images[1].id,
    });
    const nb1 = nb1Resp?.data;

    await client.models.ImageNeighbour.update({
      image1Id: images[nb1 ? 0 : 1].id,
      image2Id: images[nb1 ? 1 : 0].id,
      skipped: true,
    });

    // Force-refetch neighbours for both images
    await Promise.all([
      queryClient.refetchQueries({
        queryKey: ['imageNeighbours', images[0].id],
      }),
      queryClient.refetchQueries({
        queryKey: ['imageNeighbours', images[1].id],
      }),
      queryClient.refetchQueries({
        queryKey: ['prevNeighbours', images[0].id],
      }),
      queryClient.refetchQueries({
        queryKey: ['prevNeighbours', images[1].id],
      }),
      queryClient.refetchQueries({
        queryKey: ['nextNeighbours', images[0].id],
      }),
      queryClient.refetchQueries({
        queryKey: ['nextNeighbours', images[1].id],
      }),
    ]);

    setIsSkipping(false);
    onSkipped?.();
  }, [client, images, queryClient, onSkipped]);

  const handleRemovePoint1 = useCallback(
    (index: number) => {
      setPoints1((prev) => prev.filter((_, i) => i !== index));
    },
    [setPoints1]
  );

  const handleRemovePoint2 = useCallback(
    (index: number) => {
      setPoints2((prev) => prev.filter((_, i) => i !== index));
    },
    [setPoints2]
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
    <Card className='w-100 d-flex flex-column'>
      <Card.Header>
        <Card.Title>Manual Homography Editor</Card.Title>
      </Card.Header>
      <Card.Body>
        <Button
          variant='link'
          className='p-0 mb-2'
          onClick={() => setMoreInformation(!moreInformation)}
        >
          {moreInformation ? 'Hide instructions' : 'Show instructions'}
        </Button>
        {moreInformation && (
          <Form.Label>
            <p className='mb-1'>
              No homography found for this pair of images.
              <br />
              Please follow the instructions below:
            </p>
            <ul>
              <li>Select 12 corresponding points on both images.</li>
              <li>Drag markers to adjust.</li>
              <li>
                <strong>Right-click</strong> a marker to remove it.
              </li>
              <li>Points should be distributed across the images.</li>
              <li>Aim to cover as much area as possible.</li>
              <li>Avoid straight lines.</li>
              <li>Click Save to compute and store the homography.</li>
            </ul>
          </Form.Label>
        )}
        <div className='table-responsive'>
          <table className='table table-sm table-striped table-dark align-middle mb-0'>
            <thead>
              <tr>
                <th>#</th>
                <th>Image 1 (x, y)</th>
                <th>Image 2 (x, y)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(({ i, p1, p2 }) => (
                <tr key={`row-${i}`}>
                  <td>{i + 1}</td>
                  <td>
                    {p1 ? (
                      <span className='d-flex align-items-center gap-2'>
                        <span>
                          {Math.round(p1.x)}, {Math.round(p1.y)}
                        </span>
                        <Button
                          size='sm'
                          variant='outline-danger'
                          className='py-0 px-1'
                          onClick={() => handleRemovePoint1(i)}
                          title='Remove this point'
                        >
                          ×
                        </Button>
                      </span>
                    ) : (
                      <span className='text-muted fst-italic'>—</span>
                    )}
                  </td>
                  <td>
                    {p2 ? (
                      <span className='d-flex align-items-center gap-2'>
                        <span>
                          {Math.round(p2.x)}, {Math.round(p2.y)}
                        </span>
                        <Button
                          size='sm'
                          variant='outline-danger'
                          className='py-0 px-1'
                          onClick={() => handleRemovePoint2(i)}
                          title='Remove this point'
                        >
                          ×
                        </Button>
                      </span>
                    ) : (
                      <span className='text-muted fst-italic'>—</span>
                    )}
                  </td>
                  <td className='text-end'>
                    {p1 && p2 && (
                      <Button
                        size='sm'
                        variant='danger'
                        onClick={() => handleRemovePair(i)}
                      >
                        Remove pair
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {tableRows.length === 0 && (
                <tr>
                  <td colSpan={4} className='text-center'>
                    No points yet. Click on both images to add matching points.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className='d-flex gap-2 w-100 mt-2'>
            <Button
              size='sm'
              onClick={handleSave}
              disabled={!canCompute || isSaving}
              className='flex-grow-1'
            >
              {isSaving ? 'Saving...' : 'Save homography'}
            </Button>
          </div>
        </div>
        <div className='mt-3 border-top border-dark pt-3'>
          <Form.Label>
            If these images overlap but don't need to be registered, you can
            skip this pair.
          </Form.Label>
          <Button
            size='sm'
            className='w-100'
            variant='outline-warning'
            onClick={() => handleSkip()}
            disabled={isSkipping}
          >
            {isSkipping ? 'Skipping...' : 'Skip this pair'}
          </Button>
        </div>
        <div className='mt-3 border-top border-dark pt-3'>
          <Form.Label>
            If there is no overlap between the images, you can unlink them by
            pressing the button below.
          </Form.Label>
          <Button
            size='sm'
            className='w-100'
            variant='outline-danger'
            onClick={() => handleUnlink()}
          >
            Unlink images
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}

export type { Point };
