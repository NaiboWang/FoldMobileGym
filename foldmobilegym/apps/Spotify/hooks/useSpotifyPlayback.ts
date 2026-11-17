import { useSyncExternalStore } from 'react';
import { spotifyPlaybackRuntime } from '../state';

export function useSpotifyPlayback() {
  return useSyncExternalStore(spotifyPlaybackRuntime.subscribe, spotifyPlaybackRuntime.getSnapshot, spotifyPlaybackRuntime.getSnapshot);
}
