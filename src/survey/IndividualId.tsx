import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Form } from 'react-bootstrap';
import { uploadData } from 'aws-amplify/storage';
import { Schema } from '../amplify/client-schema';
import { GlobalContext, UserContext } from '../Context';
import { fetchAllPaginatedResults } from '../utils';
import { DataClient } from '../../amplify/shared/data-schema.generated';
import { logAdminAction } from '../utils/adminActionLogger';

// AppSync rejects very large mutation arguments; above this the payload is
// staged in S3 and only a reference is sent (mirrors FalseNegatives).
const PAYLOAD_SIZE_THRESHOLD = 200_000;

type LaunchHandler = {
  execute: (
    onProgress: (msg: string) => void,
    onLaunchConfirmed: () => void
  ) => Promise<void>;
};

type CategoryOption = { id: string; name: string };

export default function IndividualId({
  project,
  annotationSet,
  launching,
  setLaunchDisabled,
  setIndividualIdLaunchHandler,
}: {
  project: Schema['Project']['type'];
  annotationSet: Schema['AnnotationSet']['type'];
  launching: boolean;
  setLaunchDisabled: React.Dispatch<React.SetStateAction<boolean>>;
  setIndividualIdLaunchHandler: React.Dispatch<
    React.SetStateAction<LaunchHandler | null>
  >;
}) {
  const { client } = useContext(GlobalContext)!;
  const { user } = useContext(UserContext)!;

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [allAnnotations, setAllAnnotations] = useState<
    Array<{ categoryId: string; imageId: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Categories that actually have annotations, with per-category image counts.
  const availableCategories = useMemo(() => {
    const byCat = new Map<string, Set<string>>();
    for (const a of allAnnotations) {
      let set = byCat.get(a.categoryId);
      if (!set) {
        set = new Set();
        byCat.set(a.categoryId, set);
      }
      set.add(a.imageId);
    }
    return categories
      .filter((c) => byCat.has(c.id))
      .map((c) => ({ ...c, imageCount: byCat.get(c.id)!.size }));
  }, [categories, allAnnotations]);

  const selectedImageIds = useMemo(() => {
    if (!selectedCategoryId) return [];
    const ids = new Set<string>();
    for (const a of allAnnotations) {
      if (a.categoryId === selectedCategoryId) ids.add(a.imageId);
    }
    return Array.from(ids);
  }, [allAnnotations, selectedCategoryId]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      setLoadingProgress(0);
      try {
        const [cats, annotations] = await Promise.all([
          fetchAllPaginatedResults(
            client.models.Category.categoriesByAnnotationSetId,
            {
              annotationSetId: annotationSet.id,
              selectionSet: ['id', 'name'] as const,
            }
          ),
          fetchAnnotationImageIds(client, annotationSet.id, (count) => {
            if (mounted) setLoadingProgress(count);
          }),
        ]);
        if (!mounted) return;
        setCategories(cats.map((c) => ({ id: c.id, name: c.name })));
        setAllAnnotations(annotations);
      } catch (err) {
        console.error('Failed to load Individual ID data', err);
      }
      if (mounted) setLoading(false);
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [client, annotationSet.id]);

  useEffect(() => {
    setLaunchDisabled(loading || !selectedCategoryId || launching);
  }, [loading, selectedCategoryId, launching, setLaunchDisabled]);

  const selectedCategoryIdRef = useRef(selectedCategoryId);
  const selectedImageIdsRef = useRef(selectedImageIds);
  useEffect(() => {
    selectedCategoryIdRef.current = selectedCategoryId;
  }, [selectedCategoryId]);
  useEffect(() => {
    selectedImageIdsRef.current = selectedImageIds;
  }, [selectedImageIds]);

  useEffect(() => {
    setIndividualIdLaunchHandler({
      execute: async (
        onProgress: (msg: string) => void,
        onLaunchConfirmed: () => void
      ) => {
        const categoryId = selectedCategoryIdRef.current;
        if (!categoryId) {
          onProgress('No label selected.');
          return;
        }
        onLaunchConfirmed();
        onProgress('Launching Individual ID...');

        const categoryName =
          categories.find((c) => c.id === categoryId)?.name ?? undefined;
        const payload = {
          projectId: project.id,
          annotationSetId: annotationSet.id,
          categoryId,
          categoryName,
          annotatedImageIds: selectedImageIdsRef.current,
        };

        onProgress('Submitting Individual ID request...');
        await sendLaunchIndividualIdRequest(client, payload);
        onProgress('Individual ID launch submitted');

        await logAdminAction(
          client,
          user.userId,
          `Launched Individual ID for label "${categoryName ?? categoryId}" in annotation set "${annotationSet.name}"`,
          project.id,
          (project as any).organizationId
        ).catch(console.error);
      },
    });
    return () => {
      setIndividualIdLaunchHandler(null);
    };
  }, [
    annotationSet.id,
    annotationSet.name,
    categories,
    client,
    project.id,
    setIndividualIdLaunchHandler,
    user.userId,
  ]);

  const selectedCategory = availableCategories.find(
    (c) => c.id === selectedCategoryId
  );

  return (
    <div className='px-3 pb-3 pt-1'>
      <div className='d-flex flex-column gap-3 mt-2'>
        {loading ? (
          <p
            className='text-muted mb-0 text-center'
            style={{ fontSize: '12px' }}
          >
            Loading annotations
            {loadingProgress > 0
              ? ` (${loadingProgress.toLocaleString()} fetched)`
              : ''}
            ...
          </p>
        ) : availableCategories.length === 0 ? (
          <Alert variant='warning' className='mb-0'>
            No labels with annotations found for this annotation set.
          </Alert>
        ) : (
          <>
            <Form.Group>
              <Form.Label className='mb-0'>Label to identify</Form.Label>
              <span
                className='text-muted d-block mb-1'
                style={{ fontSize: '12px' }}
              >
                Select the label whose individuals should be identified across
                images.
              </span>
              <Form.Select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                disabled={launching}
              >
                <option value=''>Select a label...</option>
                {availableCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            {selectedCategoryId && selectedCategory && (
              <div
                className='border border-dark shadow-sm p-2'
                style={{ backgroundColor: '#697582' }}
              >
                <div className='text-white' style={{ fontSize: '12px' }}>
                  <div>
                    Images with <strong>{selectedCategory.name}</strong>{' '}
                    annotations: <strong>{selectedCategory.imageCount}</strong>
                  </div>
                  <div className='text-muted mt-1'>
                    Transects containing these images will be made available as
                    Individual ID jobs once tiling completes.
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

async function fetchAnnotationImageIds(
  client: DataClient,
  annotationSetId: string,
  onProgress?: (count: number) => void
): Promise<Array<{ categoryId: string; imageId: string }>> {
  const allItems: Array<{ categoryId: string; imageId: string }> = [];
  let nextToken: string | null | undefined = undefined;
  let lastReported = 0;

  do {
    const { data, nextToken: nt } =
      await client.models.Annotation.annotationsByAnnotationSetId(
        { setId: annotationSetId },
        {
          selectionSet: ['categoryId', 'imageId'] as const,
          limit: 10000,
          nextToken,
        }
      );
    for (const item of data || []) {
      allItems.push({ categoryId: item.categoryId, imageId: item.imageId });
    }
    const currentThousand = Math.floor(allItems.length / 1000);
    if (onProgress && currentThousand > lastReported) {
      lastReported = currentThousand;
      onProgress(allItems.length);
    }
    nextToken = nt as string | null | undefined;
  } while (nextToken);

  return allItems;
}

async function sendLaunchIndividualIdRequest(
  client: DataClient,
  payload: Record<string, unknown>
) {
  const payloadStr = JSON.stringify(payload);
  let requestPayload: string;

  if (payloadStr.length > PAYLOAD_SIZE_THRESHOLD) {
    const s3Key = `launch-payloads/${crypto.randomUUID()}.json`;
    await uploadData({
      path: s3Key,
      data: payloadStr,
      options: { bucket: 'outputs', contentType: 'application/json' },
    }).result;
    requestPayload = JSON.stringify({ payloadS3Key: s3Key });
  } else {
    requestPayload = payloadStr;
  }

  try {
    await (client as any).mutations.launchIndividualId(
      { request: requestPayload },
      { retry: false }
    );
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
