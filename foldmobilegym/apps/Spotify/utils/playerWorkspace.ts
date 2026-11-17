// App-local parallel view. Shared-canvas padding and OS split Tasks are not App chrome.
const SOURCE_ROUTES = [
  /^\/$/, /^\/(?:search(?:\/input)?|library|premium(?:\/payment)?|create|liked-songs|profile|history|new-releases)$/,
  /^\/(?:playlist|artist|category|video)\/[^/]+$/,
  /^\/settings(?:\/(?:account|content|playback|privacy|notifications|apps|data-saver|quality|about))?$/,
];
export const DEFAULT_PLAYER_SOURCE = '/?tab=all';
export const PLAYER_PARALLEL_MIN_WIDTH = 600;

export function isPlayerSource(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return false;
  try {
    const url = new URL(value, 'http://spotify.local');
    return url.origin === 'http://spotify.local' && !url.hash && SOURCE_ROUTES.some(pattern => pattern.test(url.pathname));
  } catch { return false; }
}

export function normalizePlayerSource(value: string | null | undefined): string {
  if (!value || !isPlayerSource(value)) return DEFAULT_PLAYER_SOURCE;
  const url = new URL(value, 'http://spotify.local');
  if (url.pathname === '/' && !url.searchParams.has('tab')) url.searchParams.set('tab', 'all');
  return url.pathname + url.search;
}

export function parallelSourceTarget(playerSearch: string, target: string): string {
  // Opening a full player or leaving for authentication is a real outer navigation.
  if (!isPlayerSource(target)) return target;
  const query = new URLSearchParams(playerSearch);
  query.set('layout', 'parallel');
  query.set('source', normalizePlayerSource(target));
  return '/player?' + query.toString();
}
