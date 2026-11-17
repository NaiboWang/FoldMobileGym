import { describe, expect, it } from 'vitest';
import * as TimeService from '../os/TimeService';
import { monthSwipeDelta, shiftMonthTimestamp } from '../system/Calendar/monthNavigation';
import { NAVIGATION_DECLARATION } from '../system/Calendar/navigation.declaration';

describe('Calendar month paging', () => {
  it.each([[47, 0, 0], [48, 0, -1], [-48, 0, 1], [100, 100, 0], [60, 50, 0], [-120, 30, 1]])
    ('classifies screen delta %s,%s as %s', (dx, dy, expected) => {
      expect(monthSwipeDelta(dx, dy)).toBe(expected);
    });
  it.each([[2026, 0, 31, 1, 2026, 1, 28], [2024, 0, 31, 1, 2024, 1, 29], [2026, 0, 12, -1, 2025, 11, 12], [2026, 11, 12, 1, 2027, 0, 12]])
    ('clamps a month shift across calendar boundaries', (y, m, d, delta, ey, em, ed) => {
      const result = TimeService.fromTimestamp(shiftMonthTimestamp(TimeService.fromLocalParts(y, m, d, 9, 15).getTime(), delta));
      expect([result.getFullYear(), result.getMonth(), result.getDate(), result.getHours(), result.getMinutes()]).toEqual([ey, em, ed, 9, 15]);
    });
});

describe('Calendar view history', () => {
  it('replaces a bounded view state instead of adding back entries', () => {
    expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === 'home.view.switch')).toMatchObject({
      from: [{ path: '/', search: { menu: null, view: null } }, { path: '/', search: { menu: null, view: '*' } }], to: '/', mode: 'replace',
      cases: [
        expect.objectContaining({ search: { view: 'year' } }),
        expect.objectContaining({ search: { view: 'week' } }),
        expect.objectContaining({ search: { view: 'day' } }),
        expect.objectContaining({ search: { view: 'agenda' } }),
        expect.objectContaining({ when: { op: 'always' }, search: {} }),
      ],
    });
  });
  it('preserves each view while a menu is open and declares each menu combination', () => {
    expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === 'home.menu.open')?.preserveParams).toEqual(['view']);
    const states = NAVIGATION_DECLARATION.routes.find(r => r.path === '/')!.uiStates;
    for (const view of ['year', 'week', 'day', 'agenda']) {
      expect(states).toContainEqual(expect.objectContaining({ search: { view } }));
      expect(states).toContainEqual(expect.objectContaining({ search: { view, menu: 'open' } }));
    }
  });
  it('models date-jump submission and month paging as explicit actions', () => {
    expect(NAVIGATION_DECLARATION.routes.find(r => r.path === '/date-jump')?.uiStates[0].actions)
      .toContainEqual(expect.objectContaining({ id: 'calendar.dateJump.submit', behavior: 'submit' }));
    expect(NAVIGATION_DECLARATION.routes.find(r => r.path === '/')?.uiStates[0].actions)
      .toContainEqual(expect.objectContaining({ id: 'calendar.home.month.shift', behavior: 'other', paramsSchema: { delta: 'number' } }));
  });
  it('exposes agenda-entry navigation only on views that actually render it', () => {
    expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === 'event.open')?.from).toEqual([
      { path: '/', search: { menu: null, view: null } }, { path: '/', search: { menu: null, view: 'day' } }, { path: '/', search: { menu: null, view: 'week' } }, '/search',
      { path: '/new-event', search: { sheet: null } }, { path: '/event/:eventId/edit', search: { sheet: null } },
    ]);
  });
});
