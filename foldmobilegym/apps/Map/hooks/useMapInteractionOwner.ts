import { useContext, useEffect, useRef } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';

/** Recheck the live navigator as well as the render snapshot (same-frame Back). */
export function useMapInteractionOwner() {
  const activityId = useActivityId();
  const location = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const mounted = useRef(true);
  const live = useRef(location);
  live.current = location;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return () => {
    const current = (navigator as { location?: typeof location }).location ?? live.current;
    const os = window.__OS__?.getState();
    const top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
    return mounted.current && current.key === location.key
      && !os?.isLauncherVisible && !os?.isRecentsVisible
      && top?.activityId === activityId;
  };
}
