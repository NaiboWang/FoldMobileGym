import {useCallback,useContext,useLayoutEffect,useRef,useState} from 'react';
import {UNSAFE_NavigationContext,useLocation} from 'react-router-dom';
import {useActivityId} from '../../../os/ActivityContext';
import TaskManager from '../../../os/TaskManager';
import {useNotesStore} from '../state';
/** Same-turn foreground/history/source lease; own synchronous publications renew it. */
export function useNoteInteractionOwner(routeId:string|undefined,createdId:()=>string|null){
  const location=useLocation(),activityId=useActivityId(),{navigator}=useContext(UNSAFE_NavigationContext);
  const latest=useRef({routeId,createdId});latest.current={routeId,createdId};
  const generation=useRef(0),mounted=useRef(false),writing=useRef(false),entry=useRef(location.key);
  const [,refresh]=useState(0);
  if(entry.current!==location.key){generation.current++;entry.current=location.key;}
  const token=generation.current;
  const foreground=useCallback(()=>{const os=TaskManager.getState(),top=os.tasks.find(task=>task.taskId===os.activeTaskId)?.stack.at(-1);return !os.isLauncherVisible&&!os.isRecentsVisible&&top?.activityId===activityId;},[activityId]);
  useLayoutEffect(()=>{
    mounted.current=true;let previous=foreground();
    const offTask=TaskManager.subscribe(()=>{const next=foreground();if(previous&&!next)generation.current++;if(previous!==next)refresh(value=>value+1);previous=next;});
    const offData=useNotesStore.subscribe((next,before)=>{
      if(writing.current)return;
      const id=latest.current.routeId==='new'?latest.current.createdId():latest.current.routeId;
      if(id&&next.notes.find(note=>note.id===id)!==before.notes.find(note=>note.id===id)){generation.current++;refresh(value=>value+1);}
    });
    return()=>{mounted.current=false;offTask();offData();};
  },[foreground]);
  const active=()=>{
    const live=(navigator as unknown as {location?:{key:string;pathname?:string}}).location;
    const adopted=latest.current.routeId==='new'&&!!latest.current.createdId()&&live?.pathname===`/note/${latest.current.createdId()}`;
    return mounted.current&&generation.current===token&&entry.current===location.key&&(!live||live.key===location.key||adopted)&&foreground();
  };
  function write<T>(fn:()=>T){writing.current=true;try{return fn();}finally{writing.current=false;}}
  return {active,write};
}
