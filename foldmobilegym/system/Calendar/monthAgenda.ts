import type { CalendarEvent } from './types';
import * as TimeService from '@/os/TimeService';
import { calendarWorkspaceSegment } from './workspaceAgenda';
interface Labels { allDay:string; starts:string; ends:string; continues:string }
export function calendarMonthEventTime(event:CalendarEvent, selectedTs:number, labels:Labels):{timeLabel:string;timeValue?:string} {
  const day=TimeService.fromTimestamp(selectedTs);day.setHours(0,0,0,0);
  const segment=calendarWorkspaceSegment(event,day.getTime());
  const time=(ts:number)=>{const d=TimeService.fromTimestamp(ts);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
  if(segment==='allDay')return {timeLabel:labels.allDay};
  if(segment==='continues')return {timeLabel:labels.continues};
  if(segment==='ends')return {timeLabel:labels.ends,timeValue:time(event.endTs)};
  if(segment==='starts')return {timeLabel:labels.starts,timeValue:time(event.startTs)};
  return {timeLabel:time(event.startTs),timeValue:time(event.endTs)};
}
