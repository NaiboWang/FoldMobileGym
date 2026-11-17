import type { Task } from '../types';

/** Real running tasks only: reopening a shortcut must preserve its activity stack. */
export function selectLauncherRecentTasks(tasks: readonly Task[], limit = 4): Task[] {
  const seen = new Set<string>();
  return tasks.map((task, index) => ({ task, index }))
    .filter(({ task }) => task.stack.length > 0)
    .sort((a, b) => b.task.lastActiveAt - a.task.lastActiveAt || b.index - a.index)
    .filter(({ task }) => {
      if (seen.has(task.rootAppId)) return false;
      seen.add(task.rootAppId);
      return true;
    })
    .slice(0, Math.max(0, limit))
    .map(({ task }) => task);
}
