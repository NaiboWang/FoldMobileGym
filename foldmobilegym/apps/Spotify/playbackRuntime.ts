import { spotifyPlaybackSnapshot, type SpotifyPlaybackSnapshot, type SpotifyPlaybackState } from './playback';

interface RuntimeHost {
  getState: () => SpotifyPlaybackState;
  subscribe: (listener: () => void) => () => void;
  synchronize: (now: number, previousNow?: number) => void;
  publish: (snapshot: SpotifyPlaybackSnapshot, state: SpotifyPlaybackState) => void;
}
interface RuntimeClock {
  now: () => number;
  observe: (listener: () => void) => () => void;
  observeBoot: (listener: () => void) => () => void;
  schedule: (listener: () => void) => () => void;
}
/** One eager App-owned simulator runtime, independent of any player/page mount. */
export function createSpotifyPlaybackRuntime(host: RuntimeHost, clock: RuntimeClock) {
  let active = true, synchronizing = false, lastNow = clock.now();
  let snapshot = spotifyPlaybackSnapshot(host.getState(), lastNow);
  let publishedTrack = host.getState().currentTrack;
  const listeners = new Set<() => void>();
  const refresh = (force = false) => {
    if (!active || synchronizing) return;
    synchronizing = true;
    try {
      const now = clock.now();
      host.synchronize(now, lastNow);
      const state = host.getState(), next = spotifyPlaybackSnapshot(state, now);
      const changed = snapshot.trackId !== next.trackId || snapshot.positionMs !== next.positionMs
        || snapshot.durationMs !== next.durationMs || snapshot.isPlaying !== next.isPlaying;
      if (changed) snapshot = next;
      if (changed || force || publishedTrack !== state.currentTrack) {
        host.publish(snapshot, state);
        publishedTrack = state.currentTrack;
      }
      lastNow = now;
      if (changed) [...listeners].forEach(listener => listener());
    } finally { synchronizing = false; }
  };
  const offStore = host.subscribe(() => refresh());
  const offClock = clock.observe(() => refresh());
  const offBoot = clock.observeBoot(() => refresh(true));
  const offTimer = clock.schedule(() => refresh());
  refresh(true);
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { if (!active) return () => {}; listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh: () => refresh(),
    dispose: () => { active = false; offStore(); offClock(); offBoot(); offTimer(); listeners.clear(); },
  };
}
