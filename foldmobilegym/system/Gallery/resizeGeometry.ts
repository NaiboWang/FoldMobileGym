import type { PinchGeometry } from './pinchGeometry';

/** Initial/duplicate notifications do not cancel a gesture whose measured geometry is unchanged. */
export function sameViewerGeometry(before: PinchGeometry | null, after: PinchGeometry | null): boolean {
  if (!before || !after) return false;
  const pairs = [
    [before.hostScale, after.hostScale], [before.width, after.width], [before.height, after.height],
    [before.imageWidth, after.imageWidth], [before.imageHeight, after.imageHeight],
    [before.center.x, after.center.x], [before.center.y, after.center.y],
  ];
  if (pairs.slice(0, 5).some(([a, b]) => a <= 0 || b <= 0)) return false;
  return pairs.every(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.001);
}
