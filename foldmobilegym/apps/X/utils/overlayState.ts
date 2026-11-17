export type XSheet = 'retweet' | 'replySort' | 'quoteSort';
const isStatus = (pathname: string) => /^\/status\/[^/]+$/.test(pathname);
export function getXSheet(pathname: string, search: string): XSheet | null {
  const params = new URLSearchParams(search), sheet = params.get('sheet');
  if (sheet === 'retweet' && (['/', '/profile', '/search/input'].includes(pathname)
    || /^\/user\/[^/]+$/.test(pathname) || isStatus(pathname))) return sheet;
  if (sheet === 'replySort' && isStatus(pathname)) return sheet;
  if (sheet === 'quoteSort' && /^\/status\/[^/]+\/activity$/.test(pathname)
    && params.get('tab') === 'quotes') return sheet;
  return null;
}
export function getXSheetParent(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete('sheet'); params.delete('sheetPostId');
  const query = params.toString();
  return pathname + (query ? `?${query}` : '');
}
export function getXSheetBackFallback(pathname: string, search: string,
  previous?: { pathname: string; search: string }): string | null {
  if (!getXSheet(pathname, search)) return null;
  const parent = getXSheetParent(pathname, search);
  const normalize = (query: string) => { const value = new URLSearchParams(query); value.sort(); return value.toString(); };
  return previous && previous.pathname === pathname
    && normalize(previous.search) === normalize(parent.slice(pathname.length)) ? null : parent;
}
/** Sheet-only pushes must not recreate text, tab, virtualizer or scroll owners. */
export function getXChildPageKey(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete('sheet'); params.delete('sheetPostId');
  if (/^\/status\/[^/]+\/activity$/.test(pathname)) params.delete('tab');
  const query = params.toString();
  return pathname + (query ? `?${query}` : '');
}
