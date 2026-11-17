import React,{useState} from 'react';
import {useParams} from 'react-router-dom';
import {useAppStrings} from '../../../os/useAppStrings';
import * as TimeService from '../../../os/TimeService';
import {alarmRuntime,useAlarmRuntime} from '../alarmRuntime';
import {useAlarmInteractionOwner} from '../hooks/useAlarmInteractionOwner';
import {useClockGestures} from '../hooks/useClockGestures';
import {strings} from '../res/strings';
import {stringsEn} from '../res/strings.en';
import {formatAlarmTime} from '../utils';

export function AlarmRingingPage(){
  const {ringId=''}=useParams(),s=useAppStrings(strings,stringsEn),{bindTap}=useClockGestures();
  const occurrence=useAlarmRuntime(state=>state.occurrences.find(item=>item.id===ringId));
  const active=useAlarmInteractionOwner(ringId),[audio,setAudio]=useState<{id:string;ready:boolean}|null>(null);
  const returnProps=bindTap('alarm.ringing.return');
  return <main className="h-full min-h-0 overflow-y-auto bg-app-bg text-app-text flex flex-col items-center px-6 pt-16 pb-10 text-center" data-clock-ringing={ringId} data-scroll-container="main" data-scroll-direction="vertical">
    <h1 className="text-2xl font-medium mb-8">{occurrence?s.alarm_ringing_title:s.alarm_ringing_unavailable}</h1>
    {occurrence&&<>
      <div className="text-[64px] leading-none tabular-nums">{formatAlarmTime(occurrence.alarm.hour,occurrence.alarm.minute)}</div>
      <p className="mt-4 text-lg break-words max-w-full">{occurrence.alarm.note||s.alarm_tab}</p>
      <p className="mt-2 text-sm text-app-text-muted">{TimeService.fromTimestamp(occurrence.triggerAtMs).toLocaleDateString()}</p>
      <button type="button" className="mt-10 rounded-full bg-app-primary text-white px-12 py-4" {...bindTap({kind:'action',id:'alarm.ringing.dismiss'},{onTrigger:()=>{if(active())alarmRuntime.dismiss(ringId);}})}>{s.alarm_ring_dismiss}</button>
      <button type="button" className="mt-4 rounded-full bg-app-surface px-6 py-3" {...bindTap({kind:'action',id:'alarm.ringing.audio.enable'},{onTrigger:()=>{
        if(!active())return;void alarmRuntime.primeSound(ringId).then(ready=>{if(active()&&useAlarmRuntime.getState().occurrences.some(item=>item.id===ringId))setAudio({id:ringId,ready});});
      }})}>{s.alarm_ring_enable_audio}</button>
      {audio?.id===ringId&&<p role="status" className="mt-3 text-sm">{audio.ready?s.alarm_ring_audio_ready:s.alarm_ring_audio_unavailable}</p>}
    </>}
    <p className="mt-8 max-w-lg text-sm text-app-text-muted">{s.alarm_runtime_scope}</p>
    <button type="button" className="mt-6 px-6 py-3 text-app-primary" {...returnProps} onClick={event=>{if(active())returnProps.onClick?.(event);}}>{s.alarm_ring_return}</button>
  </main>;
}
