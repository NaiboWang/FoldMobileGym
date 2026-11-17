import { describe, expect, it } from 'vitest';
import { createSpotifyPlaybackRuntime } from '../apps/Spotify/playbackRuntime';
import { playbackAnchor, samePlaybackAnchor, synchronizeSpotifyPlayback, type SpotifyPlaybackSnapshot, type SpotifyPlaybackState } from '../apps/Spotify/playback';
const track = { id: 'local', duration: '1:00', title: 'Local fixture', artist: 'Local', cover: '' };
function setup() {
  let now = 0, state: SpotifyPlaybackState = { currentTrack: track, isPlaying: true, queue: [track], repeat: 'off', playback: playbackAnchor(track, 0, 0, true) };
  const storeListeners = new Set<() => void>(), clockListeners = new Set<() => void>(), bootListeners = new Set<() => void>();
  let timer = () => {}, disposedTimer = false;
  const publications: SpotifyPlaybackSnapshot[] = [];
  const write = (next: SpotifyPlaybackState) => { state = next; [...storeListeners].forEach(listener => listener()); };
  const runtime = createSpotifyPlaybackRuntime({
    getState: () => state,
    subscribe: listener => { storeListeners.add(listener); return () => { storeListeners.delete(listener); }; },
    synchronize: (at, previous) => {
      const next = synchronizeSpotifyPlayback(state, at, previous);
      if (state.currentTrack !== next.currentTrack || state.isPlaying !== next.isPlaying || !samePlaybackAnchor(state.playback, next.playback)) write({ ...state, ...next });
    },
    publish: snapshot => { publications.push(snapshot); },
  }, {
    now: () => now,
    observe: listener => { clockListeners.add(listener); return () => { clockListeners.delete(listener); }; },
    observeBoot: listener => { bootListeners.add(listener); return () => { bootListeners.delete(listener); }; },
    schedule: listener => { timer = listener; return () => { disposedTimer = true; }; },
  });
  return { runtime, publications, state: () => state, write, tick: () => timer(),
    time: (value: number) => { now = value; [...clockListeners].forEach(listener => listener()); },
    boot: () => { [...bootListeners].forEach(listener => listener()); },
    resources: () => ({ store: storeListeners.size, clock: clockListeners.size, boot: bootListeners.size, disposedTimer }),
  };
}
describe('Spotify App-owned runtime, no player mount required', () => {
  it('publishes initial and precise time changes without rewriting anchors on each poll', () => {
    const s = setup(), state = s.state(), initial = s.runtime.getSnapshot();
    s.tick(); expect(s.runtime.getSnapshot()).toBe(initial); expect(s.publications).toHaveLength(1);
    s.time(15000); expect(s.runtime.getSnapshot().positionMs).toBe(15000); expect(s.publications.at(-1)?.positionMs).toBe(15000);
    expect(s.state()).toBe(state); s.runtime.dispose();
  });
  it('continues and stops naturally without UI listeners', () => {
    const s = setup(); s.time(60000);
    expect(s.state().isPlaying).toBe(false); expect(s.state().playback?.anchorPositionMs).toBe(60000);
    expect(s.publications.at(-1)?.isPlaying).toBe(false); s.runtime.dispose();
  });
  it('reacts to play/pause changes and keeps stable paused snapshots', () => {
    const s = setup(); s.time(10000);
    s.write({ ...s.state(), isPlaying: false, playback: playbackAnchor(track, 10000, 10000, false) });
    const paused = s.runtime.getSnapshot(); s.time(40000); s.tick();
    expect(s.runtime.getSnapshot()).toBe(paused); expect(paused.positionMs).toBe(10000); s.runtime.dispose();
  });
  it('rebases backwards time and force-republishes after OS reset boot', () => {
    const s = setup(); s.time(15000); s.time(-1000); expect(s.runtime.getSnapshot().positionMs).toBe(15000);
    const before = s.publications.length; s.boot(); expect(s.publications).toHaveLength(before + 1);
    expect(s.publications.at(-1)?.positionMs).toBe(15000); s.runtime.dispose();
  });
  it('refreshes metadata, cleans every observer and rejects queued callbacks after disposal', () => {
    const s = setup(); const listener = () => {}; const off = s.runtime.subscribe(listener); off();
    s.write({ ...s.state(), currentTrack: { ...track, title: 'Corrected metadata' } }); expect(s.publications).toHaveLength(2);
    s.runtime.dispose(); const before = s.publications.length; s.time(10000); s.tick(); s.runtime.refresh();
    expect(s.publications).toHaveLength(before); expect(s.resources()).toEqual({ store: 0, clock: 0, boot: 0, disposedTimer: true });
  });
});
