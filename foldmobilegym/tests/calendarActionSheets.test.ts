import { describe, expect, it } from 'vitest';
import { NAVIGATION_DECLARATION } from '../system/Calendar/navigation.declaration';

describe('Calendar home and settings sheet ownership', () => {
  it('pushes More as a home state that Back can close', () => {
    expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === 'home.menu.open')).toMatchObject({
      from: [{ path: '/', search: { menu: null, view: null } }, { path: '/', search: { menu: null, view: '*' } }], to: '/', search: { menu: 'open' }, mode: 'push',
    });
    expect(NAVIGATION_DECLARATION.routes.find(r => r.path === '/')?.uiStates).toContainEqual({
      id: 'calendar.home.menu', search: { menu: 'open' }, description: '日历更多菜单',
    });
  });
  it.each(['reminder', 'allday', 'later'])('pushes %s without replacing the settings parent', sheet => {
    expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === `settings.${sheet}.open`)).toMatchObject({
      from: { path: '/settings', search: { sheet: null } }, to: '/settings', search: { sheet }, mode: 'push',
    });
    expect(NAVIGATION_DECLARATION.routes.find(r => r.path === '/settings')?.uiStates.find(s => s.search.sheet === sheet)?.actions)
      .toContainEqual(expect.objectContaining({ id: `calendar.settings.${sheet}.submit`, behavior: 'submit', paramsSchema: { value: 'string' } }));
  });
  it('replaces the consumed menu when choosing a destination, so returning does not reopen it', () => {
    for (const id of ['date-jump.open', 'date-calculate.open', 'subscription.open', 'desk-theme.open', 'settings.open']) {
      expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === id)).toMatchObject({
        from: [{ path: '/', search: { menu: 'open', view: null } }, { path: '/', search: { menu: 'open', view: '*' } }], mode: 'replace',
      });
    }
  });
  it('names the settings list and overlaid sheet separately', () => {
    for (const path of ['/', '/settings']) {
      expect(NAVIGATION_DECLARATION.routes.find(r => r.path === path)?.scrollContainers.map(c => c.name)).toEqual(path === '/' ? ['main', 'master', 'monthGrid', 'monthContent', 'weekColumns', 'weekAllDay', 'sheet'] : ['main', 'sheet']);
    }
  });
  it('does not advertise background Home navigation while More is open', () => {
    for (const id of ['new-event.open', 'search.open']) {
      expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === id)?.from).toEqual([
        { path: '/', search: { menu: null, view: null } }, { path: '/', search: { menu: null, view: '*' } },
      ]);
    }
    expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === 'event.open')?.from)
      .toContainEqual({ path: '/', search: { menu: null, view: 'day' } });
  });
});
