export type OverlayViewport = {
  left: number; top: number; width: number; height: number; scaleX: number; scaleY: number;
};

/** The transformed simulator root is the containing block for fixed overlays. */
export function simulatorOverlayViewport(): OverlayViewport {
  const root = document.getElementById('root');
  if (!root) return { left: 0, top: 0, width: innerWidth, height: innerHeight, scaleX: 1, scaleY: 1 };
  const rect = root.getBoundingClientRect();
  return {
    left: rect.left, top: rect.top, width: root.clientWidth, height: root.clientHeight,
    scaleX: root.offsetWidth > 0 ? rect.width / root.offsetWidth : 1,
    scaleY: root.offsetHeight > 0 ? rect.height / root.offsetHeight : 1,
  };
}

export function clientToOverlay(point: { x: number; y: number }, viewport: OverlayViewport) {
  return { x: (point.x - viewport.left) / (viewport.scaleX || 1), y: (point.y - viewport.top) / (viewport.scaleY || 1) };
}
