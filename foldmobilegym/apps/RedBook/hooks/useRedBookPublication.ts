import {useContext,useEffect,useRef} from 'react';
import {useLocation,UNSAFE_NavigationContext} from 'react-router-dom';
import {useActivityId} from '../../../os/ActivityContext';
import {useRedBookStore} from '../state';
/** Claim this visible editor visit once; never publish a stale/background/other-account draft. */
export function useRedBookPublication(){
 const location=useLocation(),id=useActivityId(),user=useRedBookStore(s=>s.user.id),{navigator}=useContext(UNSAFE_NavigationContext);
 const current=useRef(location.key),claimed=useRef<string|null>(null),mounted=useRef(true);current.current=location.key;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const active=()=>{const s=window.__OS__?.getState(),top=s?.tasks.find(t=>t.taskId===s.activeTaskId)?.stack.at(-1),live=(navigator as {location?:{key:string}}).location;return mounted.current&&current.current===location.key&&(!live||live.key===location.key)&&!!s&&!s.isLauncherVisible&&!s.isRecentsVisible&&top?.activityId===id&&useRedBookStore.getState().user.id===user;};
 return {active,commit:(fn:()=>void)=>{if(!active()||claimed.current===location.key)return false;claimed.current=location.key;try{fn();return true;}catch(error){claimed.current=null;throw error;}}};
}
