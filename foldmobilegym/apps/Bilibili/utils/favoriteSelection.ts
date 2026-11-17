import type { BilibiliUser } from '../types';
type Source = Pick<BilibiliUser, 'uid' | 'favoritesFolders'>;
export type FavoriteSelection = { videoId: string; sourceKey: string | null; selectedIds: Set<string> };
const key = (user: Source) => JSON.stringify([user.uid ?? null, user.favoritesFolders ?? []]);
const valid = (user: Source) => {
  const ids = (user.favoritesFolders ?? []).map(folder => folder.id);
  return ids.every(id => typeof id === 'string' && id.length > 0) && new Set(ids).size === ids.length;
};
/** Capture displayed identities and actual membership, never a new empty selection. */
export function captureFavoriteSelection(user: Source, videoId: string, pendingId?: string | null): FavoriteSelection {
  if (!videoId || !valid(user)) return { videoId, sourceKey: null, selectedIds: new Set() };
  const folders = user.favoritesFolders ?? [];
  const selectedIds = new Set(folders.filter(folder => (folder.videoIds ?? []).includes(videoId)).map(folder => folder.id));
  if (pendingId && folders.some(folder => folder.id === pendingId)) selectedIds.add(pendingId);
  return { videoId, sourceKey: key(user), selectedIds };
}
export function favoriteSelectionIsCurrent(user: Source, videoId: string, selection: FavoriteSelection): boolean {
  if (!videoId || videoId !== selection.videoId || selection.sourceKey === null || !valid(user) || key(user) !== selection.sourceKey) return false;
  const ids = new Set((user.favoritesFolders ?? []).map(folder => folder.id));
  return [...selection.selectedIds].every(id => ids.has(id));
}
