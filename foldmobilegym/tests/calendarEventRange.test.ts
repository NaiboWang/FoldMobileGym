import { describe, expect, it } from 'vitest';
import * as TimeService from '../os/TimeService';
import { formatCalendarRange, formatCalendarStateTime, moveCalendarAllDayStart, toCalendarAllDayRange } from '../system/Calendar/eventRange';
import { dateInputValue } from '../system/Calendar/dateEditing';
const local=(y:number,m:number,d:number,h=0,min=0)=>TimeService.fromLocalParts(y,m-1,d,h,min).getTime();
const dates=(range:{startTs:number;endTs:number})=>[dateInputValue(range.startTs),dateInputValue(range.endTs)];
describe('Calendar explicit all-day civil ranges',()=>{
 it('covers one timed date with an exclusive next-day end',()=>expect(dates(toCalendarAllDayRange(local(2026,10,18,10),local(2026,10,18,12)))).toEqual(['2026-10-18','2026-10-19']));
 it('preserves an already valid multi-day all-day span',()=>{const range={startTs:local(2026,10,18),endTs:local(2026,10,21)};expect(toCalendarAllDayRange(range.startTs,range.endTs)).toEqual(range)});
 it('covers all occupied dates of an overnight multi-day timed event',()=>expect(dates(toCalendarAllDayRange(local(2026,12,31,23,30),local(2027,1,2,0,15)))).toEqual(['2026-12-31','2027-01-03']));
 it('does not add a phantom extra date when the timed event ends exactly at midnight',()=>expect(dates(toCalendarAllDayRange(local(2026,10,18,10),local(2026,10,20)))).toEqual(['2026-10-18','2026-10-20']));
 it('gives an explicit zero-duration conversion one actual civil day',()=>expect(dates(toCalendarAllDayRange(local(2026,10,18,10),local(2026,10,18,10)))).toEqual(['2026-10-18','2026-10-19']));
 it('moves the all-day start without changing the civil span',()=>expect(dates(moveCalendarAllDayStart(local(2026,10,18),local(2026,10,21),local(2026,10,19)))).toEqual(['2026-10-19','2026-10-22']));
 it('moves across a year boundary without losing the exclusive end',()=>expect(dates(moveCalendarAllDayStart(local(2026,12,30),local(2027,1,2),local(2027,1,2)))).toEqual(['2027-01-02','2027-01-05']));
 it('handles leap-year and month boundaries as civil dates',()=>expect(dates(moveCalendarAllDayStart(local(2028,2,28),local(2028,3,2),local(2028,2,29)))).toEqual(['2028-02-29','2028-03-03']));
 it('keeps midnight and civil span across spring DST rather than shifting the end one hour',()=>{
  const range=moveCalendarAllDayStart(local(2026,3,7),local(2026,3,10),local(2026,3,8));expect(dates(range)).toEqual(['2026-03-08','2026-03-11']);expect(TimeService.fromTimestamp(range.endTs).getHours()).toBe(0);
 });
 it('keeps midnight and civil span across autumn DST',()=>{
  const range=moveCalendarAllDayStart(local(2026,10,31),local(2026,11,3),local(2026,11,1));expect(dates(range)).toEqual(['2026-11-01','2026-11-04']);expect(TimeService.fromTimestamp(range.endTs).getHours()).toBe(0);
 });
 it('moves a post-US-spring range onto a transition without adding an elapsed-hour drift',()=>{
  const range=moveCalendarAllDayStart(local(2026,3,10),local(2026,3,13),local(2026,3,7));expect(dates(range)).toEqual(['2026-03-07','2026-03-10']);expect(TimeService.fromTimestamp(range.endTs).getHours()).toBe(0);
 });
 it('moves a US-spring transition range back to a normal three-day range',()=>{
  const range=moveCalendarAllDayStart(local(2026,3,8),local(2026,3,11),local(2026,3,10));expect(dates(range)).toEqual(['2026-03-10','2026-03-13']);expect(TimeService.fromTimestamp(range.endTs).getHours()).toBe(0);
 });
 it('uses the actual European spring transition dates across a month boundary',()=>{
  const range=moveCalendarAllDayStart(local(2026,3,31),local(2026,4,3),local(2026,3,28));expect(dates(range)).toEqual(['2026-03-28','2026-03-31']);expect(TimeService.fromTimestamp(range.endTs).getHours()).toBe(0);
 });
 it('moves a normal range onto the actual US autumn transition',()=>{
  const range=moveCalendarAllDayStart(local(2026,11,3),local(2026,11,6),local(2026,10,31));expect(dates(range)).toEqual(['2026-10-31','2026-11-03']);expect(TimeService.fromTimestamp(range.endTs).getHours()).toBe(0);
 });
 it('uses the actual European autumn transition dates',()=>{
  const range=moveCalendarAllDayStart(local(2026,10,27),local(2026,10,30),local(2026,10,24));expect(dates(range)).toEqual(['2026-10-24','2026-10-27']);expect(TimeService.fromTimestamp(range.endTs).getHours()).toBe(0);
 });
 it('conversion uses civil midnight even on a 23/25-hour day',()=>{
  for(const [m,d]of[[3,8],[11,1]]){const range=toCalendarAllDayRange(local(2026,m,d,1),local(2026,m,d,3));expect(TimeService.fromTimestamp(range.startTs).getHours()).toBe(0);expect(TimeService.fromTimestamp(range.endTs).getHours()).toBe(0);expect(TimeService.fromTimestamp(range.endTs).getDate()).toBe(d+1)}
 });
});
describe('Calendar complete localized detail endpoints',()=>{
 it('shows both actual dates and years for a timed cross-year range',()=>{
  const range=formatCalendarRange(local(2026,12,31,23,30),local(2027,1,2,0,15),false,'en')!;expect(range.start).toContain('2026');expect(range.start).toContain('23:30');expect(range.end).toContain('2027');expect(range.end).toContain('00:15');expect(range.start).not.toContain('年');
 });
 it('uses Chinese resources/locale without losing either endpoint',()=>{
  const range=formatCalendarRange(local(2026,10,18,9),local(2026,10,19,10),false,'zh-Hans')!;expect(range.start).toContain('18日');expect(range.end).toContain('19日');
 });
 it('retains the precise all-day exclusive endpoint without inventing a time label',()=>{
  const range=formatCalendarRange(local(2026,10,18),local(2026,10,21),true,'en')!;expect(range.start).toContain('18');expect(range.end).toContain('21');expect(range.end).not.toContain(':');
 });
 it('does not rewrite timestamps or round the stored instant for display',()=>{
  const start=local(2026,10,18,9)+12345,end=local(2026,10,19,10)+45678;expect(formatCalendarRange(start,end,false,'en')).not.toBeNull();expect(start%60000).toBe(12345);expect(end%60000).toBe(45678);
 });
 it('returns unavailable for invalid/out-of-range dates instead of throwing a page error',()=>{
  expect(formatCalendarRange(NaN,0,false,'en')).toBeNull();expect(formatCalendarRange(0,Infinity,false,'en')).toBeNull();expect(formatCalendarRange(1e20,1e20,false,'en')).toBeNull();
 });
});

