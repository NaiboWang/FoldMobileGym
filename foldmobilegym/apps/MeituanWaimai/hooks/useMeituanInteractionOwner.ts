import {useContext,useEffect,useRef} from 'react';
import {UNSAFE_NavigationContext,useLocation} from 'react-router-dom';
import {useActivityId} from '@/os/ActivityContext';
export function isMeituanForegroundActivity(activityId:string) {
  const os=window.__OS__?.getState(),top=os?.tasks.find(t=>t.taskId===os.activeTaskId)?.stack.at(-1);
  return !os?.isLauncherVisible&&!os?.isRecentsVisible&&top?.activityId===activityId;
}
export function useMeituanInteractionOwner() {
  const activityId=useActivityId(),location=useLocation(),{navigator}=useContext(UNSAFE_NavigationContext);
  const mounted=useRef(true),live=useRef(location);live.current=location;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  return ()=>mounted.current&&((navigator as {location?:typeof location}).location??live.current).key===location.key&&isMeituanForegroundActivity(activityId);
}
