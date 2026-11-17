import { describe, expect, it } from 'vitest';
import type { Task } from '../os/types';
import { selectLauncherRecentTasks } from '../os/launcher/recentTasks';

const task = (taskId: string, rootAppId: string, lastActiveAt: number, empty = false) =>
  ({ taskId, rootAppId, lastActiveAt, stack: empty ? [] : [{}] }) as Task;

describe('recording-style recent task dock', () => {
  it('does not invent shortcuts on a fresh desktop', () => {
    expect(selectLauncherRecentTasks([])).toEqual([]);
  });
  it('orders real tasks, deduplicates apps, and excludes empty stacks', () => {
    const tasks = [task('a', 'wechat', 1), task('b', 'notes', 2),
      task('c', 'wechat', 3), task('d', 'mail', 9, true)];
    expect(selectLauncherRecentTasks(tasks).map(t => t.taskId)).toEqual(['c', 'b']);
    expect(tasks.map(t => t.taskId)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('resolves equal simulated timestamps by newest task and limits the dock', () => {
    const tasks = ['a', 'b', 'c', 'd', 'e'].map(id => task(id, id, 0));
    expect(selectLauncherRecentTasks(tasks).map(t => t.taskId)).toEqual(['e', 'd', 'c', 'b']);
    expect(selectLauncherRecentTasks(tasks, 0)).toEqual([]);
  });
});
