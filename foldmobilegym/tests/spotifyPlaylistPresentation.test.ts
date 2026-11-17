import { describe, expect, it } from 'vitest';
import type { SpotifyTrack } from '../apps/Spotify/types';
import { getPlaylistColor, orderFallbackTracks } from '../apps/Spotify/utils/playlistPresentation';

const tracks: SpotifyTrack[] = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({
  id,
  title: id,
  artist: 'Test',
  cover: '',
  duration: '3:00',
}));

describe('Spotify fallback playlist presentation', () => {
  it('keeps the same playlist track order across repeated opens without mutating the source', () => {
    const originalIds = tracks.map((track) => track.id);
    const first = orderFallbackTracks(tracks, 'playlist-1').map((track) => track.id);
    expect(orderFallbackTracks(tracks, 'playlist-1').map((track) => track.id)).toEqual(first);
    expect(tracks.map((track) => track.id)).toEqual(originalIds);
  });

  it('keeps the same background for a playlist', () => {
    expect(getPlaylistColor('playlist-1')).toBe(getPlaylistColor('playlist-1'));
    expect(getPlaylistColor('playlist-1')).toMatch(/^from-(purple|blue|red|orange|emerald|yellow)-800$/);
  });
});
