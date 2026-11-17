import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { TaskManager } from '../../../os/TaskManager';
import { useActivityContext } from '../../../os/ActivityContext';
import { useAppStrings } from '../../../os/useAppStrings';
import { ownsHistoryDeletion } from '../historyOwnership';
import { useCalculatorStore } from '../state';
import { evaluateExpression, MAX_EXPRESSION_LENGTH } from '../expressionEngine';
import { expressionKeyEdit } from '../expressionEditing';
import { EXPRESSION_BASIC_KEYS, SCIENTIFIC_FUNCTION_KEYS } from '../expressionKeys';
import { useCalculatorGestures } from '../hooks/useCalculatorGestures';
import { IcCalculator, IcHistory } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export const CalculatorExpression:React.FC<{historyOpen:boolean}>=({historyOpen})=>{
 const editor=useCalculatorStore(state=>state.expressionEditor)!;
 const preview=useMemo(()=>evaluateExpression(editor.expression,editor.angleUnit),[editor.expression,editor.angleUnit]);
 const s=useAppStrings(strings,stringsEn),{bindTap}=useCalculatorGestures();
 const {taskId,activityId}=useActivityContext(),location=useLocation();
 const href=`${location.pathname}${location.search}`,field=useRef<HTMLInputElement>(null);
 const selection=useRef({start:editor.expression.length,end:editor.expression.length});
 const alive=useRef(false),expected=useRef(editor),lease=useRef<object|null>(null);
 const currentLease=useMemo(()=>({href,editor}),[href,editor]);
 useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useLayoutEffect(()=>{lease.current=currentLease;expected.current=editor;const input=field.current;if(input){const start=Math.min(selection.current.start,editor.expression.length),end=Math.min(selection.current.end,editor.expression.length);input.setSelectionRange(start,end);}},[currentLease,editor]);
 const owns=()=>{
  const multi=window.__FOLDAGENT__?.getState().multi_window;
  const floating=multi?.mode==='floating'&&multi.floating&&!multi.floating.minimized?multi.floating.task_id:null;
  return lease.current===currentLease&&expected.current===useCalculatorStore.getState().expressionEditor
   &&ownsHistoryDeletion({alive:alive.current&&!historyOpen,taskId,activityId,href},TaskManager.getState(),window.__OS__?.getAppRoute('calculator')?.path,floating);
 };
 const remember=()=>{expected.current=useCalculatorStore.getState().expressionEditor!;};
 const setText=(text:string,start:number,end=start)=>{
  if(!owns()||text.length>MAX_EXPRESSION_LENGTH)return;
  selection.current={start,end};useCalculatorStore.getState().setExpression(text);remember();
  if(field.current){field.current.value=text;field.current.focus({preventScroll:true});field.current.setSelectionRange(start,end);}
 };
 const action=(fn:()=>void)=>{if(owns()){fn();remember();}};
 const keyPress=(key:string)=>{
  if(!owns())return;const live=useCalculatorStore.getState().expressionEditor!;
  const start=field.current?.selectionStart??selection.current.start,end=field.current?.selectionEnd??selection.current.end;
  if(key==='MR'){if(live.memory!==null){const r=expressionKeyEdit(live,start,end,'recall');setText(r.expression,r.caret);}return;}
  const r=expressionKeyEdit(live,start,end,key);setText(r.expression,r.caret,'selectionEnd'in r?r.selectionEnd:r.caret);
 };
 const showLabel=(key:string,label:string)=>key==='angle'?(editor.angleUnit==='rad'?'Rad':'Deg'):editor.inverse?({sin:'sin⁻¹',cos:'cos⁻¹',tan:'tan⁻¹',ln:'eˣ',log:'10ˣ',exp:'ln'}[key]??label):label;
 const actualKey=(key:string)=>editor.inverse?({sin:'asin',cos:'acos',tan:'atan',ln:'exp',log:'pow10',exp:'ln'}[key]??key):key;
 const renderKey=(item:{key:string;label:string;col:number;row:number;span?:number})=>{
  const {key}=item,label=showLabel(key,item.label),value=actualKey(key);
  const props=key==='equals'?bindTap({kind:'action',id:'calculator.expression.calculate.submit'},{onTrigger:()=>action(()=>useCalculatorStore.getState().submitExpression())})
   :key==='clear'?bindTap({kind:'action',id:'calculator.expression.clear'},{onTrigger:()=>action(()=>{useCalculatorStore.getState().clearExpression();selection.current={start:0,end:0};})})
   :key==='angle'?bindTap({kind:'action',id:'calculator.expression.angle.toggle'},{onTrigger:()=>action(()=>useCalculatorStore.getState().toggleAngle())})
   :key==='inverse'?bindTap({kind:'action',id:'calculator.expression.inverse.toggle'},{onTrigger:()=>action(()=>useCalculatorStore.getState().toggleInverse())})
   :['MC','M+','M-'].includes(key)?bindTap({kind:'action',id:'calculator.expression.memory.press'},{params:{value:key},onTrigger:()=>action(()=>useCalculatorStore.getState().memoryExpression(key as 'MC'|'M+'|'M-'))})
   :bindTap({kind:'action',id:'calculator.expression.key.press'},{params:{value},onTrigger:()=>keyPress(value)});
  return <button type="button" key={key} data-expression-key={key} disabled={['MC','MR'].includes(key)&&editor.memory===null}
   aria-pressed={key==='inverse'?editor.inverse:undefined} aria-label={key==='backspace'?s.expression_backspace:key==='angle'?(editor.angleUnit==='rad'?s.expression_radians:s.expression_degrees):undefined}
   style={{'--wide-column':item.col,'--wide-row':item.row,'--wide-span':item.span??1} as React.CSSProperties}
   onPointerDown={event=>event.preventDefault()} {...props}>{label}</button>;
 };
 return <div className="calculator-reference calculator-expression" data-expression-editor data-scientific={editor.showScientific} data-scroll-container="main" data-scroll-direction="vertical" inert={historyOpen} aria-hidden={historyOpen||undefined}>
  <button type="button" className="calculator-history-open" aria-label={s.history_title} {...bindTap('calculator.home.history.open')}><IcHistory size={21}/></button>
  <button type="button" className="calculator-scientific-toggle" data-calculator-layout-toggle aria-label={editor.showScientific?s.scientific_hide:s.scientific_show} aria-pressed={editor.showScientific}
   {...bindTap({kind:'action',id:'calculator.expression.scientific.toggle'},{onTrigger:()=>action(()=>useCalculatorStore.getState().toggleScientific())})}><IcCalculator size={21}/></button>
  <div className="calculator-expression-display">
   <input ref={field} inputMode="none" aria-label={s.expression_label} maxLength={MAX_EXPRESSION_LENGTH} value={editor.expression} placeholder="0"
    {...bindTap({kind:'action',id:'calculator.expression.input'},{params:{value:editor.expression},onTrigger:()=>{if(owns())field.current?.focus({preventScroll:true});}})}
    onSelect={event=>{selection.current={start:event.currentTarget.selectionStart??0,end:event.currentTarget.selectionEnd??0};}}
    onPointerUp={event=>{if(editor.justEvaluated)setText(editor.expression,event.currentTarget.selectionStart??0,event.currentTarget.selectionEnd??0);}}
    onChange={event=>setText(event.currentTarget.value,event.currentTarget.selectionStart??event.currentTarget.value.length,event.currentTarget.selectionEnd??event.currentTarget.value.length)}
    onKeyDown={event=>{if(event.key==='Enter'||event.key==='='){event.preventDefault();action(()=>useCalculatorStore.getState().submitExpression());}else if(event.key==='Escape'){event.currentTarget.blur();}}}/>
   <div className="calculator-expression-preview" aria-label={s.expression_result} data-calculator-display>{editor.error?s[`expression_error_${editor.error}`]:(preview.kind==='success'?preview.display:'')}</div>
   {editor.memory!==null&&<span className="calculator-expression-memory" aria-label={s.expression_memory}>M</span>}
  </div>
  <div className="calculator-expression-keyboard-region" data-scroll-container="scientificKeys" data-scroll-direction="vertical">
   <div className="calculator-expression-keyboard">
    {editor.showScientific&&<div className="calculator-expression-functions">{SCIENTIFIC_FUNCTION_KEYS.map(renderKey)}</div>}
    <div className="calculator-expression-basic">{EXPRESSION_BASIC_KEYS.map(renderKey)}</div>
   </div>
  </div>
 </div>;
};
