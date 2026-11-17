import { useCallback, useSyncExternalStore } from 'react';
import { useActivityId } from '../../../os/ActivityContext';
import TaskManager from '../../../os/TaskManager';
import type { OSState } from '../../../os/types';

type OwnershipState = Pick<OSState, 'tasks' | 'activeTaskId' | 'isLauncherVisible' | 'isRecentsVisible'>;

/** An active task retained under Recents does not own application input. */
export function isCalendarForeground(state: OwnershipState | undefined, activityId: string): boolean {
  if (!state || !activityId || state.isLauncherVisible || state.isRecentsVisible) return false;
  return state.tasks.find(task => task.taskId === state.activeTaskId)?.stack.at(-1)?.activityId === activityId;
}

const subscribe = (notify: () => void) => TaskManager.subscribe(() => notify());
const snapshot = () => TaskManager.getState();

export function useCalendarForeground() {
  const activityId = useActivityId();
  // A frozen editor can miss the intermediate inactive render. State identity
  // ensures focus is reconsidered even if the last committed boolean was true.
  const foregroundState = useSyncExternalStore(subscribe, snapshot, snapshot);
  const owns = useCallback(() => isCalendarForeground(TaskManager.getState(), activityId), [activityId]);
  return { active: isCalendarForeground(foregroundState, activityId), foregroundState, owns };
}
