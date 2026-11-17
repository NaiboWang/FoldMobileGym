import { useCallback,useContext,useLayoutEffect,useRef,useState } from 'react';
import { UNSAFE_NavigationContext,useLocation } from 'react-router-dom';
import { useActivityId } from '../../../os/ActivityContext';
import TaskManager from '../../../os/TaskManager';
/** Revoke a hidden/history-replaced callback before React can rerender it. */
export function useAlarmInteractionOwner(sourceKey:string){
  const location=useLocation(),activityId=useActivityId(),{navigator}=useContext(UNSAFE_NavigationContext);
  const generation=useRef(0),mounted=useRef(false),entry=useRef({key:location.key,sourceKey});
  const [,refresh]=useState(0);
  if(entry.current.key!==location.key||entry.current.sourceKey!==sourceKey){generation.current++;entry.current={key:location.key,sourceKey};}
  const token=generation.current;
  const foreground=useCallback(()=>{
    const os=TaskManager.getState(),top=os.tasks.find(task=>task.taskId===os.activeTaskId)?.stack.at(-1);
    return !os.isLauncherVisible&&!os.isRecentsVisible&&top?.activityId===activityId;
  },[activityId]);
  useLayoutEffect(()=>{
    mounted.current=true;let previous=foreground();
    const off=TaskManager.subscribe(()=>{
      const next=foreground();
      if(previous&&!next)generation.current++;
      if(previous!==next)refresh(value=>value+1);
      previous=next;
    });
    return()=>{mounted.current=false;off();};
  },[foreground]);
  return ()=>{
    const live=(navigator as unknown as {location?:{key:string}}).location;
    return mounted.current&&token===generation.current&&foreground()
      &&entry.current.key===location.key&&entry.current.sourceKey===sourceKey&&(!live||live.key===location.key);
  };
}
