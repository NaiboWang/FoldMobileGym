import { describe, expect, it } from 'vitest';
import { calendarAgendaPage, calendarAgendaGroupsAtDays, calendarAgendaInitialPage, calendarWorkspaceFocusDate, calendarWorkspaceSegment, shiftCalendarWorkspaceDay } from '../system/Calendar/workspaceAgenda';
import type { CalendarEvent } from '../system/Calendar/types';
import * as TimeService from '../os/TimeService';
const at=(day:number,hour=0)=>TimeService.fromLocalParts(2026,9,day,hour).getTime();
const event=(id:string,day:number,hour=9,more:Partial<CalendarEvent>={}):CalendarEvent=>({id,type:'event',title:id,allDay:false,startTs:at(day,hour),endTs:at(day,hour+1),...more});
describe('Calendar true occupied-day agenda pages',()=>{
 it('groups actual sources chronologically without fake empty or recurrence entities',()=>{
  const a=event('A',18),b=event('B',18,10),c=event('C',19),groups=calendarAgendaPage([c,b,a]);expect(groups.map(g=>g.key)).toEqual(['2026-10-18','2026-10-19']);expect(groups[0].events).toEqual([a,b]);expect(calendarAgendaPage([])).toEqual([]);
 });
 it('reuses exact raw records in every real occupied-day segment without mutating the store model',()=>{
  const row=event('span',18,0,{allDay:true,endTs:at(21),color:'#123456',calendarAccount:'Owned account'}),input=Object.freeze([row]),before=JSON.stringify(input),groups=calendarAgendaPage(input);
  expect(groups.map(g=>g.key)).toEqual(['2026-10-18','2026-10-19','2026-10-20']);for(const group of groups)expect(group.events[0]).toBe(row);expect(JSON.stringify(input)).toBe(before);
 });
 it('shows the selected cross-day ending occurrence instead of pretending it starts today',()=>{
  const row=event('span',18,12,{endTs:at(19,12)}),groups=calendarAgendaPage([row]);expect(calendarWorkspaceFocusDate(row,at(19))).toBe(at(19));expect(calendarWorkspaceSegment(row,groups[0].dateTs)).toBe('starts');expect(calendarWorkspaceSegment(row,groups[1].dateTs)).toBe('ends');
 });
 it('does not invent a next-day occurrence at an exact exclusive midnight end',()=>{
  expect(calendarAgendaPage([event('span',18,12,{endTs:at(19)})]).map(g=>g.key)).toEqual(['2026-10-18']);
 });
 it('identifies true whole-day continuations and all-day records independently',()=>{
  expect(calendarWorkspaceSegment(event('span',18,12,{endTs:at(21,12)}),at(19))).toBe('continues');expect(calendarWorkspaceSegment(event('all',18,0,{allDay:true}),at(18))).toBe('allDay');
 });
 it('honors a real requested occurrence date but never selects a date outside that entity',()=>{
  const row=event('span',18,12,{endTs:at(21,12)});expect(calendarWorkspaceFocusDate(row,at(1),'2026-10-20')).toBe(at(20));expect(calendarWorkspaceFocusDate(row,at(1),'2026-10-25')).toBe(at(18));expect(calendarWorkspaceFocusDate(row,at(19),'bad')).toBe(at(19));
 });
 it('supports forward/backward pages and skips sparse gaps without truncating matching identities',()=>{
  const rows=Array.from({length:55},(_,i)=>event('id_'+i,1+i));const a=calendarAgendaPage(rows,at(1),1,20),b=calendarAgendaPage(rows,shiftCalendarWorkspaceDay(a.at(-1)!.dateTs,1),1,20),c=calendarAgendaPage(rows,shiftCalendarWorkspaceDay(b.at(-1)!.dateTs,1),1,20);
  expect([...a,...b,...c].flatMap(g=>g.events.map(e=>e.id))).toEqual(rows.map(e=>e.id));expect(calendarAgendaPage(rows,at(21),-1,20).map(g=>g.key)).toEqual(calendarAgendaPage(rows,at(2),1,20).map(g=>g.key));
  expect(calendarAgendaPage([event('far',5000)],at(1))[0].events[0].id).toBe('far');
 });
 it('falls back to the nearest real past page when the focus is after the complete corpus',()=>{
  const rows=[event('past-a',18),event('past-b',20)];
  expect(calendarAgendaInitialPage(rows,at(25)).map(group=>group.key)).toEqual(['2026-10-18','2026-10-20']);
  expect(calendarAgendaInitialPage([],at(25))).toEqual([]);
 });
 it('never eagerly expands a centuries-long valid interval merely to render one page',()=>{
  const row=event('long',1,0,{endTs:TimeService.fromLocalParts(9999,0,1).getTime()});const page=calendarAgendaPage([row],at(10));expect(page).toHaveLength(20);expect(page[0].dateTs).toBe(at(10));expect(page.every(g=>g.events[0]===row)).toBe(true);
 });
 it('refreshes known loaded dates from live full event records without a stale body copy',()=>{
  const old=event('A',18),replacement={...old,title:'new'},days=calendarAgendaPage([old]).map(g=>g.dateTs);expect(calendarAgendaGroupsAtDays([replacement],days)[0].events[0]).toBe(replacement);
 });
 it('rejects unusable dates/IDs and deduplicates one identity rather than substituting rows',()=>{
  const row=event('valid',18);expect(calendarAgendaPage([event('',18),event('bad',18,9,{startTs:NaN}),row,row]).flatMap(g=>g.events.map(e=>e.id))).toEqual(['valid']);
 });
});
