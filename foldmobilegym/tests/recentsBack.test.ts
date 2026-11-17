import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TaskManager from '../os/TaskManager';
import BackDispatcher from '../os/BackDispatcher';
import { registerRecentsBackHandler } from '../os/recentsBack';

let frames: FrameRequestCallback[];
let cleanup: (() => void)[];
const tick = () => { const pending = frames.splice(0); for (const frame of pending) frame(0); };
beforeEach(() => {
  frames = []; cleanup = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  TaskManager.reset();
});
afterEach(() => { tick(); for (const unregister of cleanup) unregister(); vi.unstubAllGlobals(); });

describe('Recents dismissal state transition', () => {
  it('resumes the original active task without editing its Activity stack, caller or MRU', () => {
    TaskManager.launchApp('notes'); TaskManager.launchApp('gallery');
    const before = TaskManager.getState();
    TaskManager.showRecents(); TaskManager.dismissRecents();
    expect(TaskManager.getState()).toEqual(before);
    expect(TaskManager.getState().tasks).toBe(before.tasks);
  });
  it('preserves a foreign top Activity and its result request while dismissing Recents', () => {
    TaskManager.launchApp('notes');
    const taskId = TaskManager.getState().activeTaskId!;
    TaskManager.pushActivity(taskId, { activityId: 'foreign-contact-picker', appId: 'contacts', initialRoute: '/picker', requestCode: 33 });
    const before = TaskManager.getState();
    TaskManager.showRecents(); TaskManager.dismissRecents();
    expect(TaskManager.getState()).toEqual(before);
    expect(TaskManager.getState().tasks).toBe(before.tasks);
  });
  it.each([false, true])('returns to Home if Recents was opened from Home (background tasks=%s)', withTasks => {
    if (withTasks) { TaskManager.launchApp('notes'); TaskManager.goHome(); }
    const before = TaskManager.getState();
    TaskManager.showRecents(); TaskManager.dismissRecents();
    expect(TaskManager.getState()).toEqual(before);
    expect(TaskManager.getState().tasks).toBe(before.tasks);
  });
  it('returns to Home rather than activating a different task after the underlying task was closed', () => {
    TaskManager.launchApp('notes'); TaskManager.launchApp('gallery');
    const closed = TaskManager.getState().activeTaskId!;
    TaskManager.showRecents(); TaskManager.closeTask(closed);
    const before = TaskManager.getState();
    expect(before.isRecentsVisible).toBe(true);
    TaskManager.dismissRecents();
    expect(TaskManager.getState()).toMatchObject({ activeTaskId: null, isLauncherVisible: true, isRecentsVisible: false });
    expect(TaskManager.getState().tasks).toBe(before.tasks);
  });
  it('does nothing outside Recents', () => {
    TaskManager.launchApp('notes'); const before = TaskManager.getState();
    TaskManager.dismissRecents(); expect(TaskManager.getState()).toBe(before);
    TaskManager.goHome(); const home = TaskManager.getState();
    TaskManager.dismissRecents(); expect(TaskManager.getState()).toBe(home);
  });
  it('handles a missing active-task reference without changing background tasks', () => {
    TaskManager.launchApp('notes');
    TaskManager.reset({ ...TaskManager.getState(), activeTaskId: 'missing', isRecentsVisible: true });
    const before = TaskManager.getState(); TaskManager.dismissRecents();
    expect(TaskManager.getState()).toEqual({ ...before, activeTaskId: null, isLauncherVisible: true, isRecentsVisible: false });
    expect(TaskManager.getState().tasks).toBe(before.tasks);
  });
});

describe('Recents Back dispatch ownership', () => {
  it('consumes Back before keyboard, picker, app and Activity fallbacks', () => {
    cleanup.push(registerRecentsBackHandler());
    const lower = [700, 650, 600, 100, 50, 25, 12, 0].map(priority => {
      const handler = vi.fn(() => true);
      cleanup.push(BackDispatcher.register(`probe.${priority}`, handler, priority)); return handler;
    });
    TaskManager.launchApp('gallery'); TaskManager.showRecents();
    expect(BackDispatcher.handleBack()).toBe(true);
    expect(TaskManager.getState().isRecentsVisible).toBe(false);
    for (const handler of lower) expect(handler).not.toHaveBeenCalled();
    tick(); expect(BackDispatcher.handleBack()).toBe(true);
    expect(lower[0]).toHaveBeenCalledOnce();
  });
  it.each([800, 900, 1000])('lets visible system overlay priority %s consume Back first', priority => {
    cleanup.push(registerRecentsBackHandler()); let open = true;
    cleanup.push(BackDispatcher.register('probe.overlay', () => { if (!open) return false; open = false; return true; }, priority));
    TaskManager.launchApp('notes'); TaskManager.showRecents();
    BackDispatcher.handleBack(); expect(open).toBe(false);
    expect(TaskManager.getState().isRecentsVisible).toBe(true);
    tick(); BackDispatcher.handleBack();
    expect(TaskManager.getState().isRecentsVisible).toBe(false);
  });
  it('passes ordinary app Back through when Recents is not visible', () => {
    cleanup.push(registerRecentsBackHandler()); const app = vi.fn(() => true);
    cleanup.push(BackDispatcher.register('probe.app', app, 100));
    TaskManager.launchApp('notes'); BackDispatcher.handleBack();
    expect(app).toHaveBeenCalledOnce();
  });
  it('keeps same-frame deduplication so one Back cannot also pop the underlying app', () => {
    cleanup.push(registerRecentsBackHandler()); const app = vi.fn(() => true);
    cleanup.push(BackDispatcher.register('probe.app', app, 100));
    TaskManager.launchApp('notes'); TaskManager.showRecents();
    expect(BackDispatcher.handleBack()).toBe(true);
    expect(BackDispatcher.handleBack()).toBe(false);
    expect(app).not.toHaveBeenCalled();
    tick(); BackDispatcher.handleBack(); expect(app).toHaveBeenCalledOnce();
  });
  it('unregisters the handler cleanly', () => {
    const unregister = registerRecentsBackHandler(); unregister();
    TaskManager.showRecents(); expect(BackDispatcher.handleBack()).toBe(false);
    expect(TaskManager.getState().isRecentsVisible).toBe(true);
  });
});
