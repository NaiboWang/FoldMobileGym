import { describe, expect, it } from 'vitest';
import { calendarDeletionBackSteps } from '../system/Calendar/deleteNavigation';
import { NAVIGATION_DECLARATION } from '../system/Calendar/navigation.declaration';
const history = (...paths: string[]) => paths.map(pathname => ({ pathname }));
describe('Calendar deletion return ownership', () => {
  it('consumes confirmation and ordinary detail without leaving the parent search', () => {
    expect(calendarDeletionBackSteps(history('/', '/search', '/event/a', '/event/a'), 3, '/event/a')).toBe(2);
  });
  it('consumes only one entry for an explicitly opened confirmation', () => {
    expect(calendarDeletionBackSteps(history('/', '/settings', '/', '/event/a'), 3, '/event/a')).toBe(1);
  });
  it('skips consecutive detail/edit entries for the same identity, not another event', () => {
    expect(calendarDeletionBackSteps(history('/', '/event/b', '/event/a', '/event/a/edit', '/event/a'), 4, '/event/a')).toBe(3);
  });
  it('does not infer unknown history or navigate a negative number of steps', () => {
    expect(calendarDeletionBackSteps(undefined, 0, '/event/a')).toBe(1);
    expect(calendarDeletionBackSteps(history('/', ''), 2, '/event/a')).toBe(1);
  });
});
describe('Calendar delete declaration', () => {
  it('pushes a typed event-specific confirmation', () => {
    expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === 'event.delete.open')).toMatchObject({
      from: { path: '/event/:eventId', search: { deleteConfirm: null } }, to: '/event/:eventId',
      params: { eventId: 'string' }, search: { deleteConfirm: 'open' }, mode: 'push',
    });
  });
  it('excludes editing while confirming and declares a separate scroll surface', () => {
    expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === 'event.edit')?.from).toEqual({ path: '/event/:eventId', search: { deleteConfirm: null } });
    expect(NAVIGATION_DECLARATION.routes.find(r => r.path === '/event/:eventId')?.scrollContainers.map(c => c.name)).toEqual(['main', 'master', 'confirmation']);
  });
  it('retains search text in a dynamic query rather than one history entry per keystroke', () => {
    expect(NAVIGATION_DECLARATION.routes.find(r => r.path === '/search')?.queryParams).toEqual({ q: 'string' });
  });
});
