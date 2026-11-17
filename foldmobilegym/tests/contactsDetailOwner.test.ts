import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ cleanup: [] as Array<() => void>, current: { id: 'c1' },
  os: { activeTaskId: 'contacts-task', isLauncherVisible: false, isRecentsVisible: false,
    tasks: [{ taskId: 'contacts-task', stack: [{ activityId: 'contacts-activity' }] }] } }));
vi.mock('../system/Contacts/state', () => ({ contactSourceIsCurrent: (source: unknown) => source === h.current }));
vi.mock('../os/ActivityContext', () => ({ useActivityId: () => 'contacts-activity' }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useLayoutEffect: (effect: () => void | (() => void)) => {
  const cleanup = effect(); if (cleanup) h.cleanup.push(cleanup);
} }));
import { createElement, useContext } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, UNSAFE_NavigationContext, type Navigator } from 'react-router-dom';
import type { Contact } from '../system/Contacts/types';
import { useContactDetailOwner } from '../system/Contacts/hooks/useContactDetailOwner';
import { ContactDetailViewportCache } from '../system/Contacts/hooks/useContactDetailViewport';

let owns: () => boolean, history: Navigator, ownerOptions: { modal: 'sms'; allowMissing?: boolean } | undefined;
function Probe() { owns = useContactDetailOwner(h.current as Contact, ownerOptions); history = useContext(UNSAFE_NavigationContext).navigator; return null; }
function mount(search = '', options?: typeof ownerOptions) { ownerOptions = options; renderToString(createElement(MemoryRouter, { initialEntries: ['/contacts?fav=true', '/contact/c1' + search], initialIndex: 1 }, createElement(Probe))); }
describe('Contacts favorite/detail action owner', () => {
  beforeEach(() => {
    h.cleanup = []; h.current = { id: 'c1' }; h.os = { activeTaskId: 'contacts-task', isLauncherVisible: false, isRecentsVisible: false,
      tasks: [{ taskId: 'contacts-task', stack: [{ activityId: 'contacts-activity' }] }] };
    vi.stubGlobal('window', { __OS__: { getState: () => h.os } });
  });
  afterEach(() => { for (const cleanup of h.cleanup) cleanup(); vi.unstubAllGlobals(); });
  it('accepts the real owned detail and source record', () => { mount('?fav=true'); expect(owns()).toBe(true); });
  it.each(['isLauncherVisible', 'isRecentsVisible'] as const)('rejects %s', key => { mount(); h.os[key] = true; expect(owns()).toBe(false); });
  it('rejects Clock or another foreground task', () => { mount(); h.os.activeTaskId = 'clock-task'; expect(owns()).toBe(false); });
  it('rejects a new Activity above the same Contact task', () => { mount(); h.os.tasks[0].stack.push({ activityId: 'sms-compose' }); expect(owns()).toBe(false); });
  it('rejects a replaced provider source, even with the same id', () => { mount(); h.current = { id: 'c1' }; expect(owns()).toBe(false); });
  it.each(['push', 'replace'] as const)('rejects immediate %s before React rerenders', method => { mount(); history[method]('/contact/c1?fav=true&menu=more'); expect(owns()).toBe(false); });
  it('rejects immediate Back before React rerenders', () => { mount(); history.go(-1); expect(owns()).toBe(false); });
  it.each(['?menu=more', '?modal=delete', '?fav=true&menu=more'])('rejects obscured controls at %s', search => { mount(search); expect(owns()).toBe(false); });
  it('rejects callbacks retained after unmount', () => { mount(); for (const cleanup of h.cleanup) cleanup(); h.cleanup = []; expect(owns()).toBe(false); });
  it('permits the source-owned SMS picker, not the underlying detail', () => {
    mount('?modal=sms', { modal: 'sms' }); expect(owns()).toBe(true);
    mount('?modal=sms'); expect(owns()).toBe(false);
  });
  it.each(['', '?modal=delete', '?menu=more&modal=sms'])('does not grant picker ownership at %s', search => {
    mount(search, { modal: 'sms' }); expect(owns()).toBe(false);
  });
  it('rejects a same-frame picker dismissal', () => {
    mount('?modal=sms', { modal: 'sms' }); history.go(-1); expect(owns()).toBe(false);
  });
  it('rejects a picker whose original provider source was replaced', () => {
    mount('?modal=sms', { modal: 'sms' }); h.current = { id: 'c1' }; expect(owns()).toBe(false);
  });
  it('allows only a visible missing-source picker to be cancelled', () => {
    function Missing() { owns = useContactDetailOwner(undefined, { modal: 'sms', allowMissing: true }); return null; }
    renderToString(createElement(MemoryRouter, { initialEntries: ['/contact/absent?modal=sms'] }, createElement(Missing)));
    expect(owns()).toBe(true); h.os.isLauncherVisible = true; expect(owns()).toBe(false);
  });
});

describe('Contacts Activity-local route-entry viewport bookmarks', () => {
  it('restores only the exact entry and provider source object', () => {
    const cache = new ContactDetailViewportCache(), source = { id: 'c1' };
    cache.remember('entry-a', source, 1536);
    expect(cache.read('entry-a', source)).toBe(1536);
    expect(cache.read('entry-a', { id: 'c1' })).toBeUndefined();
    expect(cache.read('entry-b', source)).toBeUndefined();
    expect(new ContactDetailViewportCache().read('entry-a', source)).toBeUndefined();
  });
  it.each([NaN, Infinity, -Infinity, -1])('does not store an invalid offset %s', top => {
    const cache = new ContactDetailViewportCache(), source = {};
    cache.remember('entry', source, top); expect(cache.read('entry', source)).toBeUndefined();
  });
  it('restores zero and replaces offsets without mutating the source record', () => {
    const cache = new ContactDetailViewportCache(), source = Object.freeze({ id: 'c1' });
    cache.remember('entry', source, 0); expect(cache.read('entry', source)).toBe(0);
    cache.remember('entry', source, 100); expect(cache.read('entry', source)).toBe(100);
    expect(source).toEqual({ id: 'c1' });
  });
  it('bounds entries and retains the most recently restored bookmark', () => {
    const cache = new ContactDetailViewportCache(2), source = {};
    cache.remember('a', source, 1); cache.remember('b', source, 2); cache.read('a', source); cache.remember('c', source, 3);
    expect(cache.read('b', source)).toBeUndefined(); expect(cache.read('a', source)).toBe(1); expect(cache.read('c', source)).toBe(3);
  });
  it.each([0, -1, NaN, Infinity, 1.5])('rejects invalid cache capacity %s', limit => {
    expect(() => new ContactDetailViewportCache(limit)).toThrow(RangeError);
  });
});
