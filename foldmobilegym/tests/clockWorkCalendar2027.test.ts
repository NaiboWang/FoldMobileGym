import { describe, expect, it } from 'vitest';
import { workCalendarDay } from '../system/Clock/workCalendar';
import { getNextTrigger } from '../system/Clock/utils';
import type { Alarm } from '../system/Clock/types';

// State Council notice 国办发明电〔2026〕10号, issued 2026-11-05.
const holidayRanges = [[1,1,3],[2,5,13],[4,3,5],[5,1,5],[6,9,9],[9,15,15],[10,1,7]] as const;
const makeup = new Set(['01-31','02-14','05-08','09-26','10-09']);
const key = (date: Date) => `${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const alarm: Alarm = { id:'calendar-test', hour:7, minute:0, enabled:true, repeat:'workday', vibrate:false, autoDelete:false };
describe('2027 official mainland work calendar', () => {
  it('classifies every local date, including all official holidays and make-up weekends', () => {
    for (let day = new Date(2027,0,1); day.getFullYear()===2027; day.setDate(day.getDate()+1)) {
      const rest = holidayRanges.some(([month,start,end]) => day.getMonth()+1===month && day.getDate()>=start && day.getDate()<=end);
      const expected = makeup.has(key(day)) ? 'workday' : rest || day.getDay()===0 || day.getDay()===6 ? 'rest' : 'workday';
      expect(workCalendarDay(day), key(day)).toBe(expected);
    }
  });
  it('schedules through the year boundary and the spring festival makeup day', () => {
    expect(getNextTrigger(alarm,new Date(2026,11,31,23,59))).toBe(new Date(2027,0,4,7).getTime());
    expect(getNextTrigger(alarm,new Date(2027,0,30,8))).toBe(new Date(2027,0,31,7).getTime());
    expect(getNextTrigger({...alarm,repeat:'holiday'},new Date(2026,11,31,23,59))).toBe(new Date(2027,0,1,7).getTime());
    expect(workCalendarDay(new Date(2028,0,1))).toBe('unavailable');
  });
});
