import { describe, expect, it } from 'vitest';
import { NAVIGATION_DECLARATION } from '../system/Calendar/navigation.declaration';
describe('Calendar editor reminder sheets', () => {
  it.each([
    ['/new-event', 'reminder.new.open', 'calendar.new.reminder.select'],
    ['/event/:eventId/edit', 'reminder.edit.open', 'calendar.edit.reminder.select'],
  ])('declares a separate modal state and scroll surface for %s', (path, transition, action) => {
    const route = NAVIGATION_DECLARATION.routes.find(route => route.path === path)!;
    const names = route.scrollContainers.map(scroll => scroll.name);
    expect(names).toEqual(['main', 'backgroundMain', 'master', 'monthGrid', 'monthContent', 'weekColumns', 'weekAllDay', 'reminder', 'type', 'discard']);
    expect(new Set(names).size).toBe(names.length);
    const modal = route.uiStates.find(state => state.search && 'sheet' in state.search && state.search.sheet === 'reminder')!;
    expect('actions' in modal && modal.actions).toContainEqual({ id: action, label: '选择提醒提前量', behavior: 'other', paramsSchema: { minutes: 'string' } });
    expect('actions' in modal && modal.actions).toContainEqual({
      id: path === '/new-event' ? 'calendar.new.reminder.confirm' : 'calendar.edit.reminder.confirm',
      label: path === '/new-event' ? '确认新建日程提醒' : '确认编辑日程提醒', behavior: 'submit',
    });
    expect(NAVIGATION_DECLARATION.transitions.find(item => item.id === transition)).toMatchObject({
      from: { path, search: { sheet: null } }, to: path, search: { sheet: 'reminder' }, mode: 'push',
    });
  });
  it('retains the existing event identity when opening its reminder sheet', () => {
    expect(NAVIGATION_DECLARATION.transitions.find(item => item.id === 'reminder.edit.open')?.params).toEqual({ eventId: 'string' });
  });
  it('does not advertise editor-to-detail navigation behind the reminder sheet', () => {
    const from = NAVIGATION_DECLARATION.transitions.find(item => item.id === 'event.open')!.from;
    expect(from).toContainEqual({ path: '/new-event', search: { sheet: null } });
    expect(from).toContainEqual({ path: '/event/:eventId/edit', search: { sheet: null } });
    expect(from).not.toContain('/new-event');
  });
  it.each([
    ['/new-event', 'type.new.open', 'calendar.new.type.select'],
    ['/event/:eventId/edit', 'type.edit.open', 'calendar.edit.type.select'],
  ])('declares the compact editor type picker for %s', (path, transition, action) => {
    const route = NAVIGATION_DECLARATION.routes.find(route => route.path === path)!;
    const modal = route.uiStates.find(state => state.search && 'sheet' in state.search && state.search.sheet === 'type')!;
    expect('actions' in modal && modal.actions).toContainEqual({
      id: action, label: path === '/new-event' ? '选择新建日程类型' : '选择编辑日程类型',
      behavior: 'other', paramsSchema: { type: 'string' },
    });
    expect(NAVIGATION_DECLARATION.transitions.find(item => item.id === transition)).toMatchObject({
      from: { path, search: { sheet: null } }, to: path, search: { sheet: 'type' }, mode: 'push',
    });
  });
  it.each([
    ['/new-event', 'discard.new.open', 'calendar.new.discard.submit'],
    ['/event/:eventId/edit', 'discard.edit.open', 'calendar.edit.discard.submit'],
  ])('declares the route-backed discard confirmation for %s', (path, transition, action) => {
    const route = NAVIGATION_DECLARATION.routes.find(route => route.path === path)!;
    const modal = route.uiStates.find(state => state.search && 'sheet' in state.search && state.search.sheet === 'discard')!;
    expect('actions' in modal && modal.actions).toContainEqual({
      id: action, label: path === '/new-event' ? '放弃新建日程更改' : '放弃编辑日程更改', behavior: 'submit',
    });
    expect(NAVIGATION_DECLARATION.transitions.find(item => item.id === transition)).toMatchObject({
      from: { path, search: { sheet: null } }, to: path, search: { sheet: 'discard' }, mode: 'push',
    });
  });
});
