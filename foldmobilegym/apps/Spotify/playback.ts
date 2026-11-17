import type { SpotifyTrack } from './types';

export interface SpotifyPlaybackAnchor {
  trackId: string | null;
  anchorPositionMs: number;
  anchorTimeMs: number | null;
}
export interface SpotifyPlaybackState {
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  repeat: 'off' | 'context' | 'track';
  queue: SpotifyTrack[];
  playback?: SpotifyPlaybackAnchor | null;
}
export interface SpotifyPlaybackSnapshot {
  trackId: string | null;
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
}
export interface SpotifyPlaybackResolution {
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  playback: SpotifyPlaybackAnchor;
  positionMs: number;
}

/** Metadata duration, not a guessed stream length. */
export function parseSpotifyDurationMs(value: unknown): number {
  if (typeof value !== 'string' || !/^\d+:\d{2}(?::\d{2})?$/.test(value.trim())) return 0;
  const parts = value.trim().split(':').map(Number);
  if (parts.slice(1).some(part => part >= 60)) return 0;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return Number.isSafeInteger(seconds * 1000) ? seconds * 1000 : 0;
}
export function formatSpotifyPosition(positionMs: number): string {
  const seconds = Math.floor(Number.isFinite(positionMs) ? Math.max(0, positionMs) / 1000 : 0);
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds / 60) % 60;
  return (hours ? `${hours}:${String(minutes).padStart(2, '0')}` : String(minutes)) + `:${String(seconds % 60).padStart(2, '0')}`;
}
export function playbackAnchor(track: SpotifyTrack | null, positionMs: number, now: number, playing: boolean): SpotifyPlaybackAnchor {
  return { trackId: track?.id ?? null, anchorPositionMs: positionMs, anchorTimeMs: track && playing ? now : null };
}
export function samePlaybackAnchor(a: SpotifyPlaybackAnchor | null | undefined, b: SpotifyPlaybackAnchor): boolean {
  return Boolean(a && a.trackId === b.trackId && a.anchorPositionMs === b.anchorPositionMs && a.anchorTimeMs === b.anchorTimeMs);
}
function normalizedAnchor(state: SpotifyPlaybackState, now: number): SpotifyPlaybackAnchor {
  const anchor = state.playback, track = state.currentTrack;
  if (!track || !anchor || anchor.trackId !== track.id || !Number.isFinite(anchor.anchorPositionMs)
    || anchor.anchorPositionMs < 0 || (anchor.anchorTimeMs !== null && !Number.isFinite(anchor.anchorTimeMs))) {
    return playbackAnchor(track, 0, now, Boolean(track && state.isPlaying));
  }
  const duration = parseSpotifyDurationMs(track.duration);
  const position = duration > 0 ? Math.min(duration, anchor.anchorPositionMs) : anchor.anchorPositionMs;
  if (position !== anchor.anchorPositionMs || Boolean(state.isPlaying) !== (anchor.anchorTimeMs !== null)) {
    return playbackAnchor(track, position, now, state.isPlaying);
  }
  return anchor;
}

/** Resume a stored checkpoint, never fabricate execution while the document was gone. */
export function restoreSpotifyPlayback(state: SpotifyPlaybackState, now: number): SpotifyPlaybackResolution {
  const anchor = normalizedAnchor(state, now), playing = Boolean(state.currentTrack && state.isPlaying);
  return { currentTrack: state.currentTrack, isPlaying: playing, positionMs: anchor.anchorPositionMs,
    playback: playbackAnchor(state.currentTrack, anchor.anchorPositionMs, now, playing) };
}

/** Pure, bounded queue catch-up. Only explicit state transitions write anchors. */
export function resolveSpotifyPlayback(state: SpotifyPlaybackState, now: number): SpotifyPlaybackResolution {
  const track = state.currentTrack, playing = Boolean(track && state.isPlaying);
  const anchor = normalizedAnchor(state, now);
  const elapsed = playing && anchor.anchorTimeMs !== null ? Math.max(0, now - anchor.anchorTimeMs) : 0;
  const position = anchor.anchorPositionMs + elapsed;
  const duration = parseSpotifyDurationMs(track?.duration);
  if (!track || !playing || duration <= 0 || position < duration) {
    return { currentTrack: track, isPlaying: playing, playback: anchor, positionMs: position };
  }
  const resolved = (nextTrack: SpotifyTrack, nextPosition: number, nextPlaying: boolean): SpotifyPlaybackResolution => ({
    currentTrack: nextTrack, isPlaying: nextPlaying,
    playback: playbackAnchor(nextTrack, nextPosition, now, nextPlaying), positionMs: nextPosition,
  });
  if (state.repeat === 'track') return resolved(track, position % duration, true);
  const index = state.queue.findIndex(item => item.id === track.id);
  if (index < 0 || state.queue.length === 0) return resolved(track, duration, false);
  let remaining = position - duration;
  if (state.repeat === 'context') {
    const durations = state.queue.map(item => parseSpotifyDurationMs(item.duration));
    const total = durations.reduce((sum, value) => sum + value, 0);
    if (durations.every(value => value > 0) && Number.isFinite(total) && total > 0) remaining %= total;
    for (let offset = 1; offset <= state.queue.length; offset++) {
      const nextIndex = (index + offset) % state.queue.length, nextTrack = state.queue[nextIndex], nextDuration = durations[nextIndex];
      if (nextDuration <= 0 || remaining < nextDuration) return resolved(nextTrack, remaining, true);
      remaining -= nextDuration;
    }
    return resolved(track, 0, true);
  }
  for (let nextIndex = index + 1; nextIndex < state.queue.length; nextIndex++) {
    const nextTrack = state.queue[nextIndex], nextDuration = parseSpotifyDurationMs(nextTrack.duration);
    if (nextDuration <= 0 || remaining < nextDuration) return resolved(nextTrack, remaining, true);
    remaining -= nextDuration;
  }
  const last = state.queue.at(-1)!;
  return resolved(last, parseSpotifyDurationMs(last.duration), false);
}

/** A backwards system-clock edit rebases at the last observed media position. */
export function synchronizeSpotifyPlayback(state: SpotifyPlaybackState, now: number, previousNow?: number): SpotifyPlaybackResolution {
  if (previousNow !== undefined && Number.isFinite(previousNow) && now < previousNow && state.isPlaying) {
    const before = resolveSpotifyPlayback(state, previousNow);
    return { ...before, playback: playbackAnchor(before.currentTrack, before.positionMs, now, before.isPlaying) };
  }
  return resolveSpotifyPlayback(state, now);
}
export function spotifyPlaybackSnapshot(state: SpotifyPlaybackState, now: number): SpotifyPlaybackSnapshot {
  const resolved = resolveSpotifyPlayback(state, now);
  return { trackId: resolved.currentTrack?.id ?? null, positionMs: resolved.positionMs,
    durationMs: parseSpotifyDurationMs(resolved.currentTrack?.duration), isPlaying: resolved.isPlaying };
}
export function spotifySeekPosition(clientX: number, left: number, width: number, durationMs: number): number | null {
  if (![clientX, left, width, durationMs].every(Number.isFinite) || width <= 0 || durationMs <= 0) return null;
  return Math.max(0, Math.min(1, (clientX - left) / width)) * durationMs;
}
