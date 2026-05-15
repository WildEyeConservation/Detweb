import { useMemo, useState } from 'react';
import * as jdenticon from 'jdenticon';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import type { CategoryType } from '../../schemaTypes';
import type { MatchCandidate } from '../types';
import { nameFor } from '../utils/identity';

interface Props {
  side: 'A' | 'B';
  /** Candidates whose OOV row is on THIS side (oovSide === side). */
  candidates: MatchCandidate[];
  category: CategoryType | null;
  activeKey: string | null;
  /** Hover key driven from OUTSIDE this panel (other map / other panel). */
  passiveHoverKey: string | null;
  onActivate: (candidateKey: string) => void;
  onCtrlClick: (candidateKey: string) => void;
  onHoverChange: (candidateKey: string | null) => void;
  /** Delete the OOV row underlying this card. */
  onDelete: (candidateKey: string) => void;
}

const COLLAPSED_WIDTH = 38;
const EXPANDED_WIDTH = 168;
const AVATAR_SIZE = 20;

/**
 * Side panel listing "out of view" annotations for one image of the pair.
 * OOV rows have no on-image position so they live in the panel rather than
 * on the map. Interaction matches a regular marker — click to activate,
 * Ctrl/right-click to manually link to a real annotation on the other image,
 * hover to reveal the action popup.
 *
 * The panel hides itself entirely when there are no OOV candidates on this
 * side, so it doesn't steal map width when unused.
 */
export function OovPanel({
  side,
  candidates,
  category,
  activeKey,
  passiveHoverKey,
  onActivate,
  onCtrlClick,
  onHoverChange,
  onDelete,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (candidates.length === 0) return null;

  const color = category?.color ?? '#3498db';
  const isLeft = side === 'A';

  return (
    <div
      style={{
        width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        flexShrink: 0,
        background: '#4E5D6C',
        color: '#f8f9fa',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 160ms ease',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }}
    >
      <button
        type='button'
        onClick={() => setCollapsed((c) => !c)}
        title={
          collapsed
            ? `Show ${candidates.length} out-of-view`
            : 'Collapse out-of-view panel'
        }
        style={{
          background: '#3a4654',
          border: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          color: '#f8f9fa',
          padding: collapsed ? '8px 0' : '8px 6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 600,
          gap: 4,
          minHeight: 32,
        }}
      >
        {!collapsed && (
          <span style={{ flex: 1, textAlign: 'left' }}>
            Out of view ({candidates.length})
          </span>
        )}
        {/* Chevron points INTO the panel when expanded (collapse direction),
            and OUT when collapsed (expand direction). */}
        {collapsed ? (
          isLeft ? (
            <ChevronRight size={18} strokeWidth={2.5} />
          ) : (
            <ChevronLeft size={18} strokeWidth={2.5} />
          )
        ) : isLeft ? (
          <ChevronLeft size={16} strokeWidth={2.5} />
        ) : (
          <ChevronRight size={16} strokeWidth={2.5} />
        )}
      </button>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: collapsed ? 4 : 6,
          padding: collapsed ? '6px 0' : 6,
          alignItems: 'center',
        }}
      >
        {candidates.map((c) =>
          collapsed ? (
            <CollapsedAvatar
              key={c.pairKey}
              candidate={c}
              side={side}
              color={color}
              active={c.pairKey === activeKey}
              passiveHover={passiveHoverKey === c.pairKey}
              onActivate={onActivate}
              onCtrlClick={onCtrlClick}
              onHoverChange={onHoverChange}
            />
          ) : (
            <OovCard
              key={c.pairKey}
              candidate={c}
              side={side}
              color={color}
              category={category}
              active={c.pairKey === activeKey}
              passiveHover={passiveHoverKey === c.pairKey}
              onActivate={onActivate}
              onCtrlClick={onCtrlClick}
              onHoverChange={onHoverChange}
              onDelete={onDelete}
            />
          )
        )}
      </div>
    </div>
  );
}

function CollapsedAvatar({
  candidate,
  side,
  color,
  active,
  passiveHover,
  onActivate,
  onCtrlClick,
  onHoverChange,
}: {
  candidate: MatchCandidate;
  side: 'A' | 'B';
  color: string;
  active: boolean;
  passiveHover: boolean;
  onActivate: (key: string) => void;
  onCtrlClick: (key: string) => void;
  onHoverChange: (key: string | null) => void;
}) {
  const real = side === 'A' ? candidate.realA : candidate.realB;
  const isPrimary = !real?.objectId || real.objectId === real.id;
  const identiconSvg = useMemo(
    () => (isPrimary ? jdenticon.toSvg(candidate.pairKey, AVATAR_SIZE) : ''),
    [candidate.pairKey, isPrimary]
  );
  const handleClick = (ev: React.MouseEvent) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.button === 0) {
      ev.preventDefault();
      onCtrlClick(candidate.pairKey);
      return;
    }
    onActivate(candidate.pairKey);
  };
  const handleContextMenu = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onCtrlClick(candidate.pairKey);
  };
  const ring = active
    ? '0 0 0 2px #ff8c1a'
    : passiveHover
    ? '0 0 0 2px #ffd28a'
    : 'none';
  return (
    <div
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => onHoverChange(candidate.pairKey)}
      onMouseLeave={() => onHoverChange(null)}
      title={nameFor(candidate.pairKey)}
      style={{
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: '50%',
        background: color,
        border: '1px solid rgba(0,0,0,0.7)',
        boxShadow: ring,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
      }}
      {...(isPrimary
        ? { dangerouslySetInnerHTML: { __html: identiconSvg } }
        : {})}
    />
  );
}

