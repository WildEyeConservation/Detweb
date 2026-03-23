import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Form, Spinner } from 'react-bootstrap';
import Select from 'react-select';
import { uploadData } from 'aws-amplify/storage';
import { Schema } from '../amplify/client-schema';
import { GlobalContext, UserContext } from '../Context';
import { logAdminAction } from '../utils/adminActionLogger';
import { fetchAllPaginatedResults } from '../utils';
import type { DataClient } from '../../amplify/shared/data-schema.generated';
import pLimit from 'p-limit';

type LaunchHandler = {
  execute: (
    onProgress: (msg: string) => void,
    onLaunchConfirmed: () => void
  ) => Promise<void>;
};

type CategoryOption = { label: string; value: string };

type AnnotationItem = { id: string; imageId: string };

type NeighbourItem = {
  image1Id: string;
  image2Id: string;
  homography: number[] | null;
  skipped: boolean | null;
};

type HomographyImageMeta = {
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

type HomographyPairManifestItem = {
  pairKey: string;
  image1Id: string;
  image2Id: string;
  annotationSetId: string;
  primaryImage: HomographyImageMeta;
  secondaryImage: HomographyImageMeta;
};

type PairInfo = { primaryId: string; secondaryId: string };

// ── Pair calculation (pure computation, reused by preview + launch) ──

function calculatePairs(
  annotationsByCategory: Map<string, AnnotationItem[]>,
  selectedCategoryIds: string[],
  neighbourCache: Map<string, NeighbourItem[]>
): { pairs: Map<string, PairInfo>; annotatedImageIds: Set<string> } {
  // Union annotations from selected categories
  const annotatedImageIds = new Set<string>();
  for (const catId of selectedCategoryIds) {
    const annotations = annotationsByCategory.get(catId);
    if (annotations) {
      for (const a of annotations) annotatedImageIds.add(a.imageId);
    }
  }

  const pairs = new Map<string, PairInfo>();

  for (const imageId of annotatedImageIds) {
    const neighbours = neighbourCache.get(imageId);
    if (!neighbours) continue;

    for (const nb of neighbours) {
      const otherId = nb.image1Id === imageId ? nb.image2Id : nb.image1Id;
      const pairKey = [imageId, otherId].sort().join('::');
      if (pairs.has(pairKey)) continue;

      const noHomography = !nb.homography || nb.homography.length !== 9;
      if (!noHomography || nb.skipped) continue;

      if (!annotatedImageIds.has(imageId) && !annotatedImageIds.has(otherId)) continue;

      const primaryId = annotatedImageIds.has(imageId) ? imageId : otherId;
      const secondaryId = primaryId === imageId ? otherId : imageId;
      pairs.set(pairKey, { primaryId, secondaryId });
    }
  }

  return { pairs, annotatedImageIds };
}

export default function HomographyLaunch({
  project,
  annotationSet,
  launching,
  setLaunchDisabled,
  setHomographyLaunchHandler,
}: {
  project: Schema['Project']['type'];
  annotationSet: Schema['AnnotationSet']['type'];
  launching: boolean;
  setLaunchDisabled: React.Dispatch<React.SetStateAction<boolean>>;
  setHomographyLaunchHandler: React.Dispatch<
    React.SetStateAction<LaunchHandler | null>
  >;
}) {
  const { client } = useContext(GlobalContext)!;
  const { user } = useContext(UserContext)!;

  const [categories, setCategories] = useState<Schema['Category']['type'][]>([]);
  const [selectedCategories, setSelectedCategories] = useState<
    CategoryOption[]
  >([]);

  // Fetch categories for this project directly (component is not inside ProjectContext)
  useEffect(() => {
    let cancelled = false;
    async function fetchCategories() {
      const allCategories: Schema['Category']['type'][] = [];
      let nextToken: string | null | undefined = undefined;
      do {
        const result = await client.models.Category.list({
          filter: { projectId: { eq: project.id } },
          nextToken,
          limit: 1000,
        });
        allCategories.push(...(result.data ?? []));
        nextToken = result.nextToken;
      } while (nextToken);
      if (!cancelled) setCategories(allCategories);
    }
    fetchCategories();
    return () => { cancelled = true; };
  }, [client, project.id]);

  const [batchSize, setBatchSize] = useState<number>(50);
  const [hidden, setHidden] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [queueName, setQueueName] = useState<string>(`Homography - ${annotationSet.name}`);

  // ── Incremental caches (persist across selection changes) ──
  const annotationsCacheRef = useRef(new Map<string, AnnotationItem[]>());
  const neighbourCacheRef = useRef(new Map<string, NeighbourItem[]>());

  // ── Preview state ──
  const [pairCount, setPairCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<string>('');
  const previewAbortRef = useRef(0); // incremented to cancel stale previews

  // Filter categories to this annotation set
  const categoryOptions: CategoryOption[] = (categories ?? [])
    .filter((c) => c.annotationSetId === annotationSet.id)
    .map((c) => ({ label: c.name, value: c.id }));

  // ── Debounced preview calculation on selection change ──
  // Fetches always run to completion (populating caches for later runs).
  // Only the final pair calculation + UI update is skipped if a newer run has started.
  const updatePreview = useCallback(async (selected: CategoryOption[]) => {
    const selectedIds = selected.map((c) => c.value);

    if (selectedIds.length === 0) {
      setPairCount(null);
      setPreviewStatus('');
      setPreviewLoading(false);
      return;
    }

    const runId = ++previewAbortRef.current;
    const isLatest = () => previewAbortRef.current === runId;
    setPreviewLoading(true);
    if (isLatest()) setPreviewStatus('Fetching annotations...');

    try {
      const annotationsCache = annotationsCacheRef.current;
      const neighbourCache = neighbourCacheRef.current;

      // 1. Fetch annotations for any categories not yet cached
      // Always let fetches complete so the cache is populated for future runs
      const uncachedCategoryIds = selectedIds.filter((id) => !annotationsCache.has(id));
      if (uncachedCategoryIds.length > 0) {
        const limit = pLimit(5);
        await Promise.all(
          uncachedCategoryIds.map((catId) =>
            limit(async () => {
              const annotations = await fetchAnnotations(client, annotationSet.id, [catId]);
              annotationsCache.set(catId, annotations);
            })
          )
        );
      }

      // 2. Determine which images need neighbour fetching
      const allAnnotatedImageIds = new Set<string>();
      for (const catId of selectedIds) {
        const annotations = annotationsCache.get(catId);
        if (annotations) {
          for (const a of annotations) allAnnotatedImageIds.add(a.imageId);
        }
      }

      const uncachedImageIds = [...allAnnotatedImageIds].filter(
        (id) => !neighbourCache.has(id)
      );

      if (uncachedImageIds.length > 0) {
        if (isLatest()) {
          setPreviewStatus(`Fetching neighbours for ${uncachedImageIds.length} images...`);
        }
        const limit = pLimit(15);
        let completed = 0;

        await Promise.all(
          uncachedImageIds.map((imageId) =>
            limit(async () => {
              const [n1, n2] = await Promise.all([
                fetchAllPaginatedResults<NeighbourItem>(
                  (client.models.ImageNeighbour as any).imageNeighboursByImage1key,
                  { image1Id: imageId, limit: 1000, selectionSet: NEIGHBOUR_SELECTION }
                ),
                fetchAllPaginatedResults<NeighbourItem>(
                  (client.models.ImageNeighbour as any).imageNeighboursByImage2key,
                  { image2Id: imageId, limit: 1000, selectionSet: NEIGHBOUR_SELECTION }
                ),
              ]);
              neighbourCache.set(imageId, [...n1, ...n2]);
              completed++;
              if (completed % 50 === 0 || completed === uncachedImageIds.length) {
                if (isLatest()) {
                  setPreviewStatus(
                    `Fetched neighbours for ${completed}/${uncachedImageIds.length} images...`
                  );
                }
              }
            })
          )
        );
      }

      // Only update UI if this is still the latest run
      if (!isLatest()) return;

      // 3. Calculate pairs
      const { pairs } = calculatePairs(annotationsCache, selectedIds, neighbourCache);
      setPairCount(pairs.size);
      setPreviewStatus('');
    } catch (err) {
      console.error('Preview calculation failed', err);
      if (isLatest()) {
        setPreviewStatus('Failed to calculate pairs');
        setPairCount(null);
      }
    } finally {
      if (isLatest()) {
        setPreviewLoading(false);
      }
    }
  }, [client, annotationSet.id]);

  // Debounce selection changes
  useEffect(() => {
    const timer = setTimeout(() => {
      updatePreview(selectedCategories);
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedCategories, updatePreview]);

  // Enable/disable Launch button
  useEffect(() => {
    setLaunchDisabled(
      selectedCategories.length === 0 ||
      launching ||
      previewLoading ||
      pairCount === 0 ||
      pairCount === null
    );
  }, [selectedCategories, launching, previewLoading, pairCount, setLaunchDisabled]);

  // Refs for stable launch handler
  const batchSizeRef = useRef(batchSize);
  const hiddenRef = useRef(hidden);
  const queueNameRef = useRef(queueName);

  useEffect(() => { batchSizeRef.current = batchSize; }, [batchSize]);
  useEffect(() => { hiddenRef.current = hidden; }, [hidden]);
  useEffect(() => { queueNameRef.current = queueName; }, [queueName]);

  // Expose launch handler to parent
  useEffect(() => {
    setHomographyLaunchHandler({
      execute: async (
        onProgress: (msg: string) => void,
        onLaunchConfirmed: () => void
      ) => {
        const selectedIds = selectedCategories.map((c) => c.value);
        if (selectedIds.length === 0) {
          onProgress('No categories selected.');
          return;
        }

        const annotationsCache = annotationsCacheRef.current;
        const neighbourCache = neighbourCacheRef.current;

        // Recalculate pairs from cache (should already be populated by preview)
        const { pairs } = calculatePairs(
          annotationsCache, selectedIds, neighbourCache
        );

        if (pairs.size === 0) {
          alert('No image pairs requiring homography were found.');
          return;
        }

        // Collect all involved image IDs
        const allInvolvedImageIds = new Set<string>();
        for (const { primaryId, secondaryId } of pairs.values()) {
          allInvolvedImageIds.add(primaryId);
          allInvolvedImageIds.add(secondaryId);
        }

        onLaunchConfirmed();
        onProgress(`Fetching metadata for ${allInvolvedImageIds.size} images...`);

        // Fetch image metadata (not cached during preview — only needed at launch)
        const imageMetaMap = await fetchImageMetadata(
          client, [...allInvolvedImageIds], onProgress
        );

        // Build manifest items
        const manifestItems: HomographyPairManifestItem[] = [];
        for (const [pairKey, { primaryId, secondaryId }] of pairs) {
          const primary = imageMetaMap.get(primaryId);
          const secondary = imageMetaMap.get(secondaryId);
          if (!primary || !secondary) continue;
          manifestItems.push({
            pairKey,
            image1Id: primary.id,
            image2Id: secondary.id,
            annotationSetId: annotationSet.id,
            primaryImage: primary,
            secondaryImage: secondary,
          });
        }

        if (manifestItems.length === 0) {
          alert('No valid image pairs found (missing metadata).');
          return;
        }

        onProgress(`Uploading manifest for ${manifestItems.length} pairs...`);

        // Upload manifest to S3
        const manifestKey = `queue-manifests/${crypto.randomUUID()}.json`;
        await uploadData({
          path: manifestKey,
          data: JSON.stringify({ items: manifestItems }),
          options: {
            bucket: 'outputs',
            contentType: 'application/json',
          },
        }).result;

        // Call lambda with manifest reference
        onProgress('Submitting homography launch request...');
        const payload = {
          projectId: project.id,
          annotationSetId: annotationSet.id,
          batchSize: batchSizeRef.current,
          hidden: hiddenRef.current,
          manifestS3Key: manifestKey,
          launchedCount: manifestItems.length,
          queueName: queueNameRef.current,
        };
        await sendLaunchRequest(client, payload);
        onProgress('Homography launch submitted');

        await logAdminAction(
          client,
          user.userId,
          `Launched Homography task for ${selectedIds.length} categories, ${manifestItems.length} pairs in annotation set "${annotationSet.name}"`,
          project.id,
          (project as any).organizationId
        ).catch(console.error);
      },
    });
    return () => {
      setHomographyLaunchHandler(null);
    };
  }, [
    annotationSet.id,
    annotationSet.name,
    client,
    project.id,
    selectedCategories,
    setHomographyLaunchHandler,
    user.userId,
  ]);

  return (
    <div className='px-3 pb-3 pt-1'>
      <div className='d-flex flex-column gap-3 mt-2'>
        <Form.Group>
          <Form.Label className='mb-0'>Labels</Form.Label>
          <span
            className='text-muted d-block mb-1'
            style={{ fontSize: '12px' }}
          >
            Select the labels whose annotations define which image pairs need
            homographies.
          </span>
          <Select
            value={selectedCategories}
            onChange={(v) =>
              setSelectedCategories(v as CategoryOption[])
            }
            isMulti
            name='Labels for homography'
            options={categoryOptions}
            className='text-black w-100'
            closeMenuOnSelect={false}
            isDisabled={launching}
          />
        </Form.Group>

        {selectedCategories.length > 0 && (
          <>
            <div className='d-flex align-items-center gap-2'>
              {previewLoading ? (
                <>
                  <Spinner animation='border' size='sm' />
                  <span className='text-muted' style={{ fontSize: '13px' }}>
                    {previewStatus || 'Calculating pairs...'}
                  </span>
                </>
              ) : pairCount !== null ? (
                <span style={{ fontSize: '14px' }}>
                  {pairCount === 0 ? (
                    <span className='text-warning'>No pairs requiring homography found.</span>
                  ) : (
                    <>
                      <strong>{pairCount.toLocaleString()}</strong>{' '}
                      pair{pairCount !== 1 ? 's' : ''} to launch
                    </>
                  )}
                </span>
              ) : null}
            </div>

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
                    The name shown on the Jobs page.
                  </span>
                  <Form.Control
                    type='text'
                    value={queueName}
                    onChange={(e) => setQueueName(e.target.value)}
                    disabled={launching}
                  />
                </Form.Group>

                <Form.Group>
                  <Form.Label className='mb-0'>Batch Size</Form.Label>
                  <span
                    className='text-muted d-block mb-1'
                    style={{ fontSize: '12px' }}
                  >
                    The number of pairs a user can pick up at a time.
                  </span>
                  <Form.Control
                    type='number'
                    value={batchSize}
                    onChange={(e) =>
                      setBatchSize(
                        Number((e.target as HTMLInputElement).value)
                      )
                    }
                    disabled={launching}
                  />
                </Form.Group>

                <Form.Group>
                  <Form.Switch
                    label='Hide Job From Non-Admin Workers'
                    checked={hidden}
                    onChange={() => setHidden(!hidden)}
                    disabled={launching}
                  />
                  <span
                    className='text-muted d-block'
                    style={{ fontSize: '12px' }}
                  >
                    When enabled, only admin users will see this job on the Jobs
                    page.
                  </span>
                </Form.Group>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Data fetching helpers ──

const NEIGHBOUR_SELECTION = ['image1Id', 'image2Id', 'homography', 'skipped'] as const;

async function fetchAnnotations(
  client: DataClient,
  annotationSetId: string,
  categoryIds: string[]
): Promise<AnnotationItem[]> {
  return fetchAllPaginatedResults(
    (client.models.Annotation as any).annotationsByAnnotationSetId,
    {
      setId: annotationSetId,
      filter: { or: categoryIds.map((id) => ({ categoryId: { eq: id } })) },
      limit: 1000,
      selectionSet: ['id', 'imageId'] as const,
    }
  );
}

const IMAGE_SELECTION = [
  'id', 'width', 'height', 'timestamp', 'originalPath', 'projectId',
  'latitude', 'longitude', 'altitude_wgs84', 'cameraSerial', 'group',
] as const;

async function fetchImageMetadata(
  client: DataClient,
  imageIds: string[],
  onProgress: (msg: string) => void
): Promise<Map<string, HomographyImageMeta>> {
  const result = new Map<string, HomographyImageMeta>();
  const limit = pLimit(15);
  let completed = 0;

  await Promise.all(
    imageIds.map((id) =>
      limit(async () => {
        try {
          const { data } = await client.models.Image.get(
            { id },
            { selectionSet: IMAGE_SELECTION }
          );
          if (data) result.set(id, data as unknown as HomographyImageMeta);
        } catch (err) {
          console.warn('Failed to fetch image metadata', { id, error: err });
        }
        completed++;
        if (completed % 100 === 0 || completed === imageIds.length) {
          onProgress(`Fetched metadata for ${completed}/${imageIds.length} images...`);
        }
      })
    )
  );

  return result;
}

// ── Lambda communication ──

async function sendLaunchRequest(
  client: DataClient,
  payload: Record<string, unknown>
) {
  const requestPayload = JSON.stringify(payload);
  try {
    await (client as any).mutations.launchHomography({ request: requestPayload });
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
