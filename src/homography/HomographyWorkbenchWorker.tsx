import { useState, useContext, useCallback, useRef } from 'react';
import { GlobalContext } from '../Context';
import { HomographyWorkbench } from './HomographyWorkbench';
import type { Matrix } from 'mathjs';
import { inv } from 'mathjs';
import type { Point } from './ManualHomographyEditor';

export type HomographyImageMeta = {
  id: string;
  width: number;
  height: number;
  timestamp: number | null;
  originalPath: string | null;
  projectId: string;
  latitude: number | null;
  longitude: number | null;
  altitude_wgs84: number | null;
  cameraSerial: string | null;
  group: string | null;
};

export type HomographyMessage = {
  pairKey: string;
  queueId: string;
  annotationSetId: string;
  primaryImage: HomographyImageMeta;
  secondaryImage: HomographyImageMeta;
  ack: () => Promise<void>;
};

type Props = {
  pair: HomographyMessage;
  savedPoints?: { p1: Point[]; p2: Point[] };
  queueId: string;
  onComplete: () => void;
  onBack?: () => void;
  onForward?: () => void;
  onExit?: () => void;
  onSavePoints: (pairKey: string, points: { p1: Point[]; p2: Point[] }) => void;
  header?: React.ReactNode;
};

async function resolveNeighbourDirection(
  client: any,
  primaryId: string,
  secondaryId: string
): Promise<{ image1Id: string; image2Id: string; isForward: boolean }> {
  const fwdResp = await client.models.ImageNeighbour.get({
    image1Id: primaryId,
    image2Id: secondaryId,
  });
  if (fwdResp?.data) {
    return { image1Id: primaryId, image2Id: secondaryId, isForward: true };
  }
  const revResp = await client.models.ImageNeighbour.get({
    image1Id: secondaryId,
    image2Id: primaryId,
  });
  if (revResp?.data) {
    return { image1Id: secondaryId, image2Id: primaryId, isForward: false };
  }
  throw new Error(
    `ImageNeighbour record not found in either direction for ${primaryId} / ${secondaryId}`
  );
}

export function HomographyWorkbenchWorker({
  pair,
  savedPoints,
  queueId,
  onComplete,
  onBack,
  onForward,
  onExit,
  onSavePoints,
  header,
}: Props) {
  const { client } = useContext(GlobalContext)!;
  const [isSaving, setIsSaving] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const currentPointsRef = useRef<{ p1: Point[]; p2: Point[] }>({ p1: [], p2: [] });

  const handlePointsChange = useCallback(
    (points: { p1: Point[]; p2: Point[] }) => {
      currentPointsRef.current = points;
    },
    []
  );

  const handleSave = useCallback(
    async (H: Matrix) => {
      setIsSaving(true);
      try {
        const flat: number[] = (H.toArray() as number[][]).flat();
        const flatInverse: number[] = (inv(H).toArray() as number[][]).flat();

        const dir = await resolveNeighbourDirection(
          client,
          pair.primaryImage.id,
          pair.secondaryImage.id
        );

        await (client.models.ImageNeighbour.update as any)({
          image1Id: dir.image1Id,
          image2Id: dir.image2Id,
          homography: dir.isForward ? flat : flatInverse,
          homographySource: 'manual',
        });

        await (client as any).mutations.incrementQueueCount({ id: queueId });
        await pair.ack();
        onSavePoints(pair.pairKey, currentPointsRef.current);
        onComplete();
      } catch (error) {
        console.error('Failed to save homography', error);
      } finally {
        setIsSaving(false);
      }
    },
    [client, pair, queueId, onComplete, onSavePoints]
  );

  const handleSkip = useCallback(async () => {
    if (
      !window.confirm(
        "Are you sure you want to skip this pair? The images will remain neighbours but won't require registration."
      )
    )
      return;

    setIsSkipping(true);
    try {
      const dir = await resolveNeighbourDirection(
        client,
        pair.primaryImage.id,
        pair.secondaryImage.id
      );

      await (client.models.ImageNeighbour.update as any)({
        image1Id: dir.image1Id,
        image2Id: dir.image2Id,
        skipped: true,
      });

      await (client as any).mutations.incrementQueueCount({ id: queueId });
      await pair.ack();
      onSavePoints(pair.pairKey, currentPointsRef.current);
      onComplete();
    } catch (error) {
      console.error('Failed to skip pair', error);
    } finally {
      setIsSkipping(false);
    }
  }, [client, pair, queueId, onComplete, onSavePoints]);

  const handleBack = useCallback(() => {
    onSavePoints(pair.pairKey, currentPointsRef.current);
    onBack?.();
  }, [pair.pairKey, onSavePoints, onBack]);

  const handleForward = useCallback(() => {
    onSavePoints(pair.pairKey, currentPointsRef.current);
    onForward?.();
  }, [pair.pairKey, onSavePoints, onForward]);

  return (
    <HomographyWorkbench
      images={[pair.primaryImage as any, pair.secondaryImage as any]}
      onSave={handleSave}
      onSkip={handleSkip}
      isSaving={isSaving}
      isSkipping={isSkipping}
      annotationSetId={pair.annotationSetId}
      initialPoints={savedPoints}
      onPointsChange={handlePointsChange}
      header={
        <div className='d-flex align-items-center gap-3'>
          {header}
          {onBack && (
            <button
              className='btn btn-sm btn-outline-secondary'
              onClick={handleBack}
              disabled={isSaving || isSkipping}
            >
              Back
            </button>
          )}
          {onForward && (
            <button
              className='btn btn-sm btn-outline-secondary'
              onClick={handleForward}
              disabled={isSaving || isSkipping}
            >
              Forward
            </button>
          )}
          {onExit && (
            <button
              className='btn btn-sm btn-outline-warning'
              onClick={onExit}
              disabled={isSaving || isSkipping}
            >
              Save &amp; Exit
            </button>
          )}
        </div>
      }
    />
  );
}
