import { clampPan, panLimits, type PanPoint } from './panGeometry';

export type ViewerTransform = { scale: number; position: PanPoint };
export type PinchGeometry = {
  center: PanPoint; hostScale: number;
  imageWidth: number; imageHeight: number; width: number; height: number;
};
export const MAX_VIEWER_SCALE = 4;
export function pointerPair(a: PanPoint, b: PanPoint) {
  return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) };
}

/** Keep the same image point under the moving centroid (before edge clamping).
 * Touches/center are physical host CSS pixels; position is pre-zoom image CSS px.
 */
export function pinchTransform(initial: ViewerTransform, start: ReturnType<typeof pointerPair>,
  current: ReturnType<typeof pointerPair>, geometry: PinchGeometry): ViewerTransform {
  const { hostScale, center, imageWidth, imageHeight, width, height } = geometry;
  if (![initial.scale, start.distance, current.distance, hostScale, imageWidth, imageHeight, width, height,
    center.x, center.y, start.center.x, start.center.y, current.center.x, current.center.y, initial.position.x, initial.position.y].every(Number.isFinite)
    || Math.min(initial.scale, start.distance, hostScale, imageWidth, imageHeight, width, height) <= 0 || current.distance < 0) return initial;
  const scale = Math.max(1, Math.min(MAX_VIEWER_SCALE, initial.scale * current.distance / start.distance));
  return { scale, position: clampPan({
    x: initial.position.x + (current.center.x - center.x) / (hostScale * scale) - (start.center.x - center.x) / (hostScale * initial.scale),
    y: initial.position.y + (current.center.y - center.y) / (hostScale * scale) - (start.center.y - center.y) / (hostScale * initial.scale),
  }, panLimits(imageWidth, imageHeight, width, height, scale)) };
}
