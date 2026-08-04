export const ACTIVE_MARKER_SIZE = 22;
export const ACTIVE_MARKER_COLOR = '#ff8c1a';

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
