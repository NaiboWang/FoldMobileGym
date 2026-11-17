/** Pointer coordinates and this rectangle are both viewport CSS pixels. */
export function readerTapZone(clientX: number, frame: { left: number; width: number }): 'previous' | 'menu' | 'next' {
  if (!Number.isFinite(clientX) || !Number.isFinite(frame.left) || !Number.isFinite(frame.width) || frame.width <= 0) return 'menu';
  const fraction = (clientX - frame.left) / frame.width;
  if (fraction <= .35) return 'previous';
  if (fraction >= .65) return 'next';
  return 'menu';
}
