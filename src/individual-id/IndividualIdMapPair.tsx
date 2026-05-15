import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { GlobalContext } from '../Context';
import type { CategoryType, ImageType } from '../schemaTypes';
import maplibregl from 'maplibre-gl';
import {
  IndividualIdMap,
  type MapMarker,
  type MarkerKind,
  type MapInstanceCallback,
} from './IndividualIdMap';
import type { AnnotationType } from '../schemaTypes';
import type { MatchCandidate, NeighbourPair, PixelTransform } from './types';
import { Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { OovPanel } from './components/OovPanel';

interface Props {
  pair: NeighbourPair;
  imageA: ImageType;
  imageB: ImageType;
  /** Candidates after merge with working state. */
  candidates: MatchCandidate[];
  /** Used for marker color. */
  category: CategoryType | null;
  /** Visibility / hotkey gate. Hotkeys disabled when false. */
  visible: boolean;

  // ---- callbacks the harness wires up ----
  /** User dragged a marker. */
  onDrag: (
    candidateKey: string,
    side: 'A' | 'B',
    pos: { x: number; y: number }
  ) => void;
  /**
   * First space press on the active candidate. The harness should mark it
   * `locked` in the working state. NO DB write.
   */
  onLock: (candidateKey: string) => void;
  /**
   * Second space press: harness should commit the link to the database
   * (assign a shared objectId to both annotations, creating the shadow
   * annotation if needed) AND mark the candidate `accepted` locally.
   */
  onAccept: (candidateKey: string) => void;
  /** User pressed Escape — clear "active" selection in this pair. */
  onUnfocus?: () => void;
  /**
   * User clicked on empty map area to place a brand-new annotation. The
   * harness fires an immediate `Annotation.create` for the clicked side; the
   * other side is left to Munkres (it will propose a shadow). The harness is
   * given the pre-generated annotation `id` so this component can set it as
   * the active candidate immediately (Munkres will key the resulting
   * candidate by the same id, so activation survives the rebuild).
   */
  onPlaceNew?: (
    side: 'A' | 'B',
    pos: { x: number; y: number },
    newAnnotationId: string
  ) => void;
  /**
   * User clicked Delete on a marker's popup. Receives the real annotation's
   * id (never a shadow). The harness fires `Annotation.delete`.
   */
  onDelete?: (annotationId: string) => void;
  /**
   * User clicked Change Label on a marker's popup. Receives the real
   * annotation's id and its current category id (never a shadow). The
   * harness opens the ChangeCategoryModal and fires the eventual update.
   */
  onChangeLabel?: (annotationId: string, currentCategoryId: string) => void;
  /**
   * User clicked "Mark as obscured" / "Mark as visible" on a marker's popup.
   * Receives the real annotation's id (never a shadow). The harness toggles
   * the annotation's `obscured` flag.
   */
  onToggleObscured?: (annotationId: string) => void;
  /**
   * User ctrl+clicked a real marker on the other image while a candidate is
   * active. Args: the active candidate's real annotation id (on the image
   * opposite the click) and the ctrl-clicked real annotation id. The harness
   * shows a confirm dialog, then commits the link.
   */
  onManualLinkRequest?: (
    activeAnnotationId: string,
    clickedAnnotationId: string
  ) => void;
  /**
   * The harness asks: are we done with this pair? Returns true iff every
   * candidate is `accepted`.
   */
  onAllAccepted?: () => void;
  /**
   * User clicked the "Add out-of-view" map control on side A or B. The harness
   * creates an OOV annotation bound to that image; it surfaces as a card in
   * the side panel.
   */
  onAddOov?: (side: 'A' | 'B') => void;
  /** User clicked Prev / Next pair — harness handles confirmation. */
  onRequestPrevPair: () => void;
  onRequestNextPair: () => void;
  /**
   * Munkres "leave unmatched" cost in image pixels. The toolbar surfaces a
   * slider; the maps render a translucent ring around the active marker so
   * the user can see exactly the radius within which a partner would be
   * accepted.
   */
  leniency: number;
  onLeniencyChange: (next: number) => void;
}

const DEFAULT_COLOR = '#3498db';

/**
 * The two-map workspace.
 *
 * Concerns:
 *   - Render two MapLibre maps with marker overlays.
 *   - Manage which candidate is "active" (highlighted on both maps).
 *   - Implement the keyboard flow:
 *       Arrow Left/Right  → focus prev/next candidate (within this pair only).
 *       Space             → lock first, then accept (then advance focus).
 *       Escape            → unfocus.
 *       Ctrl + Arrow      → request prev/next PAIR (parent shows confirm).
 *   - Forward drags to `onDrag`. Never write to the database.
 *
 * Explicitly NOT this component's concern:
 *   - Knowing about other pairs.
 *   - Auto-jumping anywhere when the active candidate becomes accepted.
 *   - Persisting positions across mounts (harness owns that via working state).
 */
export function IndividualIdMapPair(props: Props) {
  const {
    pair,
    imageA,
    imageB,
    candidates,
    category,
    visible,
    onDrag,
    onLock,
    onAccept,
    onUnfocus,
    onPlaceNew,
    onDelete,
    onChangeLabel,
    onToggleObscured,
    onManualLinkRequest,
    onAllAccepted,
    onRequestPrevPair,
    onRequestNextPair,
    onAddOov,
    leniency,
    onLeniencyChange,
  } = props;
  const { client } = useContext(GlobalContext)!;

  // ---- Active candidate management ----
  // Default to the first non-accepted candidate when the pair changes. We do
  // NOT auto-advance when a candidate becomes `accepted` — that's the user's
  // job (second space press).
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const lastPairKeyRef = useRef<string>('');
  const pairKey = `${pair.image1Id}__${pair.image2Id}`;
  useEffect(() => {
    if (lastPairKeyRef.current === pairKey) return;
    lastPairKeyRef.current = pairKey;
    const firstPending = candidates.find(
      (c) => c.status !== 'accepted' && !c.informational
    );
    setActiveKey(firstPending?.pairKey ?? null);
    // We intentionally only re-default when the pair changes, not when the
    // candidates list mutates. Otherwise dragging could shift focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairKey]);

  // If the active candidate disappears (e.g. rejected / removed), clear focus.
  useEffect(() => {
    if (activeKey && !candidates.some((c) => c.pairKey === activeKey)) {
      setActiveKey(null);
    }
  }, [activeKey, candidates]);

  // ---- Fire onAllAccepted after the pair transitions to fully accepted ----
  // We watch `candidates` rather than firing synchronously inside Space's
  // accept branch. By the time this effect runs, the harness has re-rendered
  // with the post-accept state — so its `earliestEarlierIncomplete` value
  // already reflects any new shadows the just-accepted match created on
  // earlier pairs. Without this, accepting the *only* candidate on a pair
  // would race the harness's recompute and the "earlier pair needs
  // attention" branch would read stale (undefined) state.
  //
  // The `sawIncompleteRef` gate prevents the popup from firing when the
  // user simply navigates to a pair that's already fully linked — we only
  // want it on the user's own transition from incomplete → complete.
  const sawIncompleteRef = useRef(false);
  useEffect(() => {
    sawIncompleteRef.current = false;
  }, [pairKey]);
  useEffect(() => {
    const linkable = candidates.filter((c) => !c.informational);
    if (linkable.length === 0) return; // nothing to track on an empty pair
    const allAccepted = linkable.every((c) => c.status === 'accepted');
    if (!allAccepted) {
      sawIncompleteRef.current = true;
      return;
    }
    if (sawIncompleteRef.current) {
      sawIncompleteRef.current = false;
      onAllAccepted?.();
    }
  }, [candidates, onAllAccepted]);

  const activeCandidate = useMemo(
    () => candidates.find((c) => c.pairKey === activeKey) ?? null,
    [candidates, activeKey]
  );

  // ---- Source keys for tile pyramid ----
  const [sourceKeys, setSourceKeys] = useState<
    [string | undefined, string | undefined]
  >([undefined, undefined]);
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      [imageA, imageB].map(async (img) => {
        const resp = await (client.models.ImageFile as any).imagesByimageId({
          imageId: img.id,
        });
        const jpg = (resp.data ?? []).find(
          (f: any) => f.type === 'image/jpeg'
        );
        return jpg?.key as string | undefined;
      })
    ).then((keys) => {
      if (!cancelled) setSourceKeys(keys as [string | undefined, string | undefined]);
    });
    return () => {
      cancelled = true;
    };
  }, [imageA.id, imageB.id, client]);

  // ---- Marker projection ----
  const color = category?.color || DEFAULT_COLOR;

  /**
   * Visual classification rules:
   *   - shadow if there's no DB row on this side (isShadow{A,B}).
   *   - secondary if the real annotation has an `objectId` that is NOT its
   *     own id — i.e., it's been linked into another row's identity.
   *   - primary otherwise (real with id===objectId, OR real with no objectId
   *     yet — pending pairs share an identicon between sides until accept).
   */
  function classify(real: AnnotationType | undefined, isShadow: boolean): MarkerKind {
    if (isShadow || !real) return 'shadow';
    if (real.objectId && real.objectId !== real.id) return 'secondary';
    return 'primary';
  }

  const markersA: MapMarker[] = useMemo(() => {
    const out: MapMarker[] = [];
    for (const c of candidates) {
      if (!c.posA) continue;
      out.push({
        candidateKey: c.pairKey,
        side: 'A',
        x: c.posA.x,
        y: c.posA.y,
        color,
        status: c.status,
        kind: classify(c.realA, c.isShadowA),
        identityKey: c.pairKey,
        active: c.pairKey === activeKey,
        obscured: !!c.realA?.obscured,
      });
    }
    return out;
  }, [candidates, activeKey, color]);

  const markersB: MapMarker[] = useMemo(() => {
    const out: MapMarker[] = [];
    for (const c of candidates) {
      if (!c.posB) continue;
      out.push({
        candidateKey: c.pairKey,
        side: 'B',
        x: c.posB.x,
        y: c.posB.y,
        color,
        status: c.status,
        kind: classify(c.realB, c.isShadowB),
        identityKey: c.pairKey,
        active: c.pairKey === activeKey,
        obscured: !!c.realB?.obscured,
      });
    }
    return out;
  }, [candidates, activeKey, color]);

  // ---- Drag handlers ----
  const handleDragA = useCallback(
    (candidateKey: string, x: number, y: number) => {
      onDrag(candidateKey, 'A', { x, y });
    },
    [onDrag]
  );
  const handleDragB = useCallback(
    (candidateKey: string, x: number, y: number) => {
      onDrag(candidateKey, 'B', { x, y });
    },
    [onDrag]
  );

  // ---- Map sync (pan + zoom via the homography) ----
  // Each side reports its map instance + coord converters via onMapInstance.
  // We keep them in refs and wire `move`/`zoom` listeners to project the
  // source's centre through the appropriate transform and slave the other
  // map. An `isSyncingRef` guard prevents a feedback loop.
  type MapHandle = {
    map: maplibregl.Map;
    px2lngLat: (x: number, y: number) => [number, number];
    lngLat2px: (lng: number, lat: number) => { x: number; y: number };
  };
  const mapsRef = useRef<[MapHandle | null, MapHandle | null]>([null, null]);
  const [mapsTick, setMapsTick] = useState(0);
  const isSyncingRef = useRef(false);

  const onMapInstance0: MapInstanceCallback = useCallback(
    (map, px2lngLat, lngLat2px) => {
      const wasNull = mapsRef.current[0] === null;
      mapsRef.current[0] = map ? { map, px2lngLat, lngLat2px } : null;
      if (wasNull !== (map === null)) setMapsTick((t) => t + 1);
    },
    []
  );
  const onMapInstance1: MapInstanceCallback = useCallback(
    (map, px2lngLat, lngLat2px) => {
      const wasNull = mapsRef.current[1] === null;
      mapsRef.current[1] = map ? { map, px2lngLat, lngLat2px } : null;
      if (wasNull !== (map === null)) setMapsTick((t) => t + 1);
    },
    []
  );

  useEffect(() => {
    const a = mapsRef.current[0];
    const b = mapsRef.current[1];
    if (!a || !b) return;

    // src=0 means A drives B (forward); src=1 means B drives A (backward).
    const transforms: [PixelTransform, PixelTransform] = [pair.forward, pair.backward];

    const sync = (srcIdx: 0 | 1) => {
      if (isSyncingRef.current) return;
      const src = mapsRef.current[srcIdx];
      const tgt = mapsRef.current[1 - srcIdx];
      if (!src || !tgt) return;
      const tf = transforms[srcIdx];

      // Project the centre.
      const c = src.map.getCenter();
      const srcPx = src.lngLat2px(c.lng, c.lat);
      const tgtPx = tf([srcPx.x, srcPx.y]);
      const targetLngLat = tgt.px2lngLat(tgtPx[0], tgtPx[1]);

      // Match zoom via the local-derivative scale of the homography (a few
      // pixels around the centre) so a tighter view in A produces a tighter
      // view in B even when the transform isn't uniform.
      const probe = tf([srcPx.x + 100, srcPx.y]);
      const dx = probe[0] - tgtPx[0];
      const dy = probe[1] - tgtPx[1];
      const scaleRatio = Math.sqrt(dx * dx + dy * dy) / 100;
      const targetZoom = src.map.getZoom() - Math.log2(scaleRatio || 1);

      isSyncingRef.current = true;
      try {
        tgt.map.jumpTo({
          center: targetLngLat,
          zoom: targetZoom,
        });
      } finally {
        // Release on next frame so target's `move`/`zoom` events don't
        // re-enter the sync.
        requestAnimationFrame(() => {
          isSyncingRef.current = false;
        });
      }
    };

    const aMove = () => sync(0);
    const bMove = () => sync(1);
    a.map.on('move', aMove);
    b.map.on('move', bMove);
    return () => {
      a.map.off('move', aMove);
      b.map.off('move', bMove);
    };
  }, [mapsTick, pair.forward, pair.backward]);

  // ---- Auto-focus on the active candidate when it advances ----
  // After Space-accept (or arrow-key navigation), pan both maps so the new
  // active marker is centred. We deliberately skip the FIRST activation on
  // each pair — the initial auto-fitBounds should win when a pair first
  // loads. Triggers only on transitions: prev → next, both non-null.
  const prevActiveKeyRef = useRef<string | null>(null);
  useEffect(() => {
    // Reset when the pair changes — the first activation on the new pair
    // shouldn't pan.
    prevActiveKeyRef.current = null;
  }, [pairKey]);
  useEffect(() => {
    const prev = prevActiveKeyRef.current;
    prevActiveKeyRef.current = activeKey;
    if (!activeKey) return; // deselect → no pan
    if (!prev) return; // initial activation on this pair → no pan
    if (prev === activeKey) return;

    const cand = candidates.find((c) => c.pairKey === activeKey);
    if (!cand) return;
    if (cand.informational) return;

    const a = mapsRef.current[0];
    const b = mapsRef.current[1];
    // Suppress map sync during the focused pan so map B doesn't
    // mid-animation jumpTo a homography-projected centre based on map A.
    isSyncingRef.current = true;
    try {
      if (a && cand.posA) {
        a.map.easeTo({
          center: a.px2lngLat(cand.posA.x, cand.posA.y),
          duration: 250,
        });
      }
      if (b && cand.posB) {
        b.map.easeTo({
          center: b.px2lngLat(cand.posB.x, cand.posB.y),
          duration: 250,
        });
      }
    } catch {
      /* maps removed mid-pan; ignore */
    }
    const t = window.setTimeout(() => {
      isSyncingRef.current = false;
    }, 320);
    return () => window.clearTimeout(t);
    // candidates is intentionally omitted — we only want to pan on real
    // active-key transitions, not on every Munkres rebuild that yields a
    // new candidate object reference for the same pairKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  // ---- Hotkeys ----
  // Informational candidates (annotations outside the partner image's
  // overlap region) are skipped by every navigation gesture and by Space.
  // The user can still hover them for the popup to delete or relabel.
  const advanceFocus = useCallback(
    (direction: 1 | -1) => {
      const focusable = candidates.filter((c) => !c.informational);
      if (focusable.length === 0) return;
      const currentIdx = activeKey
        ? focusable.findIndex((c) => c.pairKey === activeKey)
        : -1;
      // After a final accept, currentIdx may be -1; start from the end if
      // moving back, or the start if moving forward.
      let nextIdx: number;
      if (currentIdx === -1) {
        nextIdx = direction === 1 ? 0 : focusable.length - 1;
      } else {
        nextIdx =
          (currentIdx + direction + focusable.length) % focusable.length;
      }
      setActiveKey(focusable[nextIdx]?.pairKey ?? null);
    },
    [activeKey, candidates]
  );

  const handleSpace = useCallback(() => {
    if (!activeCandidate) {
      // Nothing focused → focus the first non-accepted, non-informational.
      const next = candidates.find(
        (c) => c.status !== 'accepted' && !c.informational
      );
      if (next) setActiveKey(next.pairKey);
      return;
    }
    // If the active candidate is informational (e.g. focused via arrow keys
    // before the filter was added, or via some other path), Space jumps
    // focus to the next linkable candidate instead of being a no-op —
    // otherwise the flow gets stuck.
    if (activeCandidate.informational) {
      advanceFocus(1);
      return;
    }
    // OOV candidates can't be locked/accepted via Space — they have no
    // positional partner Munkres can confirm. The user must Ctrl/right-click
    // a real annotation on the other image (or another OOV card) to link
    // them. Pressing Space just skips ahead.
    if (activeCandidate.oovSide) {
      advanceFocus(1);
      return;
    }
    if (activeCandidate.status === 'pending') {
      onLock(activeCandidate.pairKey);
      return;
    }
    if (activeCandidate.status === 'locked') {
      onAccept(activeCandidate.pairKey);
      // Advance focus to the next non-accepted, non-informational candidate
      // — staying on this pair. Only the harness decides when to leave it.
      // We deliberately do NOT fire onAllAccepted from here — that's done
      // by an effect below that watches `candidates` so the harness has
      // had a chance to re-render with the post-accept state (otherwise
      // the "earlier pair needs attention?" check reads stale data).
      const linkable = candidates.filter((c) => !c.informational);
      const remaining = linkable.filter(
        (c) => c.status !== 'accepted' && c.pairKey !== activeCandidate.pairKey
      );
      if (remaining.length === 0) {
        setActiveKey(null);
      } else {
        // Prefer the next one in list order after the current, looping
        // back to the start if we've reached the end. Search the linkable
        // list (informational candidates are skipped entirely).
        const idx = linkable.findIndex(
          (c) => c.pairKey === activeCandidate.pairKey
        );
        const after = linkable
          .slice(idx + 1)
          .find((c) => c.status !== 'accepted');
        const before = linkable
          .slice(0, idx)
          .find((c) => c.status !== 'accepted');
        setActiveKey((after ?? before)?.pairKey ?? null);
      }
      return;
    }
    if (activeCandidate.status === 'accepted') {
      // No-op: spacebar on an already accepted candidate just advances focus.
      advanceFocus(1);
    }
  }, [
    activeCandidate,
    candidates,
    onLock,
    onAccept,
    onAllAccepted,
    advanceFocus,
  ]);

  const handleEscape = useCallback(() => {
    if (activeKey) {
      setActiveKey(null);
      onUnfocus?.();
    }
  }, [activeKey, onUnfocus]);

  useHotkeys('Space', handleSpace, { enabled: visible, preventDefault: true }, [
    handleSpace,
  ]);
  useHotkeys('Escape', handleEscape, { enabled: visible }, [handleEscape]);
  useHotkeys('ArrowRight', () => advanceFocus(1), { enabled: visible }, [
    advanceFocus,
  ]);
  useHotkeys('ArrowLeft', () => advanceFocus(-1), { enabled: visible }, [
    advanceFocus,
  ]);
  useHotkeys('Ctrl+ArrowRight', onRequestNextPair, { enabled: visible }, [
    onRequestNextPair,
  ]);
  useHotkeys('Ctrl+ArrowLeft', onRequestPrevPair, { enabled: visible }, [
    onRequestPrevPair,
  ]);

  // ---- Click handlers ----
  const handleMarkerClick = useCallback(
    (candidateKey: string) => {
      // Don't activate informational markers — they have no partner to
      // lock/accept, so the orange ring would be misleading. The hover
      // popup still lets the user delete or change the label.
      const c = candidates.find((cc) => cc.pairKey === candidateKey);
      if (c?.informational) return;
      setActiveKey(candidateKey);
    },
    [candidates]
  );

  /**
   * Click on empty map area:
   *
   *   - If a candidate is currently active, treat the click as a deselect.
   *     Otherwise the user can't dismiss a selection without reaching for
   *     Escape, and an accidental click while a shadow is selected would
   *     fire a create at the click position (Munkres then re-pairs and the
   *     old shadow appears to "become real and move").
   *   - Only when nothing is active do we create a fresh annotation at the
   *     click position. We pre-generate the id so we can immediately set
   *     the resulting candidate as active — Munkres will key its rebuilt
   *     candidate by the same id (no objectId yet → `makePairKey` falls
   *     through to `id`).
   */
  const placeFromClick = useCallback(
    (clickedSide: 'A' | 'B', pos: { x: number; y: number }) => {
      if (activeKey) {
        setActiveKey(null);
        onUnfocus?.();
        return;
      }
      if (!category || !onPlaceNew) return;
      const newId = crypto.randomUUID();
      onPlaceNew(clickedSide, pos, newId);
      setActiveKey(newId);
    },
    [activeKey, category, onPlaceNew, onUnfocus]
  );

  const handleMapClickA = useCallback(
    (x: number, y: number) => placeFromClick('A', { x, y }),
    [placeFromClick]
  );
  const handleMapClickB = useCallback(
    (x: number, y: number) => placeFromClick('B', { x, y }),
    [placeFromClick]
  );

  // ---- Hover state for cross-map highlighting ----
  // When the user hovers a marker on side A, side B should highlight the
  // partner with a passive popup (and vice versa). We track which side
  // initiated the hover so each map can decide between interactive (local)
  // and passive (remote) popup behaviour.
  const [hover, setHover] = useState<{ side: 'A' | 'B'; key: string } | null>(
    null
  );
  const handleHoverA = useCallback((key: string | null) => {
    setHover(key ? { side: 'A', key } : null);
  }, []);
  const handleHoverB = useCallback((key: string | null) => {
    setHover(key ? { side: 'B', key } : null);
  }, []);
  // The passive prop fed to each map: the hovered key, but only when the
  // hover originated on the OTHER side.
  const passiveForA = hover && hover.side === 'B' ? hover.key : null;
  const passiveForB = hover && hover.side === 'A' ? hover.key : null;

  // ---- Delete handlers (per side, look up the real annotation) ----
  const handleDeleteA = useCallback(
    (candidateKey: string) => {
      const c = candidates.find((cc) => cc.pairKey === candidateKey);
      if (c?.realA) onDelete?.(c.realA.id);
    },
    [candidates, onDelete]
  );
  const handleDeleteB = useCallback(
    (candidateKey: string) => {
      const c = candidates.find((cc) => cc.pairKey === candidateKey);
      if (c?.realB) onDelete?.(c.realB.id);
    },
    [candidates, onDelete]
  );

  const handleChangeLabelA = useCallback(
    (candidateKey: string) => {
      const c = candidates.find((cc) => cc.pairKey === candidateKey);
      if (c?.realA) onChangeLabel?.(c.realA.id, c.realA.categoryId);
    },
    [candidates, onChangeLabel]
  );
  const handleChangeLabelB = useCallback(
    (candidateKey: string) => {
      const c = candidates.find((cc) => cc.pairKey === candidateKey);
      if (c?.realB) onChangeLabel?.(c.realB.id, c.realB.categoryId);
    },
    [candidates, onChangeLabel]
  );

  const handleToggleObscuredA = useCallback(
    (candidateKey: string) => {
      const c = candidates.find((cc) => cc.pairKey === candidateKey);
      if (c?.realA) onToggleObscured?.(c.realA.id);
    },
    [candidates, onToggleObscured]
  );
  const handleToggleObscuredB = useCallback(
    (candidateKey: string) => {
      const c = candidates.find((cc) => cc.pairKey === candidateKey);
      if (c?.realB) onToggleObscured?.(c.realB.id);
    },
    [candidates, onToggleObscured]
  );

  // ---- Manual cross-image link (ctrl+click the other image's marker) ----
  // When a candidate is active, ctrl+clicking a *real* marker on the OTHER
  // image asks to link that annotation with the active candidate's real
  // annotation on the image opposite the click. v1 only allows this when the
  // active candidate's far side (the side being clicked toward) is a
  // shadow/informational proposal — never silently breaking an existing
  // real↔real link. Invalid ctrl+clicks are ignored (no activation).
  const handleCtrlClickA = useCallback(
    (candidateKey: string) => {
      if (!activeCandidate || activeCandidate.pairKey === candidateKey) return;
      const clicked = candidates.find((c) => c.pairKey === candidateKey);
      if (!clicked?.realA) return; // clicked a shadow, nothing to link
      // Anchor = active candidate's real on the opposite image (B). Its A
      // side must currently be a shadow/informational, not a real↔real.
      if (!activeCandidate.realB) return;
      if (activeCandidate.realA && !activeCandidate.informational) return;
      onManualLinkRequest?.(activeCandidate.realB.id, clicked.realA.id);
    },
    [activeCandidate, candidates, onManualLinkRequest]
  );
  const handleCtrlClickB = useCallback(
    (candidateKey: string) => {
      if (!activeCandidate || activeCandidate.pairKey === candidateKey) return;
      const clicked = candidates.find((c) => c.pairKey === candidateKey);
      if (!clicked?.realB) return;
      if (!activeCandidate.realA) return;
      if (activeCandidate.realB && !activeCandidate.informational) return;
      onManualLinkRequest?.(activeCandidate.realA.id, clicked.realB.id);
    },
    [activeCandidate, candidates, onManualLinkRequest]
  );

  // OOV candidates split by side. The OOV row itself lives on `side` (its
  // realA/realB on that side is the oov:true row); the partner, if any,
  // lives on the OTHER side as a normal positioned annotation that the map
  // still renders. So markers on a map can coexist with a panel card on the
  // same side that lives in the opposite-side panel — there is no overlap.
  const oovCandidatesA = useMemo(
    () => candidates.filter((c) => c.oovSide === 'A'),
    [candidates]
  );
  const oovCandidatesB = useMemo(
    () => candidates.filter((c) => c.oovSide === 'B'),
    [candidates]
  );

  // Panel cards reuse the map-side ctrl-click handlers — the geometry is
  // identical (clicking a side-A card against a side-B active candidate is
  // the same gesture as ctrl-clicking a side-A map marker).
  const handleCardDeleteA = useCallback(
    (candidateKey: string) => {
      const c = candidates.find((cc) => cc.pairKey === candidateKey);
      if (c?.realA) onDelete?.(c.realA.id);
    },
    [candidates, onDelete]
  );
  const handleCardDeleteB = useCallback(
    (candidateKey: string) => {
      const c = candidates.find((cc) => cc.pairKey === candidateKey);
      if (c?.realB) onDelete?.(c.realB.id);
    },
    [candidates, onDelete]
  );

  const addOovA = useCallback(() => onAddOov?.('A'), [onAddOov]);
  const addOovB = useCallback(() => onAddOov?.('B'), [onAddOov]);

  // Image-space coords of the active candidate on each side, fed to the
  // maps so they can render a leniency-radius ring around the right marker.
  const activeAnchorA = activeCandidate?.posA ?? null;
  const activeAnchorB = activeCandidate?.posB ?? null;

  return (
    <div className='w-100 h-100 d-flex flex-column gap-2'>
      <div className='d-flex flex-row gap-2 w-100' style={{ flex: 1 }}>
        <OovPanel
          side='A'
          candidates={oovCandidatesA}
          category={category}
          activeKey={activeKey}
          passiveHoverKey={passiveForA}
          onActivate={handleMarkerClick}
          onCtrlClick={handleCtrlClickA}
          onHoverChange={handleHoverA}
          onDelete={handleCardDeleteA}
        />
        <div style={{ flex: 1, minHeight: 0 }}>
          <IndividualIdMap
            image={imageA}
            sourceKey={sourceKeys[0]}
            markers={markersA}
            onMarkerDrag={handleDragA}
            onMarkerClick={handleMarkerClick}
            onMapClick={handleMapClickA}
            onMapInstance={onMapInstance0}
            passiveHoverKey={passiveForA}
            onHoverChange={handleHoverA}
            onMarkerDelete={handleDeleteA}
            onMarkerChangeLabel={handleChangeLabelA}
            onMarkerToggleObscured={handleToggleObscuredA}
            onMarkerCtrlClick={handleCtrlClickA}
            onAddOov={addOovA}
            leniency={leniency}
            leniencyAnchor={activeAnchorA}
            // Side A's overlay traces image B's bounds projected onto A.
            previewTransform={pair.backward}
            otherImage={imageB}
          />
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <IndividualIdMap
            image={imageB}
            sourceKey={sourceKeys[1]}
            markers={markersB}
            onMarkerDrag={handleDragB}
            onMarkerClick={handleMarkerClick}
            onMapClick={handleMapClickB}
            onMapInstance={onMapInstance1}
            passiveHoverKey={passiveForB}
            onHoverChange={handleHoverB}
            onMarkerDelete={handleDeleteB}
            onMarkerChangeLabel={handleChangeLabelB}
            onMarkerToggleObscured={handleToggleObscuredB}
            onMarkerCtrlClick={handleCtrlClickB}
            onAddOov={addOovB}
            leniency={leniency}
            leniencyAnchor={activeAnchorB}
            // Side B's overlay traces image A's bounds projected onto B.
            previewTransform={pair.forward}
            otherImage={imageA}
          />
        </div>
        <OovPanel
          side='B'
          candidates={oovCandidatesB}
          category={category}
          activeKey={activeKey}
          passiveHoverKey={passiveForB}
          onActivate={handleMarkerClick}
          onCtrlClick={handleCtrlClickB}
          onHoverChange={handleHoverB}
          onDelete={handleCardDeleteB}
        />
      </div>
      <PairToolbar
        active={activeCandidate}
        // Toolbar counts exclude informational markers — they're visible
        // but not part of the linking workflow.
        candidatesCount={
          candidates.filter((c) => !c.informational).length
        }
        acceptedCount={
          candidates.filter(
            (c) => c.status === 'accepted' && !c.informational
          ).length
        }
        onPrev={onRequestPrevPair}
        onNext={onRequestNextPair}
        leniency={leniency}
        onLeniencyChange={onLeniencyChange}
      />
    </div>
  );
}

function PairToolbar({
  active,
  candidatesCount,
  acceptedCount,
  onPrev,
  onNext,
  leniency,
  onLeniencyChange,
}: {
  active: MatchCandidate | null;
  candidatesCount: number;
  acceptedCount: number;
  onPrev: () => void;
  onNext: () => void;
  leniency: number;
  onLeniencyChange: (next: number) => void;
}) {
  const navigate = useNavigate();

  const status = active
    ? active.status === 'pending'
      ? 'Press Space to lock the active marker.'
      : active.status === 'locked'
      ? 'Press Space again to accept the link.'
      : 'Already linked. Use ←/→ to focus another candidate.'
    : candidatesCount === 0
    ? 'No matches in this pair.'
    : 'Click or use ←/→ to focus a candidate, then Space.';

  return (
    <div
      className='d-flex flex-row align-items-center justify-content-between gap-2 px-3 py-3'
      style={{
        // Unified with the progress bar below — same background, no rounded
        // corners, divider line provided by ProgressBar's top border.
        background: '#4E5D6C',
        color: '#f8f9fa',
        fontSize: 12,
      }}
    >
      <div className='d-flex flex-row gap-2 align-items-center'>
        <Button
          onClick={onPrev}
          title='Previous pair (Ctrl+←)'
          size='sm'
        >
          ←
        </Button>
        <Button
          size='sm'
          onClick={onNext}
          title='Next pair (Ctrl+→)'
        >
          →
        </Button>
        <span style={{ opacity: 0.85 }}>
          {acceptedCount} / {candidatesCount} accepted
        </span>
      </div>
      <div
        className='d-flex flex-row gap-2 align-items-center'
        title='Munkres only proposes a match if the projected distance to a partner is below this many image pixels. The active marker shows a ring at this radius.'
      >
        <label
          htmlFor='ii-leniency'
          style={{ opacity: 0.8, fontSize: 11, marginBottom: 0 }}
        >
          Pairing radius
        </label>
        <input
          id='ii-leniency'
          type='range'
          min={0}
          max={1000}
          step={10}
          value={leniency}
          onChange={(e) => onLeniencyChange(parseInt(e.target.value, 10))}
          style={{ width: 140 }}
        />
        <span
          style={{
            opacity: 0.85,
            minWidth: 56,
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {leniency} px
        </span>
      </div>
      <span style={{ flex: 1, textAlign: 'right' }}>{status}</span>
      <Button
        size='sm'
        onClick={() => {
          navigate('/jobs');
          }
        }
        >
        Save & Exit
      </Button>
    </div>
  );
}
