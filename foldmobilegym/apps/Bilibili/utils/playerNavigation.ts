interface PlayerLocation { pathname: string; search: string; key: string; state?: unknown }
export function getPlaybackEntryKey(location: Pick<PlayerLocation, 'key' | 'state'>) {
  const state = location.state as { bilibiliPlaybackEntry?: unknown } | null;
  return typeof state?.bilibiliPlaybackEntry === 'string' ? state.bilibiliPlaybackEntry : location.key;
}
export function isVideoFullscreen(pathname: string, search: string) {
  return /^\/video\/[^/]+$/.test(pathname) && new URLSearchParams(search).get('view') === 'fullscreen';
}
export function getVideoFullscreenFallback(location: Pick<PlayerLocation, 'pathname' | 'search'>, previous?: { pathname: string; search: string }) {
  if (!isVideoFullscreen(location.pathname, location.search)) return null;
  const params = new URLSearchParams(location.search);
  const tab = params.get('tab') === 'comment' ? 'comment' : 'intro';
  if (previous?.pathname === location.pathname && !isVideoFullscreen(previous.pathname, previous.search)
      && (new URLSearchParams(previous.search).get('tab') || 'intro') === tab) return null;
  return `${location.pathname}?tab=${tab}`;
}

export function isVideoCommentPanel(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  return /^\/video\/[^/]+$/.test(pathname) && params.get('tab') === 'comment'
    && ['compose', 'thread'].includes(params.get('commentPanel') || '');
}
export function getVideoCommentPanelFallback(location: Pick<PlayerLocation, 'pathname' | 'search'>, previous?: { pathname: string; search: string }) {
  if (!isVideoCommentPanel(location.pathname, location.search)) return null;
  if (previous?.pathname === location.pathname && new URLSearchParams(previous.search).get('tab') === 'comment'
    && !isVideoCommentPanel(previous.pathname, previous.search)) return null;
  return `${location.pathname}?tab=comment`;
}
