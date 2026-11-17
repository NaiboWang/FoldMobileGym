import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createTodo,updateTodo,toggleTodo,deleteTodo,groupCalendarTodos,validTodoInput,calendarTodoBackFallback } from '../system/Calendar/todos';
import { resetAllAppStores } from '../os/createAppStore';
import { useCalendarStore } from '../system/Calendar/state';
const input={title:'  Synthetic todo  ',dueDate:null};
describe('Calendar-owned todo records',()=>{
 it('loads primary-navigation geometry after the base calendar stylesheet',()=>{const app=readFileSync(new URL('../system/Calendar/CalendarApp.tsx',import.meta.url),'utf8');expect(app.indexOf("import './calendar-todos.css'")).toBeGreaterThan(app.indexOf("import './calendar-adaptive.css'"));});
 it('keeps the editable surface keyboard-attached so pointer Save cannot jump before click',()=>{const page=readFileSync(new URL('../system/Calendar/pages/CalendarTodosPage.tsx',import.meta.url),'utf8');expect(page).toContain('inert={confirm} data-keep-keyboard="true"');});
 it('creates complete records, protects immutable identity and avoids collisions at frozen time',()=>{
  const first=createTodo([],input,0,'id')!;const second=createTodo(first.todos,input,0,'id')!;
  expect(first.todos[0]).toEqual({id:'id',title:'Synthetic todo',dueDate:null,completedAt:null,updatedAt:0,revision:1});expect(second.id).toBe('id-1');expect(first.todos).toHaveLength(1);
 });
 it.each(['','  ','x'.repeat(501)])('rejects empty/oversized titles without creating records: %s',title=>expect(createTodo([],{title,dueDate:null},1,'id')).toBeNull());
 it.each(['2026-02-30','2025-02-29','2026-13-01','abc','1899-12-31'])('rejects invalid due date %s',dueDate=>expect(validTodoInput({title:'x',dueDate})).toBe(false));
 it('accepts leap days and no-date values',()=>{expect(validTodoInput({title:'x',dueDate:'2028-02-29'})).toBe(true);expect(validTodoInput(input)).toBe(true);});
 it('keeps completion at epoch zero and restores without treating zero as absent',()=>{
  const row=createTodo([],input,0,'a')!.todos;
  const done=toggleTodo(row,'a',1,0)!;expect(done[0].completedAt).toBe(0);expect(groupCalendarTodos(done,'1970-01-01').completed).toHaveLength(1);
  expect(toggleTodo(done,'a',2,-1)![0].completedAt).toBeNull();expect(row[0].completedAt).toBeNull();
 });
 it('rejects stale edits, toggles and deletions rather than replacing newer work',()=>{
  const first=createTodo([],input,1,'a')!.todos,second=updateTodo(first,'a',1,{title:'new',dueDate:'2026-09-12'},2)!;
  expect(updateTodo(second,'a',1,input,3)).toBeNull();expect(toggleTodo(second,'a',1,3)).toBeNull();expect(deleteTodo(second,'a',1)).toBeNull();expect(deleteTodo(second,'missing',2)).toBeNull();
  expect(second[0].title).toBe('new');expect(deleteTodo(second,'a',2)).toEqual([]);
 });
 it('derives all counts from actual records, never reference-phone sample counts',()=>{
  let rows=createTodo([],{title:'overdue',dueDate:'2026-09-11'},1,'a')!.todos;
  rows=createTodo(rows,{title:'later',dueDate:'2026-09-13'},1,'b')!.todos;
  rows=createTodo(rows,{title:'no date',dueDate:null},1,'c')!.todos;
  const g=groupCalendarTodos(rows,'2026-09-12');expect(g.overdue.map(t=>t.id)).toEqual(['a']);expect(g.scheduled.map(t=>t.id)).toEqual(['b']);expect(g.undated.map(t=>t.id)).toEqual(['c']);expect(g.completed).toEqual([]);
 });
 it('reconstructs cold editor and confirmation owners without inventing a different task',()=>{
  expect(calendarTodoBackFallback('/todos/new','')).toBe('/todos');expect(calendarTodoBackFallback('/todos/a/edit','?returnView=week')).toBe('/todos?returnView=week');expect(calendarTodoBackFallback('/todos/new','?returnView=agenda&collapsed=undated')).toBe('/todos?returnView=agenda&collapsed=undated');
  expect(calendarTodoBackFallback('/todos/a/edit','?deleteConfirm=open&returnView=agenda')).toBe('/todos/a/edit?returnView=agenda');
  expect(calendarTodoBackFallback('/todos/a/edit','?deleteConfirm=open',{pathname:'/todos/a/edit',search:'?returnView=month'})).toBeNull();
  expect(calendarTodoBackFallback('/todos/a/edit','',{pathname:'/todos',search:''})).toBeNull();
 });
 it('clears new todo data on a real app-store reset while retaining event defaults',()=>{
  const original=useCalendarStore.getState();
  try {original.createTodo(input);expect(useCalendarStore.getState().todos?.length).toBeGreaterThan(0);resetAllAppStores();expect(useCalendarStore.getState().todos).toBeUndefined();expect(useCalendarStore.getState().events).toEqual(original.events);}
  finally {useCalendarStore.setState(original);}
 });
 it('isolates todo mutations from event records, settings, drafts and event counters',()=>{
  const original=useCalendarStore.getState();const before={events:original.events,settings:original.settings,draft:original.draft,created:original.createdCount,deleted:original.deletedCount,mutations:original.mutationCount};
  try{const id=original.createTodo(input)!;expect(id).toBeTruthy();const todo=useCalendarStore.getState().todos!.find(t=>t.id===id)!;
   expect(original.toggleTodo(id,todo.revision)).toBe(true);const live=useCalendarStore.getState().todos!.find(t=>t.id===id)!;expect(original.updateTodo(id,todo.revision,input)).toBe(false);expect(original.deleteTodo(id,live.revision)).toBe(true);
   const state=useCalendarStore.getState();expect({events:state.events,settings:state.settings,draft:state.draft,created:state.createdCount,deleted:state.deletedCount,mutations:state.mutationCount}).toEqual(before);
  }finally{useCalendarStore.setState({todos:original.todos});}
 });
});
