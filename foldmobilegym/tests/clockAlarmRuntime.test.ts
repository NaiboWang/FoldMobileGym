import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const fixture=vi.hoisted(()=>({now:0,push:vi.fn(),dismiss:vi.fn(),sound:{prime:vi.fn(async()=>true),play:vi.fn(()=>true),stop:vi.fn(),dispose:vi.fn()}}));
vi.mock('../os/TimeService',()=>({now:()=>fixture.now,getDate:()=>new Date(fixture.now),fromTimestamp:(value:number)=>new Date(value)}));
vi.mock('../os/NotificationService',()=>({default:{push:fixture.push,dismiss:fixture.dismiss}}));
vi.mock('../os/BrowserTimerSound',()=>({createBrowserTimerSound:()=>fixture.sound}));
vi.mock('../os/locale',()=>({getLocale:()=> 'en',useLocale:()=> 'en'}));
// Actual Clock actions on Zustand; browser workflow verifies persistence/OS boot.
vi.mock('../os/createAppStore',async()=>{
  const {create}=await import('zustand');
  return {createAppStoreWithActions:(_id:string,initial:object,creator:any)=>create((set,get)=>({...initial,...creator(set,get)})),memoSelector:(input:any,compute:any)=>(state:any)=>compute(input(state)),registerStateAdapter:vi.fn()};
});
import {useClockStore} from '../system/Clock/state';
import {alarmRuntime,useAlarmRuntime} from '../system/Clock/alarmRuntime';
import {getNextTrigger,formatCountdownText,getNextAlarmText} from '../system/Clock/utils';
import BroadcastBus,{ACTION_TIME_SET} from '../os/BroadcastBus';
import {resetAllOsStores} from '../os/createOsStore';
import type {Alarm} from '../system/Clock/types';
const alarm:Alarm={id:'actual-source',hour:4,minute:0,repeat:'daily',enabled:true,note:'Original note',vibrate:true,autoDelete:false};
const at=(day=21,hour=4,minute=0)=>new Date(2026,9,day,hour,minute).getTime();
const state=()=>useAlarmRuntime.getState();
function tick(value=at()){fixture.now=value;vi.advanceTimersByTime(200);}
beforeEach(()=>{
  vi.useFakeTimers();fixture.now=at(21,3,59);useClockStore.getState().setAlarms([{...alarm}]);
  useAlarmRuntime.setState({revision:0,occurrences:[],armed:[]},true);alarmRuntime.start();vi.clearAllMocks();
});
afterEach(()=>{useClockStore.getState().setAlarms([]);useAlarmRuntime.setState({revision:0,occurrences:[],armed:[]},true);vi.useRealTimers();});
describe('Clock alarm runtime and actual source consumption',()=>{
  it('boots idempotently without duplicate polling loops',()=>{const before=vi.getTimerCount();alarmRuntime.start();alarmRuntime.start();expect(vi.getTimerCount()).toBe(before);});
  it('fires one exact local notification without a UI Task',()=>{tick();expect(state().occurrences).toHaveLength(1);expect(fixture.push).toHaveBeenCalledTimes(1);expect(fixture.push.mock.calls[0][0]).toMatchObject({appId:'clock',title:'Alarm ringing',autoCancel:false});expect(fixture.push.mock.calls[0][0].route).toBe(`/alarm/ringing/${state().occurrences[0].id}`);expect(state().occurrences[0].triggerAtMs).toBe(at());});
  it('uses the selected tone from the occurrence snapshot',()=>{useClockStore.getState().setAlarms([{...alarm,tone:'soft'}]);tick();expect(fixture.sound.play).toHaveBeenCalledWith(state().occurrences[0].id,'soft');});
  it('does not duplicate an occurrence across polling and clock replay',()=>{tick();tick();fixture.now=at(21,3,59);BroadcastBus.sendBroadcast({action:ACTION_TIME_SET});vi.advanceTimersByTime(200);tick();expect(fixture.push).toHaveBeenCalledTimes(1);});
  it('disables a one-shot only after actual triggering and preserves its content',()=>{const source={...alarm,repeat:'once' as const};useClockStore.getState().setAlarms([source]);tick();expect(useClockStore.getState().alarms).toEqual([{...source,enabled:false}]);expect(state().occurrences).toHaveLength(1);tick(at(22));expect(state().occurrences).toHaveLength(1);});
  it('auto-delete removes only its consumed source, retaining the ringing snapshot',()=>{const source={...alarm,autoDelete:true};const sibling={...alarm,id:'sibling',enabled:false};useClockStore.getState().setAlarms([source,sibling]);tick();expect(useClockStore.getState().alarms).toEqual([sibling]);expect(state().occurrences[0].alarm).toEqual(source);});
  it('repeating alarms remain enabled and receive distinct next-day IDs',()=>{tick();const first=state().occurrences[0].id;expect(useClockStore.getState().alarms[0].enabled).toBe(true);expect(alarmRuntime.dismiss(first)).toBe(true);tick(at(22));expect(state().occurrences[0].id).not.toBe(first);expect(alarmRuntime.dismiss(first)).toBe(false);expect(state().occurrences).toHaveLength(1);});
  it('stop dismisses only its owned notification and cannot hit a newer run',()=>{tick();const id=state().occurrences[0].id;expect(alarmRuntime.dismiss(id)).toBe(true);expect(alarmRuntime.dismiss(id)).toBe(false);expect(fixture.dismiss.mock.calls.filter(call=>call[0]===id)).toHaveLength(1);expect(state().occurrences).toEqual([]);});
  it('source edits/delete cancel old occurrences rather than retaining a false current alarm',()=>{tick();const id=state().occurrences[0].id;useClockStore.getState().updateAlarm({...alarm,note:'New source'});expect(state().occurrences).toEqual([]);expect(fixture.dismiss).toHaveBeenCalledWith(id);expect(alarmRuntime.dismiss(id)).toBe(false);});
  it('rejects stale/ambiguous consume calls as true no-ops',()=>{const source=useClockStore.getState().alarms[0];useClockStore.getState().updateAlarm({...source});const before=useClockStore.getState();expect(before.consumeAlarm(source)).toBe(false);expect(useClockStore.getState()).toBe(before);useClockStore.getState().setAlarms([source,{...source}]);expect(useClockStore.getState().consumeAlarm(source)).toBe(false);});
  it('cannot preserve an auto-deleted occurrence after its ID is reused',()=>{useClockStore.getState().setAlarms([{...alarm,autoDelete:true}]);tick();useClockStore.getState().setAlarms([{...alarm}]);expect(state().occurrences).toEqual([]);});
  it('simultaneous alarms retain distinct identities and independent stop controls',()=>{useClockStore.getState().setAlarms([{...alarm},{...alarm,id:'second'}]);tick();const [first,second]=state().occurrences;expect(first.id).not.toBe(second.id);alarmRuntime.dismiss(first.id);expect(state().occurrences.map(item=>item.id)).toEqual([second.id]);});
  it('reset revokes old occurrences, notifications and late commands',()=>{tick();const old=state().occurrences[0].id,revision=state().revision;resetAllOsStores();expect(state().occurrences).toEqual([]);expect(state().revision).toBeGreaterThan(revision);expect(alarmRuntime.dismiss(old)).toBe(false);expect(fixture.sound.dispose).toHaveBeenCalled();});
  it('late audio preparation cannot play a removed occurrence',async()=>{tick();const id=state().occurrences[0].id;let resolve!:(ready:boolean)=>void;fixture.sound.prime.mockImplementationOnce(()=>new Promise<boolean>(done=>{resolve=done;}));const pending=alarmRuntime.primeSound(id);alarmRuntime.dismiss(id);const played=fixture.sound.play.mock.calls.length;resolve(true);expect(await pending).toBe(false);expect(fixture.sound.play).toHaveBeenCalledTimes(played);});
  it('unknown/expired occurrence sound requests do not allocate audio',async()=>{expect(await alarmRuntime.primeSound('missing')).toBe(false);expect(fixture.sound.prime).not.toHaveBeenCalled();});
  it('reentrant OS reset while posting cannot leave a ghost occurrence or audio',()=>{fixture.push.mockImplementationOnce(()=>resetAllOsStores());tick();expect(state().occurrences).toEqual([]);expect(fixture.sound.play).not.toHaveBeenCalled();});
  it('a reentrant replacement during one-shot consumption is not claimed as the old ring source',()=>{
    const source={...alarm,repeat:'once' as const};useClockStore.getState().setAlarms([source]);let replaced=false;
    const off=useClockStore.subscribe(next=>{if(!replaced&&next.alarms[0]?.enabled===false){replaced=true;next.updateAlarm({...source,hour:5,enabled:true});}});
    try{tick();expect(state().occurrences).toEqual([]);expect(useClockStore.getState().alarms[0]).toMatchObject({hour:5,enabled:true});}
    finally{off();}
  });
});
describe('calendar-aware actual alarm schedule helpers',()=>{
  it('distinguishes national makeup work from Monday-Friday mode',()=>{const base=new Date(2026,9,9,8);const work=getNextTrigger({...alarm,hour:7,repeat:'workday'},base),weekday=getNextTrigger({...alarm,hour:7,repeat:'weekday'},base);expect(new Date(work).getDate()).toBe(10);expect(new Date(weekday).getDate()).toBe(12);});
  it('skips a national holiday weekday for work mode but includes it for rest mode',()=>{const base=new Date(2026,9,1,3);expect(new Date(getNextTrigger({...alarm,repeat:'workday'},base)).getDate()).toBe(8);expect(new Date(getNextTrigger({...alarm,repeat:'holiday'},base)).getDate()).toBe(1);});
  it('does not invent an occurrence beyond the available calendar year',()=>{expect(getNextTrigger({...alarm,repeat:'workday'},new Date(2028,0,1))).toBe(Infinity);expect(getNextTrigger({...alarm,repeat:'holiday'},new Date(2027,11,31,23,59))).toBe(Infinity);expect(formatCountdownText(Infinity,0,'h','m','Unavailable')).toBe('Unavailable');});
  it('can arm the first covered midnight after an already-passed unknown date',()=>{expect(getNextTrigger({...alarm,hour:0,minute:0,repeat:'holiday'},new Date(2024,11,31,23,59))).toBe(new Date(2025,0,1,0,0).getTime());});
  it('refuses invalid source times and does not label unknown schedules as no alarms',()=>{expect(getNextTrigger({...alarm,hour:99},new Date())).toBe(Infinity);expect(getNextAlarmText([{...alarm,repeat:'workday'}],'None','h','m',new Date(2028,0,1),'Unknown calendar')).toBe('Unknown calendar');});
});
