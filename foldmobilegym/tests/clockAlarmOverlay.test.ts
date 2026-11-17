import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getAlarmOverlay, getAlarmBackFallback } from '../system/Clock/alarmOverlay';
import { NAVIGATION_DECLARATION } from '../system/Clock/navigation.declaration';
const source = (file: string) => readFileSync(new URL('../system/Clock/' + file, import.meta.url), 'utf8');
describe('Clock alarm overlay history', () => {
  it.each(['add', 'edit', 'quick'])('derives %s from the URL', panel => {
    expect(getAlarmOverlay('/alarm', '?panel=' + panel + '&alarmId=alarm%2F1')).toMatchObject({ panel, alarmId: 'alarm/1', isEditor: panel !== 'quick', isEdit: panel === 'edit', isRepeat: false });
  });
  it.each(['add', 'edit'])('keeps %s mounted under the nested repeat sheet', panel => {
    expect(getAlarmOverlay('/alarm', '?repeat=open&panel=' + panel)).toMatchObject({ panel, isEditor: true, isRepeat: true });
  });
  it.each(['add', 'edit'])('keeps %s mounted under the nested ringtone sheet', panel => {
    expect(getAlarmOverlay('/alarm', `?ringtone=open&panel=${panel}&alarmId=a1`)).toMatchObject({ panel, alarmId: 'a1', isEditor: true, isRingtone: true });
  });
  it.each([['/world', '?panel=add&repeat=open'], ['/alarm', ''], ['/alarm', '?panel=unknown'], ['/alarm', '?repeat=open'], ['/alarm', '?panel=quick&repeat=open']])('does not invent a repeat overlay for %s %s', (path, search) => {
    expect(getAlarmOverlay(path, search).isRepeat).toBe(false);
  });
  it('reconstructs only missing parents for cold/external entries', () => {
    const search = '?panel=edit&repeat=open&alarmId=a1';
    expect(getAlarmBackFallback('/alarm', search)).toBe('/alarm?panel=edit&alarmId=a1');
    expect(getAlarmBackFallback('/alarm', search, { pathname: '/world', search: '' })).toBe('/alarm?panel=edit&alarmId=a1');
    expect(getAlarmBackFallback('/alarm', search, { pathname: '/alarm', search: '?alarmId=a1&panel=edit' })).toBeNull();
    expect(getAlarmBackFallback('/alarm', '?panel=quick&alarmId=a1')).toBe('/alarm');
    expect(getAlarmBackFallback('/alarm', '?panel=quick&alarmId=a1', { pathname: '/world', search: '' })).toBeNull();
    expect(getAlarmBackFallback('/world', '')).toBeNull();
    expect(getAlarmBackFallback('/alarm', '?panel=edit&ringtone=open&alarmId=a1')).toBe('/alarm?panel=edit&alarmId=a1');
    expect(getAlarmBackFallback('/alarm', '?panel=edit&ringtone=open&alarmId=a1', { pathname: '/alarm', search: '?panel=edit&alarmId=a1' })).toBeNull();
  });
  it('declares every actual alarm state, dynamic ID and separate scrollers', () => {
    const alarm = NAVIGATION_DECLARATION.routes.find(route => route.path === '/alarm')!;
    expect(alarm.uiStates.map(state => state.search)).toEqual([{}, { selection: 'alarms' }, { menu: 'more' }, { panel: 'add' }, { panel: 'quick' }, { panel: 'edit' }, { panel: 'add', repeat: 'open' }, { panel: 'edit', repeat: 'open' }, { panel: 'add', ringtone: 'open' }, { panel: 'edit', ringtone: 'open' }]);
    expect(alarm.queryParams).toEqual({ alarmId: 'string' });
    const world = NAVIGATION_DECLARATION.routes.find(route => route.path === '/world')!;
    expect(world.uiStates.map(state => state.search)).toContainEqual({ selection: 'cities' });
    expect(alarm.scrollContainers.map(scroll => scroll.name)).toEqual(['main', 'alarmEditor', 'alarmRepeat', 'alarmTone', 'globalMenu']);
  });
  it('pushes open/nested panels but replaces quick edit for full settings', () => {
    const transitions = NAVIGATION_DECLARATION.transitions;
    expect(transitions.find(t => t.id === 'alarm.item.selection.enter')).toMatchObject({ mode: 'push', search: { selection: 'alarms' } });
    expect(transitions.find(t => t.id === 'world.city.selection.enter')).toMatchObject({ mode: 'push', search: { selection: 'cities' } });
    expect(transitions.find(t => t.id === 'alarm.add.open')).toMatchObject({ mode: 'push', search: { panel: 'add' }, from: { path: '/alarm', search: { panel: null, selection: null } } });
    expect(transitions.find(t => t.id === 'alarm.item.edit.open')).toMatchObject({ mode: 'push', searchParams: { alarmId: 'string' } });
    expect(transitions.find(t => t.id === 'alarm.editor.more.open')).toMatchObject({ mode: 'replace', preserveParams: ['alarmId'] });
    expect(transitions.find(t => t.id === 'alarm.repeat.open')).toMatchObject({ mode: 'push', preserveParams: ['panel', 'alarmId'], search: { repeat: 'open' } });
    expect(transitions.find(t => t.id === 'alarm.ringtone.open')).toMatchObject({ mode: 'push', preserveParams: ['panel', 'alarmId'], search: { ringtone: 'open' } });
  });
  it('uses unique action IDs instead of duplicate global save/repeat IDs', () => {
    const ids = NAVIGATION_DECLARATION.routes.flatMap(route => route.uiStates.flatMap(state => 'actions' in state ? state.actions.map(action => action.id) : []));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('alarm.quick.save.submit');
    expect(ids).toContain('alarm.add.repeat.select.daily');
    expect(ids).toContain('alarm.edit.repeat.select.daily');
    expect(ids).toContain('alarm.add.ringtone.select.soft');
    expect(ids).toContain('alarm.edit.ringtone.preview');
  });
  it('isolates both background layers and derives all alarm visibility', () => {
    const shell = source('ClockApp.tsx');
    expect(shell).not.toMatch(/const \[show(?:AlarmEditor|AlarmEditModal|Repeat),/);
    expect(shell).toContain('inert={ringing || !!overlay.panel || showCitySelector || menuOpen || settingsOpen}');
    expect(shell).toContain('inert={showRepeat || showRingtone}');
    expect(shell).not.toContain('BackDispatcher');
    expect(shell).toContain('closedAlarmEntry.current === location.key');
  });
  it('does not pop twice after save or More settings', () => {
    const modal = source('pages/AlarmEditModal.tsx');
    expect(modal).not.toMatch(/onSave\([^;]+;\s*onClose\(\)/);
    expect(modal).not.toMatch(/onMoreSettings\([^;]+;\s*onClose\(\)/);
    expect(modal).toContain('clock-alarm-quick absolute');
    expect(modal).not.toContain('fixed inset-0');
  });
});
