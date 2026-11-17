const normalized = (search: string) => { const params = new URLSearchParams(search); params.sort(); return params.toString(); };

/** Cold result dialogs own the visible result, not an unrelated seeded home entry. */
export function railwayQueryModalBackFallback(pathname: string, search: string, previous?: { pathname: string; search: string }): string | null {
  if (pathname !== '/query-result') return null;
  const params = new URLSearchParams(search);
  const key = params.get('filterPanel') === 'open' ? 'filterPanel' : params.get('swapDialog') === 'open' ? 'swapDialog' : null;
  if (!key) return null;
  params.delete(key);
  const parentSearch = params.size ? `?${params.toString()}` : '';
  return previous?.pathname === pathname && normalized(previous.search) === normalized(parentSearch) ? null : pathname + parentSearch;
}
