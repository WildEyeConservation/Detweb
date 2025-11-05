import { useParams } from 'react-router-dom';
import { useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { GlobalContext } from './Context';
import { RegisterPair } from './RegisterPair';
import { ManualHomographyEditor } from './ManualHomographyEditor';
import { array2Matrix, makeTransform } from './utils';
import { inv } from 'mathjs';
import type { ImageType } from './schemaTypes';

type Point = { id: string; x: number; y: number };

type PairState = {
  images: [ImageType, ImageType];
  transforms: ((coords: [number, number]) => [number, number])[] | null;
  hasHomography: boolean;
  neighbourKey: { image1Id: string; image2Id: string };
};

export function PairLoader() {
  const { image1Id, image2Id, selectedSet } = useParams();
  const { client } = useContext(GlobalContext)!;
  const [pair, setPair] = useState<PairState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [points1, setPoints1] = useState<Point[]>([]);
  const [points2, setPoints2] = useState<Point[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadPair() {
      if (!image1Id || !image2Id || !selectedSet) {
        setPair(null);
        setError('Missing URL parameters for register route.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setPair(null);
      setPoints1([]);
      setPoints2([]);

      const attempt = async (id1: string, id2: string, reversed: boolean) => {
        try {
          const response = await client.models.ImageNeighbour.get(
            { image1Id: id1, image2Id: id2 },
            { selectionSet: ['homography', 'image1.*', 'image2.*'] }
          );
          const data = response?.data;
          if (!data?.image1 || !data?.image2) {
            return false;
          }

          const homographyMatrix = array2Matrix(data.homography ?? null);
          const hasHomography = Boolean(homographyMatrix);

          const transforms = hasHomography
            ? [
                makeTransform(
                  reversed
                    ? inv(homographyMatrix as any)
                    : (homographyMatrix as any)
                ),
                makeTransform(
                  reversed
                    ? (homographyMatrix as any)
                    : inv(homographyMatrix as any)
                ),
              ]
            : null;

          if (!cancelled) {
            setPair({
              images: reversed
                ? [data.image2 as ImageType, data.image1 as ImageType]
                : [data.image1 as ImageType, data.image2 as ImageType],
              transforms,
              hasHomography,
              neighbourKey: { image1Id: id1, image2Id: id2 },
            });
          }
          return true;
        } catch (err) {
          return false;
        }
      };

      const forwardOk = await attempt(image1Id, image2Id, false);
      if (!forwardOk) {
        const reverseOk = await attempt(image2Id, image1Id, true);
        if (!reverseOk && !cancelled) {
          setError('Unable to load neighbour information for this image pair.');
        }
      }

      if (!cancelled) {
        setLoading(false);
      }
    }

    loadPair();

    return () => {
      cancelled = true;
    };
  }, [client, image1Id, image2Id, selectedSet]);

  const handleHomographySaved = useCallback((H: any) => {
    setPair((prev) => {
      if (!prev) return prev;
      const fwd = makeTransform(H as any);
      const bwd = makeTransform(inv(H as any) as any);
      return {
        ...prev,
        transforms: [fwd, bwd],
        hasHomography: true,
      };
    });
    setPoints1([]);
    setPoints2([]);
  }, []);

  const content = useMemo(() => {
    if (loading) {
      return <div>Loading registration pair...</div>;
    }

    if (error) {
      return <div className='text-danger'>{error}</div>;
    }

    if (!pair || !selectedSet) {
      return (
        <div className='text-danger'>
          Unable to display this registration pair.
        </div>
      );
    }

    const showManualEditor = !pair.hasHomography;

    return (
      <div
        className='d-flex flex-column flex-grow-1 w-100'
        style={{
          maxWidth: '1555px',
          padding: '16px',
          minHeight: 'calc(100vh - 120px)',
        }}
      >
        <div
          className='d-flex flex-column flex-md-row gap-3 flex-grow-1 w-100'
          style={{ minHeight: 0 }}
        >
          {showManualEditor && (
            <div
              className='w-100 h-100 d-flex flex-column flex-grow-0'
              style={{ maxWidth: '360px' }}
            >
              <ManualHomographyEditor
                images={pair.images}
                points1={points1}
                points2={points2}
                setPoints1={setPoints1}
                setPoints2={setPoints2}
                onSaved={handleHomographySaved}
              />
            </div>
          )}
          <div className='flex-grow-1 d-flex' style={{ minHeight: 0 }}>
            <RegisterPair
              images={pair.images}
              selectedSet={selectedSet}
              transforms={pair.transforms ?? undefined}
              visible={true}
              next={() => {}}
              prev={() => {}}
              ack={() => {}}
              noHomography={!pair.hasHomography}
              points1={points1}
              points2={points2}
              setPoints1={setPoints1}
              setPoints2={setPoints2}
            />
          </div>
        </div>
      </div>
    );
  }, [
    error,
    handleHomographySaved,
    loading,
    pair,
    points1,
    points2,
    selectedSet,
  ]);

  return content;
}
