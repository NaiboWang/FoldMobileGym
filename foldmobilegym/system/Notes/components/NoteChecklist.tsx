import { useLocation } from 'react-router-dom';
import { isFullNoteEditor } from '../editorView';
import React,{useRef,useLayoutEffect} from 'react';
import type { NoteChecklistItem } from '../noteChecklist';
import {newChecklistItemId} from '../noteChecklist';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import {IcDelete} from '../res/icons';
import {useNotesGestures} from '../hooks/useNotesGestures';

type Control=HTMLInputElement|HTMLTextAreaElement;
export function NoteChecklist({noteId,items,disabled,active,isComposing,onText,onToggle,onRemove,register,select,keyDown,compositionStart,compositionEnd}:{
  noteId:string;items:NoteChecklistItem[];disabled:boolean;active:()=>boolean;isComposing:()=>boolean;
  onText:(id:string,element:HTMLTextAreaElement,event:Event,tail:boolean)=>void;
  onToggle:(id:string,completed:boolean)=>void;onRemove:(id:string)=>void;
  register:(id:string,element:Control|null,tail?:boolean)=>void;select:(id:string,element:Control)=>void;
  keyDown:(event:React.KeyboardEvent<Control>)=>void;compositionStart:()=>void;compositionEnd:()=>void;
}) {
  const s = useAppStrings(strings, stringsEn);
  const location = useLocation(), focused = isFullNoteEditor(location.pathname, location.search);
  const container=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const root=container.current;if(!root)return;let alive=true,width=-1;
    const grow=()=>{if(!alive||root.clientWidth<=0)return;for(const element of root.querySelectorAll('textarea')){element.style.height='auto';element.style.height=`${Math.max(26,element.scrollHeight)}px`;}};
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>{if(root.clientWidth!==width){width=root.clientWidth;grow();}});
    observer?.observe(root);grow();return()=>{alive=false;observer?.disconnect();};
  },[items]);
  const {bindTap}=useNotesGestures(),tail=useRef<string|null>(null);
  if(!tail.current||items.some(item=>item.id===tail.current))tail.current=newChecklistItemId(items);
  const trailingId=tail.current;
  return <div ref={container} className="py-3" data-notes-checklist={noteId} data-keep-keyboard="true">
    {[...items, { id: trailingId, text: '', completed: false }].map((item, index) =>
      <div key={item.id} className="flex items-center gap-3 py-2">
        <input type="checkbox" checked={item.completed} disabled={disabled || isComposing() || index === items.length} onPointerDown={event=>event.preventDefault()}
          style={{accentColor:'var(--app-primary)'}} aria-label={`${s.checklist_complete} ${index + 1}`} onChange={event => {if(active())onToggle(item.id,event.target.checked);}}
          data-action={focused ? 'notes.focus.checklist.toggle' : 'notes.checklist.toggle'} data-action-type="toggle" data-action-params={JSON.stringify({ id: item.id })} />
        <textarea rows={1} ref={element=>{register(item.id,element,index===items.length);if(element){element.style.height='auto';element.style.height=`${Math.max(26,element.scrollHeight)}px`;}}} value={item.text} disabled={disabled} placeholder={s.checklist_add_item}
          aria-label={`${s.checklist_item} ${index + 1}`} data-benchmark-field={`notes-checklist-${index}`}
          className="min-w-0 flex-1 bg-transparent outline-none text-[16px] resize-none overflow-hidden"
          style={{ textDecoration: item.completed ? 'line-through' : undefined }}
          data-action={focused ? 'notes.focus.checklist.input' : 'notes.checklist.input'} data-action-type="input" data-action-params={JSON.stringify({ id: item.id, value: item.text })}
          onSelect={event=>select(item.id,event.currentTarget)} onFocus={event=>select(item.id,event.currentTarget)}
          onCompositionStart={compositionStart} onCompositionEnd={compositionEnd}
          onChange={event => {if(active())onText(item.id,event.currentTarget,event.nativeEvent,index===items.length);}}
          onKeyDown={event => {
            keyDown(event);
            if(event.defaultPrevented||isComposing()||event.nativeEvent.isComposing||event.keyCode===229||!active())return;
            if (event.key !== 'Enter') return;
            event.preventDefault();
            const next = event.currentTarget.closest('[data-notes-checklist]')?.querySelectorAll<HTMLTextAreaElement>('textarea');
            next?.[index + 1]?.focus();
          }} />
        {index<items.length&&<button type="button" disabled={disabled||isComposing()} className="w-7 h-7 shrink-0 text-app-text-muted" onPointerDown={event=>event.preventDefault()} aria-label={`${s.checklist_remove} ${index+1}`}
          {...bindTap(focused ? { kind: 'action', id: 'notes.focus.checklist.remove' } : { kind: 'action', id: 'notes.checklist.remove' },{params:{id:item.id},onTrigger:()=>{if(active())onRemove(item.id);}})}><IcDelete size={16}/></button>}
      </div>)}
  </div>;
}