describe('Calendar truthful snapshot time aliases',()=>{
 it('keeps the legacy zero-second local ISO shape and a real offset',()=>{
  const ts=local(2026,10,18,9,25),text=formatCalendarStateTime(ts);expect(text).toContain('T09:25:00');expect(text).toMatch(/[+-]\d{2}:\d{2}$/);expect(TimeService.parseToTimestamp(text)).toBe(ts);
  if(TimeService.fromTimestamp(ts).getTimezoneOffset()===-480)expect(text).toBe('2026-10-18T09:25:00+08:00');
 });
 it('retains seconds and milliseconds instead of rounding benchmark-visible aliases',()=>{
  const ts=local(2026,10,18,9,25)+12345,text=formatCalendarStateTime(ts);expect(text).toContain(':12.345');expect(TimeService.parseToTimestamp(text)).toBe(ts);
 });
 it('round-trips epoch, historical and expanded-year instants rather than inventing local labels',()=>{
  for(const ts of [0,-1000000000000,TimeService.fromLocalParts(10000,0,2,9).getTime()])expect(TimeService.parseToTimestamp(formatCalendarStateTime(ts))).toBe(ts);
 });
 it('marks invalid or sub-millisecond values unavailable',()=>{
  for(const ts of [NaN,Infinity,1e20,0.5])expect(formatCalendarStateTime(ts)).toBe('');
 });
});
