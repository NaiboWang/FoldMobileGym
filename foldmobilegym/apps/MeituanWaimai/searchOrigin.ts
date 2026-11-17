/** A literal local parent route, never an external URL or an executable redirect. */
export function readMeituanOrigin(search: string): { path: string; kind: 'home' | 'search' } | null {
  const route = new URLSearchParams(search);
  if (route.getAll('origin').length !== 1) return null;
  const origin = route.get('origin');
  if (origin === '/') return { path: origin, kind: 'home' };
  if (!origin?.startsWith('/?') || origin.includes('#') || origin.length === 2) return null;
  const params = new URLSearchParams(origin.slice(2));
  if (params.has('search') && params.get('search') !== 'open') return null;
  if ([...params.keys()].some(key => !['q', 'category', 'search'].includes(key))) return null;
  const category = params.get('category');
  if (category && !['all', 'food', 'drinks', 'market'].includes(category)) return null;
  if ([...params.keys()].some(key => params.getAll(key).length !== 1)) return null;
  return { path: origin, kind: params.get('search') === 'open' || Boolean(params.get('q')) ? 'search' : 'home' };
}

export function readMeituanSearchOrigin(search: string): string | null {
  const origin = readMeituanOrigin(search);
  return origin?.kind === 'search' ? origin.path : null;
}
