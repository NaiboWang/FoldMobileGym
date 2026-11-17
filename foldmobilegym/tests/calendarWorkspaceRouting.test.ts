import { describe, expect, it } from 'vitest';
import { calendarEditorBackground, calendarEditorBackFallback, isCalendarEditor, type CalendarSurfaceLocation } from '../system/Calendar/workspaceRouting';
import { calendarEventIdFromPath } from '../system/Calendar/eventIdentity';
import { NAVIGATION_DECLARATION } from '../system/Calendar/navigation.declaration';
const location=(pathname:string,search='',key='entry'):CalendarSurfaceLocation=>({pathname,search,key,hash:'',state:null});
describe('Calendar transparent editor route provenance',()=>{
 it('recognizes only actual new/edit routes, not arbitrary nested paths',()=>{
  expect(isCalendarEditor('/new-event')).toBe(true);expect(isCalendarEditor('/event/A%2FB/edit')).toBe(true);expect(isCalendarEditor('/event/A')).toBe(false);expect(isCalendarEditor('/settings')).toBe(false);expect(isCalendarEditor('/event/A/edit/extra')).toBe(false);
 });
 it.each(['','?view=year','?view=week','?view=day'])('retains the exact original home owner/query %s behind New',search=>{
  const parent=location('/',search,'home-key');expect(calendarEditorBackground(location('/new-event'),parent)).toBe(parent);
 });
 it('retains the exact detail owner behind its edit and a new event opened there',()=>{
  const parent=location('/event/A','','detail-key');expect(calendarEditorBackground(location('/event/A/edit'),parent)).toBe(parent);expect(calendarEditorBackground(location('/new-event'),parent)).toBe(parent);
 });
 it('does not confuse another event or nested confirmation with the editor owner',()=>{
  const result=calendarEditorBackground(location('/event/A/edit'),location('/event/B'));expect(result.pathname).toBe('/event/A');expect(result.search).toBe('');
  expect(calendarEditorBackground(location('/event/A/edit'),location('/event/A','?deleteConfirm=open')).search).toBe('');
 });
 it('keeps encoded identity bytes without double-decoding or resolving them as extra path segments',()=>{
  expect(calendarEditorBackground(location('/event/A%252FB/edit')).pathname).toBe('/event/A%252FB');expect(calendarEditorBackground(location('/event/%E6%97%A5%E7%A8%8B/edit')).pathname).toBe('/event/%E6%97%A5%E7%A8%8B');
 });
 it('gives a cold editor a real home/detail backdrop without writing business state or history',()=>{
  const current=location('/new-event','?sheet=reminder');const before=JSON.stringify(current);const parent=calendarEditorBackground(current);expect(parent.pathname).toBe('/');expect(parent.search).toBe('');expect(JSON.stringify(current)).toBe(before);
  expect(calendarEditorBackground(location('/event/A/edit','?sheet=reminder')).pathname).toBe('/event/A');
 });
 it('does not retain unrelated settings or editor state as an invented foreground page',()=>{
  expect(calendarEditorBackground(location('/new-event'),location('/settings')).pathname).toBe('/');expect(calendarEditorBackground(location('/new-event'),location('/event/A/edit')).pathname).toBe('/');
 });
 it('declares real replace selection, push editor and existing four view destinations',()=>{
  expect(NAVIGATION_DECLARATION.transitions.find(t=>t.id==='workspace.event.select')).toMatchObject({mode:'replace',to:'/event/:eventId',params:{eventId:'string'}});
  expect(NAVIGATION_DECLARATION.transitions.find(t=>t.id==='workspace.new.open')).toMatchObject({mode:'push',to:'/new-event'});
  expect(NAVIGATION_DECLARATION.transitions.find(t=>t.id==='workspace.home.switch')?.cases).toHaveLength(4);
 });
 it('declares distinct live foreground/background/master scroll surfaces on editor routes',()=>{
  for(const path of ['/new-event','/event/:eventId/edit']){const names=NAVIGATION_DECLARATION.routes.find(route=>route.path===path)!.scrollContainers.map(row=>row.name);expect(new Set(names).size).toBe(names.length);for(const name of ['main','backgroundMain','master','weekColumns','weekAllDay'])expect(names).toContain(name)}
 });
 it('decodes raw event identity once and keeps literal percent/slash identities distinct',()=>{
  expect(calendarEventIdFromPath('/event/A%252FB')).toBe('A%2FB');expect(calendarEventIdFromPath('/event/A%2FB')).toBe('A/B');expect(calendarEventIdFromPath('/event/%E6%97%A5%E7%A8%8B/edit')).toBe('日程');expect(calendarEventIdFromPath('/event/bad%ZZ')).toBeUndefined();expect(calendarEventIdFromPath('/settings')).toBeUndefined();
 });

 it('retains a real agenda occurrence behind a cold edit without carrying reminder UI into it',()=>{
  expect(calendarEditorBackground(location('/event/A/edit','?agendaDate=2026-10-19&sheet=reminder')).search).toBe('?agendaDate=2026-10-19');
 });

 it('falls back through cold reminder and editor parents while preserving a real occurrence',()=>{
  expect(calendarEditorBackFallback('/event/A/edit','?agendaDate=2026-10-19&sheet=reminder',{pathname:'/',search:''})).toBe('/event/A/edit?agendaDate=2026-10-19');
  expect(calendarEditorBackFallback('/event/A/edit','?agendaDate=2026-10-19&sheet=type',{pathname:'/',search:''})).toBe('/event/A/edit?agendaDate=2026-10-19');
  expect(calendarEditorBackFallback('/event/A/edit','?agendaDate=2026-10-19&sheet=discard',{pathname:'/',search:''})).toBe('/event/A/edit?agendaDate=2026-10-19');
  expect(calendarEditorBackFallback('/event/A/edit','?agendaDate=2026-10-19',{pathname:'/',search:''})).toBe('/event/A?agendaDate=2026-10-19');
  expect(calendarEditorBackFallback('/new-event','',{pathname:'/settings',search:''})).toBe('/');
 });

 it('keeps genuine warm editor parents on the real history stack',()=>{
  expect(calendarEditorBackFallback('/event/A/edit','?agendaDate=2026-10-19&sheet=reminder',{pathname:'/event/A/edit',search:'?agendaDate=2026-10-19'})).toBeNull();
  expect(calendarEditorBackFallback('/event/A/edit','?agendaDate=2026-10-19&sheet=type',{pathname:'/event/A/edit',search:'?agendaDate=2026-10-19'})).toBeNull();
  expect(calendarEditorBackFallback('/event/A/edit','?agendaDate=2026-10-19&sheet=discard',{pathname:'/event/A/edit',search:'?agendaDate=2026-10-19'})).toBeNull();
  expect(calendarEditorBackFallback('/event/A/edit','?agendaDate=2026-10-19',{pathname:'/event/A',search:'?agendaDate=2026-10-19'})).toBeNull();
  expect(calendarEditorBackFallback('/new-event','',{pathname:'/',search:'?view=week'})).toBeNull();
 });

});
