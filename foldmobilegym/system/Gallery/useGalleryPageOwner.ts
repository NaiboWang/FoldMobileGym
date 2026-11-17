import { useContext, useLayoutEffect, useRef } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import { useActivityContext } from '../../os/ActivityContext';
import TaskManager from '../../os/TaskManager';

/** Reject retained background/detached controls and callbacks from older entries. */
export function useGalleryPageOwner() {
  const { activityId } = useActivityContext();
  const location = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const live = useRef(location.key);
  const mounted = useRef(false);
  live.current = location.key;
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return () => {
    // MemoryRouter mutates its history before React commits useLocation(). This
    // live key closes same-frame push/replace/Back and modal-open races.
    const currentKey = (navigator as { location?: typeof location }).location?.key ?? live.current;
    const os = TaskManager.getState();
    return !!activityId && mounted.current && live.current === location.key && currentKey === location.key
      && !os.isLauncherVisible && !os.isRecentsVisible
      && os.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1)?.activityId === activityId;
  };
}
