import { useContext, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';
import TaskManager from '@/os/TaskManager';

function useFileManagerPageOwner(allowVisibleWindow: boolean) {
  const activityId = useActivityId(), location = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const mounted = useRef(false), liveKey = useRef(location.key);
  liveKey.current = location.key;
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return () => {
    const state = TaskManager.getState();
    const key = (navigator as { location?: typeof location }).location?.key ?? liveKey.current;
    const task = state.tasks.find(task => task.stack.at(-1)?.activityId === activityId);
    // Read-only list refresh also follows a visible, unfocused split/floating pane.
    // Actual actions still require the focused task; recents/launcher are excluded below.
    const visible = allowVisibleWindow && typeof document !== 'undefined'
      && document.getElementById(`activity-container-${activityId}`)?.checkVisibility();
    return !!activityId && mounted.current && key === location.key && liveKey.current === location.key
      && !state.isLauncherVisible && !state.isRecentsVisible
      && !!task && (task.taskId === state.activeTaskId || !!visible);
  };
}

export function useFileManagerShareOwner() { return useFileManagerPageOwner(false); }
export function useFileManagerListOwner() { return useFileManagerPageOwner(true); }

export function useFileManagerShareSelection() {
  const [selectedIds, commit] = useState<Set<string>>(() => new Set());
  const liveSelection = useRef(selectedIds);
  const setSelectedIds = useCallback((next: Set<string> | ((current: Set<string>) => Set<string>)) => {
    const value = typeof next === 'function' ? next(liveSelection.current) : next;
    liveSelection.current = value;
    commit(value);
  }, []);
  return { selectedIds, setSelectedIds, liveSelection };
}
