import { useCallback, useContext, useEffect, useState } from 'react';
import { Form, Spinner } from 'react-bootstrap';
import Select, { SingleValue } from 'react-select';
import { Schema } from '../amplify/client-schema';
import { GlobalContext } from '../Context';
import CreateTask from '../CreateTask';
import LabeledToggleSwitch from '../LabeledToggleSwitch';
import type { TiledLaunchRequest } from '../types/LaunchTask';
import { DataClient } from '../../amplify/shared/data-schema.generated';

type LaunchHandler = (onProgress: (msg: string) => void) => Promise<void>;

type Option = { label: string; value: string };

type TiledOption = {
  label: string;
  value: string;
  locationCount?: number;
  tilesPerImage?: number;
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
  const { client } = useContext(GlobalContext)!;

  // Tile set selection/creation
  const [useExistingTiled, setUseExistingTiled] = useState<boolean>(false);
  const [tiledSetOptions, setTiledSetOptions] = useState<TiledOption[]>([]);
  const [selectedTiledSetId, setSelectedTiledSetId] = useState<string>('');
  const [handleCreateTask, setHandleCreateTask] = useState<
    (() => Promise<TiledLaunchRequest>) | null
  >(null);

  // Queue tag
  const [loadingModels, setLoadingModels] = useState<boolean>(false);
  const [queueTag, setQueueTag] = useState<string>(
    `${annotationSet.name} - False Negatives`
  );

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

  // Load all tiled location sets for the project
  useEffect(() => {
    let cancelled = false;
    async function loadTiledSets() {
      setLoadingModels(true);
      const resp1 = await client.models.LocationSet.locationSetsByProjectId(
        { projectId: project.id },
        {
          selectionSet: ['id', 'name', 'description', 'locationCount'] as const,
        }
      );
      const data = resp1.data as Array<{
        id: string;
        name: string;
        description?: string | null;
        locationCount?: number | null;
      }>;

      // Restrict tiled sets to those mapped to the current annotation set
      const resp2 =
        await client.models.TasksOnAnnotationSet.locationSetsByAnnotationSetId({
          annotationSetId: annotationSet.id,
        });
      const taskMappings = resp2.data as Array<{ locationSetId: string }>;
      const allowedTiledSetIds = new Set(
        (taskMappings || []).map((m) => m.locationSetId)
      );

      const options: TiledOption[] = [];
      for (const ls of data || []) {
        const descRaw = ls.description as string | undefined;
        if (!descRaw) continue;
        try {
          const desc = JSON.parse(descRaw);
          if (desc && desc.mode === 'tiled' && allowedTiledSetIds.has(ls.id)) {
            const parts: string[] = [];
            if (ls.name) parts.push(ls.name);
            if (
              typeof desc.horizontalTiles === 'number' &&
              typeof desc.verticalTiles === 'number'
            ) {
              parts.push(`${desc.horizontalTiles}x${desc.verticalTiles}`);
            }
            if (
              typeof desc.width === 'number' &&
              typeof desc.height === 'number'
            ) {
              parts.push(`${desc.width}x${desc.height}px`);
            }
            const horizontal = Number(desc.horizontalTiles ?? 0);
            const vertical = Number(desc.verticalTiles ?? 0);
            options.push({
              label: parts.join(' • '),
              value: ls.id,
              locationCount:
                typeof ls.locationCount === 'number'
                  ? ls.locationCount
                  : undefined,
              tilesPerImage:
                horizontal > 0 && vertical > 0
                  ? horizontal * vertical
                  : undefined,
            });
          }
        } catch {}
      }
      if (!cancelled)
        setTiledSetOptions(
          options.sort((a, b) => (a.label > b.label ? 1 : -1))
        );
      if (!cancelled) setLoadingModels(false);
    }
    loadTiledSets();
    return () => {
      cancelled = true;
    };
  }, [
    client.models.LocationSet,
    client.models.TasksOnAnnotationSet,
    project.id,
    annotationSet.id,
  ]);

  // Enable/disable Launch button
  useEffect(() => {
    const shouldDisable =
      launching ||
      loadingModels ||
      (useExistingTiled
        ? !selectedTiledSetId
        : typeof handleCreateTask !== 'function');
    setLaunchDisabled(shouldDisable);
  }, [
    launching,
    loadingModels,
    useExistingTiled,
    selectedTiledSetId,
    handleCreateTask,
    setLaunchDisabled,
  ]);

  const computeSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryMessage('Preparing tile data...');
    setCandidateTiles(null);
    setEstimatedSampleTiles(null);
    setExpectedTiles(null);
    try {
      let tiles: MinimalTile[] = [];

      if (useExistingTiled) {
        if (!selectedTiledSetId) {
          throw new Error('Select an existing tiled set');
        }
        setSummaryMessage('Fetching tiles...');
        tiles = await fetchTilesFromLocationSet(client, selectedTiledSetId);
      } else {
        if (typeof handleCreateTask !== 'function') return;
        setSummaryMessage('Generating tiles...');
        const request = await handleCreateTask();
        tiles = generateTilesFromRequest(request);
      }

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
    handleCreateTask,
    samplePercent,
    selectedTiledSetId,
    useExistingTiled,
  ]);

  // Expose launch handler to parent
  useEffect(() => {
    setFalseNegativesLaunchHandler(
      () => async (onProgress: (msg: string) => void) => {
        let locationSetId: string | undefined;
        let tiledRequestPayload: TiledLaunchRequest | null = null;

        if (useExistingTiled) {
          if (!selectedTiledSetId) return;
          locationSetId = selectedTiledSetId;
        } else {
          if (typeof handleCreateTask !== 'function') return;
          onProgress('Preparing tiling request...');
          tiledRequestPayload = await handleCreateTask();
        }

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
          locationSetId,
          tiledRequest: tiledRequestPayload,
          batchSize: 200,
        };

        onProgress('Enqueuing jobs...');
        sendLaunchFalseNegativesRequest(client, payload);
        onProgress('Launch request submitted');
      }
    );
    return () => {
      setFalseNegativesLaunchHandler(null);
    };
  }, [
    annotationSet.id,
    client,
    handleCreateTask,
    project.id,
    queueTag,
    samplePercent,
    selectedTiledSetId,
    setFalseNegativesLaunchHandler,
    useExistingTiled,
  ]);

  // modelOptions now derived from actual location sets; when exactly one, it's auto-selected

  return (
    <div className='px-3 pb-3 pt-1'>
      <div className='d-flex flex-column gap-3 mt-2'>
        <div
          className='border border-dark shadow-sm p-2'
          style={{ backgroundColor: '#697582' }}
        >
          <LabeledToggleSwitch
            className='m-0'
            leftLabel='Create tiles'
            rightLabel='Use existing tiles'
            checked={useExistingTiled}
            onChange={(checked) => setUseExistingTiled(checked)}
          />
          {useExistingTiled ? (
            <Form.Group className='mt-2'>
              <Form.Label className='mb-0'>Existing tiled sets</Form.Label>
              <Select<Option>
                value={
                  tiledSetOptions.find((o) => o.value === selectedTiledSetId) ||
                  null
                }
                onChange={(opt: SingleValue<Option>) =>
                  setSelectedTiledSetId(opt?.value ?? '')
                }
                options={tiledSetOptions}
                placeholder='Select a tiled set'
                className='text-black'
                isDisabled={launching}
              />
            </Form.Group>
          ) : (
            <div className='mt-2'>
              <CreateTask
                name={`${annotationSet.name}-FN`}
                projectId={project.id}
                setHandleCreateTask={setHandleCreateTask}
                setLaunchDisabled={() => {}}
                disabled={launching}
              />
            </div>
          )}
        </div>

        {loadingModels && (
          <p
            className='text-muted mb-0 mt-2 text-center'
            style={{ fontSize: '12px' }}
          >
            Loading tile sets...
          </p>
        )}
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
                Modify this to display a different name for the job in the jobs
                page.
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
              disabled={
                launching ||
                (useExistingTiled
                  ? !selectedTiledSetId
                  : typeof handleCreateTask !== 'function') ||
                summaryLoading
              }
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
      </div>
    </div>
  );
}

