import type { OSState } from '../../../os/types';

type SplitWindow = { mode: string; primary_task_id?: string | null; secondary_task_id?: string | null } | undefined;

/** Auto-advance is allowed for a visible task's top Activity, never behind system overlays. */
export function canAdvanceVisiblePreview(os: OSState, activityId: string, taskId: string, multi: SplitWindow): boolean {
  if (!activityId || !taskId || os.isLauncherVisible || os.isRecentsVisible) return false;
  const task = os.tasks.find(item => item.taskId === taskId);
  if (task?.stack.at(-1)?.activityId !== activityId) return false;
  if (os.activeTaskId === taskId) return true;
  if (multi?.mode !== 'split' || !multi.primary_task_id || !multi.secondary_task_id) return false;
  const panes = [multi.primary_task_id, multi.secondary_task_id];
  return panes.includes(taskId) && !!os.activeTaskId && panes.includes(os.activeTaskId)
    && panes.every(id => os.tasks.some(item => item.taskId === id));
}
