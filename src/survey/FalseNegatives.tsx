import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Form, Spinner } from 'react-bootstrap';
import Select, { SingleValue } from 'react-select';
import { Schema } from '../../amplify/client-schema';
import { GlobalContext, UserContext } from '../Context';
import CreateTask from '../CreateTask';
import { makeSafeQueueName } from '../utils';
import LabeledToggleSwitch from '../LabeledToggleSwitch';
import {
  CreateQueueCommand,
  SendMessageBatchCommand,
} from '@aws-sdk/client-sqs';

type LaunchHandler = (onProgress: (msg: string) => void) => Promise<void>;

type Nullable<T> = T | null;

type Option = { label: string; value: string };

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
  const { getSqsClient } = useContext(UserContext)!;

  // Tile set selection/creation
  const [useExistingTiled, setUseExistingTiled] = useState<boolean>(false);
  const [tiledSetOptions, setTiledSetOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [selectedTiledSetId, setSelectedTiledSetId] = useState<string>('');
  const [handleCreateTask, setHandleCreateTask] = useState<
    (() => Promise<string>) | null
  >(null);
  const [workingTileSetId, setWorkingTileSetId] = useState<string>('');

  // Model selection and threshold
  const [model, setModel] = useState<Option | null>(null);
  const [modelOptions, setModelOptions] = useState<Option[]>([]);
  // Internal flag during initial model derivation; not used in UI yet
  const [loadingModels, setLoadingModels] = useState<boolean>(false);
  const [threshold, setThreshold] = useState<number>(0.6);
  const [queueTag, setQueueTag] = useState<string>(
    `${annotationSet.name} - False Negatives`
  );

  // Sampling
  const [samplePercent, setSamplePercent] = useState<number>(5);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string>('');
  const [totalTiles, setTotalTiles] = useState<number>(0);
  const [candidateCount, setCandidateCount] = useState<number>(0);
  const [selectedCount, setSelectedCount] = useState<number>(0);
  const selectedLocationIdsRef = useRef<string[]>([]);

  // Load all tiled location sets for the project
  useEffect(() => {
    let cancelled = false;
    async function loadTiledSets() {
      setLoadingModels(true);
      const resp1 = await client.models.LocationSet.locationSetsByProjectId(
        { projectId: project.id },
        { selectionSet: ['id', 'name', 'description'] as const }
      );
      const data = resp1.data as Array<{
        id: string;
        name: string;
        description?: string | null;
      }>;
      // Derive model options from location set names the user actually has
      const modelOpts: Option[] = [];
      const pushOnce = (label: string, value: string) => {
        if (!modelOpts.some((o) => o.value === value)) modelOpts.push({ label, value });
      };
      for (const ls of data || []) {
        const n = String(ls.name || '').toLowerCase();
        if (n.includes('scoutbot')) pushOnce('ScoutBot', 'scoutbot');
        if (n.includes('mad')) pushOnce('MAD AI', 'mad');
        if (n.includes('elephant-detection-nadir'))
          pushOnce('Elephant Detection Nadir', 'heatmap');
      }
      if (!cancelled) {
        setModelOptions(modelOpts);
        if (modelOpts.length === 1) setModel(modelOpts[0]);
      }
      // Restrict tiled sets to those mapped to the current annotation set
      const resp2 =
        await client.models.TasksOnAnnotationSet.locationSetsByAnnotationSetId({
          annotationSetId: annotationSet.id,
        });
      const taskMappings = resp2.data as Array<{ locationSetId: string }>;
      const allowedTiledSetIds = new Set(
        (taskMappings || []).map((m) => m.locationSetId)
      );

      const options: { label: string; value: string }[] = [];
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
            options.push({ label: parts.join(' • '), value: ls.id });
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
      !model ||
      (useExistingTiled
        ? !selectedTiledSetId
        : typeof handleCreateTask !== 'function') ||
      scanning ||
      selectedLocationIdsRef.current.length === 0;
    setLaunchDisabled(shouldDisable);
  }, [
    launching,
    loadingModels,
    model,
    useExistingTiled,
    selectedTiledSetId,
    handleCreateTask,
    scanning,
    setLaunchDisabled,
    selectedCount,
  ]);

  // Helpers
  function isInsideTile(px: number, py: number, tile: MinimalTile): boolean {
    const halfW = (tile.width ?? 0) / 2;
    const halfH = (tile.height ?? 0) / 2;
    const minX = tile.x - halfW;
    const maxX = tile.x + halfW;
    const minY = tile.y - halfH;
    const maxY = tile.y + halfH;
    return px >= minX && px <= maxX && py >= minY && py <= maxY;
  }

  function randomSample<T>(arr: T[], count: number): T[] {
    if (count <= 0) return [];
    if (count >= arr.length) return arr.slice();
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, count);
  }

  const computeFalseNegativeTiles = useCallback(async () => {
    if (!model) return;
    setScanning(true);
    setScanMessage('Preparing tile set...');
    try {
      let tileSetId = workingTileSetId;
      if (!useExistingTiled) {
        if (typeof handleCreateTask !== 'function') return;
        // Create tiles first to be able to fetch them
        tileSetId = await handleCreateTask();
        setWorkingTileSetId(tileSetId);
      } else {
        tileSetId = selectedTiledSetId;
      }
      if (!tileSetId) return;

      setScanMessage('Fetching tiles...');
      const tiles: MinimalTile[] = [];
      {
        let nextToken: string | null | undefined = undefined;
        do {
          const { data, nextToken: nt } =
            await client.models.Location.locationsBySetIdAndConfidence(
              { setId: tileSetId },
              {
                selectionSet: [
                  'id',
                  'imageId',
                  'x',
                  'y',
                  'width',
                  'height',
                ] as const,
                limit: 1000,
                nextToken,
              }
            );
          const page = (data || [])
            .filter(
              (l) => typeof l.id === 'string' && typeof l.imageId === 'string'
            )
            .map((l) => ({
              id: l.id as string,
              imageId: l.imageId as string,
              x: l.x as number,
              y: l.y as number,
              width: (l.width ?? 0) as number,
              height: (l.height ?? 0) as number,
            }));
          tiles.push(...page);
          nextToken = nt as string | null | undefined;
        } while (nextToken);
      }
      setTotalTiles(tiles.length);

      setScanMessage('Fetching model detections...');
      const modelLocs: Array<{ imageId: string; x: number; y: number }> = [];
      {
        let nextToken: string | null | undefined = undefined;
        do {
          const { data, nextToken: nt } =
            await client.models.Location.locationsByProjectIdAndSource(
              { projectId: project.id, source: { beginsWith: model.value } },
              {
                selectionSet: ['imageId', 'x', 'y'] as const,
                filter: {
                  confidence: { ge: threshold },
                },
                limit: 1000,
                nextToken,
              }
            );
          const page = (data || [])
            .filter((l) => typeof l.imageId === 'string')
            .map((l) => ({
              imageId: l.imageId as string,
              x: l.x as number,
              y: l.y as number,
            }));
          modelLocs.push(...page);
          nextToken = nt as string | null | undefined;
        } while (nextToken);
      }

      setScanMessage('Fetching annotations...');
      const annotations: Array<{ imageId: string; x: number; y: number }> = [];
      {
        let nextToken: string | null | undefined = undefined;
        do {
          const { data, nextToken: nt } =
            await client.models.Annotation.annotationsByAnnotationSetId(
              { setId: annotationSet.id },
              {
                selectionSet: ['imageId', 'x', 'y'] as const,
                limit: 1000,
                nextToken,
              }
            );
          const page = (data || [])
            .filter((a) => typeof a.imageId === 'string')
            .map((a) => ({
              imageId: a.imageId as string,
              x: a.x as number,
              y: a.y as number,
            }));
          annotations.push(...page);
          nextToken = nt as string | null | undefined;
        } while (nextToken);
      }

      setScanMessage('Fetching image timestamps...');
      const images: Array<{ id: string; timestamp?: Nullable<number> }> = [];
      {
        let nextToken: string | null | undefined = undefined;
        do {
          const { data, nextToken: nt } =
            await client.models.Image.imagesByProjectId(
              { projectId: project.id },
              {
                selectionSet: ['id', 'timestamp'] as const,
                limit: 1000,
                nextToken,
              }
            );
          const page = (data || []).map((im) => ({
            id: im.id as string,
            timestamp: (im as { timestamp?: number | null }).timestamp ?? null,
          }));
          images.push(...page);
          nextToken = nt as string | null | undefined;
        } while (nextToken);
      }

      const imgTs = new Map<string, number>();
      for (const im of images) {
        imgTs.set(im.id, Number(im.timestamp ?? 0));
      }

      // Group detections and annotations by imageId
      const detByImage = new Map<string, Array<{ x: number; y: number }>>();
      for (const d of modelLocs) {
        const list = detByImage.get(d.imageId) || [];
        list.push({ x: d.x, y: d.y });
        detByImage.set(d.imageId, list);
      }
      const annByImage = new Map<string, Array<{ x: number; y: number }>>();
      for (const a of annotations) {
        const list = annByImage.get(a.imageId) || [];
        list.push({ x: a.x, y: a.y });
        annByImage.set(a.imageId, list);
      }

      setScanMessage('Computing candidate tiles...');
      const candidates: MinimalTile[] = [];
      for (const t of tiles) {
        const dets = detByImage.get(t.imageId) || [];
        const anns = annByImage.get(t.imageId) || [];
        const hasModel = dets.some((p) => isInsideTile(p.x, p.y, t));
        const hasAnn = anns.some((p) => isInsideTile(p.x, p.y, t));
        if (!hasModel && !hasAnn) candidates.push(t);
      }

      // Sort by parent image timestamp
      candidates.sort((a, b) => imgTs.get(a.imageId)! - imgTs.get(b.imageId)!);
      setCandidateCount(candidates.length);

      const count = Math.floor(
        (candidates.length * Math.max(0, Math.min(samplePercent, 100))) / 100
      );
      const sampled = randomSample(candidates, count);
      selectedLocationIdsRef.current = sampled.map((t) => t.id);
      setSelectedCount(selectedLocationIdsRef.current.length);
    } finally {
      setScanMessage('');
      setScanning(false);
    }
  }, [
    model,
    threshold,
    samplePercent,
    useExistingTiled,
    selectedTiledSetId,
    handleCreateTask,
    workingTileSetId,
    client,
    project.id,
    annotationSet.id,
  ]);

  // Create queue helper similar to SpeciesLabelling
  const createQueue = useCallback(
    async (
      name: string,
      isHidden: boolean,
      tag: string
    ): Promise<{ id: string; url: string; batchSize: number } | null> => {
      const safeName = makeSafeQueueName(name + '-' + crypto.randomUUID());
      const sqsClient = await getSqsClient();
      const result = await sqsClient.send(
        new CreateQueueCommand({
          QueueName: safeName,
          Attributes: {
            MessageRetentionPeriod: '1209600',
          },
        })
      );
      const url = result.QueueUrl as string | undefined;
      if (!url) return null;
      const { data: queue } = await client.models.Queue.create({
        url,
        name,
        projectId: project.id,
        batchSize: 200,
        hidden: isHidden,
        tag,
        approximateSize: 1,
      });
      if (!queue) return null;
      return { id: queue.id, url, batchSize: 200 };
    },
    [client.models.Queue, getSqsClient, project.id]
  );

  // Expose launch handler to parent
  useEffect(() => {
    setFalseNegativesLaunchHandler(
      () => async (onProgress: (msg: string) => void) => {
        const ids = selectedLocationIdsRef.current;
        if (!ids || ids.length === 0) return;
        const name = 'False Negatives';
        onProgress('Creating queue...');
        const queue = await createQueue(name, false, queueTag);
        if (!queue) return;

        onProgress('Sending jobs...');
        const batchSize = 10;
        const sqsClient = await getSqsClient();
        const totalBatches = Math.ceil(ids.length / queue.batchSize);
        let sent = 0;
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);
          const entries = batch.map((locationId) => ({
            Id: `msg-${locationId}`,
            MessageBody: JSON.stringify({
              location: { id: locationId, annotationSetId: annotationSet.id },
              allowOutside: true,
              taskTag: queueTag,
              skipLocationWithAnnotations: false,
            }),
          }));
          await sqsClient.send(
            new SendMessageBatchCommand({
              QueueUrl: queue.url,
              Entries: entries,
            })
          );
          sent += batch.length;
          onProgress(`Queued ${sent} of ${ids.length}`);
        }

        // Update queue info and link the task to the annotation set and tile set
        await client.models.Queue.update({ id: queue.id, totalBatches });
        const setId = useExistingTiled ? selectedTiledSetId : workingTileSetId;
        if (setId) {
          await client.models.TasksOnAnnotationSet.create({
            annotationSetId: annotationSet.id,
            locationSetId: setId,
          });
        }
        onProgress('Launch complete');
      }
    );
    return () => {
      setFalseNegativesLaunchHandler(null);
    };
  }, [
    annotationSet.id,
    annotationSet.name,
    createQueue,
    client.models.Queue,
    client.models.TasksOnAnnotationSet,
    getSqsClient,
    setFalseNegativesLaunchHandler,
    useExistingTiled,
    selectedTiledSetId,
    workingTileSetId,
    queueTag,
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

        {loadingModels ? (
          <p
            className='text-muted mb-0 mt-2 text-center'
            style={{ fontSize: '12px' }}
          >
            Loading models...
          </p>
        ) : modelOptions.length > 1 ? (
          <Form.Group>
            <Form.Label className='mb-0'>Model</Form.Label>
            <Select<Option>
              value={model}
              onChange={(m: SingleValue<Option>) => setModel(m ?? null)}
              options={modelOptions}
              placeholder='Select a model'
              className='text-black'
              isDisabled={launching}
            />
          </Form.Group>
        ) : (
          modelOptions.length === 0 && (
            <p
              className='text-muted mb-0 mt-2 text-center'
              style={{ fontSize: '12px' }}
            >
              You must first process your images before launching this task.
            </p>
          )
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
                onChange={(e) => setQueueTag((e.target as HTMLInputElement).value)}
                disabled={launching}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label className='mb-0'>Confidence threshold (&gt;=)</Form.Label>
              <Form.Control
                type='number'
                min={0}
                max={1}
                step={0.01}
                value={threshold}
                onChange={(e) =>
                  setThreshold(Number((e.target as HTMLInputElement).value))
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
              <div>Total tiles: {totalTiles}</div>
              <div>Candidate tiles: {candidateCount}</div>
              <div>Selected tiles: {selectedCount}</div>
            </div>
            <button
              type='button'
              className='btn btn-primary'
              disabled={
                launching ||
                !model ||
                (useExistingTiled
                  ? !selectedTiledSetId
                  : typeof handleCreateTask !== 'function') ||
                scanning
              }
              onClick={computeFalseNegativeTiles}
            >
              {scanning ? (
                <span className='d-inline-flex align-items-center'>
                  <Spinner animation='border' size='sm' className='me-2' />{' '}
                  Scanning...
                </span>
              ) : (
                'Scan Tiles'
              )}
            </button>
          </div>
          {scanMessage && (
            <div className='mt-2 text-muted' style={{ fontSize: '12px' }}>
              {scanMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
