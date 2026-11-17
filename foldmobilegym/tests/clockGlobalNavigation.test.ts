import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { canOpenClockMenu, isClockMenuOpen, getClockGlobalBackFallback } from '../system/Clock/globalNavigation';
import { normalizeClockEntryRoute } from '../system/Clock/entryRoute';
describe('Clock global menu/settings navigation', () => {
  it('does not focus a background menu when another split pane is active', () => {
    const source = readFileSync(new URL('../system/Clock/components/ClockGlobalMenu.tsx', import.meta.url), 'utf8');
    expect(source).toContain('if (initialOwner.current()) first.current?.focus');
  });
  it.each(['', '?foo=bar'])('opens only from the unblocked alarm base: %s', search => {
    expect(canOpenClockMenu('/alarm', search)).toBe(true); expect(isClockMenuOpen('/alarm', search)).toBe(false);
  });
  it.each(['?menu=more', '?menu=', '?menu=other', '?panel=add', '?panel=quick', '?selection=alarms'])('blocks opening over another state: %s', search => {
    expect(canOpenClockMenu('/alarm', search)).toBe(false);
  });
  it('recognizes the explicit menu without confusing other pages or overlays', () => {
    expect(isClockMenuOpen('/alarm', '?menu=more')).toBe(true);
    for (const path of ['/world', '/settings', '/alarm/ringing/id']) expect(isClockMenuOpen(path, '?menu=more')).toBe(false);
    for (const search of ['?menu=other', '?menu=more&panel=quick', '?menu=more&selection=alarms']) expect(isClockMenuOpen('/alarm', search)).toBe(false);
  });
  it('reconstructs cold menu/settings parents but preserves an actual existing history entry', () => {
    expect(getClockGlobalBackFallback('/settings', '')).toBe('/alarm');
    expect(getClockGlobalBackFallback('/alarm', '?menu=more')).toBe('/alarm');
    expect(getClockGlobalBackFallback('/alarm', '')).toBeNull();
    for (const previous of [{ pathname: '/alarm', search: '' }, { pathname: '/world', search: '' }]) {
      expect(getClockGlobalBackFallback('/settings', '', previous)).toBeNull();
      expect(getClockGlobalBackFallback('/alarm', '?menu=more', previous)).toBeNull();
    }
  });
  it.each([
    ['/', '/alarm'], ['/?menu=more', '/alarm?menu=more'], ['/settings', '/settings'],
    ['/alarm?menu=other', '/alarm'], ['/alarm?menu=more&panel=quick&alarmId=a1', '/alarm?panel=quick&alarmId=a1'],
    ['/alarm?selection=alarms&menu=more', '/alarm?selection=alarms'], ['/alarm?menu=bad#section', '/alarm#section'],
    ['/world?menu=other', '/world?menu=other'],
  ])('normalizes external entry %s without disturbing existing alarm/world payloads', (input, expected) => {
    expect(normalizeClockEntryRoute(input)).toBe(expected);
  });
});
