export type FavoriteSheetSnap = 'closed' | 'half' | 'full';
const extent = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
export function favoriteSheetTop(height: number, snap: FavoriteSheetSnap): number {
  const h = extent(height);
  const full = Math.min(40, h / 4);
  // The fixed header/footer need a useful body viewport in short split panes.
  return snap === 'closed' ? h : snap === 'half' && h / 2 >= 200 ? h / 2 : full;
}
/** Convert pointer motion from browser pixels to Activity-local layout pixels. */
export function favoriteSheetDragTop(height: number, startTop: number, deltaClientY: number, scale: number): number {
  const h = extent(height), zoom = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const delta = Number.isFinite(deltaClientY) ? deltaClientY / zoom : 0;
  return Math.max(favoriteSheetTop(h, 'full'), Math.min(h, extent(startTop) + delta));
}
export function favoriteSheetDrop(height: number, top: number, velocity: number): FavoriteSheetSnap {
  const h = extent(height);
  if (velocity > 0.5 || top > h * 0.75) return 'closed';
  if (velocity < -0.5 || top < h * 0.3) return 'full';
  return 'half';
}
