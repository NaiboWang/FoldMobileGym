import { useContext, useLayoutEffect, useRef } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';
import { TaskManager } from '@/os/TaskManager';

/** Local list actions belong only to their foreground Activity and exact route entry. */
export function useBilibiliEntryOwner() {
  const activityId = useActivityId(), location = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const mounted = useRef(false), liveKey = useRef(location.key);
  liveKey.current = location.key;
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return () => {
    const state = TaskManager.getState();
    const current = (navigator as { location?: typeof location }).location;
    return mounted.current && !state.isLauncherVisible && !state.isRecentsVisible
      && state.tasks.find(task => task.taskId === state.activeTaskId)?.stack.at(-1)?.activityId === activityId
      && (current?.key ?? liveKey.current) === location.key && liveKey.current === location.key;
  };
}