async function fetchTilesFromLocationSet(
  client: DataClient,
  locationSetId: string
): Promise<MinimalTile[]> {
  const tiles: MinimalTile[] = [];
  let nextToken: string | null | undefined = undefined;
  do {
    const { data, nextToken: nt } =
      await client.models.Location.locationsBySetIdAndConfidence(
        { setId: locationSetId },
        {
          selectionSet: ['id', 'imageId', 'x', 'y', 'width', 'height'] as const,
          limit: 1000,
          nextToken,
        }
      );
    for (const item of data || []) {
      if (!item?.id || !item?.imageId) continue;
      tiles.push({
        id: item.id as string,
        imageId: item.imageId as string,
        x: Number(item.x ?? 0),
        y: Number(item.y ?? 0),
        width: Number(item.width ?? 0),
        height: Number(item.height ?? 0),
      });
    }
    nextToken = nt as string | null | undefined;
  } while (nextToken);
  return tiles;
}

function generateTilesFromRequest(request: TiledLaunchRequest): MinimalTile[] {
  const tiles: MinimalTile[] = [];
  const baselineWidth = Math.max(0, request.maxX - request.minX);
  const baselineHeight = Math.max(0, request.maxY - request.minY);
  const baselineIsLandscape = baselineWidth >= baselineHeight;
  let counter = 0;

  for (const image of request.images) {
    const imageIsLandscape = image.width >= image.height;
    const swapTileForImage = baselineIsLandscape !== imageIsLandscape;
    const tileWidthForImage = swapTileForImage ? request.height : request.width;
    const tileHeightForImage = swapTileForImage
      ? request.width
      : request.height;
    const horizontalTilesForImage = swapTileForImage
      ? request.verticalTiles
      : request.horizontalTiles;
    const verticalTilesForImage = swapTileForImage
      ? request.horizontalTiles
      : request.verticalTiles;
    const roiMinXForImage = swapTileForImage ? request.minY : request.minX;
    const roiMinYForImage = swapTileForImage ? request.minX : request.minY;
    const roiMaxXForImage = swapTileForImage ? request.maxY : request.maxX;
    const roiMaxYForImage = swapTileForImage ? request.maxX : request.maxY;

    const effectiveW = Math.max(0, roiMaxXForImage - roiMinXForImage);
    const effectiveH = Math.max(0, roiMaxYForImage - roiMinYForImage);
    const xStepSize =
      horizontalTilesForImage > 1
        ? (effectiveW - tileWidthForImage) / (horizontalTilesForImage - 1)
        : 0;
    const yStepSize =
      verticalTilesForImage > 1
        ? (effectiveH - tileHeightForImage) / (verticalTilesForImage - 1)
        : 0;

    for (let xStep = 0; xStep < horizontalTilesForImage; xStep++) {
      for (let yStep = 0; yStep < verticalTilesForImage; yStep++) {
        const x = Math.round(
          roiMinXForImage +
            (horizontalTilesForImage > 1 ? xStep * xStepSize : 0) +
            tileWidthForImage / 2
        );
        const y = Math.round(
          roiMinYForImage +
            (verticalTilesForImage > 1 ? yStep * yStepSize : 0) +
            tileHeightForImage / 2
        );
        tiles.push({
          id: `${image.id}-${counter++}`,
          imageId: image.id,
          x,
          y,
          width: tileWidthForImage,
          height: tileHeightForImage,
        });
      }
    }
  }

  return tiles;
}

