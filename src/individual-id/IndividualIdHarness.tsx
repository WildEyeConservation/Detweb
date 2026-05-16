import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { GlobalContext, ProjectContext } from '../Context';
import type { AnnotationType } from '../schemaTypes';
import { useTransectData, type TransectData } from './hooks/useTransectData';
import {
  makePairKey,
  usePairWorkingState,
} from './hooks/usePairWorkingState';
import { buildMatchCandidates } from './utils/munkres';
import { buildNeighbourTransforms } from './utils/transforms';
import { evaluatePairCompletion } from './utils/completion';
import { isOov } from './utils/identity';
import { buildLanes, filterLanesToAttention } from './utils/lanes';
import type {
  MatchCandidate,
  NeighbourPairWithMeta,
  PairCompletionState,
} from './types';
import { IndividualIdMapPair } from './IndividualIdMapPair';
import { ProgressBar } from './components/ProgressBar';
import { LoadingCard } from './components/LoadingCard';
import { NavigateAwayDialog } from './components/NavigateAwayDialog';
import { PairCompleteDialog } from './components/PairCompleteDialog';
import { LinkAnnotationDialog } from './components/LinkAnnotationDialog';
import ChangeCategoryModal from '../ChangeCategoryModal';
import type { CategoryType } from '../schemaTypes';

/**
 * Default Munkres "leave unmatched" cost in image pixels. Anything at a
 * projected distance below this gets paired; anything beyond is left as a
 * shadow. 40 px is intentionally tight — wide enough to absorb typical
 * homography drift, narrow enough that two animals lying a body-length
 * apart on the same image won't accidentally claim each other.
 */
const DEFAULT_LENIENCY = 40;

/**
 * Chronological order between two images, ported from the
 * `reconcileHomographies` Lambda so the UI's primary/secondary determination
 * matches the server's. The older image owns the canonical identity (its
 * annotation is the primary); newer images carry secondaries that link to
 * it.
 *
 * Rules:
 *   1. If both images have timestamps and they differ, the smaller one wins.
 *   2. If either timestamp is missing, the comparison is undecided (returns
 *      false in both directions, treating them as same-age).
 *   3. On a timestamp tie, fall back to alphabetic comparison of
 *      `originalPath` so the order is at least deterministic.
 */
/** Group annotations by imageId — used to keep `annotationsByImage` in
 * sync with `annotations` whenever we mutate the transect cache. */
function indexByImage(
  annotations: AnnotationType[]
): Record<string, AnnotationType[]> {
  const out: Record<string, AnnotationType[]> = {};
  for (const a of annotations) (out[a.imageId] ??= []).push(a);
  return out;
}

function isOlder(
  a: { timestamp?: number | null; originalPath?: string | null },
  b: { timestamp?: number | null; originalPath?: string | null }
): boolean {
  const at = a.timestamp ?? null;
  const bt = b.timestamp ?? null;
  if (at !== null && bt !== null) {
    if (at !== bt) return at < bt;
    // tie: fall through to originalPath
  } else {
    // at least one missing — treat as same-age
    return false;
  }
  if (a.originalPath && b.originalPath) {
    return a.originalPath < b.originalPath;
  }
  return false;
}

/**
 * One participant in an identity link: an existing real annotation, or a
 * shadow position that commitActorLink will materialise as a new row.
 */
type LinkActor = {
  id: string;
  imageId: string;
  existing: AnnotationType | null;
  candidatePos: { x: number; y: number } | null;
};

/**
 * Top-level "Individual ID" workflow.
 *
 * Reads `?transectId=…&categoryId=…&annotationSetId=…` from the URL.
 *
 * Responsibilities:
 *   - Load all images / neighbours / annotations for the transect (one
 *     category at a time) via useTransectData.
 *   - Pre-compute Munkres candidates for every pair, every render. Merging
 *     with usePairWorkingState preserves the user's drags/locks across
 *     navigation.
 *   - Manage `currentPairIndex`, navigation guards, the progress bar.
 *   - On accept, write the link to the database and invalidate cache.
 *   - When a pair becomes complete, decide whether an earlier pair now needs
 *     attention (because its annotations gained new partners) and prompt the
 *     user accordingly. Never auto-jumps without confirmation.
 *
 * Two components total are exported from this directory: this Harness and
 * IndividualIdMapPair. Everything else is internal to the feature.
 */
