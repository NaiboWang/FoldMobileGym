import React, { useContext, useEffect, useRef, useState } from 'react';
import { UNSAFE_NavigationContext, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';
import * as TimeService from '@/os/TimeService';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarStore } from '../state';
import { groupCalendarTodos, validTodoInput } from '../todos';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
import { CalendarSectionNav } from '../components/CalendarSectionNav';
import type { CalendarTodo } from '../types';
const EMPTY_TODOS: CalendarTodo[]=[];
function useTodoOwner() {
  const activityId=useActivityId(), location=useLocation(),{navigator}=useContext(UNSAFE_NavigationContext);
  const mounted=useRef(true),live=useRef(location);live.current=location;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  return ()=>{
    const route=(navigator as {location?:typeof location}).location??live.current;
    const os=window.__OS__?.getState(),top=os?.tasks.find(t=>t.taskId===os.activeTaskId)?.stack.at(-1);
    return mounted.current && route.key===location.key && !os?.isLauncherVisible && !os?.isRecentsVisible && top?.activityId===activityId;
  };
}
export function CalendarTodosPage() {
  const s=useAppStrings(strings,stringsEn),{bindTap,go}=useCalendarGestures(),location=useLocation(),[params]=useSearchParams();
  const pending=useRef<string|null>(null);
  useEffect(()=>{pending.current=null;},[location.key]);
  const owns=useTodoOwner();
  const open=(todoId?:string)=>{if(location.pathname!=='/todos'||!owns()||pending.current===location.key)return;pending.current=location.key;if(todoId)go('todos.edit.open',{todoId});else go('todos.new.open');};
  const todos=useCalendarStore(state=>state.todos??EMPTY_TODOS),editor=location.pathname!=='/todos';
  const [observed,setObserved]=useState(()=>TimeService.now());
  useEffect(()=>{const timer=setInterval(()=>setObserved(TimeService.now()),1000);return()=>clearInterval(timer);},[]);
  const date=TimeService.fromTimestamp(observed),today=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const collapsed=new Set((params.get('collapsed')??'').split(',').filter(v=>['overdue','scheduled','undated','completed'].includes(v)));
  const groups=groupCalendarTodos(todos,today),labels={overdue:s.todos_overdue,scheduled:s.todos_scheduled,undated:s.todos_undated,completed:s.todos_completed};
  return <div className="calendar-todos-page">
    <div className="calendar-todos-base" inert={editor}>
      <header><h1>{s.todos_all}</h1></header>
      <div className="calendar-todos-list" data-scroll-container={editor?undefined:'main'} data-scroll-direction="vertical">
        {!todos.length&&<div className="calendar-todos-empty"><strong>{s.todos_empty}</strong><p>{s.todos_empty_hint}</p></div>}
        {(Object.keys(groups) as Array<keyof typeof groups>).map(group=>groups[group].length>0&&<section key={group} data-calendar-todo-group={group}>
          <button type="button" className="calendar-todo-group-heading" aria-expanded={!collapsed.has(group)}
            {...bindTap('todos.group.toggle',{params:{collapsed:[...new Set(collapsed.has(group)?[...collapsed].filter(v=>v!==group):[...collapsed,group])].sort().join(',')},onTrigger:()=>{
              if(!owns()||editor)return;const next=new Set(collapsed);if(next.has(group))next.delete(group);else next.add(group);go('todos.group.toggle',{collapsed:[...next].sort().join(',')});
            }})}><span>{labels[group]} ({groups[group].length}{s.todos_count_suffix})</span><svg viewBox="0 0 20 20" aria-hidden="true" style={{transform:collapsed.has(group)?'rotate(180deg)':undefined}}><path d="m5 12 5-5 5 5"/></svg></button>
          {!collapsed.has(group)&&groups[group].map(todo=><div key={todo.id} className="calendar-todo-row" data-calendar-todo-id={todo.id}>
            <button type="button" role="checkbox" aria-checked={todo.completedAt!==null} aria-label={todo.completedAt!==null?s.todos_restore:s.todos_complete}
              {...bindTap({kind:'action',id:'calendar.todo.toggle'},{params:{todoId:todo.id},onTrigger:()=>{if(owns()&&!editor)useCalendarStore.getState().toggleTodo(todo.id,todo.revision);}})}><i aria-hidden="true">{todo.completedAt!==null?'✓':''}</i></button>
            <button type="button" className="calendar-todo-title" {...bindTap('todos.edit.open',{params:{todoId:todo.id},onTrigger:()=>open(todo.id)})}><strong className={todo.completedAt!==null?'is-complete':''}>{todo.title}</strong>{todo.dueDate&&group==='scheduled'&&<small>{todo.dueDate}</small>}</button>
          </div>)}
        </section>)}
      </div>
      <CalendarSectionNav selected="todos" />
      <button type="button" className="calendar-todos-add" aria-label={s.todos_new} {...bindTap('todos.new.open',{onTrigger:()=>open()})}>+</button>
    </div>
    {editor&&<TodoEditor key={location.pathname} owns={owns} />}
  </div>;
}
function TodoEditor({owns}:{owns:()=>boolean}) {
  const s=useAppStrings(strings,stringsEn),{bindTap,bindBack,back,go}=useCalendarGestures(),{todoId}=useParams(),[params]=useSearchParams();
  const todos=useCalendarStore(state=>state.todos??EMPTY_TODOS),original=useRef(todos.find(t=>t.id===todoId)),editing=!!todoId,confirm=editing&&params.get('deleteConfirm')==='open';
  const [title,setTitle]=useState(original.current?.title??''),[due,setDue]=useState(original.current?.dueDate??''),[error,setError]=useState('');
  const submitted=useRef(false),current=todos.find(t=>t.id===todoId),stale=editing&&(!original.current||current?.revision!==original.current.revision);
  const input={title,dueDate:due||null};
  const leave=()=>{back();};
  const save=()=>{
    if(!owns()||confirm||submitted.current)return;
    if(stale){setError(s.todos_changed);return;}
    if(!validTodoInput(input)){setError(s.todos_invalid);return;}
    submitted.current=true;const store=useCalendarStore.getState();
    const ok=editing?store.updateTodo(todoId!,original.current!.revision,input):!!store.createTodo(input);
    if(!ok){submitted.current=false;setError(s.todos_changed);return;} window.__OS__?.keyboard.hide(); leave();
  };
  const remove=()=>{
    if(!owns()||!confirm||submitted.current||stale)return;
    submitted.current=true;
    if(!useCalendarStore.getState().deleteTodo(todoId!,original.current!.revision)){submitted.current=false;setError(s.todos_changed);return;}
    // Close both confirmation and editor through the same declared app history owner.
    go('todos.return',{}, {mode:'replace',popTo:'/todos'});
  };
  return <div className="calendar-todo-editor-layer">
    <section className="calendar-todo-editor" onKeyDown={e=>{
      if(!owns()||e.ctrlKey||e.metaKey||e.altKey)return;
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();window.__OS__?.handleBack();}
      if(e.key==='Tab'){
        const controls=[...e.currentTarget.querySelectorAll<HTMLElement>('button,input,textarea,[tabindex]')].filter(n=>n.tabIndex>=0&&!n.closest('[inert]')&&!n.matches(':disabled')&&n.checkVisibility());
        if(!controls.length)return;e.preventDefault();const i=controls.indexOf(document.activeElement as HTMLElement);
        controls[e.shiftKey?(i<=0?controls.length-1:i-1):(i+1)%controls.length].focus({preventScroll:true});
      }
    }} role="dialog" aria-modal="true" aria-label={editing?s.todos_edit:s.todos_new}>
      <div className="calendar-todo-editor-content" inert={confirm} data-keep-keyboard="true">
        <header><button type="button" aria-label={s.todos_cancel} {...bindBack()}>×</button><h1>{editing?s.todos_edit:s.todos_new}</h1>
          <button type="button" disabled={stale||!validTodoInput(input)} {...(editing?bindTap({kind:'action',id:'calendar.todo.update'},{onTrigger:save}):bindTap({kind:'action',id:'calendar.todo.create'},{onTrigger:save}))}>{s.todos_save}</button></header>
        <div className="calendar-todo-fields" data-scroll-container={confirm?undefined:'main'} data-scroll-direction="vertical">
          {editing&&!original.current?<p role="alert">{s.todos_changed}</p>:<>
            <label>{s.todos_title_hint}<textarea aria-label={s.todos_title_hint} maxLength={500} value={title} data-action={editing?'calendar.todo.edit.title.input':'calendar.todo.new.title.input'} data-action-type="input" onChange={e=>{if(owns()&&!confirm)setTitle(e.target.value);}} /></label>
            <label>{s.todos_due}<input type="date" min="1900-01-01" max="9999-12-31" aria-label={s.todos_due} value={due} data-action={editing?'calendar.todo.edit.due.input':'calendar.todo.new.due.input'} data-action-type="input" onChange={e=>{if(owns()&&!confirm)setDue(e.target.value);}} /></label>
            <p className="calendar-todo-notice">{s.todos_date_notice}</p>
            {(stale||error)&&<p role="alert">{error||s.todos_changed}</p>}
            {editing&&<button type="button" className="calendar-todo-delete" disabled={stale} {...bindTap('todos.delete.open',{params:{todoId:todoId!},onTrigger:()=>{if(!owns()||stale)return;window.__OS__?.keyboard.hide();go('todos.delete.open',{todoId:todoId!});}})}>{s.todos_delete}</button>}
          </>}
        </div>
      </div>
      {confirm&&<div className="calendar-todo-delete-dialog" role="alertdialog" aria-modal="true" aria-label={s.todos_delete}>
        <p>{s.todos_delete_confirm}</p><button type="button" {...bindBack()}>{s.todos_cancel}</button><button type="button" disabled={stale} {...bindTap({kind:'action',id:'calendar.todo.delete'},{onTrigger:remove})}>{s.todos_delete}</button>
      </div>}
    </section>
  </div>;
}
