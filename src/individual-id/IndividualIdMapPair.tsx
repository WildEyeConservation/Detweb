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
import { HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OovPanel } from './components/OovPanel';
import { HelpModal } from './components/HelpModal';

interface Props {
  pair: NeighbourPair;
  imageA: ImageType;
  imageB: ImageType;
  candidates: MatchCandidate[];
  category: CategoryType | null;
  /** Hotkeys are disabled when false. */
  visible: boolean;

  onDrag: (
    candidateKey: string,
    side: 'A' | 'B',
    pos: { x: number; y: number }
  ) => void;
  /** First space press: mark `locked` in working state. No DB write. */
  onLock: (candidateKey: string) => void;
  onUnlock: (candidateKey: string) => void;
  /** Second space press: commit the link and mark `accepted`. */
  onAccept: (candidateKey: string) => void;
  onUnfocus?: () => void;
  /** Harness pre-generates the id so the candidate survives the Munkres rebuild. */
  onPlaceNew?: (
    side: 'A' | 'B',
    pos: { x: number; y: number },
    newAnnotationId: string
  ) => void;
  onDelete?: (annotationId: string) => void;
  onChangeLabel?: (annotationId: string, currentCategoryId: string) => void;
  onToggleObscured?: (annotationId: string) => void;
  /** Obscured intent for a shadow side; stamped onto the row created at accept. */
  onSetProposedObscured?: (
    candidateKey: string,
    side: 'A' | 'B',
    value: boolean
  ) => void;
  /** Args: active candidate's real id opposite the click, then the ctrl-clicked real id. */
  onManualLinkRequest?: (
    activeAnnotationId: string,
    clickedAnnotationId: string
  ) => void;
  onAllAccepted?: () => void;
  onAddOov?: (side: 'A' | 'B') => void;
  /** Omit to hide the prev button + Ctrl+← shortcut (used by single-pair mode). */
  onRequestPrevPair?: () => void;
  /** Omit to hide the next button + Ctrl+→ shortcut (used by single-pair mode). */
  onRequestNextPair?: () => void;
  leniency: number;
  onLeniencyChange: (next: number) => void;
  /** Also gates the progress bar; owned by the harness. */
  collapsed: boolean;
  onCollapsedChange: (next: boolean) => void;
  /** Both maps open at this zoom instead of fit-to-image. Undefined on the first pair. */
  initialZoom?: number;
  onZoomChange?: (zoom: number) => void;
  /** Copied to the clipboard when the toolbar's Share button is clicked. */
  shareHref?: string;
}

const DEFAULT_COLOR = '#3498db';