// Fetch observation points - locations that humans have reviewed
// Returns a map of imageId -> array of tile bounds (locations that were observed)
async function fetchObservationPointsDetailed(
  client: DataClient,
  annotationSetId: string
): Promise<Map<string, Array<{ x: number; y: number; width: number; height: number }>>> {
  const map = new Map<string, Array<{ x: number; y: number; width: number; height: number }>>();
  
  // First, fetch all observations to get location IDs
  const locationIds: string[] = [];
  let nextToken: string | null | undefined = undefined;
  do {
    const { data, nextToken: nt } =
      await client.models.Observation.observationsByAnnotationSetId(
        { annotationSetId },
        {
          selectionSet: ['locationId'] as const,
          limit: 1000,
          nextToken,
        }
      );
    for (const item of data || []) {
      const locationId = item?.locationId as string | undefined;
      if (locationId) {
        locationIds.push(locationId);
      }
    }
    nextToken = nt as string | null | undefined;
  } while (nextToken);

  // Now fetch the location details for each observed location
  // Process in parallel with some batching
  const batchSize = 50;
  for (let i = 0; i < locationIds.length; i += batchSize) {
    const batch = locationIds.slice(i, i + batchSize);
    const locationPromises = batch.map(async (locationId) => {
      try {
        const { data } = await client.models.Location.get({ id: locationId });
        return data;
      } catch {
        return null;
      }
    });
    
    const locations = await Promise.all(locationPromises);
    for (const loc of locations) {
      if (!loc?.imageId) continue;
      const list = map.get(loc.imageId as string) || [];
      list.push({
        x: Number(loc.x ?? 0),
        y: Number(loc.y ?? 0),
        width: Number(loc.width ?? 0),
        height: Number(loc.height ?? 0),
      });
      map.set(loc.imageId as string, list);
    }
  }

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

async function sendLaunchFalseNegativesRequest(
  client: DataClient,
  payload: Record<string, unknown>
) {
  try {
    await client.mutations.launchFalseNegatives({
      request: JSON.stringify(payload),
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

function isInsideTile(px: number, py: number, tile: MinimalTile): boolean {
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
  tile1: MinimalTile,
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
