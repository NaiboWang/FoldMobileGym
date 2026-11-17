/** Only the recorded favorites provenance selects a standalone contact surface. */
export function isFavoriteContactOrigin(search: string | URLSearchParams): boolean {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  return params.get('fav') === 'true';
}

export function contactOriginSuffix(search: string | URLSearchParams): string {
  const source = typeof search === 'string' ? new URLSearchParams(search) : search;
  const preserved = new URLSearchParams();
  if (isFavoriteContactOrigin(source)) preserved.set('fav', 'true');
  if (source.has('q')) preserved.set('q', source.get('q') ?? '');
  const suffix = preserved.toString();
  return suffix ? `?${suffix}` : '';
}

export function contactMenuBackFallback(pathname: string, search: string, previous?: { pathname: string; search: string }): string | null {
  const params = new URLSearchParams(search);
  if (!/^\/contact\/[^/]+$/.test(pathname) || params.get('menu') !== 'more') return null;
  const before = new URLSearchParams(previous?.search);
  const sameParent = previous?.pathname === pathname && !before.has('menu') && !before.has('modal')
    && contactOriginSuffix(before) === contactOriginSuffix(params);
  return sameParent ? null : pathname + contactOriginSuffix(params);
}