function OovCard({
  candidate,
  side,
  color,
  category,
  active,
  passiveHover,
  onActivate,
  onCtrlClick,
  onHoverChange,
  onDelete,
}: {
  candidate: MatchCandidate;
  side: 'A' | 'B';
  color: string;
  category: CategoryType | null;
  active: boolean;
  passiveHover: boolean;
  onActivate: (key: string) => void;
  onCtrlClick: (key: string) => void;
  onHoverChange: (key: string | null) => void;
  onDelete: (key: string) => void;
}) {
  const real = side === 'A' ? candidate.realA : candidate.realB;
  const isPrimary = !real?.objectId || real.objectId === real.id;
  const identiconSvg = useMemo(
    () => (isPrimary ? jdenticon.toSvg(candidate.pairKey, 20) : ''),
    [candidate.pairKey, isPrimary]
  );
  const [hover, setHover] = useState(false);
  const showActions = hover;

  // Status pill colour mirrors the map status rings.
  const statusColor =
    candidate.status === 'accepted'
      ? '#27ae60'
      : candidate.status === 'locked'
      ? '#f1c40f'
      : '#888';
  const statusLabel =
    candidate.status === 'accepted'
      ? 'Linked'
      : candidate.status === 'pending'
      ? 'Needs link'
      : 'Locked';

  const handleClick = (ev: React.MouseEvent) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.button === 0) {
      ev.preventDefault();
      onCtrlClick(candidate.pairKey);
      return;
    }
    onActivate(candidate.pairKey);
  };
  const handleContextMenu = (ev: React.MouseEvent) => {
    ev.preventDefault();
    onCtrlClick(candidate.pairKey);
  };

  // Active wins over passive hover for the outline colour.
  const outline = active
    ? '2px solid #ff8c1a'
    : passiveHover
    ? '2px solid #ffd28a'
    : '1px solid rgba(255,255,255,0.15)';

  return (
    <div
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => {
        setHover(true);
        onHoverChange(candidate.pairKey);
      }}
      onMouseLeave={() => {
        setHover(false);
        onHoverChange(null);
      }}
      style={{
        width: '100%',
        background: '#5B6977',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 6,
        padding: 6,
        cursor: 'pointer',
        outline,
        outlineOffset: -1,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: color,
            border: '1px solid rgba(0,0,0,0.5)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          {...(isPrimary
            ? { dangerouslySetInnerHTML: { __html: identiconSvg } }
            : {})}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {nameFor(candidate.pairKey)}
          </div>
          {category && (
            <div
              style={{
                fontSize: 10,
                opacity: 0.75,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {category.name}
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          color: statusColor,
        }}
      >
        {statusLabel}
      </div>
      {showActions && (
        <button
          type='button'
          onClick={(ev) => {
            ev.stopPropagation();
            onDelete(candidate.pairKey);
          }}
          title='Delete out-of-view annotation'
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            background: '#d9534f',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: 2,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}
