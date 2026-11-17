import { useOS } from '../../../os/OSContext';
import { useLayoutEffect, useRef, useState } from 'react';
import type React from 'react';
import { useLocation, UNSAFE_NavigationContext } from 'react-router-dom';
import { useContext } from 'react';
import { getTracker } from '../../../os/utils/memoryHistoryTracker';
import { useWechatStore } from '../state';
import { useWechatGestures } from './useWechatGestures';
import { useChatEntryOwner } from './useChatEntryOwner';
import type { TransitionId } from '../navigation.declaration';
import type { ActionSpec } from '../../../os/hooks/useTriggerGestures';
type Options<T extends HTMLElement> = { params?:Record<string,string|number>; onTrigger?:()=>void; beforeTrigger?:(event:React.SyntheticEvent<T>)=>void; preventDefault?:boolean; stopPropagation?:boolean };
function recipient(target: string | null) {
  const s=useWechatStore.getState();
  if(target===null)return s.momentDraft;
  return target ? s.contacts.find(c=>c.wxid===target) ?? s.chats.find(c=>c.id===target)?.user ?? (s.user.wxid===target?s.user:null) : null;
}
export function usePickerSession(target: string | null, reset: () => void) {
  const base=useWechatGestures(),location=useLocation(),entryOwner=useChatEntryOwner(),{navigator}=useContext(UNSAFE_NavigationContext);
  const {state:osState}=useOS();
  const live=useWechatStore(s=>s.user.wxid);
  const liveRecipient=useWechatStore(s=>target===null?s.momentDraft:target?s.contacts.find(c=>c.wxid===target)??s.chats.find(c=>c.id===target)?.user??(s.user.wxid===target?s.user:null):null);
  const previous=useRef({key:location.key,path:location.pathname,target}),known=useRef(new Set([location.key]));
  const source=useRef({actor:live,recipient:recipient(target)}),generation=useRef(0),mounted=useRef(false),expected=useRef(false),navigating=useRef(false),inside=useRef(false),committing=useRef(false),consumed=useRef(false);
  type Claim={generation:number;active:()=>boolean};
  const resetRef=useRef(reset);useLayoutEffect(()=>{resetRef.current=reset;});
  const claim=useRef<Claim|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;claim.current=null;};},[]);
  useLayoutEffect(()=>{
    if(previous.current.key===location.key&&previous.current.path===location.pathname&&previous.current.target===target)return;
    // A child Back/return must never revive a request started by an older visible entry.
    if(claim.current){claim.current=null;setBusy(false);}
    const own=previous.current.path===location.pathname&&previous.current.target===target&&(known.current.has(location.key)||expected.current);
    if(!own){generation.current++;known.current=new Set();source.current={actor:useWechatStore.getState().user.wxid,recipient:recipient(target)};claim.current=null;consumed.current=false;resetRef.current();setBusy(false);setError(false);}
    known.current.add(location.key);previous.current={key:location.key,path:location.pathname,target};expected.current=false;navigating.current=false;
  },[location.key,location.pathname,target]);
  useLayoutEffect(()=>{
    if(!entryOwner()&&claim.current){claim.current=null;setBusy(false);}
  },[entryOwner,osState]);
  const owns=()=>source.current.recipient!==null&&source.current.recipient!==undefined&&entryOwner()&&useWechatStore.getState().auth?.session.loggedIn&&useWechatStore.getState().user.wxid===source.current.actor&&recipient(target)===source.current.recipient;
  const canEdit=()=>owns()&&!claim.current&&!consumed.current&&!navigating.current;
  function protect<T extends HTMLElement>(props:React.HTMLAttributes<T>,navigation=false,entryOnly=false):React.HTMLAttributes<T>{
    return {...props,onClick:event=>{
      if(event.currentTarget.closest('[inert]')||!(entryOnly?entryOwner()&&!navigating.current:canEdit()))return;
      if(navigation){expected.current=true;navigating.current=true;}
      const old=inside.current;inside.current=true;try{props.onClick?.(event);}catch(error){if(navigation){expected.current=false;navigating.current=false;}throw error;}finally{inside.current=old;}
    }};
  }
  const go:typeof base.go=(id,params={},options)=>{
    if(!entryOwner()||(!committing.current&&!inside.current&&!canEdit()))return;
    expected.current=true;navigating.current=true;try{base.go(id,params,options);}catch(error){expected.current=false;navigating.current=false;throw error;}
  };
  const back=(steps=1)=>{if(entryOwner()&&!navigating.current){claim.current=null;setBusy(false);navigating.current=true;base.back(steps);}};
  function bindTap<T extends HTMLElement=HTMLElement>(id:TransitionId|'system.back'|ActionSpec,options?:Options<T>){
    const props=typeof id==='string'?base.bindTap<T>(id,options):base.bindTap<T>(id,{...options,onTrigger:options?.onTrigger??(()=>{})});
    return protect<T>(props,typeof id==='string'&&id!=='system.back'&&!options?.onTrigger);
  }
  function bindBack<T extends HTMLElement=HTMLElement>(options?:Parameters<typeof base.bindBack<T>>[0]){return protect<T>(base.bindBack<T>(options),false,true);}
  const begin=()=>{if(!canEdit())return null;const value={generation:generation.current,active:entryOwner};claim.current=value;setBusy(true);setError(false);return value;};
  const valid=(value:Claim)=>claim.current===value&&value.generation===generation.current&&value.active()&&owns();
  const finish=(value:Claim,failed=false)=>{if(claim.current!==value)return;claim.current=null;if(mounted.current){setBusy(false);if(failed&&value.active())setError(true);}};
  const commit=(value:Claim,write:()=>void)=>{if(!valid(value)){finish(value);return false;}consumed.current=true;committing.current=true;try{write();return true;}finally{committing.current=false;finish(value);}};
  const chatReturnSteps=()=>{
    const index=(navigator as {index?:number}).index??0,stack=getTracker(navigator)?.stack??[],chat=`/chat/${encodeURIComponent(target??'')}`;
    let i=index-1;while(i>=0&&stack[i]?.pathname===location.pathname)i--;
    return i>=0&&stack[i]?.pathname===chat ? index-i : null;
  };
  return {bindTap,bindBack,go,back,canEdit,begin,valid,finish,commit,chatReturnSteps,generation:generation.current,busy,error:error||!liveRecipient||live!==source.current.actor||liveRecipient!==source.current.recipient,fail:()=>{if(entryOwner())setError(true);}};
}
