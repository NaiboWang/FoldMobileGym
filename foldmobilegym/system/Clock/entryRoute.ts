/** The Clock's declared home is /alarm; / remains a compatibility entry alias. */
export function normalizeClockEntryRoute(path: string): string {
  const canonical = path === '/' || path === '/?' ? '/alarm' : path.startsWith('/?') ? '/alarm' + path.slice(1) : path;
  const hashAt = canonical.indexOf('#');
  const route = hashAt < 0 ? canonical : canonical.slice(0, hashAt);
  const hash = hashAt < 0 ? '' : canonical.slice(hashAt);
  const queryAt = route.indexOf('?');
  if (queryAt < 0 || route.slice(0, queryAt) !== '/alarm') return canonical;
  const params = new URLSearchParams(route.slice(queryAt + 1));
  if (!params.has('menu') || (params.get('menu') === 'more' && !params.has('panel') && !params.has('selection'))) return canonical;
  // The global menu must never stack over an alarm editor/selection, nor turn an
  // unknown external menu value into a visible-but-inoperable alarm page.
  params.delete('menu');
  const search = params.toString();
  return '/alarm' + (search ? '?' + search : '') + hash;
}
