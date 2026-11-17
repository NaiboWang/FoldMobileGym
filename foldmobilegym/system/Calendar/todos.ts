import * as TimeService from '@/os/TimeService';
import type { CalendarTodo } from './types';
export interface TodoInput { title: string; dueDate: string | null }
export function validTodoInput(input: TodoInput): boolean {
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 500) return false;
  if (input.dueDate === null) return true;
  if (typeof input.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) return false;
  const [y,m,d] = input.dueDate.split('-').map(Number);
  if (y < 1900 || y > 9999) return false;
  const date = TimeService.fromLocalParts(y,m-1,d);
  return date.getFullYear()===y && date.getMonth()===m-1 && date.getDate()===d;
}
export function createTodo(todos: readonly CalendarTodo[], input: TodoInput, now: number, candidate: string) {
  if (!validTodoInput(input) || !Number.isFinite(now) || !candidate) return null;
  let id=candidate, suffix=1;const occupied=new Set(todos.map(t=>t.id));
  while (occupied.has(id)) id=`${candidate}-${suffix++}`;
  return {id,todos:[{id,title:input.title.trim(),dueDate:input.dueDate,completedAt:null,updatedAt:now,revision:1},...todos]};
}
export function updateTodo(todos: readonly CalendarTodo[], id: string, revision: number, input: TodoInput, now: number): CalendarTodo[] | null {
  if (!validTodoInput(input) || !Number.isFinite(now) || !todos.some(t=>t.id===id && t.revision===revision)) return null;
  return todos.map(t=>t.id===id ? {...t,title:input.title.trim(),dueDate:input.dueDate,updatedAt:now,revision:t.revision+1} : t);
}
export function toggleTodo(todos: readonly CalendarTodo[], id: string, revision: number, now: number): CalendarTodo[] | null {
  if (!Number.isFinite(now) || !todos.some(t=>t.id===id && t.revision===revision)) return null;
  return todos.map(t=>t.id===id ? {...t,completedAt:t.completedAt===null ? now : null,updatedAt:now,revision:t.revision+1} : t);
}
export function deleteTodo(todos: readonly CalendarTodo[], id: string, revision: number): CalendarTodo[] | null {
  return todos.some(t=>t.id===id && t.revision===revision) ? todos.filter(t=>t.id!==id) : null;
}
export function groupCalendarTodos(todos: readonly CalendarTodo[], today: string) {
  const groups: Record<'overdue'|'scheduled'|'undated'|'completed',CalendarTodo[]>={overdue:[],scheduled:[],undated:[],completed:[]};
  for (const todo of todos) {
    if (todo.completedAt!==null) groups.completed.push(todo);
    else if (!todo.dueDate) groups.undated.push(todo);
    else groups[todo.dueDate<today?'overdue':'scheduled'].push(todo);
  }
  groups.overdue.sort((a,b)=>a.dueDate!.localeCompare(b.dueDate!)||a.id.localeCompare(b.id));
  groups.scheduled.sort((a,b)=>a.dueDate!.localeCompare(b.dueDate!)||a.id.localeCompare(b.id));
  groups.completed.sort((a,b)=>b.completedAt!-a.completedAt!||a.id.localeCompare(b.id));
  return groups;
}
export function calendarTodoBackFallback(path: string, search: string, previous?: {pathname:string;search:string}) {
  if (path!=='/todos/new' && !/^\/todos\/[^/]+\/edit$/.test(path)) return null;
  const params=new URLSearchParams(search),context=new URLSearchParams();
  const view=params.get('returnView');
  if(view&&['year','month','week','day','agenda'].includes(view))context.set('returnView',view);
  const groups=(params.get('collapsed')??'').split(',').filter(g=>['overdue','scheduled','undated','completed'].includes(g));
  if(groups.length)context.set('collapsed',[...new Set(groups)].sort().join(','));
  const suffix=context.size?'?'+context.toString():'';
  if (path!=='/todos/new' && params.get('deleteConfirm')==='open') {
    return previous?.pathname===path && !new URLSearchParams(previous.search).has('deleteConfirm') ? null : path+suffix;
  }
  return previous?.pathname==='/todos' ? null : '/todos'+suffix;
}
