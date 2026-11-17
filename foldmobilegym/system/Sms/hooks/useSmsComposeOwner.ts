import { useContext, useLayoutEffect, useRef } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';
import TaskManager from '@/os/TaskManager';

export function useSmsComposeOwner() {
  const activityId = useActivityId(), location = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const liveKey = useRef(location.key), mounted = useRef(false);
  liveKey.current = location.key;
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return () => {
    const os = TaskManager.getState();
    const key = (navigator as { location?: typeof location }).location?.key ?? liveKey.current;
    return !!activityId && mounted.current && key === location.key && liveKey.current === location.key
      && !os.isLauncherVisible && !os.isRecentsVisible
      && os.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1)?.activityId === activityId;
  };
}
