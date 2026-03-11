import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GlobalContext } from '../Context';
import { Card, Button, ProgressBar, Spinner, Alert } from 'react-bootstrap';
import { HomographyWorkbench } from './HomographyWorkbench';
import { useHomographyPreloader, type ManifestPair } from './useHomographyPreloader';
import type { Matrix } from 'mathjs';
import { getUrl } from 'aws-amplify/storage';

type BatchData = {
  id: string;
  poolId: string;
  projectId: string;
  batchIndex: number;
  status: string;
  assignedUserId: string | null;
  currentIndex: number;
  pairCount: number;
  pairManifestS3Key: string | null;
  annotationSetId: string;
};

export function HomographyBatchView() {
  const { batchId } = useParams<{ poolId: string; batchId: string }>();
  const { client } = useContext(GlobalContext)!;
  const navigate = useNavigate();

  const [batch, setBatch] = useState<BatchData | null>(null);
  const [pairs, setPairs] = useState<ManifestPair[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [batchComplete, setBatchComplete] = useState(false);
  const [assigningNext, setAssigningNext] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load batch data and manifest
  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;

    (async () => {
      try {
        const batchResp = await (client.models as any).HomographyBatch.get({ id: batchId });
        const batchData = batchResp?.data as unknown as BatchData | null;

        if (!batchData) {
          setError('Batch not found');
          setLoading(false);
          return;
        }

        if (batchData.status !== 'assigned') {
          setError(`This batch is not assigned (status: ${batchData.status})`);
          setLoading(false);
          return;
        }

        if (cancelled) return;
        setBatch(batchData);
        setCurrentIndex(batchData.currentIndex);

        // Download manifest from S3
        if (batchData.pairManifestS3Key) {
          const urlResult = await getUrl({
            path: batchData.pairManifestS3Key,
            options: { bucket: 'outputBucket' },
          });
          const response = await fetch(urlResult.url.toString());
          const manifest = await response.json();

          if (!cancelled) {
            setPairs(manifest.pairs || []);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [batchId, client]);

  // Heartbeat
  useEffect(() => {
    if (!batchId || batchComplete) return;

    const sendHeartbeat = async () => {
      try {
        await (client.mutations as any).heartbeatHomographyBatch({ batchId });
      } catch (e) {
        console.error('Heartbeat failed:', e);
      }
    };

    sendHeartbeat(); // Initial heartbeat
    heartbeatRef.current = setInterval(sendHeartbeat, 30_000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [batchId, batchComplete, client]);

  const { currentPair, recordSavedHomography } = useHomographyPreloader(
    pairs,
    currentIndex,
    client,
  );

  const handleSave = useCallback(async (H: Matrix) => {
    if (!batch) return;
    setIsSaving(true);
    try {
      const flat: number[] = (H.toArray() as number[][]).flat();
      const pair = pairs[currentIndex];

      const result = await (client.mutations as any).saveHomographyPair({
        batchId: batch.id,
        pairIndex: currentIndex,
        image1Id: pair.image1.id,
        image2Id: pair.image2.id,
        homography: flat,
        skip: false,
      });

      const parsed = typeof result?.data === 'string' ? JSON.parse(result.data) : result?.data;

      recordSavedHomography(currentIndex, flat);

      if (parsed?.completed) {
        setBatchComplete(true);
      } else {
        setCurrentIndex(prev => prev + 1);
      }
    } catch (e) {
      console.error('Save failed:', e);
      alert(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSaving(false);
    }
  }, [batch, pairs, currentIndex, client, recordSavedHomography]);

  const handleSkip = useCallback(async () => {
    if (!batch) return;
    setIsSkipping(true);
    try {
      const pair = pairs[currentIndex];

      const result = await (client.mutations as any).saveHomographyPair({
        batchId: batch.id,
        pairIndex: currentIndex,
        image1Id: pair.image1.id,
        image2Id: pair.image2.id,
        skip: true,
      });

      const parsed = typeof result?.data === 'string' ? JSON.parse(result.data) : result?.data;

      if (parsed?.completed) {
        setBatchComplete(true);
      } else {
        setCurrentIndex(prev => prev + 1);
      }
    } catch (e) {
      console.error('Skip failed:', e);
      alert(`Skip failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSkipping(false);
    }
  }, [batch, pairs, currentIndex, client]);

  const handleTakeNextBatch = useCallback(async () => {
    if (!batch) return;
    setAssigningNext(true);
    try {
      const result = await (client.mutations as any).assignHomographyBatch({ poolId: batch.poolId });
      const parsed = typeof result?.data === 'string' ? JSON.parse(result.data) : result?.data;

      if (parsed?.id && !parsed?.error) {
        navigate(`/surveys/${batch.projectId}/homography-pool/${batch.poolId}/batch/${parsed.id}`);
        // Reset state for new batch
        setBatchComplete(false);
        setLoading(true);
      } else {
        navigate('/jobs');
      }
    } catch (e) {
      console.error('Failed to get next batch:', e);
      navigate('/jobs');
    } finally {
      setAssigningNext(false);
    }
  }, [batch, client, navigate]);

  if (loading) {
    return (
      <div className='d-flex align-items-center justify-content-center h-100 w-100' style={{ paddingTop: '16px' }}>
        <Spinner animation='border' className='me-2' /> Loading batch...
      </div>
    );
  }

  if (error) {
    return (
      <div className='d-flex flex-column align-items-center justify-content-center h-100 w-100' style={{ paddingTop: '16px' }}>
        <Alert variant='danger'>{error}</Alert>
        <Button onClick={() => navigate('/jobs')}>Back to Jobs</Button>
      </div>
    );
  }

  if (batchComplete) {
    return (
      <div className='d-flex flex-column align-items-center justify-content-center h-100 w-100 gap-3' style={{ paddingTop: '16px' }}>
        <Card style={{ maxWidth: '500px' }}>
          <Card.Header>
            <Card.Title className='mb-0'>Batch Complete</Card.Title>
          </Card.Header>
          <Card.Body className='d-flex flex-column gap-3 align-items-center'>
            <p className='mb-0'>{pairs.length} pairs processed.</p>
            <div className='d-flex gap-2'>
              <Button
                variant='primary'
                onClick={handleTakeNextBatch}
                disabled={assigningNext}
              >
                {assigningNext ? <><Spinner size='sm' className='me-1' /> Getting next batch...</> : 'Take Next Batch'}
              </Button>
              <Button variant='secondary' onClick={() => navigate('/jobs')}>
                Back to Jobs
              </Button>
            </div>
          </Card.Body>
        </Card>
      </div>
    );
  }

  const pairReady = currentPair.status === 'ready';
  const pairLoading = currentPair.status === 'loading' || currentPair.status === 'idle';

  return (
    <div style={{ width: '100%', paddingTop: '16px', paddingBottom: '16px', height: '100%' }}>
      {pairLoading ? (
        <div className='d-flex align-items-center justify-content-center h-100'>
          <Spinner animation='border' className='me-2' /> Loading pair {currentIndex + 1}...
        </div>
      ) : currentPair.status === 'error' ? (
        <div className='d-flex flex-column align-items-center justify-content-center h-100 gap-2'>
          <Alert variant='danger'>Error loading pair: {currentPair.error.message}</Alert>
          <Button variant='warning' onClick={handleSkip} disabled={isSkipping}>
            Skip this pair
          </Button>
        </div>
      ) : pairReady ? (
        <HomographyWorkbench
          images={currentPair.images}
          onSave={handleSave}
          onSkip={handleSkip}
          isSaving={isSaving}
          isSkipping={isSkipping}
          annotationSetId={batch?.annotationSetId}
          header={
            <div className='d-flex align-items-center gap-3'>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                Pair {currentIndex + 1} / {pairs.length}
              </span>
              <ProgressBar
                now={(currentIndex / pairs.length) * 100}
                style={{ width: '150px', height: '8px' }}
              />
              {currentIndex > 0 && (
                <Button
                  size='sm'
                  variant='outline-secondary'
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                >
                  Prev
                </Button>
              )}
            </div>
          }
        />
      ) : null}
    </div>
  );
}
