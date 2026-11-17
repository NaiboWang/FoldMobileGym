import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ cleanups: [] as Array<() => void>, os: { activeTaskId: 'tb', isLauncherVisible: false, isRecentsVisible: false,
  tasks: [{ taskId: 'tb', stack: [{ activityId: 'tb-cart' }] }] } }));
vi.mock('../os/ActivityContext', () => ({ useActivityId: () => 'tb-cart' }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useLayoutEffect: (effect: () => void | (() => void)) => {
  const cleanup = effect(); if (cleanup) h.cleanups.push(cleanup);
} }));
import { createElement, useContext } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, UNSAFE_NavigationContext, type Navigator } from 'react-router-dom';
import { useTaobaoCartOwner } from '../apps/Taobao/hooks/useTaobaoCartOwner';
let owns: () => boolean, history: Navigator, surface: 'cart' | 'sku';
function Probe() { owns = useTaobaoCartOwner(surface); history = useContext(UNSAFE_NavigationContext).navigator; return null; }
function mount(search = '', view: typeof surface = 'cart', path = '/cart') {
  surface = view; renderToString(createElement(MemoryRouter, { initialEntries: ['/me', path + search], initialIndex: 1 }, createElement(Probe)));
}
describe('Taobao cart and SKU Activity/history ownership', () => {
  beforeEach(() => {
    h.cleanups = []; h.os = { activeTaskId: 'tb', isLauncherVisible: false, isRecentsVisible: false,
      tasks: [{ taskId: 'tb', stack: [{ activityId: 'tb-cart' }] }] };
    vi.stubGlobal('window', { __OS__: { getState: () => h.os } });
  });
  afterEach(() => { for (const cleanup of h.cleanups) cleanup(); vi.unstubAllGlobals(); });
  it.each(['', '?manage=1'])('permits the actual foreground cart %s', query => { mount(query); expect(owns()).toBe(true); });
  it.each(['?sheet=sku&productId=phone', '?manage=1&sheet=sku&productId=phone'])('permits only the modal owner at %s', query => {
    mount(query, 'sku'); expect(owns()).toBe(true); mount(query); expect(owns()).toBe(false);
  });
  it.each(['?sheet=other', '?dialog=remove', '?sheet=sku&dialog=remove'])('does not grant a SKU owner at %s', query => {
    mount(query, 'sku'); expect(owns()).toBe(false);
  });
  it('rejects another route, even with the same SKU query', () => { mount('?sheet=sku', 'sku', '/item/phone'); expect(owns()).toBe(false); });
  it.each(['isLauncherVisible', 'isRecentsVisible'] as const)('rejects %s', key => { mount('?sheet=sku', 'sku'); h.os[key] = true; expect(owns()).toBe(false); });
  it('rejects Clock or another Activity above the same task', () => {
    mount('?sheet=sku', 'sku'); h.os.activeTaskId = 'clock'; expect(owns()).toBe(false);
    h.os.activeTaskId = 'tb'; h.os.tasks[0].stack.push({ activityId: 'other' }); expect(owns()).toBe(false);
  });
  it.each(['push', 'replace'] as const)('rejects immediate %s before React commits', method => {
    mount(); history[method]('/cart?sheet=sku&productId=phone'); expect(owns()).toBe(false);
  });
  it('rejects a same-frame dismissed sheet and unmounted callbacks', () => {
    mount('?sheet=sku', 'sku'); history.go(-1); expect(owns()).toBe(false);
    mount('?sheet=sku', 'sku'); for (const cleanup of h.cleanups) cleanup(); h.cleanups = []; expect(owns()).toBe(false);
  });
});
