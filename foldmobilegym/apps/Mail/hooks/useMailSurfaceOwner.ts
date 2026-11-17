import { useContext, useEffect, useRef } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';
export function useMailSurfaceOwner() {
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const location = useLocation(), activityId = useActivityId(), liveKey = useRef(location.key), livePath = useRef(location.pathname), mounted = useRef(true);
  liveKey.current = location.key; livePath.current = location.pathname;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return (queryOnly = false) => {
    const os = window.__OS__?.getState(), top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
    const current = (navigator as { location?: typeof location }).location;
    if (queryOnly && new URLSearchParams(current?.search ?? location.search).get('menu') === 'message') return false;
    const querySurface = (path: string) => path === '/search' || /^\/search\/message\/[^/]+$/.test(path);
    return mounted.current && !os?.isLauncherVisible && !os?.isRecentsVisible && top?.activityId === activityId
      && (queryOnly ? querySurface(current?.pathname ?? livePath.current) && querySurface(location.pathname)
        : (current?.key ?? liveKey.current) === location.key && liveKey.current === location.key);
  };
}
