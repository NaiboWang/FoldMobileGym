import type { CalendarEvent } from './types';
import * as TimeService from '@/os/TimeService';
import { dateInputValue, replaceCalendarDate } from './dateEditing';
export interface CalendarAgendaGroup { key: string; dateTs: number; events: CalendarEvent[] }
const DAY=86_400_000;
const midnight=(timestamp:number)=>{const date=TimeService.fromTimestamp(timestamp);date.setHours(0,0,0,0);return date};
const ordinal=(timestamp:number)=>{const date=midnight(timestamp);return Math.round((date.getTime()-date.getTimezoneOffset()*60_000)/DAY)};
const localDay=(day:number)=>{
  const utc=TimeService.fromTimestamp(day*DAY),year=utc.getUTCFullYear(),month=utc.getUTCMonth(),date=utc.getUTCDate();
  utc.setTime(0);utc.setFullYear(year,month,date);utc.setHours(0,0,0,0);return utc.getTime();
};
function sources(events:readonly CalendarEvent[]){
  const seen=new Set<string>();
  return [...events].filter(event=>{
    if(!event.id||seen.has(event.id)||!Number.isFinite(event.startTs)||!Number.isFinite(event.endTs)
      ||!Number.isFinite(TimeService.fromTimestamp(event.startTs).getTime())||!Number.isFinite(TimeService.fromTimestamp(event.endTs).getTime()))return false;
    seen.add(event.id);return true;
  }).sort((a,b)=>a.startTs-b.startTs||a.id.localeCompare(b.id));
}
export function calendarAgendaGroupsAtDays(events:readonly CalendarEvent[],days:readonly number[]):CalendarAgendaGroup[]{
  const rows=sources(events);
  return days.map(dateTs=>({key:dateInputValue(dateTs),dateTs,events:rows.filter(event=>{
    const first=ordinal(event.startTs),last=ordinal(event.endTs>event.startTs?event.endTs-1:event.startTs),day=ordinal(dateTs);
    return first<=day&&day<=last;
  })})).filter(group=>group.events.length>0);
}
/** Bounded occupied-day pages over the complete real corpus, not a cap on matching records. */
export function calendarAgendaPage(events:readonly CalendarEvent[],fromTs?:number,direction:1|-1=1,limit=20):CalendarAgendaGroup[]{
  const rows=sources(events),intervals=rows.map(event=>({first:ordinal(event.startTs),last:ordinal(event.endTs>event.startTs?event.endTs-1:event.startTs)}));
  let cursor=fromTs===undefined?(direction===1?-Infinity:Infinity):ordinal(fromTs);
  const days:number[]=[];
  while(days.length<Math.max(0,limit)){
    let candidate=direction===1?Infinity:-Infinity;
    for(const range of intervals){const day=direction===1?Math.max(cursor,range.first):Math.min(cursor,range.last);
      if(day>=range.first&&day<=range.last)candidate=direction===1?Math.min(candidate,day):Math.max(candidate,day)}
    if(!Number.isFinite(candidate))break;
    const dateTs=localDay(candidate);cursor=candidate+direction;
    if(Number.isFinite(dateTs)&&ordinal(dateTs)===candidate)days.push(dateTs);
  }
  if(direction===-1)days.reverse();return calendarAgendaGroupsAtDays(rows,days);
}
/** Start at the requested day when possible, otherwise keep the nearest real past page reachable. */
export function calendarAgendaInitialPage(events:readonly CalendarEvent[],fromTs:number,limit=20):CalendarAgendaGroup[]{
  const forward=calendarAgendaPage(events,fromTs,1,limit);
  return forward.length ? forward : calendarAgendaPage(events,fromTs,-1,limit);
}
export function calendarWorkspaceFocusDate(event:CalendarEvent|undefined,selectedDateTs:number,requestedDay?:string):number{
  const selected=midnight(selectedDateTs).getTime(),requested=requestedDay?replaceCalendarDate(selected,requestedDay):null;
  const contains=(dateTs:number)=>{const next=midnight(dateTs);next.setDate(next.getDate()+1);return !!event&&event.startTs<next.getTime()&&event.endTs>dateTs};
  if(requested!==null&&contains(requested))return requested;
  return event&&!contains(selected)?midnight(event.startTs).getTime():selected;
}
export function calendarWorkspaceSegment(event:CalendarEvent,dateTs:number):'allDay'|'starts'|'ends'|'continues'|'timed'{
  if(event.allDay)return 'allDay';const next=midnight(dateTs);next.setDate(next.getDate()+1);
  const before=event.startTs<dateTs,after=event.endTs>next.getTime();
  return before?(after?'continues':'ends'):(after?'starts':'timed');
}
export function shiftCalendarWorkspaceDay(timestamp:number,delta:number):number{const date=midnight(timestamp);date.setDate(date.getDate()+delta);return date.getTime()}
