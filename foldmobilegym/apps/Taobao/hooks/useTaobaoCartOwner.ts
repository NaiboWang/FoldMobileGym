import { useContext, useLayoutEffect, useRef } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';

/** Cart actions belong to this foreground Activity and the immediate history entry. */
export function useTaobaoCartOwner(surface: 'cart' | 'sku' = 'cart') {
  const activityId = useActivityId(), location = useLocation(), mounted = useRef(false);
  const { navigator } = useContext(UNSAFE_NavigationContext), liveKey = useRef(location.key); liveKey.current = location.key;
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return () => {
    const os = window.__OS__?.getState(), current = (navigator as { location?: typeof location }).location;
    const query = new URLSearchParams(location.search);
    return mounted.current && location.pathname === '/cart' && (current?.key ?? liveKey.current) === location.key
      && liveKey.current === location.key && !query.has('dialog')
      && (surface === 'sku' ? query.get('sheet') === 'sku' : !query.has('sheet'))
      && !os?.isLauncherVisible && !os?.isRecentsVisible && !!activityId
      && os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1)?.activityId === activityId;
  };
}
