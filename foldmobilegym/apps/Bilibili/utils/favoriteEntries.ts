import type { BilibiliVideo } from '../types';

/** Keep stored folder order and identity even when a catalog item is absent. */
export function resolveFavoriteEntries(videoIds: readonly string[] | undefined, videos: readonly BilibiliVideo[]) {
  const byId = new Map<string, BilibiliVideo>();
  for (const video of videos) if (!byId.has(video.id)) byId.set(video.id, video);
  return (videoIds ?? []).map(id => ({ id, video: byId.get(id) }));
}
