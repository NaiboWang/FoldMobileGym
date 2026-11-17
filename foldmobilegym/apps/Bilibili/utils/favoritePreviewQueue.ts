/** In-memory simulator preview queue; does not represent actual audio/video playback. */
export type FavoritePreviewQueue = { ids: string[]; index: number };

export function createFavoritePreviewQueue(ids: readonly string[], available: ReadonlySet<string>): FavoritePreviewQueue | null {
  const playable = ids.filter(id => typeof id === 'string' && id.length > 0 && available.has(id));
  return playable.length ? { ids: playable, index: 0 } : null;
}

/** A route-owned queue advances only from its current item and skips missing catalog records. */
export function nextFavoritePreview(value: unknown, currentId: string, available: ReadonlySet<string>): FavoritePreviewQueue | null {
  if (!value || typeof value !== 'object') return null;
  const { ids, index } = value as { ids?: unknown; index?: unknown };
  if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string' && id.length > 0)
      || typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= ids.length
      || ids[index] !== currentId) return null;
  for (let next = index + 1; next < ids.length; next++) {
    if (available.has(ids[next])) return { ids: [...ids], index: next };
  }
  return null;
}
