export interface HistoryOwnerState {
  activeTaskId: string | null;
  isLauncherVisible: boolean;
  isRecentsVisible: boolean;
  tasks: readonly { taskId: string; stack: readonly { activityId: string }[] }[];
}

export function ownsHistoryDeletion(
  owner: { alive: boolean; taskId: string; activityId: string; href: string },
  state: HistoryOwnerState, liveRoute: string | undefined, visibleFloatingTask: string | null = null,
) {
  if (!owner.alive || !owner.taskId || !owner.activityId || state.activeTaskId !== owner.taskId
    || state.isRecentsVisible || (state.isLauncherVisible && visibleFloatingTask !== owner.taskId)
    || liveRoute !== owner.href) return false;
  return state.tasks.find(task => task.taskId === owner.taskId)?.stack.at(-1)?.activityId === owner.activityId;
}
