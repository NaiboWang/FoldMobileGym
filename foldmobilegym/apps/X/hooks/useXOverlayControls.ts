import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useActivityId } from '../../../os/ActivityContext';
import { useXStore } from '../state';
import { getXSheet } from '../utils/overlayState';

/** A background/old entry cannot open or commit a modal on behalf of a new one. */
export function useXOverlayControls() {
  const location = useLocation(), activityId = useActivityId();
  const userId = useXStore(state => state.user.id);
  const liveKey = useRef(location.key), opening = useRef<string | null>(null), closed = useRef<string | null>(null);
  liveKey.current = location.key;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { opening.current = null; }, [location.key]);
  const ownsEntry = () => {
    const state = window.__OS__?.getState();
    const top = state?.tasks.find(task => task.taskId === state.activeTaskId)?.stack.at(-1);
    return mounted.current && liveKey.current === location.key && top?.activityId === activityId
      && useXStore.getState().user.id === userId;
  };
  return {
    isCurrent: ownsEntry,
    openOnce: (open: () => void) => {
      if (!ownsEntry() || opening.current === location.key || getXSheet(location.pathname, location.search)) return;
      opening.current = location.key; open();
    },
    claim: () => {
      if (!ownsEntry() || closed.current === location.key) return false;
      closed.current = location.key; return true;
    },
  };
}
