export type ClockSelectionMode = 'alarms' | 'cities';

export function getClockSelectionMode(pathname: string, search: string): ClockSelectionMode | null {
  if (pathname !== '/alarm' && pathname !== '/world') return null;
  const params = new URLSearchParams(search);
  if (params.has('panel')) return null;
  const value = params.get('selection');
  if (pathname === '/alarm' && value === 'alarms') return 'alarms';
  if (pathname === '/world' && value === 'cities') return 'cities';
  return null;
}

/** A cold selection entry still closes to its own list, never another Clock tab. */
export function getClockSelectionBackFallback(pathname: string, search: string,
  previous?: { pathname: string; search: string }) {
  if (!getClockSelectionMode(pathname, search)) return null;
  return previous?.pathname === pathname && !previous.search ? null : pathname;
}
