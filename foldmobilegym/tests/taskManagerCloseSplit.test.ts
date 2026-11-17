import { beforeEach, describe, expect, it } from 'vitest';
import { TaskManager } from '../os/TaskManager';

beforeEach(() => TaskManager.reset());
describe('closing one split task with an explicit surviving task', () => {
  it.each(['notes', 'calculator'])('removes only %s without an intermediate launcher state', closedApp => {
    for (const id of ['calendar', 'notes', 'calculator']) TaskManager.launchApp(id);
    const before = TaskManager.getState();
    const closed = before.tasks.find(task => task.rootAppId === closedApp)!;
    const survivor = before.tasks.find(task => task.rootAppId === (closedApp === 'notes' ? 'calculator' : 'notes'))!;
    const states: ReturnType<typeof TaskManager.getState>[] = [];
    const unsubscribe = TaskManager.subscribe(state => states.push(state));
    TaskManager.closeTask(closed.taskId, survivor.taskId);
    unsubscribe();
    const after = TaskManager.getState();
    expect(after.tasks.map(task => task.rootAppId).sort()).toEqual(['calendar', survivor.rootAppId].sort());
    expect(after.tasks.find(task => task.taskId === survivor.taskId)).toBe(survivor);
    expect(after.activeTaskId).toBe(survivor.taskId);
    expect(states.every(state => !state.isLauncherVisible && !state.isRecentsVisible)).toBe(true);
  });
  it('does not activate a missing or closed successor', () => {
    TaskManager.launchApp('notes');
    const id = TaskManager.getState().activeTaskId!;
    TaskManager.closeTask(id, id);
    expect(TaskManager.getState()).toMatchObject({ tasks: [], activeTaskId: null, isLauncherVisible: true });
  });
  it('ordinary recents dismissal retains recents when no successor is requested', () => {
    TaskManager.launchApp('notes'); TaskManager.launchApp('calculator');
    const id = TaskManager.getState().activeTaskId!;
    TaskManager.showRecents(); TaskManager.closeTask(id);
    expect(TaskManager.getState()).toMatchObject({ isRecentsVisible: true, isLauncherVisible: false });
  });
});
