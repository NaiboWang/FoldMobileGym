import type { SpotifyTrack } from '../types';

const PLAYLIST_COLORS = [
  'from-purple-800',
  'from-blue-800',
  'from-red-800',
  'from-orange-800',
  'from-emerald-800',
  'from-yellow-800',
] as const;

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

export function getPlaylistColor(playlistId: string): string {
  return PLAYLIST_COLORS[hashText(playlistId) % PLAYLIST_COLORS.length];
}

export function orderFallbackTracks(tracks: SpotifyTrack[], playlistId: string): SpotifyTrack[] {
  return [...tracks].sort((left, right) => {
    const score = hashText(`${playlistId}:${left.id}`) - hashText(`${playlistId}:${right.id}`);
    return score || left.id.localeCompare(right.id);
  });
}
