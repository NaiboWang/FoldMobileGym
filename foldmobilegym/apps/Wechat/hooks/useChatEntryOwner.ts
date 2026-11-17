import { useLayoutEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';
/** A retained composer is usable only by its real foreground Activity/history entry. */
export function useChatEntryOwner() {
  const location = useLocation(), activityId = useActivityId(), current = useRef(location), mounted = useRef(false);
  useLayoutEffect(() => { current.current = location; mounted.current = true; return () => { mounted.current = false; }; }, [location]);
  return useCallback(() => {
    const os = window.__OS__?.getState(), top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
    return mounted.current && !os?.isLauncherVisible && !os?.isRecentsVisible && top?.activityId === activityId
      && current.current.key === location.key && current.current.pathname === location.pathname && current.current.search === location.search;
  }, [activityId, location]);
}
