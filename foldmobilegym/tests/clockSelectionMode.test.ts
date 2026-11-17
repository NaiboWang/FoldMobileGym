import { describe, expect, it } from 'vitest';
import { getClockSelectionMode, getClockSelectionBackFallback } from '../system/Clock/selectionMode';

describe('Clock selection mode is URL-owned', () => {
  it.each([
    ['/alarm', '?selection=alarms', 'alarms'],
    ['/world', '?selection=cities', 'cities'],
  ] as const)('recognizes %s selection', (path, search, expected) => {
    expect(getClockSelectionMode(path, search)).toBe(expected);
  });
  it.each([
    ['/alarm', ''], ['/alarm', '?selection=cities'], ['/world', '?selection=alarms'],
    ['/timer', '?selection=alarms'], ['/alarm/ringing/id', '?selection=alarms'],
    ['/alarm', '?selection=alarms&panel=edit'], ['/world', '?selection=cities&panel=cities'],
  ] as const)('rejects invalid selection %s %s', (path, search) => {
    expect(getClockSelectionMode(path, search)).toBeNull();
  });
  it.each([['/alarm', 'alarms'], ['/world', 'cities']] as const)('reconstructs only the own list parent of %s', (pathname, mode) => {
    const search = '?selection=' + mode;
    expect(getClockSelectionBackFallback(pathname, search)).toBe(pathname);
    expect(getClockSelectionBackFallback(pathname, search, { pathname, search: '' })).toBeNull();
    expect(getClockSelectionBackFallback(pathname, search, { pathname: '/timer', search: '' })).toBe(pathname);
    expect(getClockSelectionBackFallback(pathname, search, { pathname, search })).toBe(pathname);
    expect(getClockSelectionBackFallback(pathname, '')).toBeNull();
  });
});
