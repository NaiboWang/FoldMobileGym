/** Global app menu/settings are separate from per-alarm editing overlays. */
export function canOpenClockMenu(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  return pathname === '/alarm' && params.get('menu') === null
    && params.get('panel') === null && params.get('selection') === null;
}

export function isClockMenuOpen(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  return pathname === '/alarm' && params.get('menu') === 'more'
    && params.get('panel') === null && params.get('selection') === null;
}

export function getClockGlobalBackFallback(pathname: string, search: string, previous?: { pathname: string; search: string }) {
  if (!previous && (pathname === '/settings' || isClockMenuOpen(pathname, search))) return '/alarm';
  return null;
}
