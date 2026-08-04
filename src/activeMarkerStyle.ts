export const ACTIVE_MARKER_SIZE = 22;
export const ACTIVE_MARKER_COLOR = '#ff8c1a';
export const TAG_BADGE_COLOR = '#0dcaf0';

export function applyActiveMarkerStyle(element: HTMLElement) {
  element.style.cssText = [
    `width:${ACTIVE_MARKER_SIZE}px`,
    `height:${ACTIVE_MARKER_SIZE}px`,
    'border-radius:50%',
    'box-sizing:border-box',
    'background:transparent',
    `border:3px solid ${ACTIVE_MARKER_COLOR}`,
    'box-shadow:0 0 0 1px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.6)',
    'cursor:move',
  ].join(';');
}

// Set once, at creation - maplibre positions markers by writing to
// element.style.transform, so the container's cssText must not be rewritten
// afterwards.
export function applyTagBadgeContainerStyle(element: HTMLElement) {
  element.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'align-items:flex-start',
    'gap:3px',
    'pointer-events:none',
  ].join(';');
}

export function applyTagBadgeStyle(element: HTMLElement) {
  element.style.cssText = [
    `background:${TAG_BADGE_COLOR}`,
    'color:#000',
    'font-size:12px',
    'font-weight:600',
    'line-height:1.4',
    'padding:1px 7px',
    'border-radius:10px',
    'white-space:nowrap',
    'border:1px solid rgba(0,0,0,0.6)',
    'box-shadow:0 1px 3px rgba(0,0,0,0.6)',
  ].join(';');
}
