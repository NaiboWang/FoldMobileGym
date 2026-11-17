import { useCallback, useContext, useLayoutEffect, useRef, useState } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import { useActivityId } from '../../../os/ActivityContext';
import TaskManager from '../../../os/TaskManager';
import { useBilibiliStore } from '../state';
/** A foreground/history/actor lease. Data edits are separate from this volatile claim. */
export function useCommentOwner(sourceKey:string,draftKey?:string) {
  const location=useLocation(),activityId=useActivityId(),{navigator}=useContext(UNSAFE_NavigationContext);
  const actor=useBilibiliStore(state=>state.user.uid??'');
  const current=useRef({key:location.key,sourceKey}),generation=useRef(0),mounted=useRef(false),writing=useRef(false),consumed=useRef(false);
  const [,refresh]=useState(0);
  if(current.current.key!==location.key||current.current.sourceKey!==sourceKey){generation.current++;consumed.current=false;current.current={key:location.key,sourceKey};}
  const token=generation.current;
  const foreground=useCallback(()=>{const os=TaskManager.getState(),top=os.tasks.find(task=>task.taskId===os.activeTaskId)?.stack.at(-1);return !os.isLauncherVisible&&!os.isRecentsVisible&&top?.activityId===activityId;},[activityId]);
  const revoke=useCallback(()=>{generation.current++;consumed.current=false;if(mounted.current)refresh(value=>value+1);},[]);
  useLayoutEffect(()=>{
    mounted.current=true;let wasForeground=foreground();
    const offTask=TaskManager.subscribe(()=>{const next=foreground();if(wasForeground&&!next)revoke();else if(!wasForeground&&next)refresh(value=>value+1);wasForeground=next;});
    const offData=useBilibiliStore.subscribe((next,previous)=>{
      if(next.user.uid!==previous.user.uid||(!writing.current&&draftKey&&next.commentDrafts?.[draftKey]!==previous.commentDrafts?.[draftKey]))revoke();
    });
    return()=>{mounted.current=false;offTask();offData();};
  },[draftKey,foreground,revoke]);
  const active=()=>{
    const live=(navigator as unknown as {location?:{key:string}}).location;
    return mounted.current&&generation.current===token&&current.current.key===location.key&&current.current.sourceKey===sourceKey
      &&(!live||live.key===location.key)&&useBilibiliStore.getState().user.uid===actor&&!!actor&&foreground();
  };
  function write<T>(fn:()=>T):T{writing.current=true;try{return fn();}finally{writing.current=false;}}
  const begin=()=>{if(consumed.current||!active())return null;consumed.current=true;return {active};};
  return {active,write,begin,revoke,actor};
}