// Two-map workspace: renders both maps + markers and the keyboard flow.
// Never writes the DB and never persists across mounts — the harness owns both.
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
    onUnlock,
    onAccept,
    onUnfocus,
    onPlaceNew,
    onDelete,
    onChangeLabel,
    onToggleObscured,
    onSetProposedObscured,
    onManualLinkRequest,
    onAllAccepted,
    onRequestPrevPair,
    onRequestNextPair,
    onAddOov,
    leniency,
    onLeniencyChange,
    collapsed,
    onCollapsedChange,
    initialZoom,
    onZoomChange,
    shareHref,
  } = props;
  const { client } = useContext(GlobalContext)!;

  // Default to the first non-accepted candidate on pair change; never auto-advance on accept.
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
    // Re-default only on pair change, not candidate mutation (else dragging shifts focus).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairKey]);

  // If the active candidate disappears (e.g. rejected / removed), clear focus.
  useEffect(() => {
    if (activeKey && !candidates.some((c) => c.pairKey === activeKey)) {
      setActiveKey(null);
    }
  }, [activeKey, candidates]);

  // Watch `candidates` post-render (not Space's accept branch) so the harness
  // has recomputed before we fire — avoids a stale "earlier pair incomplete?"
  // read. sawIncompleteRef limits firing to the user's own incomplete→complete.
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

  const color = category?.color || DEFAULT_COLOR;

  // secondary = real whose objectId points at another row's identity; primary otherwise.
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
        obscured: c.realA ? !!c.realA.obscured : !!c.obscuredA,
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
        obscured: c.realB ? !!c.realB.obscured : !!c.obscuredB,
      });
    }
    return out;
  }, [candidates, activeKey, color]);

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

  // Slave the other map via the homography on move/zoom; isSyncingRef breaks the feedback loop.
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

      const c = src.map.getCenter();
      const srcPx = src.lngLat2px(c.lng, c.lat);
      const tgtPx = tf([srcPx.x, srcPx.y]);
      const targetLngLat = tgt.px2lngLat(tgtPx[0], tgtPx[1]);

      // Match zoom via the homography's local-derivative scale (handles non-uniform transforms).
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
        // Release next frame so the target's move/zoom doesn't re-enter sync.
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

  // Imperative pan so it can fire on gestures that don't change activeKey (Space-lock, first activation).
  const focusPanTimeoutRef = useRef<number | null>(null);
  const panToCandidate = useCallback(
    (key: string) => {
      const cand = candidates.find((c) => c.pairKey === key);
      if (!cand || cand.informational) return;
      const a = mapsRef.current[0];
      const b = mapsRef.current[1];
      // Suppress sync during the pan so B doesn't mid-animation jump off A's centre.
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
      if (focusPanTimeoutRef.current != null) {
        window.clearTimeout(focusPanTimeoutRef.current);
      }
      focusPanTimeoutRef.current = window.setTimeout(() => {
        isSyncingRef.current = false;
        focusPanTimeoutRef.current = null;
      }, 320);
    },
    [candidates]
  );

  // With a carried-over zoom, pan to the first candidate once both maps are
  // ready. Gated on sourceKeys (the maps rebuild when they resolve) so only
  // the final stable instance is panned — avoids the double-pan; ref makes it idempotent.
  const focusedMapRef = useRef<maplibregl.Map | null>(null);
  useEffect(() => {
    if (initialZoom == null) return;
    if (!activeKey) return;
    if (!sourceKeys[0] || !sourceKeys[1]) return;
    const a = mapsRef.current[0];
    const b = mapsRef.current[1];
    if (!a || !b) return;
    if (focusedMapRef.current === a.map) return;
    focusedMapRef.current = a.map;
    panToCandidate(activeKey);
  }, [mapsTick, activeKey, initialZoom, sourceKeys, panToCandidate]);

  // Pan on active-candidate transitions; skip the first activation so initial framing wins.
  const prevActiveKeyRef = useRef<string | null>(null);
  useEffect(() => {
    // First activation on a new pair shouldn't pan.
    prevActiveKeyRef.current = null;
  }, [pairKey]);
  useEffect(() => {
    const prev = prevActiveKeyRef.current;
    prevActiveKeyRef.current = activeKey;
    if (!activeKey) return; // deselect → no pan
    if (!prev) return; // initial activation on this pair → no pan
    if (prev === activeKey) return;

    panToCandidate(activeKey);
    // Pan only on real active-key transitions, not every Munkres rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  // Informational candidates are skipped by navigation and Space (hover popup still works).
  const advanceFocus = useCallback(
    (direction: 1 | -1) => {
      const focusable = candidates.filter((c) => !c.informational);
      if (focusable.length === 0) return;
      const currentIdx = activeKey
        ? focusable.findIndex((c) => c.pairKey === activeKey)
        : -1;
      // currentIdx may be -1 after a final accept.
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
      if (next) {
        setActiveKey(next.pairKey);
        panToCandidate(next.pairKey);
      }
      return;
    }
    // Informational can't be locked — Space skips ahead so the flow doesn't get stuck.
    if (activeCandidate.informational) {
      advanceFocus(1);
      return;
    }
    // Pure OOV (no chain extension, no positional partner) still needs a
    // manual Ctrl/⌘+click link — Space skips ahead. An OOV with a chain
    // extension (proposedOov on the other side) is acceptable below.
    if (
      activeCandidate.oovSide &&
      !activeCandidate.proposedOovA &&
      !activeCandidate.proposedOovB
    ) {
      advanceFocus(1);
      return;
    }
    if (activeCandidate.status === 'pending') {
      onLock(activeCandidate.pairKey);
      panToCandidate(activeCandidate.pairKey);
      return;
    }
    if (activeCandidate.status === 'locked') {
      onAccept(activeCandidate.pairKey);
      // Advance focus within this pair; onAllAccepted is fired by the effect, not here (stale-read race).
      const linkable = candidates.filter((c) => !c.informational);
      const remaining = linkable.filter(
        (c) => c.status !== 'accepted' && c.pairKey !== activeCandidate.pairKey
      );
      if (remaining.length === 0) {
        setActiveKey(null);
      } else {
        // Next linkable after current, looping back to the start.
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
      advanceFocus(1);
    }
  }, [
    activeCandidate,
    candidates,
    onLock,
    onAccept,
    onAllAccepted,
    advanceFocus,
    panToCandidate,
  ]);

  const handleEscape = useCallback(() => {
    if (activeKey) {
      if (activeCandidate?.status === 'locked') {
        onUnlock(activeCandidate.pairKey);
      }
      setActiveKey(null);
      onUnfocus?.();
    }
  }, [activeKey, activeCandidate, onUnlock, onUnfocus]);

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
  useHotkeys(
    'Ctrl+ArrowRight',
    () => onRequestNextPair?.(),
    { enabled: visible && !!onRequestNextPair },
    [onRequestNextPair]
  );
  useHotkeys(
    'Ctrl+ArrowLeft',
    () => onRequestPrevPair?.(),
    { enabled: visible && !!onRequestPrevPair },
    [onRequestPrevPair]
  );

  const handleMarkerClick = useCallback(
    (candidateKey: string) => {
      // Don't activate informational markers — no partner to lock/accept.
      const c = candidates.find((cc) => cc.pairKey === candidateKey);
      if (c?.informational) return;
      setActiveKey(candidateKey);
    },
    [candidates]
  );

  // Empty-map click: deselect if a candidate is active (an accidental create
  // would make the old shadow appear to "move"); otherwise create a new
  // annotation, pre-generating the id so it survives the Munkres rebuild.
  const placeFromClick = useCallback(
    (clickedSide: 'A' | 'B', pos: { x: number; y: number }) => {
      if (activeKey) {
        if (activeCandidate?.status === 'locked') {
          onUnlock(activeCandidate.pairKey);
        }
        setActiveKey(null);
        onUnfocus?.();
        return;
      }
      if (!category || !onPlaceNew) return;
      const newId = crypto.randomUUID();
      onPlaceNew(clickedSide, pos, newId);
      setActiveKey(newId);
    },
    [activeKey, activeCandidate, onUnlock, category, onPlaceNew, onUnfocus]
  );

  const handleMapClickA = useCallback(
    (x: number, y: number) => placeFromClick('A', { x, y }),
    [placeFromClick]
  );
  const handleMapClickB = useCallback(
    (x: number, y: number) => placeFromClick('B', { x, y }),
    [placeFromClick]
  );

  // Track which side initiated the hover so the other map shows a passive popup.
  const [hover, setHover] = useState<{ side: 'A' | 'B'; key: string } | null>(
    null
  );
  const handleHoverA = useCallback((key: string | null) => {
    setHover(key ? { side: 'A', key } : null);
  }, []);
  const handleHoverB = useCallback((key: string | null) => {
    setHover(key ? { side: 'B', key } : null);
  }, []);
  const passiveForA = hover && hover.side === 'B' ? hover.key : null;
  const passiveForB = hover && hover.side === 'A' ? hover.key : null;

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
      if (!c) return;
      // Real → live DB toggle; shadow → in-memory intent applied at accept.
      if (c.realA) onToggleObscured?.(c.realA.id);
      else onSetProposedObscured?.(c.pairKey, 'A', !c.obscuredA);
    },
    [candidates, onToggleObscured, onSetProposedObscured]
  );
  const handleToggleObscuredB = useCallback(
    (candidateKey: string) => {
      const c = candidates.find((cc) => cc.pairKey === candidateKey);
      if (!c) return;
      if (c.realB) onToggleObscured?.(c.realB.id);
      else onSetProposedObscured?.(c.pairKey, 'B', !c.obscuredB);
    },
    [candidates, onToggleObscured, onSetProposedObscured]
  );

  // Ctrl+click a real marker on the other image to link it with the active
  // candidate's real on the opposite side — only when that side is a
  // shadow/informational proposal, never breaking an existing real↔real link.
  const handleCtrlClickA = useCallback(
    (candidateKey: string) => {
      if (!activeCandidate || activeCandidate.pairKey === candidateKey) return;
      const clicked = candidates.find((c) => c.pairKey === candidateKey);
      if (!clicked?.realA) return; // clicked a shadow, nothing to link
      // Anchor = active's real on B; A side must be a shadow/informational.
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

  // OOV candidates split by side; the partner (if any) renders normally on
  // the other map. Chain-proposed OOVs (no DB row yet) ride the same panel
  // — the visual treatment of those cards differentiates them.
  const oovCandidatesA = useMemo(
    () => candidates.filter((c) => c.oovSide === 'A' || c.proposedOovA),
    [candidates]
  );
  const oovCandidatesB = useMemo(
    () => candidates.filter((c) => c.oovSide === 'B' || c.proposedOovB),
    [candidates]
  );

  // Panel cards reuse the map-side ctrl-click handlers (identical geometry).
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

  const activeAnchorA = activeCandidate?.posA ?? null;
  const activeAnchorB = activeCandidate?.posB ?? null;

  return (
    <div className='w-100 h-100 d-flex flex-column gap-2'>
      <div className='d-flex flex-row gap-2 w-100' style={{ flex: 1, minHeight: 0 }}>
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
            initialZoom={initialZoom}
            // Side A is canonical; B stays synced via the homography.
            onZoomChange={onZoomChange}
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
            // Same opening zoom; the homography sync reconciles scale on first move.
            initialZoom={initialZoom}
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
        // Counts exclude informational markers.
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
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
        shareHref={shareHref}
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
  collapsed,
  onCollapsedChange,
  shareHref,
}: {
  active: MatchCandidate | null;
  candidatesCount: number;
  acceptedCount: number;
  onPrev?: () => void;
  onNext?: () => void;
  leniency: number;
  onLeniencyChange: (next: number) => void;
  collapsed: boolean;
  onCollapsedChange: (next: boolean) => void;
  shareHref?: string;
}) {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

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
        background: '#4E5D6C',
        color: '#f8f9fa',
        fontSize: 12,
        position: 'relative',
      }}
    >
      <div className='d-flex flex-row gap-2 align-items-center'>
        <span
          style={{
            borderRight: '1px solid rgba(255, 255, 255, 0.25)',
            paddingRight: 8,
            marginRight: 4,
            display: 'flex',
          }}
        >
          <Button
            size='sm'
            variant='info'
            onClick={() => setHelpOpen(true)}
            title='How ChainLink works'
          >
            <HelpCircle size={16} style={{ verticalAlign: 'middle' }} />
          </Button>
        </span>
        <Button
          size='sm'
          variant='outline-light'
          onClick={() => onCollapsedChange(!collapsed)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▴' : '▾'}
        </Button>
        {onPrev && (
          <Button
            onClick={onPrev}
            title='Previous image pair (Ctrl+←)'
            size='sm'
          >
            ←
          </Button>
        )}
        {onNext && (
          <Button
            size='sm'
            onClick={onNext}
            title='Next image pair (Ctrl+→)'
          >
            →
          </Button>
        )}
        {!collapsed && (
          <span style={{ opacity: 0.85 }}>
            {acceptedCount} / {candidatesCount} accepted
          </span>
        )}
      </div>
      <div
        className='d-flex flex-row gap-2 align-items-center'
        title='Munkres only proposes a match if the projected distance to a partner is below this many image pixels. The active marker shows a ring at this radius.'
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
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
        <input
          type='number'
          aria-label='Pairing radius in pixels'
          min={0}
          max={1000}
          step={1}
          value={leniency}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (Number.isNaN(n)) return;
            onLeniencyChange(Math.max(0, Math.min(1000, n)));
          }}
          style={{
            width: 60,
            background: '#3B4753',
            color: '#f8f9fa',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: 4,
            fontSize: 12,
            padding: '2px 4px',
            fontVariantNumeric: 'tabular-nums',
          }}
        />
        <span style={{ opacity: 0.85, fontSize: 11 }}>px</span>
      </div>
      {/* Always render the spacer so Share/Save stay right-aligned when collapsed. */}
      <span style={{ flex: 1, textAlign: 'right' }}>{!collapsed && status}</span>
      <Button
        size='sm'
        variant='outline-light'
        onClick={async () => {
          // shareHref is a route path; expand to an absolute URL so the
          // clipboard payload is openable outside this tab.
          const absolute = shareHref
            ? new URL(shareHref, window.location.origin).toString()
            : window.location.href;
          try {
            await navigator.clipboard.writeText(absolute);
            setShareCopied(true);
            window.setTimeout(() => setShareCopied(false), 1500);
          } catch (err) {
            console.error('Failed to copy share link', err);
          }
        }}
        title={shareCopied ? 'Link copied' : 'Copy a link to this pair'}
      >
        {shareCopied ? 'Copied!' : 'Share'}
      </Button>
      <Button
        size='sm'
        onClick={() => {
          navigate('/jobs');
          }
        }
        >
        Save & Exit
      </Button>
      <HelpModal show={helpOpen} onHide={() => setHelpOpen(false)} />
    </div>
  );
}
