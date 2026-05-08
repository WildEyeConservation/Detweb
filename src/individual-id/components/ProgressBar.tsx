import { useEffect, useMemo, useRef, useState } from 'react';
import type { PairCompletionState } from '../types';
import { completionColor } from '../utils/completion';

interface Props {
  /** Completion state for each pair, in display order. */
  states: PairCompletionState[];
  /** Index of the pair currently being worked on. */
  activeIndex: number;
  /** Click a slot to jump to that pair (harness shows confirm if needed). */
  onJump: (index: number) => void;
}

const HEIGHT = 22;
const PADDING_X = 12;

/**
 * Canvas-based progress bar that scales to any number of pairs.
 *
 *   - Plenty of room (slot >= 8px) → render filled circles.
 *   - Less room (slot >= 1.5px) → render thin filled bars.
 *   - Less than 1px per pair → quantise: each on-screen column represents
 *     a bucket of pairs and is coloured by the worst (yellow > green) state
 *     in the bucket so that incomplete pairs are never visually swallowed.
 *
 * Click and hover work in slot-space regardless of render mode.
 */
export function ProgressBar({ states, activeIndex, onJump }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  // ResizeObserver to keep the canvas pinned to its container width.
  useEffect(() => {
    const wrap = wrapperRef.current;
    if (!wrap) return;
    setWidth(Math.floor(wrap.getBoundingClientRect().width));
    const ro = new ResizeObserver((entries) => {
      setWidth(Math.floor(entries[0].contentRect.width));
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  const innerWidth = Math.max(0, width - 2 * PADDING_X);
  const slotWidth = states.length > 0 ? innerWidth / states.length : 0;

  const acceptedCount = useMemo(
    () =>
      states.reduce(
        (n, s) => n + (s.status === 'complete' || s.status === 'empty' ? 1 : 0),
        0
      ),
    [states]
  );

  // Render the canvas whenever inputs change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, width) * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${HEIGHT}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, HEIGHT);

    if (states.length === 0 || slotWidth <= 0) return;

    if (slotWidth >= 8) {
      // Dot mode.
      const radius = Math.min(8, slotWidth / 2 - 1);
      states.forEach((s, i) => {
        const cx = PADDING_X + i * slotWidth + slotWidth / 2;
        const cy = HEIGHT / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = completionColor(s);
        ctx.fill();
        if (i === activeIndex) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    } else if (slotWidth >= 1.5) {
      // Slim bar mode — one bar per pair, 1px gap if there's room.
      const barW = Math.max(1, slotWidth - 0.5);
      const top = 4;
      const barH = HEIGHT - 8;
      states.forEach((s, i) => {
        const x = PADDING_X + i * slotWidth;
        ctx.fillStyle = completionColor(s);
        ctx.fillRect(x, top, barW, barH);
      });
      if (activeIndex >= 0 && activeIndex < states.length) {
        const x = PADDING_X + activeIndex * slotWidth;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 0.5, top - 1.5, barW + 1, barH + 3);
      }
    } else {
      // Quantised mode: bucket pairs into pixels. Each on-screen column
      // shows the worst (incomplete > complete) status in its bucket so a
      // single yellow pair in a 200-pair window still gets a visible mark.
      const cols = Math.max(1, Math.floor(innerWidth));
      const top = 4;
      const barH = HEIGHT - 8;
      // Pre-compute per-column colour.
      const perCol = new Array(cols).fill('') as string[];
      const perColPriority = new Array(cols).fill(0) as number[]; // 0 empty, 1 green, 2 yellow
      for (let i = 0; i < states.length; i++) {
        const col = Math.min(cols - 1, Math.floor((i / states.length) * cols));
        const priority = states[i].status === 'incomplete' ? 2 : 1;
        if (priority > perColPriority[col]) {
          perColPriority[col] = priority;
          perCol[col] = completionColor(states[i]);
        }
      }
      for (let col = 0; col < cols; col++) {
        if (perColPriority[col] === 0) continue;
        ctx.fillStyle = perCol[col];
        ctx.fillRect(PADDING_X + col, top, 1, barH);
      }
      // Active marker.
      if (activeIndex >= 0 && activeIndex < states.length) {
        const x = PADDING_X + Math.floor((activeIndex / states.length) * cols);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 0.5, top - 1.5, 2, barH + 3);
      }
    }
  }, [states, slotWidth, innerWidth, width, activeIndex]);

  // Map a screen x to a pair index.
  const xToIndex = (clientX: number): number | null => {
    const canvas = canvasRef.current;
    if (!canvas || states.length === 0 || slotWidth <= 0) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - PADDING_X;
    if (x < 0) return null;
    const i = Math.floor(x / slotWidth);
    return i >= 0 && i < states.length ? i : null;
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        // Same colour as the toolbar above; a 1px top border gives the
        // sense of two sections within one bar.
        background: '#4E5D6C',
        borderTop: '1px solid rgba(0, 0, 0, 0.25)',
        color: '#f8f9fa',
        userSelect: 'none',
      }}
      className='w-100 d-flex flex-column pt-2 pb-3'
    >
      <div
        className='d-flex flex-row align-items-center justify-content-between px-3 pb-1'
        style={{ fontSize: 11, opacity: 0.85 }}
      >
        <span>
          {hover !== null
            ? `Pair ${hover + 1} / ${states.length}`
            : `${acceptedCount} / ${states.length} done`}
        </span>
        <span style={{ opacity: 0.75 }}>
          {slotWidth >= 8
            ? 'click a dot to jump'
            : slotWidth >= 1.5
            ? 'click a bar to jump'
            : 'click anywhere to jump'}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        onMouseMove={(e) => setHover(xToIndex(e.clientX))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const i = xToIndex(e.clientX);
          if (i !== null) onJump(i);
        }}
        style={{ display: 'block', cursor: 'pointer' }}
      />
    </div>
  );
}
