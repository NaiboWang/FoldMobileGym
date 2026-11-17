import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { realNow } from '../../../os/TimeService';
import { sameNoteImages, type NoteImage } from '../noteImages';
import { createTextHistory, type EditorField, type EditorSelection, type EditorText, type TextSnapshot } from '../textHistory';
import { sameChecklist } from '../noteChecklist';
type TextControl = HTMLInputElement | HTMLTextAreaElement;
const selection = (field: EditorField, element: TextControl): EditorSelection => ({ field, start: element.selectionStart ?? 0, end: element.selectionEnd ?? 0, direction: element.selectionDirection ?? 'none' });
export function useNoteTextHistory(options: {
  initial: EditorText; routeId?: string; readOnly: boolean;
  titleRef: React.RefObject<HTMLInputElement | null>; contentRef: React.RefObject<HTMLTextAreaElement | null>;
  commit: (text: EditorText) => void;
  isActive?:()=>boolean;
}) {
  const registry = useRef(new Map<string, ReturnType<typeof createTextHistory>>());
  const scope = options.routeId ?? 'new';
  if (!registry.current.has(scope)) registry.current.set(scope, createTextHistory(options.initial));
  const history = registry.current.get(scope)!;
  if (scope !== 'new' && registry.current.get('new') === history) registry.current.delete('new');
  // Only the current editing session keeps a bounded set of recently opened note histories.
  while (registry.current.size > 16) {
    const oldest = [...registry.current.keys()].find(key => key !== scope);
    if (oldest === undefined) break;
    registry.current.delete(oldest);
  }
  const latest = useRef(options); latest.current = options;
  const [, refresh] = useState(0), [composing, setComposing] = useState(false);
  const composition = useRef<number | undefined>(undefined), compositionCounter = useRef(0);
  const beforeInput = useRef<{ selection: EditorSelection; inputType: string } | null>(null);
  const restoreFrame = useRef<number | null>(null);
  const checklistControls=useRef(new Map<string,TextControl>());
  const checklistTail=useRef<TextControl|null>(null);
  const checklistListeners=useRef(new Map<string,()=>void>());
  const cancelRestore = () => { if (restoreFrame.current !== null) cancelAnimationFrame(restoreFrame.current); restoreFrame.current = null; };
  const controls = () => ({ title: latest.current.titleRef.current, content: latest.current.contentRef.current });
  const apply = (snapshot: TextSnapshot | null) => {
    if (!snapshot) return;
    latest.current.commit(snapshot); refresh(value => value + 1); cancelRestore();
    restoreFrame.current = requestAnimationFrame(() => {
      restoreFrame.current = null;
      if(latest.current.isActive?.()===false)return;
      const element = snapshot.selection.itemId?(checklistControls.current.get(snapshot.selection.itemId)??(!snapshot.checklist?.some(row=>row.id===snapshot.selection.itemId)?checklistTail.current:null)):controls()[snapshot.selection.field];
      if (!element?.isConnected || element.disabled || element.closest('[inert]') || !element.getClientRects().length) return;
      element.focus({ preventScroll: true });
      element.setSelectionRange(snapshot.selection.start, snapshot.selection.end, snapshot.selection.direction);
    });
  };
  const move = (kind: 'undo' | 'redo') => {
    if (latest.current.readOnly || latest.current.isActive?.()===false || composition.current !== undefined) return;
    apply(kind === 'undo' ? history.undo() : history.redo());
  };
  const moveRef = useRef(move); moveRef.current = move;
  // Undo can remove the focused row before the next animation frame restores a
  // caret. Keep immediate Ctrl-Z/Y owned by this editor during that short gap.
  useEffect(()=>{
    const fallback=(event:KeyboardEvent)=>{
      if(event.defaultPrevented||event.isComposing||composition.current!==undefined||!(event.ctrlKey||event.metaKey)||event.altKey||latest.current.isActive?.()===false)return;
      const key=event.key.toLowerCase();if(key!=='z'&&key!=='y')return;
      const target=event.target;
      if(!(target instanceof HTMLElement)||target instanceof HTMLTextAreaElement||(target instanceof HTMLInputElement&&target.type!=='checkbox')||target.isContentEditable)return;
      const root=latest.current.contentRef.current?.closest('[data-notes-editor]');
      if(!root?.isConnected||(target!==document.body&&target!==document.documentElement&&!root.contains(target)))return;
      event.preventDefault();moveRef.current(key==='y'||event.shiftKey?'redo':'undo');
    };
    document.addEventListener('keydown',fallback,true);return()=>document.removeEventListener('keydown',fallback,true);
  },[]);
  // Native beforeinput is needed for exact pre-edit ranges and mobile IME history commands.
  useEffect(() => {
    const histories=registry.current;
    const cleanups: (() => void)[] = [];
    for (const field of ['title', 'content'] as const) {
      const element = controls()[field]; if (!element) continue;
      const before = (nativeEvent: Event) => {
        const event = nativeEvent as InputEvent;
        if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
          if (event.cancelable && !event.isComposing) { event.preventDefault(); moveRef.current(event.inputType === 'historyUndo' ? 'undo' : 'redo'); }
          return;
        }
        beforeInput.current = { selection: selection(field, element), inputType: event.inputType || 'insertText' };
      };
      element.addEventListener('beforeinput', before);
      cleanups.push(() => element.removeEventListener('beforeinput', before));
    }
    return () => { cleanups.forEach(stop => stop()); if(histories.get(latest.current.routeId??'new')!==history)cancelRestore(); };
  }, [options.routeId, options.readOnly, history]);
  useEffect(()=>()=>{cancelRestore();for(const stop of checklistListeners.current.values())stop();checklistListeners.current.clear();},[]);
  return {
    canUndo: history.canUndo() && !composing && !options.readOnly,
    canRedo: history.canRedo() && !composing && !options.readOnly,
    getSnapshot:history.getSnapshot,
    isComposing:()=>composition.current!==undefined,
    registerChecklistControl:(id:string,element:TextControl|null,tail=false)=>{
      checklistListeners.current.get(id)?.();checklistListeners.current.delete(id);
      if(element){
        checklistControls.current.set(id,element);
        const before=(native:Event)=>{
          const event=native as InputEvent;
          if(event.inputType==='historyUndo'||event.inputType==='historyRedo'){
            if(event.cancelable&&!event.isComposing){event.preventDefault();moveRef.current(event.inputType==='historyUndo'?'undo':'redo');}return;
          }
          beforeInput.current={selection:{...selection('content',element),itemId:id},inputType:event.inputType||'insertText'};
        };
        element.addEventListener('beforeinput',before);checklistListeners.current.set(id,()=>element.removeEventListener('beforeinput',before));
      }else checklistControls.current.delete(id);
      if(tail)checklistTail.current=element;
    },
    focusChecklist:(id?:string,caret=0)=>{
      cancelRestore();const currentHistory=history;
      restoreFrame.current=requestAnimationFrame(()=>{
        restoreFrame.current=null;if(latest.current.isActive?.()===false||registry.current.get(latest.current.routeId??'new')!==currentHistory)return;
        const element=id?checklistControls.current.get(id):checklistTail.current;
        if(!element?.isConnected||element.disabled||element.closest('[inert]')||!element.getClientRects().length)return;
        element.focus({preventScroll:true});element.setSelectionRange(caret,caret);element.scrollIntoView({block:'nearest'});
      });
    },
    selectChecklist:(id:string,element:TextControl)=>{beforeInput.current=null;history.select({...selection('content',element),itemId:id});},
    document:(patch:Partial<EditorText>,after:EditorSelection,inputType:string)=>{
      if(latest.current.readOnly||latest.current.isActive?.()===false)return false;
      const current=history.getSnapshot();
      const pending=beforeInput.current,before=pending?.selection.itemId&&pending.selection.itemId===current.selection.itemId&&['insertText','insertCompositionText','insertFromPaste','deleteContentBackward','deleteContentForward'].includes(inputType)?pending.selection:current.selection;
      beforeInput.current=null;
      if(!history.record({...current,...patch},before,after,{inputType,time:realNow(),composition:composition.current}))return false;
      cancelRestore();latest.current.commit(history.getSnapshot());refresh(value=>value+1);return true;
    },
    undo: () => move('undo'), redo: () => move('redo'),
    adopt: (persistentId: string) => { registry.current.set(persistentId, history); },
    load: (text: EditorText) => {
      cancelRestore(); beforeInput.current = null; composition.current = undefined; setComposing(false);
      const current = history.getSnapshot();
      if (current.title !== text.title || current.content !== text.content || !sameNoteImages(current.images, text.images) || !sameChecklist(current,text)) history.reset(text);
      refresh(value => value + 1);
    },
    images: (images: NoteImage[], inputType: 'insertImage' | 'removeImage') => {
      if (latest.current.readOnly || composition.current !== undefined) return;
      const current = history.getSnapshot();
      history.breakGroup();
      if (!history.record({ ...current, images }, current.selection, current.selection, { inputType, time: realNow() })) return;
      cancelRestore(); latest.current.commit(history.getSnapshot()); refresh(value => value + 1);
    },
    change: (field: EditorField, element: TextControl, nativeEvent: Event) => {
      if (latest.current.readOnly || latest.current.isActive?.()===false) return;
      cancelRestore();
      const current = history.getSnapshot();
      const text = { ...current, [field]: element.value };
      const pending = beforeInput.current;
      const before = pending?.selection.field === field ? pending.selection : current.selection.field === field ? current.selection : selection(field, element);
      const inputType = (nativeEvent as InputEvent).inputType || pending?.inputType || 'insertText';
      beforeInput.current = null;
      history.record(text, before, selection(field, element), { inputType, time: realNow(), composition: composition.current });
      latest.current.commit(text); refresh(value => value + 1);
    },
    blur: () => { history.breakGroup(); },
    select: (field: EditorField, element: TextControl) => { history.select(selection(field, element)); },
    keyDown: (event: React.KeyboardEvent<TextControl>) => {
      if (event.nativeEvent.isComposing || composition.current !== undefined || !(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      event.preventDefault(); move(key === 'y' || event.shiftKey ? 'redo' : 'undo');
    },
    compositionStart: () => { history.breakGroup(); composition.current = ++compositionCounter.current; setComposing(true); },
    compositionEnd: () => { composition.current = undefined; history.breakGroup(); setComposing(false); },
  };
}
