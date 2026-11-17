import {describe,expect,it} from 'vitest';
import {createAlarmEngine} from '../system/Clock/alarmEngine';
import {workCalendarDay} from '../system/Clock/workCalendar';
import {getAlarmRingingBackFallback,isAlarmRingingRoute} from '../system/Clock/alarmRingingRoute';
import type {Alarm} from '../system/Clock/types';
const original:Alarm={id:'source',hour:4,minute:0,repeat:'daily',enabled:true,vibrate:true,autoDelete:false};
function setup(){
  const f={now:1000,alarms:[original] as Alarm[],events:[] as {source:Alarm;at:number}[],onFire:null as null|(()=>void),available:true};
  const engine=createAlarmEngine({alarms:()=>f.alarms,now:()=>f.now,next:(_alarm,now)=>f.available?(Math.floor(now/60000)+1)*60000:Infinity,
    fire:(source,at)=>{f.events.push({source,at});f.onFire?.();}});
  engine.refresh();return {f,engine};
}
describe('current-source alarm engine',()=>{
  it('arms only future occurrences and fires the exact source at its deadline',()=>{const {f,engine}=setup();f.now=59999;engine.refresh();expect(f.events).toEqual([]);f.now=60000;engine.refresh();expect(f.events).toEqual([{source:original,at:60000}]);expect(engine.armed()).toEqual([{alarmId:'source',triggerAtMs:120000}]);});
  it('does not repeat an observed occurrence on polling or backward/forward replay',()=>{const {f,engine}=setup();f.now=60000;engine.refresh();engine.refresh();f.now=1000;engine.refresh(true);f.now=60000;engine.refresh(true);expect(f.events).toHaveLength(1);f.now=120000;engine.refresh();expect(f.events).toHaveLength(2);});
  it('rebases a replaced source without using the old captured plan',()=>{const {f,engine}=setup();f.now=60000;f.alarms=[{...original,note:'Replacement'}];engine.refresh();expect(f.events).toEqual([]);f.now=120000;engine.refresh();expect(f.events[0].source).toBe(f.alarms[0]);});
  it('disabled/deleted/ambiguous source IDs cannot fire',()=>{for(const alarms of [[],[{...original,enabled:false}],[original,{...original}]]){const {f,engine}=setup();f.alarms=alarms;f.now=60000;engine.refresh();expect(f.events).toEqual([]);expect(engine.armed()).toEqual([]);}});
  it('latches before reentrant observation and consumes source removal',()=>{const {f,engine}=setup();f.onFire=()=>{f.alarms=[];engine.refresh();};f.now=60000;engine.refresh();expect(f.events).toHaveLength(1);expect(engine.armed()).toEqual([]);});
  it('real elapsed polling may deliver late after a suspended browser',()=>{const {f,engine}=setup();f.now=300000;engine.refresh();expect(f.events.map(event=>event.at)).toEqual([60000]);engine.refresh();expect(f.events).toHaveLength(1);});
  it('explicit TIME_SET does not replay hours of missed alerts',()=>{const {f,engine}=setup();f.now=300000;engine.refresh(true);expect(f.events).toEqual([]);expect(engine.armed()[0].triggerAtMs).toBe(360000);});
  it('TIME_SET within the due minute delivers once',()=>{const {f,engine}=setup();f.now=119999;engine.refresh(true);expect(f.events).toHaveLength(1);});
  it('unavailable calendars arm after an explicit supported-time change',()=>{const {f,engine}=setup();f.available=false;f.alarms=[{...original}];engine.refresh();expect(engine.armed()).toEqual([]);f.available=true;engine.refresh(true);expect(engine.armed()[0].triggerAtMs).toBe(60000);});
  it('unavailable plans also recover when ordinary time enters covered dates',()=>{const {f,engine}=setup();f.available=false;f.alarms=[{...original}];engine.refresh();expect(engine.armed()).toEqual([]);f.available=true;f.now=2000;engine.refresh();expect(engine.armed()[0]?.triggerAtMs).toBe(60000);});
  it('invalid time does not corrupt the last valid plan',()=>{const {f,engine}=setup();f.now=NaN;engine.refresh();expect(engine.armed()[0].triggerAtMs).toBe(60000);f.now=60000;engine.refresh();expect(f.events).toHaveLength(1);});
  it('reset creates fresh future plans instead of stale notifications',()=>{const {f,engine}=setup();f.now=60000;engine.reset();expect(f.events).toEqual([]);expect(engine.armed()[0].triggerAtMs).toBe(120000);});
});
describe('explicit Mainland-China work/rest calendar coverage',()=>{
  const date=(year:number,month:number,day:number)=>new Date(year,month-1,day,8,0);
  it('includes 2025 official rest weekdays and Sunday makeup workdays',()=>{expect(workCalendarDay(date(2025,1,28))).toBe('rest');expect(workCalendarDay(date(2025,1,26))).toBe('workday');expect(workCalendarDay(date(2025,2,8))).toBe('workday');});
  it('includes 2026 national rest and makeup dates rather than weekday aliases',()=>{expect(workCalendarDay(date(2026,10,5))).toBe('rest');expect(workCalendarDay(date(2026,10,10))).toBe('workday');expect(workCalendarDay(date(2026,9,20))).toBe('workday');expect(workCalendarDay(date(2026,2,23))).toBe('rest');});
  it('classifies ordinary covered weekdays/weekends as complementary modes',()=>{expect(workCalendarDay(date(2026,10,21))).toBe('workday');expect(workCalendarDay(date(2026,10,24))).toBe('rest');});
  it('explicitly refuses unsupported years and invalid dates',()=>{expect(workCalendarDay(date(2024,1,1))).toBe('unavailable');expect(workCalendarDay(date(2028,1,1))).toBe('unavailable');expect(workCalendarDay(new Date(NaN))).toBe('unavailable');});
});
describe('cold ringing-route Back',()=>{
  it('returns a cold occurrence to alarms without replacing real previous history',()=>{expect(getAlarmRingingBackFallback('/alarm/ringing/owned')).toBe('/alarm');expect(getAlarmRingingBackFallback('/alarm/ringing/owned',{pathname:'/timer'})).toBeNull();});
  it('does not treat an unrelated or malformed route as an occurrence',()=>{expect(isAlarmRingingRoute('/alarm/ringing')).toBe(false);expect(getAlarmRingingBackFallback('/world')).toBeNull();});
});
