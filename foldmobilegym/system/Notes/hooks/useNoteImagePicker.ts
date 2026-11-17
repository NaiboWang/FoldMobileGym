import { useEffect, useRef, useState } from 'react';
import type { DocumentReference } from '../../../os/utils/documentReference';
import { isDocumentReference } from '../../../os/utils/documentReference';
import { useNotesStore } from '../state';
import type { Note } from '../types';
import { isNoteTrashed } from '../utils';
import { loadNoteImage, resolveNoteImageNode } from '../utils/imageSource';

export function useNoteImagePicker(options: { routeId?: string; note?: Note; blocked: boolean; onPick: (source: DocumentReference) => void }) {
  const latest=useRef(options);latest.current=options;
  const request=useRef(0),pending=useRef(false),abort=useRef<AbortController|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(false);
  useEffect(()=>{setBusy(false);setError(false);pending.current=false;return()=>{request.current++;abort.current?.abort();};},[options.routeId]);
  const pick=()=>{
    if(pending.current || latest.current.blocked)return;
    const owner=latest.current;
    const stillOwned=()=>latest.current.routeId===owner.routeId && !latest.current.blocked
      && (owner.routeId==='new' ? !latest.current.note : !!owner.note && useNotesStore.getState().notes.find(note=>note.id===owner.routeId)===owner.note && !isNoteTrashed(owner.note));
    if(!stillOwned())return;
    const token=++request.current,controller=new AbortController();abort.current=controller;
    pending.current=true;setBusy(true);setError(false);window.__OS__?.keyboard.hide();
    const complete=(failed=false)=>{if(request.current!==token)return;pending.current=false;setBusy(false);if(failed&&stillOwned())setError(true);};
    let received=false;
    const launched=window.__OS__?.startActivityForResult({action:'ACTION_OPEN_DOCUMENT',type:'image/*'},async result=>{
      if(received || request.current!==token)return;received=true;
      if(result.resultCode==='CANCELED'){complete();return;}
      const source=result.data?.document;
      if(!stillOwned()){complete();return;}
      if(result.resultCode!=='OK'||!isDocumentReference(source)||!resolveNoteImageNode(source)){complete(true);return;}
      const uri=await loadNoteImage(source,controller.signal);
      if(request.current!==token)return;
      if(!uri || !stillOwned() || !resolveNoteImageNode(source)){complete(!uri);return;}
      owner.onPick({id:source.id,path:source.path,createdAt:source.createdAt});complete();
    });
    if(!launched)complete(true);
  };
  return {pick,busy,error};
}
