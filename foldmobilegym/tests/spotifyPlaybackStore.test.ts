import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spotifyPlaybackRuntime, useSpotifyStore } from '../apps/Spotify/state';
import * as TimeService from '../os/TimeService';
import MediaSessionService from '../os/MediaSessionService';
import BroadcastBus, { ACTION_BOOT_COMPLETED } from '../os/BroadcastBus';
import { playbackAnchor, restoreSpotifyPlayback } from '../apps/Spotify/playback';
const initial = useSpotifyStore.getState(), timeConfig = TimeService.getTimeConfig();
const tracks = [
  { id: 'a', title: 'Source A', artist: 'Local', cover: '', duration: '1:00' },
  { id: 'b', title: 'Source B', artist: 'Local', cover: '', duration: '2:00' },
  { id: 'c', title: 'Source C', artist: 'Local', cover: '', duration: '0:30' },
];
const time = async (value: number) => { TimeService.useSimulatedTime(value, false); await Promise.resolve(); await Promise.resolve(); };
beforeEach(async () => {
  await time(0);
  useSpotifyStore.setState({ ...initial, currentTrack: tracks[0], queue: tracks, isPlaying: false,
    playback: playbackAnchor(tracks[0], 0, 0, false), repeat: 'off' }, true);
});
afterEach(() => useSpotifyStore.setState(initial, true));
afterAll(() => { useSpotifyStore.setState(initial, true); TimeService.initTimeService(timeConfig); });
const get = useSpotifyStore.getState;
describe('actual Spotify state command integration', () => {
  it('pauses, resumes and reports one exact position through the OS session', async () => {
    get().togglePlay(); const before = get(); await time(15000);
    expect(get()).toBe(before); expect(spotifyPlaybackRuntime.getSnapshot().positionMs).toBe(15000);
    expect(MediaSessionService.getActiveSession()?.positionMs).toBe(15000);
    get().togglePlay(); expect(get().playback?.anchorPositionMs).toBe(15000);
    await time(25000); expect(spotifyPlaybackRuntime.getSnapshot().positionMs).toBe(15000);
    get().togglePlay(); await time(28000);
    expect(spotifyPlaybackRuntime.getSnapshot().positionMs).toBe(18000);
  });
  it('binds seeks to the source ID, rejects invalid values and does not edit other records', () => {
    const before = get(); get().togglePlay('other'); get().seekPlayback(NaN, 'a'); get().seekPlayback(10000, 'other'); expect(get()).toBe(before);
    get().seekPlayback(20000, 'a'); expect(get().isPlaying).toBe(false); expect(get().playback?.anchorPositionMs).toBe(20000);
    expect(get().queue).toBe(before.queue); expect(get().likedSongs).toBe(before.likedSongs); expect(get().playHistory).toBe(before.playHistory);
    get().seekPlayback(999999, 'a'); expect(get().playback?.anchorPositionMs).toBe(60000); expect(get().isPlaying).toBe(false);
    get().togglePlay(); expect(spotifyPlaybackRuntime.getSnapshot().positionMs).toBe(0);
  });
  it('preserves the same-track position and resets explicitly selected queue/skip entries', async () => {
    get().togglePlay(); await time(5000); get().playTrack(tracks[0]);
    expect(spotifyPlaybackRuntime.getSnapshot().positionMs).toBe(5000);
    get().skipToNext(); expect(get().currentTrack?.id).toBe('b'); expect(spotifyPlaybackRuntime.getSnapshot().positionMs).toBe(0);
    get().seekPlayback(20000, 'a'); expect(spotifyPlaybackRuntime.getSnapshot().positionMs).toBe(0);
    get().skipToPrevious(); expect(get().currentTrack?.id).toBe('a'); expect(spotifyPlaybackRuntime.getSnapshot().positionMs).toBe(0);
    get().setQueueWithTracks(tracks, 1); expect(get().currentTrack?.id).toBe('b'); expect(spotifyPlaybackRuntime.getSnapshot().positionMs).toBe(0);
  });
  it('keeps an unknown-duration same-track position without inventing an end or a seek target', async () => {
    const unknown = { ...tracks[0], id: 'unknown', duration: 'unknown' };
    get().playTrack(unknown); await time(5000); get().playTrack(unknown);
    expect(spotifyPlaybackRuntime.getSnapshot().positionMs).toBe(5000);
    const before = get(); get().seekPlayback(123, 'unknown'); get().syncPlayback(NaN);
    expect(get()).toBe(before); expect(MediaSessionService.getActiveSession()?.durationMs).toBe(0);
  });
  it('handles empty queues and absent current tracks without ghost playing state', () => {
    get().setQueueWithTracks([]); get().togglePlay(); get().seekPlayback(1000); get().skipToNext(); get().skipToPrevious();
    expect(get().currentTrack).toBeNull(); expect(get().isPlaying).toBe(false); expect(MediaSessionService.getActiveSession()).toBeNull();
  });
  it('advances in the background across multiple queue records and stops at the actual last end', async () => {
    get().togglePlay(); const history = get().playHistory; await time(65000);
    expect(get().currentTrack?.id).toBe('b'); expect(spotifyPlaybackRuntime.getSnapshot().positionMs).toBe(5000);
    await time(99999999);
    expect(get().currentTrack?.id).toBe('c'); expect(get().isPlaying).toBe(false); expect(spotifyPlaybackRuntime.getSnapshot().positionMs).toBe(30000);
    expect(get().playHistory).toBe(history);
  });
  it('rebases backwards time, checkpoints and restores without pretending offline execution', async () => {
    get().togglePlay(); await time(15000); await time(0);
    expect(spotifyPlaybackRuntime.getSnapshot().positionMs).toBe(15000);
    await time(2000); get().checkpointPlayback();
    expect(get().playback?.anchorPositionMs).toBe(17000);
    const restored = restoreSpotifyPlayback(get(), 999999999);
    expect(restored.positionMs).toBe(17000); expect(restored.playback.anchorTimeMs).toBe(999999999);
  });
  it('publishes accurate restored state on BOOT after the volatile session is cleared', async () => {
    get().seekPlayback(12345, 'a'); MediaSessionService.clearActiveSession();
    BroadcastBus.sendBroadcast({ action: ACTION_BOOT_COMPLETED }); await Promise.resolve();
    expect(MediaSessionService.getActiveSession()?.positionMs).toBe(12345);
    expect(MediaSessionService.getActiveSession()?.isPlaying).toBe(false);
  });
  it('keeps a persisted sleep deadline and stops at its exact simulated time', async () => {
    const longTrack = { ...tracks[0], duration: '10:00' };
    get().setQueueWithTracks([longTrack]);
    get().setSleepTimer(5);
    expect(get().settings.playback.sleepTimer).toBe(5);
    expect(get().settings.playback.sleepTimerDeadlineMs).toBe(300000);
    await time(299999);
    expect(get().isPlaying).toBe(true);
    expect(spotifyPlaybackRuntime.getSnapshot().positionMs).toBe(299999);
    await time(300000);
    expect(get().isPlaying).toBe(false);
    expect(spotifyPlaybackRuntime.getSnapshot().positionMs).toBe(300000);
    expect(get().settings.playback.sleepTimer).toBe(0);
    expect(get().settings.playback.sleepTimerDeadlineMs).toBe(0);
  });
  it('clears a timer explicitly and ignores unsupported duration values', () => {
    get().setSleepTimer(5);
    const deadline = get().settings.playback.sleepTimerDeadlineMs;
    get().setSleepTimer(7);
    expect(get().settings.playback.sleepTimerDeadlineMs).toBe(deadline);
    get().setSleepTimer(0);
    expect(get().settings.playback.sleepTimer).toBe(0);
    expect(get().settings.playback.sleepTimerDeadlineMs).toBe(0);
  });
});
