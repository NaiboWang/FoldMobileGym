import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';

/** A retained page may act only for the same foreground Activity/history entry. */
export function useRedditRouteOwner(pathname: string) {
  const location = useLocation(), activityId = useActivityId();
  const current = useRef(location), mounted = useRef(false);
  useLayoutEffect(() => {
    current.current = location; mounted.current = true;
    return () => { mounted.current = false; };
  }, [location]);
  return () => {
    const state = window.__OS__?.getState();
    const top = state?.tasks.find(task => task.taskId === state.activeTaskId)?.stack.at(-1);
    return mounted.current && !state?.isLauncherVisible && !state?.isRecentsVisible && top?.activityId === activityId && current.current.key === location.key
      && current.current.pathname === pathname && current.current.search === location.search;
  };
}
