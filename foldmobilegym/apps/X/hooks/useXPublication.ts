import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useActivityId } from '../../../os/ActivityContext';
import { useXStore } from '../state';

/** Claim one synchronous publication for this live editor/history entry only. */
export function useXPublication() {
  const location = useLocation();
  const activityId = useActivityId();
  const userId = useXStore(state => state.user.id);
  const liveKey = useRef(location.key);
  liveKey.current = location.key;
  const publishedKey = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  return (publish: () => void): boolean => {
    const os = window.__OS__?.getState();
    const top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
    if (!mounted.current || liveKey.current !== location.key
      || top?.activityId !== activityId || useXStore.getState().user.id !== userId
      || publishedKey.current === location.key) return false;
    // A ref (not a render-delayed disabled flag) also rejects two clicks in one JS task.
    publishedKey.current = location.key;
    try {
      publish();
      return true;
    } catch (error) {
      publishedKey.current = null;
      throw error;
    }
  };
}
