import {useCallback,useLayoutEffect,useRef} from 'react';
import type {IntentPayload} from '../../../os/types/manifest';
import TaskManager from '../../../os/TaskManager';
import {IntentResolver} from '../../../os/IntentResolver';
import {useNotesStore} from '../state';

/** A chooser belongs to this exact source visit, not whichever app is foreground later. */
export function useNoteTextShare(options:{routeKey:string;isActive:()=>boolean;intent:()=>IntentPayload|null;onUnavailable:()=>void}) {
  const latest=useRef(options);latest.current=options;
  const owned=useRef<IntentPayload|null>(null);
  const cancelOwn=useCallback(()=>{
    const intent=owned.current;owned.current=null;
    if(intent&&IntentResolver.getState().intent===intent)IntentResolver.cancelIntentChooser();
  },[]);
  useLayoutEffect(()=>{
    const guard=()=>{if(owned.current&&!latest.current.isActive())cancelOwn();};
    const offTask=TaskManager.subscribe(guard),offData=useNotesStore.subscribe(guard);
    const offChooser=IntentResolver.subscribe(state=>{if(owned.current&&state.intent!==owned.current)owned.current=null;});
    return()=>{offTask();offData();offChooser();cancelOwn();};
  },[cancelOwn]);
  useLayoutEffect(()=>()=>cancelOwn(),[options.routeKey,cancelOwn]);
  const visit=options;
  return ()=>{
    // A retained click callback must never borrow the latest route's permission.
    if(latest.current.routeKey!==visit.routeKey||!visit.isActive()||IntentResolver.getState().open)return;
    const intent=visit.intent();if(!intent)return;
    owned.current=intent;
    try{
      if(!window.__OS__?.startActivity(intent)&&visit.isActive())visit.onUnavailable();
    }catch{if(visit.isActive())visit.onUnavailable();}
    finally{if(IntentResolver.getState().intent!==intent)owned.current=null;}
  };
}
