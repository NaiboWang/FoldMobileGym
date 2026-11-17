import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAYER_SOURCE, isPlayerSource, normalizePlayerSource, parallelSourceTarget } from '../apps/Spotify/utils/playerWorkspace';
import { NAVIGATION_DECLARATION as nav } from '../apps/Spotify/navigation.declaration';

describe('Spotify source-owned parallel player navigation', () => {
  it.each(['/search', '/search/input?q=Jay&filter=songs', '/playlist/abc?sheet=track_menu', '/artist/Jay', '/library', '/settings/playback'])('retains a real local source: %s', source => {
    expect(isPlayerSource(source)).toBe(true);
    expect(normalizePlayerSource(source)).toBe(source);
  });
  it.each([null, '', '//example.com', 'https://example.com/search', '/player', '/player?source=/player', '/signup', '/unknown', '/search#hash', '/\\example.com/search'])('rejects recursive, foreign or unsupported sources: %s', source => {
    expect(normalizePlayerSource(source)).toBe(DEFAULT_PLAYER_SOURCE);
  });
  it('normalizes the root source to its mandatory tab without changing existing queries', () => {
    expect(normalizePlayerSource('/')).toBe('/?tab=all');
    expect(normalizePlayerSource('/?tab=music')).toBe('/?tab=music');
  });
  it('wraps source navigation while retaining independent player sheets', () => {
    const result = new URL(parallelSourceTarget('?layout=parallel&source=%2F&sheet=queue', '/search/input?q=Jay'), 'http://local');
    expect(result.pathname).toBe('/player');
    expect(result.searchParams.get('source')).toBe('/search/input?q=Jay');
    expect(result.searchParams.get('layout')).toBe('parallel');
    expect(result.searchParams.get('sheet')).toBe('queue');
  });
  it('does not rewrap an explicit player opening or authentication navigation', () => {
    expect(parallelSourceTarget('?layout=parallel', '/player?source=%2Fsearch')).toBe('/player?source=%2Fsearch');
    expect(parallelSourceTarget('?layout=parallel', '/login-landing')).toBe('/login-landing');
  });
  it('declares parallel panels and retains source/layout on every player sheet navigation', () => {
    const route = nav.routes.find(route => route.path === '/player')!;
    expect(route.queryParams).toEqual({ trackId: 'string', source: 'string' });
    expect(route.uiStates.some(state => state.search.layout === 'parallel')).toBe(true);
    for (const transition of nav.transitions.filter(t => t.id.startsWith('player.') && t.to === '/player')) {
      expect('preserveParams' in transition && transition.preserveParams.includes('source')).toBe(true);
      if (!transition.id.startsWith('player.layout.')) expect('preserveParams' in transition && transition.preserveParams.includes('layout')).toBe(true);
    }
  });
});
