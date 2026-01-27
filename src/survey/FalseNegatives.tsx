import { useCallback, useContext, useEffect, useState } from 'react';
import { Alert, Form, Spinner } from 'react-bootstrap';
import { QueryCommand } from '@aws-sdk/client-dynamodb';
import { uploadData } from 'aws-amplify/storage';
import { Schema } from '../amplify/client-schema';
import { GlobalContext, UserContext } from '../Context';
import { DataClient } from '../../amplify/shared/data-schema.generated';
import { logAdminAction } from '../utils/adminActionLogger';

type LaunchHandler = {
  execute: (
    onProgress: (msg: string) => void,
    onLaunchConfirmed: () => void
  ) => Promise<void>;
};

type MinimalTile = {
  id: string;
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export default function FalseNegatives({
  project,
  annotationSet,
  launching,
  setLaunchDisabled,
  setFalseNegativesLaunchHandler,
}: {
  project: Schema['Project']['type'];
  annotationSet: Schema['AnnotationSet']['type'];
  launching: boolean;
  setLaunchDisabled: React.Dispatch<React.SetStateAction<boolean>>;
  setFalseNegativesLaunchHandler: React.Dispatch<
    React.SetStateAction<LaunchHandler | null>
  >;
}) {
  const { client, backend } = useContext(GlobalContext)!;
  const { getDynamoClient, user } = useContext(UserContext)!;

  // Global tiled location set from project
  const tiledLocationSetId = (project as any).tiledLocationSetId as
    | string
    | undefined;

  // Queue tag
  const [queueTag, setQueueTag] = useState<string>(
    `${annotationSet.name} - False Negatives`
  );

  // Tile count state
  const [globalTileCount, setGlobalTileCount] = useState<number | null>(null);
  const [loadingTileCount, setLoadingTileCount] = useState<boolean>(true);

  // Sampling
  const [samplePercent, setSamplePercent] = useState<number>(5);
  const [showAdvancedOptions, setShowAdvancedOptions] =
    useState<boolean>(false);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
  const [summaryMessage, setSummaryMessage] = useState<string>('');
  const [expectedTiles, setExpectedTiles] = useState<number | null>(null);
  const [candidateTiles, setCandidateTiles] = useState<number | null>(null);
  const [estimatedSampleTiles, setEstimatedSampleTiles] = useState<
    number | null
  >(null);

  // Load global tile count
  useEffect(() => {
    let mounted = true;
    async function loadTileCount() {
      if (!tiledLocationSetId) {
        setGlobalTileCount(0);
        setLoadingTileCount(false);
        return;
      }
      setLoadingTileCount(true);
      try {
        const { data } = await client.models.LocationSet.get(
          { id: tiledLocationSetId },
          { selectionSet: ['locationCount'] }
        );
        if (mounted) {
          setGlobalTileCount(data?.locationCount ?? 0);
        }
      } catch (err) {
        console.error('Failed to load tile count', err);
        if (mounted) {
          setGlobalTileCount(0);
        }
      }
      if (mounted) {
        setLoadingTileCount(false);
      }
    }
    loadTileCount();
    return () => {
      mounted = false;
    };
  }, [client.models.LocationSet, tiledLocationSetId]);

  // Enable/disable Launch button based on global tiles availability
  useEffect(() => {
    const shouldDisable =
      launching ||
      loadingTileCount ||
      !tiledLocationSetId ||
      (globalTileCount !== null && globalTileCount === 0);
    setLaunchDisabled(shouldDisable);
  }, [
    launching,
    loadingTileCount,
    tiledLocationSetId,
    globalTileCount,
    setLaunchDisabled,
  ]);

  // Fetch locations from DynamoDB for the global tiled set
  const fetchLocationsFromSet = useCallback(
    async (
      locationSetId: string,
      onProgress?: (message: string) => void
    ): Promise<MinimalTile[]> => {
      const dynamoClient = await getDynamoClient();
      const tiles: MinimalTile[] = [];
      let lastEvaluatedKey: Record<string, any> | undefined = undefined;
      onProgress?.('Querying locations...');
      do {
        const command = new QueryCommand({
          TableName: backend.custom.locationTable,
          IndexName: 'locationsBySetIdAndConfidence',
          KeyConditionExpression: 'setId = :locationSetId',
          ExpressionAttributeValues: {
            ':locationSetId': { S: locationSetId },
          },
          ProjectionExpression: 'id, imageId, x, y, width, height',
          ExclusiveStartKey: lastEvaluatedKey,
          Limit: 1000,
        });
        try {
          const response = await dynamoClient.send(command);
          const items = response.Items || [];
          const pageTiles = items
            .filter((item: any) => {
              const x = parseFloat(item.x?.N || '0');
              const y = parseFloat(item.y?.N || '0');
              const width = parseFloat(item.width?.N || '0');
              const height = parseFloat(item.height?.N || '0');
              return x !== 0 && y !== 0 && width !== 0 && height !== 0;
            })
            .map((item: any) => ({
              id: item.id.S as string,
              imageId: item.imageId.S as string,
              x: parseFloat(item.x?.N || '0'),
              y: parseFloat(item.y?.N || '0'),
              width: parseFloat(item.width?.N || '0'),
              height: parseFloat(item.height?.N || '0'),
            }));
          tiles.push(...pageTiles);
          onProgress?.(`Loaded ${tiles.length} locations`);
          lastEvaluatedKey = response.LastEvaluatedKey as
            | Record<string, any>
            | undefined;
        } catch (error) {
          console.error('Error querying DynamoDB:', error);
          throw error;
        }
      } while (lastEvaluatedKey);
      return tiles;
    },
    [backend.custom.locationTable, getDynamoClient]
  );

  const computeSummary = useCallback(async () => {
    if (!tiledLocationSetId) return;

    setSummaryLoading(true);
    setSummaryMessage('Preparing tile data...');
    setCandidateTiles(null);
    setEstimatedSampleTiles(null);
    setExpectedTiles(null);
    try {
      setSummaryMessage('Fetching tiles...');
      const tiles = await fetchLocationsFromSet(
        tiledLocationSetId,
        setSummaryMessage
      );

      setExpectedTiles(tiles.length);

      setSummaryMessage('Fetching reviewed locations...');
      const observationPoints = await fetchObservationPointsDetailed(
        client,
        annotationSet.id
      );

      setSummaryMessage('Fetching annotations...');
      const annotationPoints = await fetchAnnotationPointsDetailed(
        client,
        annotationSet.id
      );

      setSummaryMessage('Evaluating tiles...');
      const candidates = tiles.filter((tile) => {
        const obs = observationPoints.get(tile.imageId) || [];
        const anns = annotationPoints.get(tile.imageId) || [];
        // Check if any observed location overlaps with this tile
        const hasObservation = obs.some((o) => tilesOverlap(tile, o));
        const hasAnnotation = anns.some((pt) => isInsideTile(pt.x, pt.y, tile));
        return !hasObservation && !hasAnnotation;
      });
      setCandidateTiles(candidates.length);

      const normalizedPercent = Math.min(Math.max(samplePercent, 0), 100);
      const availableTiles = candidates.length;
      let estimatedSamples = Math.floor(
        (availableTiles * normalizedPercent) / 100
      );
      if (
        normalizedPercent > 0 &&
        estimatedSamples === 0 &&
        availableTiles > 0
      ) {
        estimatedSamples = 1;
      }
      setEstimatedSampleTiles(estimatedSamples);

      setSummaryMessage('');
    } catch (error) {
      console.error('Summary calculation failed', error);
      setSummaryMessage('Unable to compute summary');
    } finally {
      setSummaryLoading(false);
    }
  }, [
    annotationSet.id,
    client,
    fetchLocationsFromSet,
    samplePercent,
    tiledLocationSetId,
  ]);

  // Expose launch handler to parent
  useEffect(() => {
    setFalseNegativesLaunchHandler({
      execute: async (onProgress: (msg: string) => void, onLaunchConfirmed: () => void) => {
        if (!tiledLocationSetId) {
          onProgress('No tiles configured for this survey.');
          return;
        }

        onProgress('Fetching locations from global tile set...');
        const locationTiles = await fetchLocationsFromSet(
          tiledLocationSetId,
          onProgress
        );
        if (locationTiles.length === 0) {
          alert('No locations found in the global tiled set');
          return;
        }
        onLaunchConfirmed();
        onProgress(`Found ${locationTiles.length} locations`);

        const payload = {
          projectId: project.id,
          annotationSetId: annotationSet.id,
          queueOptions: {
            name: 'False Negatives',
            hidden: false,
            fifo: false,
          },
          queueTag,
          samplePercent,
          locationSetId: tiledLocationSetId,
          locationTiles,
          batchSize: 200,
        };

        onProgress('Enqueuing jobs...');
        await sendLaunchFalseNegativesRequest(client, payload);
        onProgress('Launch request submitted');

        await logAdminAction(
          client,
          user.userId,
          `Launched False Negatives queue for annotation set "${annotationSet.name}" in project "${project.name}" ($${samplePercent}% sample)`,
          project.id
        ).catch(console.error);
      }
    });
    return () => {
      setFalseNegativesLaunchHandler(null);
    };
  }, [
    annotationSet.id,
    annotationSet.name,
    client,
    fetchLocationsFromSet,
    project.id,
    project.name,
    queueTag,
    samplePercent,
    tiledLocationSetId,
    setFalseNegativesLaunchHandler,
  ]);

  // Show warning if no global tiles exist
  const showNoTilesWarning =
    !loadingTileCount && (!tiledLocationSetId || globalTileCount === 0);

  return (
    <div className='px-3 pb-3 pt-1'>
      <div className='d-flex flex-column gap-3 mt-2'>
        {loadingTileCount ? (
          <p
            className='text-muted mb-0 text-center'
            style={{ fontSize: '12px' }}
          >
            Loading tile information...
          </p>
        ) : showNoTilesWarning ? (
          <Alert variant='warning' className='mb-0'>
            <strong>No tiles configured.</strong>
            <p className='mb-0 mt-1' style={{ fontSize: '14px' }}>
              Please go to <strong>Edit Survey &gt; Manage Tiles</strong> to
              create tiles for this survey before launching a false negatives
              task.
            </p>
          </Alert>
        ) : (
          <>
            <div
              className='border border-dark shadow-sm p-2'
              style={{ backgroundColor: '#697582' }}
            >
              <p className='mb-0 text-white'>
                <strong>{globalTileCount}</strong> tiles available for false
                negative sampling.
              </p>
              <p className='mb-0 mt-1 text-muted' style={{ fontSize: '12px' }}>
                To modify tiles, go to Edit Survey &gt; Manage Tiles.
              </p>
            </div>

            <Form.Group>
              <Form.Label className='mb-0'>Sample size (%)</Form.Label>
              <Form.Control
                type='number'
                min={0}
                max={100}
                step={1}
                value={samplePercent}
                onChange={(e) =>
                  setSamplePercent(Number((e.target as HTMLInputElement).value))
                }
                disabled={launching}
              />
            </Form.Group>

            <Form.Group>
              <Form.Switch
                label='Show Advanced Options'
                checked={showAdvancedOptions}
                onChange={() => setShowAdvancedOptions(!showAdvancedOptions)}
                disabled={launching}
              />
            </Form.Group>

            {showAdvancedOptions && (
              <div
                className='d-flex flex-column gap-3 border border-dark shadow-sm p-2'
                style={{ backgroundColor: '#697582' }}
              >
                <Form.Group>
                  <Form.Label className='mb-0'>Job Name</Form.Label>
                  <span
                    className='text-muted d-block mb-1'
                    style={{ fontSize: '12px' }}
                  >
                    Modify this to display a different name for the job in the
                    jobs page.
                  </span>
                  <Form.Control
                    type='text'
                    value={queueTag}
                    onChange={(e) =>
                      setQueueTag((e.target as HTMLInputElement).value)
                    }
                    disabled={launching}
                  />
                </Form.Group>
              </div>
            )}

            <div
              className='border border-dark shadow-sm p-2'
              style={{ backgroundColor: '#697582' }}
            >
              <div className='d-flex align-items-center justify-content-between'>
                <div className='text-white' style={{ fontSize: '12px' }}>
                  <div>Expected tiles: {expectedTiles ?? '—'}</div>
                  <div>Estimated candidate tiles: {candidateTiles ?? '—'}</div>
                  <div>
                    Estimated launch ({samplePercent}%):{' '}
                    {estimatedSampleTiles ?? '—'}
                  </div>
                </div>
                <button
                  type='button'
                  className='btn btn-primary'
                  disabled={launching || summaryLoading}
                  onClick={computeSummary}
                >
                  {summaryLoading ? (
                    <span className='d-inline-flex align-items-center'>
                      <Spinner animation='border' size='sm' className='me-2' />{' '}
                      Computing summary...
                    </span>
                  ) : (
                    'Compute Summary'
                  )}
                </button>
              </div>
              {summaryMessage && (
                <div className='mt-2 text-muted' style={{ fontSize: '12px' }}>
                  {summaryMessage}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Fetch observation points - locations that humans have reviewed
// Returns a map of imageId -> array of tile bounds (locations that were observed)
async function fetchObservationPointsDetailed(
  client: DataClient,
  annotationSetId: string
): Promise<
  Map<string, Array<{ x: number; y: number; width: number; height: number }>>
> {
  const map = new Map<
    string,
    Array<{ x: number; y: number; width: number; height: number }>
  >();

  // OPTIMIZATION: Fetch observations with location data included in the same query
  // This avoids N+1 queries by including location fields in the selectionSet
  let nextToken: string | null | undefined = undefined;
  do {
    const { data, nextToken: nt } =
      await client.models.Observation.observationsByAnnotationSetId(
        { annotationSetId },
        {
          selectionSet: [
            'locationId',
            'location.id',
            'location.imageId',
            'location.width',
            'location.height',
            'location.x',
            'location.y',
          ] as const,
          limit: 1000,
          nextToken,
        }
      );
    for (const item of data || []) {
      const location = (item as any)?.location;
      if (!location?.imageId) continue;
      const imageId = location.imageId as string;
      const list = map.get(imageId) || [];
      list.push({
        x: Number(location.x ?? 0),
        y: Number(location.y ?? 0),
        width: Number(location.width ?? 0),
        height: Number(location.height ?? 0),
      });
      map.set(imageId, list);
    }
    nextToken = nt as string | null | undefined;
  } while (nextToken);

  return map;
}

async function fetchAnnotationPointsDetailed(
  client: DataClient,
  annotationSetId: string
): Promise<Map<string, Array<{ x: number; y: number }>>> {
  const map = new Map<string, Array<{ x: number; y: number }>>();
  let nextToken: string | null | undefined = undefined;
  do {
    const { data, nextToken: nt } =
      await client.models.Annotation.annotationsByAnnotationSetId(
        { setId: annotationSetId },
        {
          selectionSet: ['imageId', 'x', 'y'] as const,
          limit: 1000,
          nextToken,
        }
      );
    for (const item of data || []) {
      const imageId = item?.imageId as string | undefined;
      if (!imageId) continue;
      const list = map.get(imageId) || [];
      list.push({
        x: Number(item.x ?? 0),
        y: Number(item.y ?? 0),
      });
      map.set(imageId, list);
    }
    nextToken = nt as string | null | undefined;
  } while (nextToken);
  return map;
}

// Threshold in bytes above which we upload the payload to S3.
// Lambda sync limit is 6MB, but we use a conservative threshold.
const PAYLOAD_SIZE_THRESHOLD = 200 * 1024; // 200KB

async function sendLaunchFalseNegativesRequest(
  client: DataClient,
  payload: Record<string, unknown>
) {
  const payloadStr = JSON.stringify(payload);
  const payloadSize = new Blob([payloadStr]).size;

  let requestPayload: string;

  if (payloadSize > PAYLOAD_SIZE_THRESHOLD) {
    // Upload large payload to S3 and send only the reference.
    const s3Key = `launch-payloads/${crypto.randomUUID()}.json`;
    console.log(
      `Payload size ${payloadSize} exceeds threshold, uploading to S3`,
      { key: s3Key }
    );
    await uploadData({
      path: s3Key,
      data: payloadStr,
      options: {
        bucket: 'outputs',
        contentType: 'application/json',
      },
    }).result;
    requestPayload = JSON.stringify({ payloadS3Key: s3Key });
  } else {
    requestPayload = payloadStr;
  }

  try {
    await client.mutations.launchFalseNegatives({
      request: requestPayload,
    });
  } catch (error: any) {
    if (shouldIgnoreLaunchError(error)) {
      console.warn('Ignoring launch lambda timeout response', error);
      return;
    }
    throw error;
  }
}

function shouldIgnoreLaunchError(error: any): boolean {
  const messages: string[] = [];
  if (error?.message) messages.push(String(error.message));
  if (Array.isArray(error?.errors)) {
    for (const err of error.errors) {
      if (err?.message) messages.push(String(err.message));
    }
  }
  return messages.some((msg) =>
    /timed out|timeout|Task timed out|socket hang up/i.test(msg)
  );
}

type MinimalTileForCheck = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function isInsideTile(
  px: number,
  py: number,
  tile: MinimalTileForCheck
): boolean {
  const halfW = tile.width / 2;
  const halfH = tile.height / 2;
  const minX = tile.x - halfW;
  const maxX = tile.x + halfW;
  const minY = tile.y - halfH;
  const maxY = tile.y + halfH;
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
}

// Check if two tiles overlap (both have center x,y and width,height)
function tilesOverlap(
  tile1: MinimalTileForCheck,
  tile2: { x: number; y: number; width: number; height: number }
): boolean {
  const halfW1 = tile1.width / 2;
  const halfH1 = tile1.height / 2;
  const halfW2 = tile2.width / 2;
  const halfH2 = tile2.height / 2;

  const minX1 = tile1.x - halfW1;
  const maxX1 = tile1.x + halfW1;
  const minY1 = tile1.y - halfH1;
  const maxY1 = tile1.y + halfH1;

  const minX2 = tile2.x - halfW2;
  const maxX2 = tile2.x + halfW2;
  const minY2 = tile2.y - halfH2;
  const maxY2 = tile2.y + halfH2;

  // Check if rectangles overlap
  return minX1 < maxX2 && maxX1 > minX2 && minY1 < maxY2 && maxY1 > minY2;
}
