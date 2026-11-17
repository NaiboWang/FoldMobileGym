import { describe,it,expect } from 'vitest';
import * as TimeService from '../os/TimeService';
import { calendarMonthEventTime } from '../system/Calendar/monthAgenda';
import { calendarHomeMenuFallback } from '../system/Calendar/homeView';
import { NAVIGATION_DECLARATION } from '../system/Calendar/navigation.declaration';
import type { CalendarEvent } from '../system/Calendar/types';
const local=(d:number,h=0)=>TimeService.fromLocalParts(2026,8,d,h).getTime();
const labels={allDay:'all day',starts:'starts',ends:'ends',continues:'continues'};
const event=(startTs:number,endTs:number,allDay=false):CalendarEvent=>({id:'synthetic',title:'Synthetic event',type:'event',startTs,endTs,allDay});
describe('Calendar reference month and agenda',()=>{
 it('formats both exact endpoints for a same-day event even when selection has an hour',()=>{
  expect(calendarMonthEventTime(event(local(12,9),local(12,11)),local(12,18),labels)).toEqual({timeLabel:'09:00',timeValue:'11:00'});
 });
 it('represents a multi-day record by starts/continues/ends, never by invented recurrence',()=>{
  const record=event(local(12,22),local(14,12)),before=structuredClone(record);
  expect(calendarMonthEventTime(record,local(12),labels)).toEqual({timeLabel:'starts',timeValue:'22:00'});
  expect(calendarMonthEventTime(record,local(13),labels)).toEqual({timeLabel:'continues'});
  expect(calendarMonthEventTime(record,local(14,9),labels)).toEqual({timeLabel:'ends',timeValue:'12:00'});
  expect(record).toEqual(before);
 });
 it('keeps all-day records explicit and does not fabricate clock times',()=>expect(calendarMonthEventTime(event(local(12),local(14),true),local(13),labels)).toEqual({timeLabel:'all day'}));
 it.each(['month','year','week','day','agenda'])('reconstructs a cold %s menu without adding a root-history loop',view=>{
  const search=view==='month'?'?menu=open':`?view=${view}&menu=open`,base=view==='month'?'/':`/?view=${view}`;
  expect(calendarHomeMenuFallback('/',search)).toBe(base);
  expect(calendarHomeMenuFallback('/',search,{pathname:'/',search:view==='month'?'':`?view=${view}`})).toBeNull();
 });
 it('declares the fifth real view and an event/day-identity-preserving root agenda transition',()=>{
  expect(NAVIGATION_DECLARATION.routes[0].uiStates).toContainEqual(expect.objectContaining({search:{view:'agenda'}}));
  expect(NAVIGATION_DECLARATION.transitions.find(t=>t.id==='home.agenda.event.open')).toMatchObject({from:{path:'/',search:{view:'agenda',menu:null}},mode:'push',searchParams:{agendaDate:'string'}});
  expect(calendarHomeMenuFallback('/new-event','?menu=open')).toBeNull();
 });
});
