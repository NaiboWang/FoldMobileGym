import { createVolatileOsStore } from '../../os/createOsStore';
import BroadcastBus, { ACTION_BOOT_COMPLETED, ACTION_TIME_SET, ACTION_TIME_TICK } from '../../os/BroadcastBus';
import * as TimeService from '../../os/TimeService';
import NotificationService from '../../os/NotificationService';
import { createBrowserTimerSound } from '../../os/BrowserTimerSound';
import { resolveAppStrings } from '../../os/useAppStrings';
import { getLocale } from '../../os/locale';
import { useClockStore } from './state';
import { getNextTrigger, formatAlarmTime } from './utils';
import { createAlarmEngine } from './alarmEngine';
import { strings } from './res/strings';
import { stringsEn } from './res/strings.en';
import type { Alarm } from './types';

export type AlarmOccurrence = { id: string; alarm: Alarm; triggerAtMs: number; firedAtMs: number };
type RuntimeState = { revision: number; occurrences: AlarmOccurrence[]; armed: {alarmId:string;triggerAtMs:number}[] };
export const useAlarmRuntime=createVolatileOsStore<RuntimeState>('clock_alarms',{
  revision:0,occurrences:[],armed:[],
},{useImmer:false});
const sound=createBrowserTimerSound({gradualVolume:()=>useClockStore.getState().settings?.gradualVolume===true}),leases=new Map<string,{alarmId:string;source:Alarm|null}>();
const epoch=globalThis.crypto?.randomUUID?.()??Math.random().toString(36).slice(2);
let sequence=0,started=false,publishing=false,synchronizing=false,queued=false;
let interval:ReturnType<typeof setInterval>|null=null,audible:string|null=null;
const liveSource=(id:string)=>{
  const matches=useClockStore.getState().alarms.filter(alarm=>alarm.id===id);
  return matches.length===1?matches[0]:matches.length===0?null:undefined;
};
function publish(patch:Partial<RuntimeState>) {
  publishing=true;
  try {useAlarmRuntime.setState({...patch,revision:useAlarmRuntime.getState().revision+1});}
  finally {publishing=false;}
}
const engine=createAlarmEngine({
  alarms:()=>useClockStore.getState().alarms,
  now:()=>TimeService.now(),
  next:(alarm,now)=>getNextTrigger(alarm,TimeService.fromTimestamp(now)),
  fire:(alarm,triggerAtMs)=>{
    const source=useClockStore.getState().consumeAlarm(alarm);
    if(source===false||liveSource(alarm.id)!==source)return;
    const id=`clock.alarm.${epoch}.${++sequence}`;
    const occurrence={id,alarm:{...alarm},triggerAtMs,firedAtMs:TimeService.now()};
    leases.set(id,{alarmId:alarm.id,source});
    publish({occurrences:[...useAlarmRuntime.getState().occurrences,occurrence]});
    // A reentrant observer may cancel/reset the just-published occurrence.
    if(!useAlarmRuntime.getState().occurrences.some(item=>item.id===id))return;
    const s=resolveAppStrings(strings,stringsEn,getLocale());
    NotificationService.push({id,appId:'clock',title:s.alarm_ringing_title,
      body:`${formatAlarmTime(alarm.hour,alarm.minute)}${alarm.note?` · ${alarm.note}`:''}`,
      importance:'high',route:`/alarm/ringing/${id}`,autoCancel:false});
  },
});
function synchronize(timeSet=false) {
  if(!started)return;
  if(synchronizing){queued=true;return;}
  synchronizing=true;
  try {
    engine.refresh(timeSet);
    const current=useAlarmRuntime.getState(),removed:string[]=[];
    const occurrences=current.occurrences.filter(item=>{
      const lease=leases.get(item.id),keep=!!lease&&liveSource(lease.alarmId)===lease.source;
      if(!keep){removed.push(item.id);leases.delete(item.id);}return keep;
    });
    for(const id of removed)NotificationService.dismiss(id);
    const armed=engine.armed();
    if(removed.length||JSON.stringify(armed)!==JSON.stringify(current.armed))publish({occurrences,armed});
    const firstOccurrence=useAlarmRuntime.getState().occurrences[0];
    const first=firstOccurrence?.id??null;
    if(first!==audible){audible=first;if(first)sound.play(first,firstOccurrence?.alarm.tone);else sound.dispose();}
    if(armed.length&&interval===null)interval=setInterval(()=>synchronize(),200);
    else if(!armed.length&&interval!==null){clearInterval(interval);interval=null;}
  } finally {synchronizing=false;}
  if(queued){queued=false;synchronize();}
}
function clearRuntime(previousRevision:number) {
  for(const id of leases.keys())NotificationService.dismiss(id);
  leases.clear();sound.dispose();audible=null;
  publishing=true;
  try{useAlarmRuntime.setState({revision:previousRevision+1,occurrences:[],armed:[]},true);}
  finally{publishing=false;}
  engine.reset();synchronize();
}
useAlarmRuntime.subscribe((next,previous)=>{
  if(!publishing&&next.revision===0)clearRuntime(previous.revision);
});
export const alarmRuntime={
  start(){
    if(started)return;started=true;
    useClockStore.subscribe((next,previous)=>{if(next.alarms!==previous.alarms)synchronize();});
    BroadcastBus.registerReceiver(ACTION_TIME_SET,()=>synchronize(true));
    BroadcastBus.registerReceiver(ACTION_TIME_TICK,()=>synchronize());
    BroadcastBus.registerReceiver(ACTION_BOOT_COMPLETED,()=>synchronize());
    synchronize();
  },
  async primeSound(id?:string){
    if(id&&!useAlarmRuntime.getState().occurrences.some(item=>item.id===id))return false;
    const ready=await sound.prime();
    if(id&&!useAlarmRuntime.getState().occurrences.some(item=>item.id===id))return false;
    const first=useAlarmRuntime.getState().occurrences[0]?.id;
    const occurrence=useAlarmRuntime.getState().occurrences.find(item=>item.id===first);
    if(ready&&first)sound.play(first,occurrence?.alarm.tone);
    return ready;
  },
  dismiss(id:string){
    const current=useAlarmRuntime.getState();
    if(!current.occurrences.some(item=>item.id===id))return false;
    leases.delete(id);publish({occurrences:current.occurrences.filter(item=>item.id!==id)});
    NotificationService.dismiss(id);synchronize();return true;
  },
};
