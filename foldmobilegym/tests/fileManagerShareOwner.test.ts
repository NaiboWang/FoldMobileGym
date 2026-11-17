import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ cleanup: [] as Array<() => void>, state: {
  activeTaskId: 'files-task', isLauncherVisible: false, isRecentsVisible: false,
  tasks: [{ taskId: 'files-task', stack: [{ activityId: 'files-activity' }] }],
} }));
vi.mock('../os/TaskManager', () => ({ default: { getState: () => h.state } }));
vi.mock('../os/ActivityContext', () => ({ useActivityId: () => 'files-activity' }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useLayoutEffect: (effect: () => void | (() => void)) => {
  const cleanup = effect(); if (cleanup) h.cleanup.push(cleanup);
} }));
import { createElement, useContext } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, UNSAFE_NavigationContext, type Navigator } from 'react-router-dom';
import { useFileManagerShareOwner, useFileManagerListOwner } from '../system/FileManager/hooks/useFileManagerShareOwner';
let owns: () => boolean, history: Navigator;
function Probe() { owns = useFileManagerShareOwner(); history = useContext(UNSAFE_NavigationContext).navigator; return null; }
function mount() { renderToString(createElement(MemoryRouter, { initialEntries: ['/recent', '/folder?path=%2Fsdcard&mode=select'], initialIndex: 1 }, createElement(Probe))); }
function VisibleProbe() { owns = useFileManagerListOwner(); history = useContext(UNSAFE_NavigationContext).navigator; return null; }
function mountVisible(visible = true) {
  vi.stubGlobal('document', { getElementById: (id: string) => id === 'activity-container-files-activity' ? { checkVisibility: () => visible } : null });
  renderToString(createElement(MemoryRouter, { initialEntries: ['/recent'] }, createElement(VisibleProbe)));
}
describe('FileManager share owner with actual synchronous MemoryRouter history', () => {
  beforeEach(() => { h.cleanup = []; h.state = { activeTaskId: 'files-task', isLauncherVisible: false, isRecentsVisible: false,
    tasks: [{ taskId: 'files-task', stack: [{ activityId: 'files-activity' }] }] }; });
  afterEach(() => { for (const cleanup of h.cleanup) cleanup(); vi.unstubAllGlobals(); });
  it('accepts the currently mounted top Activity', () => { mount(); expect(owns()).toBe(true); });
  it.each(['isLauncherVisible', 'isRecentsVisible'] as const)('rejects %s', key => { mount(); h.state[key] = true; expect(owns()).toBe(false); });
  it('rejects a background task such as Clock', () => { mount(); h.state.activeTaskId = 'clock-task'; expect(owns()).toBe(false); });
  it('rejects another Activity above Files', () => { mount(); h.state.tasks[0].stack.push({ activityId: 'receiver' }); expect(owns()).toBe(false); });
  it.each(['push', 'replace'] as const)('rejects immediate %s before useLocation commits', method => {
    mount(); history[method]('/folder?path=%2Fsdcard&mode=select&modal=more'); expect(owns()).toBe(false);
  });
  it('rejects immediate Back before React commits the old entry', () => { mount(); history.go(-1); expect(owns()).toBe(false); });
  it('rejects a new entry with the exact same URL', () => { mount(); history.push('/folder?path=%2Fsdcard&mode=select'); expect(owns()).toBe(false); });
  it('rejects removed and unmounted activities', () => { mount(); h.state.tasks = []; expect(owns()).toBe(false); });
  it('rejects callbacks retained after unmount cleanup', () => { mount(); for (const cleanup of h.cleanup) cleanup(); h.cleanup = []; expect(owns()).toBe(false); });
  it('allows read-only refresh of a visible unfocused pane without authorizing actions', () => {
    mountVisible(); h.state.activeTaskId = 'clock-task'; expect(owns()).toBe(true);
    mount(); expect(owns()).toBe(false);
  });
  it('does not scan an unfocused hidden pane', () => { mountVisible(false); h.state.activeTaskId = 'clock-task'; expect(owns()).toBe(false); });
  it.each(['isLauncherVisible', 'isRecentsVisible'] as const)('excludes visible thumbnails while %s', key => {
    mountVisible(); h.state[key] = true; expect(owns()).toBe(false);
  });
  it('keeps live navigation and Activity isolation for visible panes', () => {
    mountVisible(); history.push('/folder?path=%2Fsdcard'); expect(owns()).toBe(false);
    mountVisible(); h.state.tasks[0].stack.push({ activityId: 'receiver' }); expect(owns()).toBe(false);
  });
});