export function IndividualIdHarness() {
  const [searchParams] = useSearchParams();
  const transectId = searchParams.get('transectId') ?? undefined;
  const categoryId = searchParams.get('categoryId') ?? undefined;
  const annotationSetId =
    searchParams.get('annotationSetId') ?? undefined;
  // Leniency is state so the user can adjust it via the toolbar slider. The
  // URL only seeds the initial value; later edits don't update the URL.
  const [leniency, setLeniency] = useState<number>(() => {
    const fromUrl = searchParams.get('leniency');
    const parsed = fromUrl !== null ? Number(fromUrl) : NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_LENIENCY;
  });

  const { client } = useContext(GlobalContext)!;
  const projectCtx = useContext(ProjectContext);
  const queryClient = useQueryClient();
  const transect = useTransectData({ transectId, categoryId, annotationSetId });
  const working = usePairWorkingState();

  /**
   * Mutate the cached `TransectData` for the current transect query so the
   * change survives a reload. We deliberately do NOT invalidate (which
   * would refetch the whole transect — thousands of queries); we just edit
   * the cache in place. The persister picks the new value up on its next
   * debounced save.
   *
   * The predicate matches by query-key prefix so we don't need to know
   * the project/transect/category specifics here.
   */
  const patchTransectCache = useCallback(
    (mutate: (data: TransectData) => TransectData) => {
      queryClient.setQueriesData<TransectData>(
        {
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            q.queryKey[0] === 'individual-id-transect',
        },
        (old) => (old ? mutate(old) : old)
      );
    },
    [queryClient]
  );

  // Local annotations cache: starts as the harness load, then mutates
  // optimistically when the user accepts a match. We refetch from React Query
  // on a debounce afterwards.
  const [localAnnotations, setLocalAnnotations] = useState<AnnotationType[]>(
    []
  );
  useEffect(() => {
    if (transect.data?.annotations)
      setLocalAnnotations(transect.data.annotations);
  }, [transect.data?.annotations]);

  // Index annotations by image for fast Munkres input.
  const annotationsByImage = useMemo(() => {
    const out: Record<string, AnnotationType[]> = {};
    for (const a of localAnnotations) (out[a.imageId] ??= []).push(a);
    return out;
  }, [localAnnotations]);

  // ---- Re-derive transforms from raw neighbours ----
  // Functions cannot survive React Query's localStorage persister, so we
  // rebuild them fresh from `rawNeighbours` on every reload. `pairs` is
  // ephemeral (not cached) by virtue of being a useMemo result.
  //
  // We also normalise orientation here: imageA is always the chronologically
  // older image (and image1Id its id), imageB always the newer. The progress
  // bar then sorts cleanly by imageA.timestamp ascending, the left map
  // always shows the older photo, and downstream chronological reasoning
  // (handleAccept, etc.) only ever sees A < B. If we'd swap, the homography
  // transforms swap with us — the pre-swap "forward" mapped image1→image2,
  // which becomes "backward" in the new A/B framing.
  const pairs: NeighbourPairWithMeta[] = useMemo(() => {
    const raw = transect.data?.rawNeighbours ?? [];
    const imagesById = transect.data?.imagesById ?? {};
    const out: NeighbourPairWithMeta[] = [];
    for (const n of raw) {
      const tfs = buildNeighbourTransforms(n);
      if (tfs.noHomography) continue;
      const img1 = imagesById[n.image1Id];
      const img2 = imagesById[n.image2Id];
      if (!img1 || !img2) continue;

      const swap = isOlder(img2, img1);
      const imageA = swap ? img2 : img1;
      const imageB = swap ? img1 : img2;
      const forward = swap ? tfs.backward : tfs.forward;
      const backward = swap ? tfs.forward : tfs.backward;

      out.push({
        image1Id: imageA.id,
        image2Id: imageB.id,
        forward,
        backward,
        noHomography: false,
        skipped: false,
        imageA,
        imageB,
        rawNeighbour: n,
      });
    }
    out.sort((p, q) => {
      const at = p.imageA.timestamp ?? 0;
      const bt = q.imageA.timestamp ?? 0;
      if (at !== bt) return at - bt;
      return (p.imageB.timestamp ?? 0) - (q.imageB.timestamp ?? 0);
    });
    return out;
  }, [transect.data?.rawNeighbours, transect.data?.imagesById]);

  // ---- Build all pair-candidate lists in display order ----
  type PairView = {
    candidates: MatchCandidate[];
    completion: PairCompletionState;
    pairKeyStr: string;
  };

  const pairViews: PairView[] = useMemo(() => {
    return pairs.map((p) => {
      const pairKey = makePairKey(p.image1Id, p.image2Id);
      const fresh = buildMatchCandidates({
        annotationsA: annotationsByImage[p.image1Id] ?? [],
        annotationsB: annotationsByImage[p.image2Id] ?? [],
        imageA: p.imageA,
        imageB: p.imageB,
        forward: p.forward,
        backward: p.backward,
        leniency,
        categoryFilter: categoryId,
      });
      const merged = working.mergeCandidates(pairKey, fresh);
      return {
        candidates: merged,
        completion: evaluatePairCompletion(merged),
        pairKeyStr: pairKey,
      };
    });
    // working.version increments on every override mutation so this memo
    // recomputes when the user drags / locks / accepts.
  }, [pairs, annotationsByImage, leniency, categoryId, working, working.version]);

  // ---- Per-camera lanes for the progress bar ----
  // Pure presentation grouping over the flat `pairs` array. Same-camera
  // pairs sit in their camera's lane; cross-camera pairs appear in both
  // lanes (one logical pair shown twice). Single camera → one lane.
  const lanes = useMemo(
    () => buildLanes(pairs, transect.data?.cameraNamesById ?? {}),
    [pairs, transect.data?.cameraNamesById]
  );

  // ---- Current pair index + navigation guards ----
  const [currentIndex, setCurrentIndex] = useState(0);
  // Which lane the prev/next arrows are walking. A cross-camera pair lives
  // in two lanes; this records which one the user is navigating so "next"
  // stays on the expected camera instead of jumping rigs.
  const [activeLane, setActiveLane] = useState(0);

  // "Simple view" (default on): collapse each lane to just the pairs that
  // still need attention plus their 3 nearest neighbours, hiding the long
  // runs of done pairs. The active pair is always kept so its marker stays
  // visible. Everything downstream (render + lane-relative nav) runs off
  // `visibleLanes`, so simple view transparently restricts navigation too.
  const [simpleView, setSimpleView] = useState(true);
  // Collapses the bottom chrome: the toolbar's secondary info and the whole
  // progress bar, leaving just the clean top div.
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const visibleLanes = useMemo(() => {
    if (!simpleView) return lanes;
    const states = pairViews.map((v) => v.completion);
    return filterLanesToAttention(lanes, states, currentIndex, 3);
  }, [simpleView, lanes, pairViews, currentIndex]);
  // After the first load, skip to the first incomplete (yellow) pair.
  //
  // We deliberately wait for the annotations sync to finish before
  // locking in the initial index. There's a brief window where
  // `transect.data` has resolved (so `pairViews` has length) but
  // `localAnnotations` is still empty (the sync effect hasn't fired yet).
  // In that window every pair's completion shows as `empty`, `findIndex`
  // returns -1, and we'd fall back to pair 0 forever — even though there
  // are clearly yellow pairs once annotations propagate.
  const initialisedRef = useRef(false);
  useEffect(() => {
    if (initialisedRef.current) return;
    if (!pairViews.length) return;
    const tAnns = transect.data?.annotations;
    // Wait one render if the transect has annotations but they haven't
    // been mirrored into `localAnnotations` yet — pairViews would be
    // computed against zero annotations and lock us onto pair 0.
    if (tAnns && tAnns.length > 0 && localAnnotations.length === 0) return;
    initialisedRef.current = true;
    const firstIncomplete = pairViews.findIndex(
      (v) => v.completion.status === 'incomplete'
    );
    setCurrentIndex(Math.max(0, firstIncomplete));
  }, [pairViews, transect.data?.annotations, localAnnotations.length]);

  // Keep `activeLane` pointing at a lane that actually contains the current
  // pair. The pair-complete popups move `currentIndex` directly with no lane
  // context; snap to a lane containing it so the arrows keep working.
  useEffect(() => {
    if (!visibleLanes.length) return;
    if (visibleLanes[activeLane]?.entries.includes(currentIndex)) return;
    const li = visibleLanes.findIndex((l) =>
      l.entries.includes(currentIndex)
    );
    setActiveLane(li >= 0 ? li : 0);
  }, [currentIndex, visibleLanes, activeLane]);

  const [navAway, setNavAway] = useState<{
    show: boolean;
    target: number;
    direction: 'prev' | 'next' | 'jump';
    lane: number;
  }>({ show: false, target: 0, direction: 'jump', lane: 0 });

  const requestPair = useCallback(
    (target: number, direction: 'prev' | 'next' | 'jump', lane: number) => {
      if (target < 0 || target >= pairViews.length) return;
      if (target === currentIndex) {
        // Same pair, clicked in a different lane — just refocus that lane.
        setActiveLane(lane);
        return;
      }
      const here = pairViews[currentIndex];
      const stillHasWork =
        here && here.completion.status === 'incomplete';
      if (stillHasWork) {
        setNavAway({ show: true, target, direction, lane });
      } else {
        setCurrentIndex(target);
        setActiveLane(lane);
      }
    },
    [pairViews, currentIndex]
  );

  // Prev/next arrows walk the active lane's entries, not the global flat
  // order — so navigation stays on one camera.
  const laneNav = useCallback(
    (delta: 1 | -1) => {
      const lane = visibleLanes[activeLane];
      if (!lane) return;
      const pos = lane.entries.indexOf(currentIndex);
      if (pos === -1) return;
      const next = pos + delta;
      if (next < 0 || next >= lane.entries.length) return;
      requestPair(
        lane.entries[next],
        delta === 1 ? 'next' : 'prev',
        activeLane
      );
    },
    [visibleLanes, activeLane, currentIndex, requestPair]
  );

  const confirmNavAway = () => {
    setCurrentIndex(navAway.target);
    setActiveLane(navAway.lane);
    setNavAway({ ...navAway, show: false });
  };
  const cancelNavAway = () => setNavAway({ ...navAway, show: false });

  // ---- Pair-complete popup logic ----
  const [completePopup, setCompletePopup] = useState<{
    show: boolean;
    earlier?: number;
  }>({ show: false });

  // Find the earliest earlier pair that is still incomplete.
  const earliestEarlierIncomplete = useMemo(() => {
    for (let i = 0; i < currentIndex; i++) {
      if (pairViews[i]?.completion.status === 'incomplete') return i;
    }
    return undefined;
  }, [pairViews, currentIndex]);

  const handleAllAccepted = useCallback(() => {
    setCompletePopup({ show: true, earlier: earliestEarlierIncomplete });
  }, [earliestEarlierIncomplete]);

  const acceptCompletePopup = () => {
    if (completePopup.earlier !== undefined) {
      setCurrentIndex(completePopup.earlier);
    } else if (currentIndex < pairViews.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    setCompletePopup({ show: false });
  };

  // ---- The map-pair callbacks ----
  const currentPair = pairs[currentIndex];
  const currentView = pairViews[currentIndex];
  const currentPairKey = currentView?.pairKeyStr;

  const handleDrag = useCallback(
    (
      candidateKey: string,
      side: 'A' | 'B',
      pos: { x: number; y: number }
    ) => {
      if (!currentPairKey) return;
      working.setCandidatePosition(currentPairKey, candidateKey, side, pos);
    },
    [working, currentPairKey]
  );

  const handleLock = useCallback(
    (candidateKey: string) => {
      if (!currentPairKey) return;
      working.lockCandidate(currentPairKey, candidateKey);
    },
    [working, currentPairKey]
  );

  const handleUnlock = useCallback(
    (candidateKey: string) => {
      if (!currentPairKey) return;
      working.unlockCandidate(currentPairKey, candidateKey);
    },
    [working, currentPairKey]
  );

  /**
   * User clicked empty map area to place a brand-new annotation. We create
   * the row in the DB immediately (optimistic local update first) so Munkres
   * sees it on the next render and proposes a partner shadow on the other
   * side. The pair component pre-generates `newId` so it can also set the
   * resulting candidate as active without waiting for the round-trip.
   */
  const handlePlaceNew = useCallback(
    async (
      side: 'A' | 'B',
      pos: { x: number; y: number },
      newId: string
    ) => {
      if (!currentPair || !categoryId) return;
      const setId =
        transect.data?.category?.annotationSetId ?? annotationSetId ?? '';
      if (!setId) return;
      const group = (projectCtx?.project as any)?.organizationId ?? undefined;
      const nowIso = new Date().toISOString();
      const imageId =
        side === 'A' ? currentPair.image1Id : currentPair.image2Id;
      // Fields that go to the DB. Amplify auto-manages createdAt/updatedAt
      // and owner — they are NOT part of CreateAnnotationInput.
      const dbInput = {
        id: newId,
        imageId,
        setId,
        categoryId,
        x: Math.round(pos.x),
        y: Math.round(pos.y),
        source: 'individual-id',
        projectId: projectCtx?.project?.id,
        group,
      };
      // Local cache still wants the fuller AnnotationType shape so Munkres
      // and downstream components have everything they expect.
      const localRow = {
        ...dbInput,
        createdAt: nowIso,
        updatedAt: nowIso,
      } as unknown as AnnotationType;

      // Optimistic local merge — Munkres will pick it up next render.
      setLocalAnnotations((prev) => [...prev, localRow]);
      // Persist the new row in the cached transect data too — otherwise it
      // would be missing on reload.
      patchTransectCache((old) => {
        const annotations = [...old.annotations, localRow];
        return {
          ...old,
          annotations,
          annotationsByImage: indexByImage(annotations),
        };
      });

      try {
        await client.models.Annotation.create(dbInput as any);
      } catch (err) {
        // Roll back the optimistic insert on failure.
        // eslint-disable-next-line no-console
        console.error('Failed to create annotation', err);
        setLocalAnnotations((prev) => prev.filter((a) => a.id !== newId));
        patchTransectCache((old) => {
          const annotations = old.annotations.filter((a) => a.id !== newId);
          return {
            ...old,
            annotations,
            annotationsByImage: indexByImage(annotations),
          };
        });
      }
    },
    [
      currentPair,
      categoryId,
      transect.data?.category?.annotationSetId,
      annotationSetId,
      projectCtx?.project?.id,
      projectCtx?.project,
      client,
      patchTransectCache,
    ]
  );

  /**
   * User clicked the "Add out-of-view" control on a map. Creates an OOV
   * annotation for THAT map's image (the one the user judges is missing the
   * animal that breaks the chain). It gets the active category, a placeholder
   * x/y of 0,0 (never rendered on the map — it lives in the side panel), and
   * `oov: true`. Once created, Munkres flags every pair containing this
   * image as needing attention until the user links the OOV on each side.
   */
  const handlePlaceOov = useCallback(
    async (side: 'A' | 'B') => {
      if (!currentPair || !categoryId) return;
      const setId =
        transect.data?.category?.annotationSetId ?? annotationSetId ?? '';
      if (!setId) return;
      const group = (projectCtx?.project as any)?.organizationId ?? undefined;
      const nowIso = new Date().toISOString();
      const newId = crypto.randomUUID();
      const imageId =
        side === 'A' ? currentPair.image1Id : currentPair.image2Id;
      const dbInput = {
        id: newId,
        imageId,
        setId,
        categoryId,
        x: 0,
        y: 0,
        oov: true,
        source: 'individual-id',
        projectId: projectCtx?.project?.id,
        group,
      };
      const localRow = {
        ...dbInput,
        createdAt: nowIso,
        updatedAt: nowIso,
      } as unknown as AnnotationType;

      setLocalAnnotations((prev) => [...prev, localRow]);
      patchTransectCache((old) => {
        const annotations = [...old.annotations, localRow];
        return {
          ...old,
          annotations,
          annotationsByImage: indexByImage(annotations),
        };
      });

      try {
        await client.models.Annotation.create(dbInput as any);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to create OOV annotation', err);
        setLocalAnnotations((prev) => prev.filter((a) => a.id !== newId));
        patchTransectCache((old) => {
          const annotations = old.annotations.filter((a) => a.id !== newId);
          return {
            ...old,
            annotations,
            annotationsByImage: indexByImage(annotations),
          };
        });
      }
    },
    [
      currentPair,
      categoryId,
      transect.data?.category?.annotationSetId,
      annotationSetId,
      projectCtx?.project?.id,
      projectCtx?.project,
      client,
      patchTransectCache,
    ]
  );

  /**
   * User clicked Delete in a marker's popup. Fires `Annotation.delete` and
   * optimistically removes from `localAnnotations` so Munkres rebuilds
   * without it on the next render. We deliberately don't cascade to a
   * partner annotation — if the deleted row was a primary, the secondary's
   * objectId now points at nothing, but Munkres will treat it as unmatched
   * and propose a fresh shadow on this side. The user can re-pair if they
   * want.
   */
  const handleDelete = useCallback(
    async (annotationId: string) => {
      const before = localAnnotations;
      const target = localAnnotations.find((a) => a.id === annotationId);

      // OOV deletion: the OOV is almost always a secondary bridging the
      // chain across an image where the animal isn't visible. Deleting it
      // should un-bridge — annotations OLDER than the OOV keep their
      // existing identity, while annotations NEWER than the OOV form their
      // own chain rooted at the chronologically nearest survivor (the one
      // on the image immediately after the OOV). The older segment and the
      // newer segment end up independent, exactly as if the OOV had never
      // been inserted.
      //
      // For a non-OOV deletion the existing convention is to leave
      // secondaries orphaned and let Munkres re-propose — keep that.
      const reRootUpdates: Array<{
        id: string;
        patch: Partial<AnnotationType>;
      }> = [];
      if (target && isOov(target)) {
        const chainKey = target.objectId ?? target.id;
        const chainMembers = localAnnotations.filter(
          (a) =>
            a.id !== annotationId &&
            (a.objectId === chainKey || a.id === chainKey)
        );
        const imagesById = transect.data?.imagesById ?? {};
        const ageOf = (imageId: string) => {
          const img: any = imagesById[imageId];
          return {
            timestamp: (img?.timestamp ?? null) as number | null,
            originalPath: (img?.originalPath ?? null) as string | null,
          };
        };
        const oovAge = ageOf(target.imageId);
        const newer = chainMembers.filter((a) =>
          isOlder(oovAge, ageOf(a.imageId))
        );
        if (newer.length > 0) {
          // Chronologically nearest survivor (= oldest of the newer set)
          // becomes the new primary.
          let nearest = newer[0];
          for (let i = 1; i < newer.length; i++) {
            if (isOlder(ageOf(newer[i].imageId), ageOf(nearest.imageId))) {
              nearest = newer[i];
            }
          }
          for (const a of newer) {
            if (a.objectId !== nearest.id) {
              reRootUpdates.push({
                id: a.id,
                patch: { objectId: nearest.id },
              });
            }
          }
        }
      }

      const applyDeleteAndReRoot = (
        prev: AnnotationType[]
      ): AnnotationType[] => {
        let next = prev.filter((a) => a.id !== annotationId);
        if (reRootUpdates.length > 0) {
          const patchById = new Map(
            reRootUpdates.map((u) => [u.id, u.patch])
          );
          next = next.map((a) =>
            patchById.has(a.id) ? { ...a, ...patchById.get(a.id)! } : a
          );
        }
        return next;
      };

      // Optimistic in-memory removal + re-root.
      setLocalAnnotations(applyDeleteAndReRoot);
      // Persisted cache removal — so the deletion survives a reload.
      patchTransectCache((old) => {
        const annotations = applyDeleteAndReRoot(old.annotations);
        return {
          ...old,
          annotations,
          annotationsByImage: indexByImage(annotations),
        };
      });

      try {
        const result: any = await client.models.Annotation.delete({
          id: annotationId,
        } as any);
        // Re-root patches run in parallel with the delete — failure of any
        // single update is logged but doesn't abort the others.
        await Promise.all(
          reRootUpdates.map((u) =>
            client.models.Annotation.update({
              id: u.id,
              ...u.patch,
            } as any)
          )
        );
        // AppSync returns `data: null` (with no errors) when an owner/group
        // auth filter blocks the mutation. The user won't see the row in
        // the UI either way (the cache is updated), but on next reload the
        // server will re-emit it. Surface this in the console so we notice.
        if (result && result.data == null && !result.errors?.length) {
          // eslint-disable-next-line no-console
          console.warn(
            'Annotation.delete returned null — likely an authorization issue (you may not own this row).',
            { id: annotationId }
          );
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to delete annotation', err);
        // Roll back local state and the cache.
        setLocalAnnotations(before);
        patchTransectCache((old) => ({
          ...old,
          annotations: before,
          annotationsByImage: indexByImage(before),
        }));
      }
    },
    [client, localAnnotations, patchTransectCache, transect.data?.imagesById]
  );

  /**
   * User clicked "Mark as obscured" / "Mark as visible" in a marker's popup.
   * Toggles the annotation's `obscured` flag. Deliberately NOT propagated to
   * the rest of the chain — visibility is per-image (an animal can be clearly
   * visible in one photo and hidden behind a bush in the next), unlike a
   * label change which must stay consistent across the whole individual.
   */
  const handleToggleObscured = useCallback(
    async (annotationId: string) => {
      const current = localAnnotations.find((a) => a.id === annotationId);
      if (!current) return;
      const next = !current.obscured;

      const apply = (a: AnnotationType): AnnotationType =>
        a.id === annotationId ? { ...a, obscured: next } : a;
      const revert = (a: AnnotationType): AnnotationType =>
        a.id === annotationId ? { ...a, obscured: current.obscured } : a;

      setLocalAnnotations((prev) => prev.map(apply));
      patchTransectCache((old) => {
        const annotations = old.annotations.map(apply);
        return {
          ...old,
          annotations,
          annotationsByImage: indexByImage(annotations),
        };
      });

      try {
        await client.models.Annotation.update({
          id: annotationId,
          obscured: next,
        } as any);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to toggle annotation obscured', err);
        setLocalAnnotations((prev) => prev.map(revert));
        patchTransectCache((old) => {
          const annotations = old.annotations.map(revert);
          return {
            ...old,
            annotations,
            annotationsByImage: indexByImage(annotations),
          };
        });
      }
    },
    [localAnnotations, client, patchTransectCache]
  );

  // ---- Change-label flow ----
  // The marker popup's "Change Label" button asks the harness to open the
  // ChangeCategoryModal for a specific real annotation. The modal posts
  // back the new categoryId, we fire `Annotation.update`, and apply the
  // change optimistically + to the persisted cache. Since the harness is
  // filtered to a single category, relabelling makes the row vanish from
  // this view — that's flagged in the modal via the `warning` prop.
  const allCategories: CategoryType[] =
    (projectCtx as any)?.categoriesHook?.data ?? [];
  const setIdForModal =
    transect.data?.category?.annotationSetId ?? annotationSetId ?? '';
  const setCategories = useMemo(
    () =>
      allCategories.filter(
        (c) => (c as any).annotationSetId === setIdForModal
      ),
    [allCategories, setIdForModal]
  );
  const [labelChange, setLabelChange] = useState<{
    annotationId: string;
    currentCategoryId: string;
    /** ids of every annotation in the merged chain, including the target. */
    chainIds: string[];
  } | null>(null);

  /**
   * Build the chain of annotation ids that share an `objectId` with the
   * target. Includes the target itself, every secondary pointing at the
   * chain root, and the chain root annotation (whose id equals that
   * objectId). Annotations from other transects are NOT included — chains
   * are assumed to stay within a transect.
   */
  const buildChainIds = useCallback(
    (annotationId: string): string[] => {
      const ids = new Set<string>([annotationId]);
      const target = localAnnotations.find((a) => a.id === annotationId);
      const chainKey = target?.objectId;
      if (chainKey) {
        for (const a of localAnnotations) {
          if (a.objectId === chainKey || a.id === chainKey) {
            ids.add(a.id);
          }
        }
      }
      return Array.from(ids);
    },
    [localAnnotations]
  );

  const handleChangeLabel = useCallback(
    (annotationId: string, currentCategoryId: string) => {
      setLabelChange({
        annotationId,
        currentCategoryId,
        chainIds: buildChainIds(annotationId),
      });
    },
    [buildChainIds]
  );

  const handleApplyLabelChange = useCallback(
    async (newCategoryId: string) => {
      const target = labelChange;
      if (!target) return;
      // Apply the new category to the entire chain. Rationale: the chain
      // represents a single individual animal — if the user mis-IDed it
      // here, every linked sighting was mis-IDed too. Without propagation
      // the chain would carry inconsistent labels.
      const ids = new Set(target.chainIds);

      // Capture before-state for every chain member so we can roll back.
      const beforeMap = new Map<string, AnnotationType>();
      for (const aid of ids) {
        const a = localAnnotations.find((x) => x.id === aid);
        if (a) beforeMap.set(aid, a);
      }

      const apply = (a: AnnotationType): AnnotationType =>
        ids.has(a.id) ? { ...a, categoryId: newCategoryId } : a;

      setLocalAnnotations((prev) => prev.map(apply));
      patchTransectCache((old) => {
        const annotations = old.annotations.map(apply);
        return {
          ...old,
          annotations,
          annotationsByImage: indexByImage(annotations),
        };
      });
      setLabelChange(null);

      try {
        await Promise.all(
          Array.from(ids).map((aid) =>
            client.models.Annotation.update({
              id: aid,
              categoryId: newCategoryId,
            } as any)
          )
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to update annotation labels', err);
        // Roll back every chain member we touched.
        const rollback = (a: AnnotationType): AnnotationType =>
          beforeMap.get(a.id) ?? a;
        setLocalAnnotations((prev) => prev.map(rollback));
        patchTransectCache((old) => {
          const annotations = old.annotations.map(rollback);
          return {
            ...old,
            annotations,
            annotationsByImage: indexByImage(annotations),
          };
        });
      }
    },
    [labelChange, localAnnotations, client, patchTransectCache]
  );

  /**
   * Shared core for committing an identity link between a set of "actors"
   * (real annotations and/or Munkres-proposed shadow positions that should
   * all share one `objectId`).
   *
   * Chain-aware primary determination:
   *
   *   1. Each actor is either a real annotation (possibly already linked to a
   *      chain via its `objectId`) or a shadow we'll create as a new row.
   *   2. We gather all annotations in the merged chain — the actors plus
   *      every existing annotation already sharing an `objectId` with any
   *      actor (chain members and the chain root each actor points to).
   *   3. The chronologically oldest annotation across that whole set becomes
   *      the chain root. Its id is the shared `objectId` everyone else gets.
   *   4. Every annotation whose current `objectId` differs from the new root
   *      gets a patch — including chain-only annotations on images outside
   *      this pair (merging two chains).
   *
   * The cascade is bounded — only annotations already linked to an actor are
   * touched. Two unlinked actors is the no-cascade fast path.
   *
   * We deliberately do NOT invalidate the transect query: that would refetch
   * thousands of paginated rows and the resulting reference change would
   * clobber the optimistic `localAnnotations`. The optimistic update is the
   * session source of truth; the disk cache rehydrates it on next load.
   */
  const commitActorLink = useCallback(
    async (
      actors: LinkActor[],
      categoryId: string
    ) => {
      if (actors.length === 0) return;
      const nowIso = new Date().toISOString();
      const setId =
        transect.data?.category?.annotationSetId ?? annotationSetId ?? '';
      const group =
        (projectCtx?.project as any)?.organizationId ?? undefined;
      const imagesById = transect.data?.imagesById ?? {};
      const ageOf = (imageId: string) => {
        const img: any = imagesById[imageId];
        return {
          timestamp: (img?.timestamp ?? null) as number | null,
          originalPath: (img?.originalPath ?? null) as string | null,
        };
      };

      // Gather chain-only annotations for any actor that is already linked —
      // both annotations sharing the same `objectId` and the root pointed to.
      const actorIds = new Set(actors.map((a) => a.id));
      const chainOnly: AnnotationType[] = [];
      const seenIds = new Set<string>(actorIds);
      for (const actor of actors) {
        const objId = actor.existing?.objectId;
        if (!objId) continue;
        for (const a of localAnnotations) {
          if (seenIds.has(a.id)) continue;
          if (a.objectId === objId || a.id === objId) {
            chainOnly.push(a);
            seenIds.add(a.id);
          }
        }
      }

      // Chronologically oldest member of the merged set is the chain root.
      const all = [
        ...actors.map((a) => ({ id: a.id, age: ageOf(a.imageId) })),
        ...chainOnly.map((a) => ({ id: a.id, age: ageOf(a.imageId) })),
      ];
      let oldest = all[0];
      for (let i = 1; i < all.length; i++) {
        if (isOlder(all[i].age, oldest.age)) oldest = all[i];
      }
      const rootId = oldest.id;

      const updates: Array<{ id: string; patch: Partial<AnnotationType> }> =
        [];
      const newRows: AnnotationType[] = [];

      for (const actor of actors) {
        if (actor.existing) {
          const patch: Partial<AnnotationType> = {};
          if (actor.existing.objectId !== rootId) {
            patch.objectId = rootId;
          }
          if (
            actor.candidatePos &&
            (actor.candidatePos.x !== actor.existing.x ||
              actor.candidatePos.y !== actor.existing.y)
          ) {
            // x/y are `a.integer().required()` — round defensively.
            patch.x = Math.round(actor.candidatePos.x);
            patch.y = Math.round(actor.candidatePos.y);
          }
          if (Object.keys(patch).length > 0) {
            updates.push({ id: actor.id, patch });
          }
        } else if (actor.candidatePos) {
          newRows.push({
            id: actor.id,
            imageId: actor.imageId,
            setId,
            categoryId,
            x: Math.round(actor.candidatePos.x),
            y: Math.round(actor.candidatePos.y),
            objectId: rootId,
            source: 'individual-id',
            projectId: projectCtx?.project?.id,
            group,
            createdAt: nowIso,
            updatedAt: nowIso,
          } as unknown as AnnotationType);
        }
      }

      // Chain-only annotations: rewrite their objectId to the new root if
      // it differs. They never get position changes here.
      for (const ann of chainOnly) {
        if (ann.objectId !== rootId) {
          updates.push({ id: ann.id, patch: { objectId: rootId } });
        }
      }

      // Optimistic local merge so the next Munkres run treats this as
      // already linked, mirrored into the persisted cache.
      const applyToList = (prev: AnnotationType[]): AnnotationType[] => {
        let next = prev.slice();
        for (const u of updates) {
          next = next.map((a) => (a.id === u.id ? { ...a, ...u.patch } : a));
        }
        next = next.concat(newRows);
        return next;
      };
      setLocalAnnotations(applyToList);
      patchTransectCache((old) => {
        const annotations = applyToList(old.annotations);
        return {
          ...old,
          annotations,
          annotationsByImage: indexByImage(annotations),
        };
      });

      // Fire writes (non-blocking). Strip createdAt/updatedAt — Amplify
      // auto-manages those and CreateAnnotationInput rejects them.
      try {
        await Promise.all([
          ...updates.map((u) =>
            client.models.Annotation.update({ id: u.id, ...u.patch } as any)
          ),
          ...newRows.map((row) => {
            const { createdAt: _c, updatedAt: _u, ...dbInput } = row as any;
            return client.models.Annotation.create(dbInput as any);
          }),
        ]);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to commit individual-id link', err);
      }
    },
    [
      transect.data?.category?.annotationSetId,
      transect.data?.imagesById,
      annotationSetId,
      projectCtx?.project?.id,
      projectCtx?.project,
      localAnnotations,
      client,
      patchTransectCache,
    ]
  );

  /**
   * Space-accept. Builds actors from the candidate's two sides (real
   * annotation, or a Munkres shadow → new row) and delegates the chain-aware
   * identity assignment to commitActorLink.
   */
  const handleAccept = useCallback(
    async (candidateKey: string) => {
      if (!currentPair || !currentPairKey || !currentView) return;
      const candidate = currentView.candidates.find(
        (c) => c.pairKey === candidateKey
      );
      if (!candidate) return;

      const actors: LinkActor[] = [];
      if (candidate.realA) {
        actors.push({
          id: candidate.realA.id,
          imageId: candidate.realA.imageId,
          existing: candidate.realA,
          candidatePos: candidate.posA ?? null,
        });
      } else if (candidate.posA) {
        actors.push({
          id: crypto.randomUUID(),
          imageId: currentPair.image1Id,
          existing: null,
          candidatePos: candidate.posA,
        });
      }
      if (candidate.realB) {
        actors.push({
          id: candidate.realB.id,
          imageId: candidate.realB.imageId,
          existing: candidate.realB,
          candidatePos: candidate.posB ?? null,
        });
      } else if (candidate.posB) {
        actors.push({
          id: crypto.randomUUID(),
          imageId: currentPair.image2Id,
          existing: null,
          candidatePos: candidate.posB,
        });
      }
      if (actors.length === 0) return;

      working.acceptCandidate(currentPairKey, candidateKey);
      await commitActorLink(actors, candidate.categoryId);
    },
    [currentPair, currentPairKey, currentView, working, commitActorLink]
  );

  /**
   * Manual cross-image link (ctrl+click → confirm). The two ids are real
   * annotations on opposite images that the user asserts are the same
   * individual — Munkres couldn't pair them (e.g. the animal moved between
   * frames so the projected distance exceeded the leniency radius). Writing a
   * shared objectId makes the next Munkres rebuild hard-force the match,
   * collapsing both shadow proposals automatically.
   */
  const handleManualLink = useCallback(
    async (annotationIdA: string, annotationIdB: string) => {
      const a = localAnnotations.find((x) => x.id === annotationIdA);
      const b = localAnnotations.find((x) => x.id === annotationIdB);
      if (!a || !b) return;
      await commitActorLink(
        [
          { id: a.id, imageId: a.imageId, existing: a, candidatePos: null },
          { id: b.id, imageId: b.imageId, existing: b, candidatePos: null },
        ],
        a.categoryId
      );
    },
    [localAnnotations, commitActorLink]
  );

  // ---- Manual-link confirmation ----
  // `active` is the real annotation in the currently-active candidate (on the
  // image opposite the click); `clicked` is the real annotation the user
  // ctrl+clicked on the other image. The dialog is the deliberate gate —
  // confirming commits the link immediately.
  const [pendingLink, setPendingLink] = useState<{
    active: string;
    clicked: string;
  } | null>(null);
  const requestManualLink = useCallback(
    (activeAnnotationId: string, clickedAnnotationId: string) => {
      setPendingLink({
        active: activeAnnotationId,
        clicked: clickedAnnotationId,
      });
    },
    []
  );
  const confirmManualLink = () => {
    if (pendingLink) handleManualLink(pendingLink.active, pendingLink.clicked);
    setPendingLink(null);
  };
  const cancelManualLink = () => setPendingLink(null);

  // ---- Render states ----
  if (!transectId || !categoryId) {
    return (
      <div className='p-4 text-light'>
        Missing <code>transectId</code> or <code>categoryId</code> in the URL.
      </div>
    );
  }
  if (transect.isLoading) {
    return <LoadingCard progress={transect.progress} />;
  }
  if (transect.error) {
    return (
      <div className='p-4 text-light'>
        Failed to load transect data: {String(transect.error)}
      </div>
    );
  }
  if (!pairs.length) {
    return (
      <div className='p-4 text-light'>
        No registerable pairs in this transect for the selected label.
      </div>
    );
  }

  const completionStates = pairViews.map((v) => v.completion);

  return (
    <div
      className='w-100 h-100 d-flex flex-column py-3'
      style={{ minHeight: 0 }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        {currentPair && currentView && (
          <IndividualIdMapPair
            key={currentView.pairKeyStr}
            pair={currentPair}
            imageA={currentPair.imageA}
            imageB={currentPair.imageB}
            candidates={currentView.candidates}
            category={transect.data?.category ?? null}
            visible
            leniency={leniency}
            onLeniencyChange={setLeniency}
            onDrag={handleDrag}
            onLock={handleLock}
            onUnlock={handleUnlock}
            onAccept={handleAccept}
            onPlaceNew={handlePlaceNew}
            onDelete={handleDelete}
            onChangeLabel={handleChangeLabel}
            onToggleObscured={handleToggleObscured}
            onManualLinkRequest={requestManualLink}
            onAddOov={handlePlaceOov}
            onAllAccepted={handleAllAccepted}
            onRequestPrevPair={() => laneNav(-1)}
            onRequestNextPair={() => laneNav(1)}
            collapsed={toolbarCollapsed}
            onCollapsedChange={setToolbarCollapsed}
          />
        )}
      </div>
      {!toolbarCollapsed && (
        <ProgressBar
          states={completionStates}
          lanes={visibleLanes}
          activeIndex={currentIndex}
          activeLane={activeLane}
          onJump={(i, lane) => requestPair(i, 'jump', lane)}
          simpleView={simpleView}
          onSimpleViewChange={setSimpleView}
        />
      )}
      <NavigateAwayDialog
        show={navAway.show}
        destination={navAway.direction}
        onConfirm={confirmNavAway}
        onCancel={cancelNavAway}
      />
      <PairCompleteDialog
        show={completePopup.show}
        earlierIncompleteIndex={completePopup.earlier}
        onConfirm={acceptCompletePopup}
        onStay={() => setCompletePopup({ show: false })}
      />
      <ChangeCategoryModal
        show={labelChange !== null}
        onClose={() => setLabelChange(null)}
        categories={setCategories}
        currentCategoryId={labelChange?.currentCategoryId}
        onSelectCategory={handleApplyLabelChange}
        warning={(() => {
          const count = labelChange?.chainIds.length ?? 1;
          if (count <= 1) {
            return (
              <>
                <strong>Heads up:</strong> this workspace is filtered to a
                single label, so changing this annotation's label will remove
                it from the current view. The annotation itself is preserved
                — switch to the new label to see it again.
              </>
            );
          }
          return (
            <>
              <strong>Heads up:</strong> this annotation is linked to{' '}
              {count - 1} other{count - 1 === 1 ? '' : 's'} of the same
              individual. Changing the label will update <strong>all {count}</strong>{' '}
              of them so the chain stays consistent. They'll disappear from
              this view (filtered to a single label) but the annotations
              themselves are preserved — switch to the new label to find
              them.
            </>
          );
        })()}
      />
      <LinkAnnotationDialog
        show={pendingLink !== null}
        onConfirm={confirmManualLink}
        onCancel={cancelManualLink}
      />
    </div>
  );
}
