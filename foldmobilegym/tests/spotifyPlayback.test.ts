import { describe, expect, it } from 'vitest';
import { formatSpotifyPosition, parseSpotifyDurationMs, playbackAnchor, resolveSpotifyPlayback, restoreSpotifyPlayback, samePlaybackAnchor,
  spotifyPlaybackSnapshot, spotifySeekPosition, synchronizeSpotifyPlayback, type SpotifyPlaybackState } from '../apps/Spotify/playback';
import type { SpotifyTrack } from '../apps/Spotify/types';
const track = (id: string, duration = '1:00'): SpotifyTrack => ({ id, duration, title: id, artist: 'Local', cover: '' });
const queue = [track('a'), track('b', '2:00'), track('c', '0:30')];
const state = (patch: Partial<SpotifyPlaybackState> = {}): SpotifyPlaybackState => ({ currentTrack: queue[0], queue,
  isPlaying: true, repeat: 'off', playback: playbackAnchor(queue[0], 5000, 1000, true), ...patch });

describe('Spotify simulated shared timeline', () => {
  it.each([['3:58', 238000], ['01:02:03', 3723000], ['0:00', 0], ['120:30', 7230000]])('parses actual duration %s', (value, result) => expect(parseSpotifyDurationMs(value)).toBe(result));
  it.each([null, undefined, '', '3:99', '1:60:00', '-1:30', '3:30junk', '1', 'Infinity:00'])('does not guess duration for %s', value => expect(parseSpotifyDurationMs(value)).toBe(0));
  it('uses elapsed simulated time, including anchor epoch zero, without mutating the input', () => {
    const original = state({ playback: playbackAnchor(queue[0], 2000, 0, true) });
    expect(spotifyPlaybackSnapshot(original, 13000).positionMs).toBe(15000);
    expect(original.playback?.anchorPositionMs).toBe(2000);
  });
  it('does not advance a frozen clock or paused session', () => {
    expect(spotifyPlaybackSnapshot(state(), 1000).positionMs).toBe(5000);
    expect(spotifyPlaybackSnapshot(state({ isPlaying: false, playback: playbackAnchor(queue[0], 15000, 1000, false) }), 999999).positionMs).toBe(15000);
  });
  it('recovers missing, malformed or wrong-track legacy anchors at the actual track', () => {
    for (const playback of [null, { trackId: 'other', anchorPositionMs: 999, anchorTimeMs: 0 }, { trackId: 'a', anchorPositionMs: NaN, anchorTimeMs: 0 }]) {
      const result = resolveSpotifyPlayback(state({ playback }), 0);
      expect(result.positionMs).toBe(0); expect(result.playback.trackId).toBe('a'); expect(result.playback.anchorTimeMs).toBe(0);
    }
  });
  it('clears absent-track playback and does not fabricate unknown duration', () => {
    expect(resolveSpotifyPlayback(state({ currentTrack: null }), 999).isPlaying).toBe(false);
    const unknown = track('u', 'unknown');
    const result = spotifyPlaybackSnapshot(state({ currentTrack: unknown, playback: playbackAnchor(unknown, 0, 0, true) }), 2000);
    expect(result).toEqual({ trackId: 'u', positionMs: 2000, durationMs: 0, isPlaying: true });
  });
  it('advances through real queue duration boundaries and stops at the end without repeat', () => {
    const first = resolveSpotifyPlayback(state(), 56000);
    expect(first.currentTrack?.id).toBe('b'); expect(first.positionMs).toBe(0);
    const end = resolveSpotifyPlayback(state(), 999999999);
    expect(end.currentTrack?.id).toBe('c'); expect(end.positionMs).toBe(30000); expect(end.isPlaying).toBe(false);
  });
  it('repeats one track without changing its identity', () => {
    const result = resolveSpotifyPlayback(state({ repeat: 'track' }), 191000);
    expect(result.currentTrack?.id).toBe('a'); expect(result.positionMs).toBe(15000); expect(result.isPlaying).toBe(true);
  });
  it('wraps the context and bounds very large time jumps by queue length', () => {
    const result = resolveSpotifyPlayback(state({ repeat: 'context' }), 421000);
    expect(result.currentTrack?.id).toBe('a'); expect(result.positionMs).toBe(5000);
    const huge = resolveSpotifyPlayback(state({ repeat: 'context' }), 210000000001000);
    expect(huge.currentTrack?.id).toBe('a'); expect(huge.positionMs).toBe(5000);
  });
  it('keeps an unqueued source track rather than guessing a different queue', () => {
    const standalone = track('standalone');
    const result = resolveSpotifyPlayback(state({ currentTrack: standalone, repeat: 'context', playback: playbackAnchor(standalone, 0, 0, true) }), 70000);
    expect(result.currentTrack?.id).toBe('standalone'); expect(result.isPlaying).toBe(false);
  });
  it('does not skip a track with unknown duration during catch-up', () => {
    const unknown = track('u', 'unknown');
    const result = resolveSpotifyPlayback(state({ queue: [queue[0], unknown, queue[2]], repeat: 'context' }), 9999999);
    expect(result.currentTrack?.id).toBe('u'); expect(result.isPlaying).toBe(true);
  });
  it('rebases backwards clock changes without rewinding the last observed position', () => {
    const result = synchronizeSpotifyPlayback(state(), -1000, 11000);
    expect(result.positionMs).toBe(15000); expect(result.playback.anchorTimeMs).toBe(-1000);
    const next = spotifyPlaybackSnapshot({ ...state(), ...result }, 0);
    expect(next.positionMs).toBe(16000);
  });
  it('restores only an actually stored checkpoint rather than offline elapsed time', () => {
    const restored = restoreSpotifyPlayback(state({ playback: playbackAnchor(queue[0], 12345, 1000, true) }), 9999999);
    expect(restored.positionMs).toBe(12345); expect(restored.playback.anchorTimeMs).toBe(9999999);
  });
  it('compares anchors without treating zero/null timestamps as truthy flags', () => {
    const anchor = playbackAnchor(queue[0], 0, 0, true);
    expect(samePlaybackAnchor(anchor, { ...anchor })).toBe(true);
    expect(samePlaybackAnchor({ ...anchor, anchorTimeMs: null }, anchor)).toBe(false);
  });
  it.each([[0, '0:00'], [15000, '0:15'], [3723000, '1:02:03'], [-5, '0:00'], [NaN, '0:00']])('formats position %s', (value, result) => expect(formatSpotifyPosition(value)).toBe(result));
  it('uses actual client geometry for pointer positions with explicit invalid cases', () => {
    expect(spotifySeekPosition(150, 100, 200, 60000)).toBe(15000);
    expect(spotifySeekPosition(90, 100, 200, 60000)).toBe(0);
    expect(spotifySeekPosition(400, 100, 200, 60000)).toBe(60000);
    expect(spotifySeekPosition(150, 100, 0, 60000)).toBeNull();
    expect(spotifySeekPosition(NaN, 100, 200, 60000)).toBeNull();
  });
});
