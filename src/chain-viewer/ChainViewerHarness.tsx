import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button, Card, Form, Spinner } from 'react-bootstrap';
import Select, { type SingleValue } from 'react-select';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Link2,
  PanelBottom,
} from 'lucide-react';
import { GlobalContext, ProjectContext } from '../Context';
import { fetchAllPaginatedResults } from '../utils';
import { ChainGrid } from './ChainGrid';
import { buildChains } from './utils/chainBuilder';
import type { AnnotationImageMeta, Chain, ChainAnnotation } from './types';
import './ChainViewer.css';

interface Props {
  annotationSetId: string;
}

const DEFAULT_COLOR = '#ff8c1a';

/**
 * Main view for the chain viewer. Owns:
 *   - The bulk annotation fetch (paginated, with a streaming progress count).
 *   - In-memory chain grouping + sorting.
 *   - Filters (category, "chains only" toggle).
 *   - Current-chain selection via `?chain=<primaryId>` query param.
 *   - Lazy per-chain image/camera metadata fetch (cached for the session).
 */
export function ChainViewerHarness({ annotationSetId }: Props) {
  const { client } = useContext(GlobalContext)!;
  const {
    categoriesHook: { data: categories },
    project,
  } = useContext(ProjectContext)!;
  const [searchParams, setSearchParams] = useSearchParams();
  const { surveyId } = useParams();

  const [annotations, setAnnotations] = useState<ChainAnnotation[]>([]);
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [fetchCount, setFetchCount] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [showFilters, setShowFilters] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<{ label: string; value: string } | null>(null);
  const [chainsOnly, setChainsOnly] = useState(false);
  const [columns, setColumns] = useState<number | null>(null);

  /** Cached image metadata by annotation id. Populated lazily per chain. */
  const [metaByAnnotationId, setMetaByAnnotationId] = useState<Map<string, AnnotationImageMeta>>(
    () => new Map()
  );
  const [metaLoadingChainId, setMetaLoadingChainId] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  /** Per-camera rotation in 90° steps (mod 4). Persists across chain navigation. */
  const [cameraRotations, setCameraRotations] = useState<Map<string, number>>(
    () => new Map()
  );

  const rotateByKey = useCallback((key: string) => {
    setCameraRotations((prev) => {
      const next = new Map(prev);
      next.set(key, ((prev.get(key) ?? 0) + 1) % 4);
      return next;
    });
  }, []);

  /**
   * Toggle an annotation's `obscured` flag. Optimistic — flips local state
   * immediately so the badge reacts, persists to the DB in the background,
   * and reverts on failure. We read the current value from the live
   * `annotations` closure (not from inside `setAnnotations`) because the
   * updater isn't guaranteed to run synchronously, and reading the captured
   * `prev` after-the-fact races with subsequent clicks. Mirrors the
   * pattern in `IndividualIdHarness.handleToggleObscured`.
   *
   * AppSync may return errors in the response payload without throwing, so
   * we surface those explicitly to drive the revert path.
   */
  const toggleObscured = useCallback(
    async (annotationId: string) => {
      const current = annotations.find((a) => a.id === annotationId);
      if (!current) return;
      const desired = !current.obscured;
      const apply = (list: ChainAnnotation[]) =>
        list.map((a) =>
          a.id === annotationId ? { ...a, obscured: desired } : a
        );
      const revert = (list: ChainAnnotation[]) =>
        list.map((a) =>
          a.id === annotationId ? { ...a, obscured: current.obscured } : a
        );
      setAnnotations(apply);
      try {
        const response = await (client.models.Annotation.update as any)({
          id: annotationId,
          obscured: desired,
        });
        if (response?.errors?.length) {
          throw new Error(
            response.errors.map((e: any) => e.message).join('; ')
          );
        }
      } catch (err) {
        console.error('Failed to toggle obscured flag', err);
        setAnnotations(revert);
      }
    },
    [annotations, client]
  );

  // ---- Bulk fetch all annotations for the set on mount ----
  useEffect(() => {
    let cancelled = false;
    setFetchStatus('loading');
    setFetchCount(0);
    setFetchError(null);

    (async () => {
      try {
        const data = await fetchAllPaginatedResults(
          client.models.Annotation.annotationsByAnnotationSetId,
          {
            setId: annotationSetId,
            selectionSet: [
              'id',
              'x',
              'y',
              'imageId',
              'objectId',
              'categoryId',
              'obscured',
              'oov',
              'image.timestamp',
            ] as const,
            limit: 10000,
          },
          (steps) => {
            if (!cancelled) setFetchCount(steps);
          }
        );
        if (cancelled) return;
        setAnnotations(
          (data as any[]).map((a) => ({
            id: a.id,
            x: a.x,
            y: a.y,
            imageId: a.imageId,
            objectId: a.objectId ?? null,
            categoryId: a.categoryId,
            obscured: !!a.obscured,
            oov: !!a.oov,
            imageTimestamp:
              typeof a.image?.timestamp === 'number' ? a.image.timestamp : null,
          }))
        );
        setFetchStatus('done');
      } catch (err) {
        if (cancelled) return;
        console.error('Chain viewer fetch failed', err);
        setFetchError(err instanceof Error ? err.message : String(err));
        setFetchStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, annotationSetId]);

  // ---- Chain grouping ----
  const allChains = useMemo(() => buildChains(annotations), [annotations]);

  // ---- Filtered list ----
  const filteredChains = useMemo(() => {
    let list = allChains;
    if (selectedCategory) {
      list = list.filter((c) => c.categoryId === selectedCategory.value);
    }
    if (chainsOnly) {
      list = list.filter((c) => c.annotations.length > 1);
    }
    return list;
  }, [allChains, selectedCategory, chainsOnly]);

  // ---- Current chain resolution ----
  const chainParam = searchParams.get('chain');
  const currentIndex = useMemo(() => {
    if (!chainParam) return filteredChains.length > 0 ? 0 : -1;
    const idx = filteredChains.findIndex((c) => c.primaryId === chainParam);
    return idx >= 0 ? idx : filteredChains.length > 0 ? 0 : -1;
  }, [chainParam, filteredChains]);

  const currentChain: Chain | null = currentIndex >= 0 ? filteredChains[currentIndex] : null;

  // Keep `?chain=` in sync with the resolved current chain so direct nav,
  // filter changes, and stale anchors all settle to a consistent URL.
  useEffect(() => {
    if (fetchStatus !== 'done') return;
    if (!currentChain) {
      if (chainParam) {
        const next = new URLSearchParams(searchParams);
        next.delete('chain');
        setSearchParams(next, { replace: true });
      }
      return;
    }
    if (currentChain.primaryId !== chainParam) {
      const next = new URLSearchParams(searchParams);
      next.set('chain', currentChain.primaryId);
      setSearchParams(next, { replace: true });
    }
  }, [currentChain, chainParam, fetchStatus, searchParams, setSearchParams]);

  const goTo = useCallback(
    (delta: number) => {
      if (currentIndex < 0) return;
      const nextIdx = currentIndex + delta;
      if (nextIdx < 0 || nextIdx >= filteredChains.length) return;
      const next = new URLSearchParams(searchParams);
      next.set('chain', filteredChains[nextIdx].primaryId);
      setSearchParams(next);
    },
    [currentIndex, filteredChains, searchParams, setSearchParams]
  );

  // ---- Lazy per-chain image meta ----
  useEffect(() => {
    if (!currentChain) return;
    const needed = currentChain.annotations.filter(
      (a) => !metaByAnnotationId.has(a.id)
    );
    if (needed.length === 0) return;

    let cancelled = false;
    setMetaLoadingChainId(currentChain.primaryId);

    (async () => {
      // De-dupe image fetches: many annotations in a chain often share the
      // same image, so we only hit the API once per imageId.
      const uniqueImageIds = Array.from(new Set(needed.map((a) => a.imageId)));
      const imageById = new Map<string, any>();
      const sourceKeyById = new Map<string, string | null>();

      await Promise.all(
        uniqueImageIds.map(async (imageId) => {
          try {
            const [imgResp, fileResp] = await Promise.all([
              (client.models.Image.get as any)(
                { id: imageId },
                {
                  selectionSet: [
                    'id',
                    'width',
                    'height',
                    'originalPath',
                    'cameraId',
                    'cameraSerial',
                    'camera.name',
                  ] as const,
                }
              ),
              (client.models.ImageFile as any).imagesByimageId({ imageId }),
            ]);
            imageById.set(imageId, imgResp?.data ?? null);
            const jpg = (fileResp?.data ?? []).find(
              (f: any) => f.type === 'image/jpeg'
            );
            sourceKeyById.set(imageId, jpg?.key ?? null);
          } catch (err) {
            console.error('Failed to fetch image meta', imageId, err);
            imageById.set(imageId, null);
            sourceKeyById.set(imageId, null);
          }
        })
      );

      if (cancelled) return;

      setMetaByAnnotationId((prev) => {
        const next = new Map(prev);
        for (const a of needed) {
          const img = imageById.get(a.imageId);
          if (!img) continue;
          next.set(a.id, {
            imageId: a.imageId,
            width: img.width,
            height: img.height,
            originalPath: img.originalPath ?? null,
            cameraId: img.cameraId ?? null,
            cameraName: img.camera?.name ?? null,
            cameraSerial: img.cameraSerial ?? null,
            sourceKey: sourceKeyById.get(a.imageId) ?? null,
          });
        }
        return next;
      });
      setMetaLoadingChainId((id) => (id === currentChain.primaryId ? null : id));
    })();

    return () => {
      cancelled = true;
    };
  }, [currentChain, client, metaByAnnotationId]);

  // ---- Filter options ----
  const categoryOptions = useMemo(() => {
    return (categories ?? [])
      .filter((c) => c.annotationSetId === annotationSetId)
      .map((c) => ({ label: c.name, value: c.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categories, annotationSetId]);

  const categoryColor = useMemo(() => {
    if (!currentChain) return DEFAULT_COLOR;
    const cat = (categories ?? []).find((c) => c.id === currentChain.categoryId);
    return cat?.color || DEFAULT_COLOR;
  }, [currentChain, categories]);

  const filtersBlocked = fetchStatus !== 'done';

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1555px',
        marginTop: '16px',
        marginBottom: '16px',
      }}
    >
      <div className='w-100 h-100 d-flex flex-column flex-sm-row gap-2'>
        <div
          className='d-flex flex-column gap-2 w-100'
          style={{ maxWidth: '300px' }}
        >
          <Card className='d-sm-block d-none w-100'>
            <Card.Header>
              <Card.Title className='mb-0'>Information</Card.Title>
            </Card.Header>
            <Card.Body className='d-flex flex-column gap-2'>
              <p className='mb-0'>
                <strong>Survey:</strong> {project.name}
              </p>
            </Card.Body>
          </Card>
          <Card className='w-100 flex-grow-1'>
            <Card.Header>
              <Card.Title className='mb-0 d-flex align-items-center'>
                <Button
                  className='p-0 mb-0'
                  variant='outline'
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <PanelBottom
                    className='d-sm-none'
                    style={{
                      transform: showFilters ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                </Button>
                Filters
              </Card.Title>
            </Card.Header>
            {showFilters && (
              <Card.Body className='d-flex flex-column gap-2'>
                <div className='w-100'>
                  <Form.Label>Label</Form.Label>
                  <Select
                    value={selectedCategory}
                    onChange={(
                      newValue: SingleValue<{ label: string; value: string }>
                    ) => setSelectedCategory(newValue)}
                    isClearable
                    name='Label'
                    options={categoryOptions}
                    className='text-black w-100'
                    placeholder='All labels'
                    isDisabled={filtersBlocked}
                  />
                </div>
                <Form.Switch
                  label='Chains only (>1 sighting)'
                  className='mt-2'
                  checked={chainsOnly}
                  onChange={(e) => setChainsOnly(e.target.checked)}
                  disabled={filtersBlocked}
                />
                <div className='w-100 mt-2'>
                  <Form.Label>Columns</Form.Label>
                  <Form.Select
                    value={columns === null ? 'auto' : String(columns)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setColumns(v === 'auto' ? null : parseInt(v, 10));
                    }}
                  >
                    <option value='auto'>Auto-fit</option>
                    <option value='2'>2</option>
                    <option value='3'>3</option>
                    <option value='4'>4</option>
                    <option value='5'>5</option>
                    <option value='6'>6</option>
                    <option value='8'>8</option>
                  </Form.Select>
                </div>
              </Card.Body>
            )}
          </Card>
        </div>
        <Card className='h-100 w-100'>
          <Card.Body className='d-flex flex-column gap-3' style={{ minHeight: 0 }}>
            {fetchStatus !== 'done' ? (
              <div className='d-flex align-items-center justify-content-center text-muted' style={{ minHeight: 400 }}>
                {fetchStatus === 'error' ? (
                  <span>
                    Failed to load annotations
                    {fetchError ? `: ${fetchError}` : '.'}
                  </span>
                ) : (
                  <span>
                    <Spinner animation='border' size='sm' className='me-2' />
                    Loading annotations… ({fetchCount} fetched)
                  </span>
                )}
              </div>
            ) : currentChain ? (
              <>
                <div className='d-flex align-items-center justify-content-between gap-2'>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>
                      Chain {currentIndex + 1} of {filteredChains.length}
                    </div>
                    <div className='text-muted' style={{ fontSize: 13 }}>
                      <code style={{ fontSize: 12 }}>{currentChain.primaryId}</code>
                      {' · '}
                      {currentChain.annotations.length} sighting
                      {currentChain.annotations.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className='d-flex align-items-center gap-2'>
                    <Button
                      variant='outline-light'
                      size='sm'
                      title='Re-link this chain in the ChainLinker workflow'
                      onClick={() =>
                        window.open(
                          `/surveys/${surveyId}/set/${annotationSetId}/chain-review/${currentChain.primaryId}`,
                          '_blank',
                          'noopener,noreferrer'
                        )
                      }
                      className='d-flex align-items-center gap-1'
                    >
                      <Link2 size={14} />
                      Review in ChainLinker
                    </Button>
                    <Button
                      variant={shareCopied ? 'success' : 'outline-light'}
                      size='sm'
                      title={shareCopied ? 'Copied!' : 'Copy link to this chain'}
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        setShareCopied(true);
                        window.setTimeout(() => setShareCopied(false), 1500);
                      }}
                      className='d-flex align-items-center gap-1'
                    >
                      {shareCopied ? <Check size={14} /> : <Copy size={14} />}
                      {shareCopied ? 'Copied' : 'Share'}
                    </Button>
                  </div>
                </div>
                <div
                  className='chain-viewer-grid-scroll'
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    paddingRight: 4,
                    minHeight: 0,
                  }}
                >
                  <ChainGrid
                    chain={currentChain}
                    metaByAnnotationId={metaByAnnotationId}
                    metaLoading={metaLoadingChainId === currentChain.primaryId}
                    categoryColor={categoryColor}
                    columns={columns}
                    cameraRotations={cameraRotations}
                    onRotateKey={rotateByKey}
                    onToggleObscured={toggleObscured}
                    openImageHrefFor={(a) =>
                      `/surveys/${surveyId}/image/${a.imageId}/${annotationSetId}`
                    }
                  />
                </div>
                <div className='d-flex justify-content-center align-items-center gap-2'>
                  <Button
                    variant='primary'
                    onClick={() => goTo(-1)}
                    disabled={currentIndex <= 0}
                  >
                    <ChevronLeft size={16} /> Previous
                  </Button>
                  <Button
                    variant='primary'
                    onClick={() => goTo(1)}
                    disabled={currentIndex >= filteredChains.length - 1}
                  >
                    Next <ChevronRight size={16} />
                  </Button>
                </div>
              </>
            ) : (
              <div className='d-flex align-items-center justify-content-center text-muted' style={{ minHeight: 400 }}>
                <span>No chains match the current filter.</span>
              </div>
            )}
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
