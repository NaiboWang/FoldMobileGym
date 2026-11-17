import React, { useEffect, useRef, useState } from 'react';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { CollapsingToolbar, ToolbarIconButton, TOOLBAR_SPACER_HEIGHT } from '../../../os/components/CollapsingToolbar';
import { IcAlarm, IcMoreVert, IcPlay, IcPause, IcReset, IcStop, IcSun } from '../res/icons';
import { WheelColumn } from '../components/WheelColumn';
import { formatTimerValue, formatTimerTotal } from '../timerDisplay';
import {useLocation} from 'react-router-dom';
import {useActivityId} from '../../../os/ActivityContext';
import {useOS} from '../../../os/OSContext';
import {createScreenWakeLease,type WakeLeaseStatus} from '../../../os/ScreenWakeLease';
import {timerRuntime,useTimerRuntime} from '../timerRuntime';
import {useClockGestures} from '../hooks/useClockGestures';

export const TimerPage: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  // Recreated UI adopts the existing run, without changing the initial 20-minute default.
  const [initialDuration] = useState(() => useTimerRuntime.getState().totalMs / 1000 || 20 * 60);
  const [hours, setHours] = useState(() => Math.floor(initialDuration / 3600));
  const [minutes, setMinutes] = useState(() => Math.floor(initialDuration % 3600 / 60));
  const [seconds, setSeconds] = useState(() => initialDuration % 60);
  const runtime=useTimerRuntime(),{bindTap}=useClockGestures(),location=useLocation(),activityId=useActivityId(),{state:osState}=useOS();
  const running=runtime.phase==='running',remaining=Math.ceil(runtime.remainingMs/1000),total=runtime.totalMs/1000;
  const [keepScreen,setKeepScreen]=useState(false),[wakeStatus,setWakeStatus]=useState<WakeLeaseStatus>('off'),[soundReady,setSoundReady]=useState<boolean|null>(null);
  const soundRequest=useRef(0);
  const lease=useRef<ReturnType<typeof createScreenWakeLease>|null>(null),mounted=useRef(false),current=useRef(location);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  current.current=location;
  const owner=()=>{
    const os=window.__OS__?.getState(),top=os?.tasks.find(task=>task.taskId===os.activeTaskId)?.stack.at(-1);
    return !os?.isLauncherVisible&&!os?.isRecentsVisible&&top?.activityId===activityId&&current.current.key===location.key&&current.current.pathname==='/timer'
      &&useTimerRuntime.getState().revision===runtime.revision;
  };
  const foreground=!!osState.activeTaskId&&!osState.isLauncherVisible&&!osState.isRecentsVisible&&osState.tasks.find(task=>task.taskId===osState.activeTaskId)?.stack.at(-1)?.activityId===activityId&&location.pathname==='/timer';
  // Never report an active request in the paused/background render while its release callback settles.
  const effectiveWakeStatus = keepScreen && foreground && running ? wakeStatus : 'off';
  useEffect(()=>{const value=createScreenWakeLease(setWakeStatus);lease.current=value;return()=>{lease.current=null;value.dispose();};},[]);
  useEffect(()=>{lease.current?.setWanted(keepScreen&&foreground&&running);},[keepScreen,foreground,running]);
  const primeSound=()=>{const request=++soundRequest.current;void timerRuntime.primeSound().then(ready=>{if(mounted.current&&request===soundRequest.current)setSoundReady(ready);});};
  const handleStart=()=>{if(!owner())return;primeSound();timerRuntime.start(hours*3600+minutes*60+seconds,runtime.revision);};
  const handlePause=()=>{if(owner())timerRuntime.pause(runtime.revision);};
  const handleResume=()=>{if(!owner())return;primeSound();timerRuntime.resume(runtime.revision);};
  const handleStop=()=>{if(owner())timerRuntime.stop(runtime.revision);};
  const handleReset=()=>{if(!owner()||runtime.phase!=='setup')return;setHours(0);setMinutes(0);setSeconds(0);setSoundReady(null);};
  const handleBell=()=>{if(!owner()||runtime.phase!=='setup')return;primeSound();};

  const presetList = [
    { label: '00:20:00', seconds: 1200 },
    { label: '00:30:00', seconds: 1800 },
    { label: '00:10:00', seconds: 600 },
    { label: '19:30:00', seconds: 70200 },
    { label: '00:05:00', seconds: 300 },
    { label: '00:15:00', seconds: 900 },
  ];

  const applyPreset = (secondsValue: number) => {
    if(!owner()||runtime.phase!=='setup')return;
    const hh = Math.floor(secondsValue / 3600);
    const mm = Math.floor((secondsValue % 3600) / 60);
    const ss = secondsValue % 60;
    setHours(hh);
    setMinutes(mm);
    setSeconds(ss);
  };

  const progress = total > 0 ? (remaining / total) * 100 : 0;

  return (
    <div className="h-full w-full bg-app-bg relative flex flex-col" data-clock-timer-phase={runtime.phase}>
      <CollapsingToolbar
        title={s.timer_tab}
        bgClass="bg-app-bg"
        rightContent={<ToolbarIconButton icon={IcMoreVert} label={s.toolbar_more} />}
      />
      <div className="shrink-0" style={{ height: TOOLBAR_SPACER_HEIGHT }} aria-hidden />
      <div className="px-[26px] pb-2">
        <h1 className="text-[32px] font-normal text-app-text">{s.timer_tab}</h1>
      </div>
      <div className="clock-timer-scroll px-6 flex-1 min-h-0 overflow-y-auto overscroll-contain" data-scroll-container="main" data-scroll-direction="vertical">
       <div className="clock-timer-scroll-content min-h-full flex flex-col">
        {runtime.phase==='finished' ? (
          <div data-clock-timer-finished="true" role="status" className="flex-1 flex flex-col items-center justify-center gap-5 pb-28 text-center">
            <div className="text-[42px] tabular-nums text-app-text">00:00:00</div>
            <h2 className="text-2xl font-semibold text-app-text">{s.timer_finished_title}</h2>
            <p className="text-sm text-app-text-muted max-w-sm">{s.timer_sound_scope}</p>
            {soundReady===false&&<p className="text-sm text-app-text-muted">{s.timer_sound_unavailable}</p>}
            <div className="flex gap-4">
              <button type="button" className="px-7 py-3 rounded-full bg-app-surface border border-app-border" {...bindTap({kind:'action',id:'timer.finish.dismiss'},{onTrigger:handleStop})}>{s.timer_done}</button>
              <button type="button" className="px-7 py-3 rounded-full bg-app-primary text-white" {...bindTap({kind:'action',id:'timer.finish.restart'},{onTrigger:()=>{if(owner()){primeSound();timerRuntime.start(total,runtime.revision);}}})}>{s.timer_restart}</button>
            </div>
          </div>
        ) : runtime.phase==='setup' ? (
          <>
            <div className="flex justify-center items-center gap-2 mt-12 -mb-2">
              <WheelColumn label={s.wheel_hour_label} value={hours} options={Array.from({ length: 24 }, (_, i) => i)} onChange={value=>{if(owner()&&runtime.phase==='setup')setHours(value);}} large wrap />
              <span className="text-[42px] font-medium text-black leading-none pb-2">:</span>
              <WheelColumn label={s.wheel_minute_label} value={minutes} options={Array.from({ length: 60 }, (_, i) => i)} onChange={value=>{if(owner()&&runtime.phase==='setup')setMinutes(value);}} large wrap />
              <span className="text-[42px] font-medium text-black leading-none pb-2">:</span>
              <WheelColumn label={s.wheel_second_label} value={seconds} options={Array.from({ length: 60 }, (_, i) => i)} onChange={value=>{if(owner()&&runtime.phase==='setup')setSeconds(value);}} large wrap />
            </div>
            <div className="clock-timer-presets grid grid-cols-3 gap-3 mt-12 mb-6">
              {presetList.map(item => (
                <button
                  key={item.label}
                  aria-pressed={hours * 3600 + minutes * 60 + seconds === item.seconds}
                  data-selected={hours * 3600 + minutes * 60 + seconds === item.seconds}
                  {...bindTap({kind:'action',id:'timer.preset.select.duration'},{params:{seconds:item.seconds},onTrigger:()=>applyPreset(item.seconds)})}
                  className={`clock-timer-preset py-2 rounded-xl border text-[20px] ${
                    hours * 3600 + minutes * 60 + seconds === item.seconds
                      ? 'bg-gray-200 border-app-border text-gray-800'
                      : 'border-app-border text-app-text-muted'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-16 mt-auto pb-28">
              <button
                className="clock-timer-reset w-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary"
                type="button" aria-label={s.timer_reset} disabled={hours*3600+minutes*60+seconds===0}
                {...bindTap({kind:'action',id:'timer.setup.reset'},{onTrigger:handleReset})}
              >
                <IcReset size={22} />
              </button>
              <button
                className="clock-timer-start px-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary"
                type="button" aria-label={s.timer_start} disabled={hours*3600+minutes*60+seconds===0} {...bindTap({kind:'action',id:'timer.run.start'},{onTrigger:handleStart})}
              >
                <IcPlay size={28} />
              </button>
              <button
                className="clock-timer-bell w-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary"
                type="button" aria-label={s.timer_bell} aria-pressed={soundReady===true}
                {...bindTap({kind:'action',id:'timer.setup.bell'},{onTrigger:handleBell})}
              >
                <IcAlarm size={22} />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 flex items-center justify-center mb-6">
              <div className="relative w-(--app-timer-ring-size) h-(--app-timer-ring-size)">
                <svg className="w-full h-full text-app-primary" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" stroke="var(--app-border)" strokeWidth="6" fill="none" />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={`${Math.PI * 2 * 52}`}
                    strokeDashoffset={`${Math.PI * 2 * 52 * (1 - progress / 100)}`}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-[32px] font-medium text-black">{formatTimerValue(remaining)}</div>
                  <div className="text-[12px] text-gray-400" data-clock-timer-total>{formatTimerTotal(total, s)}</div>
                  <button
                    type="button" aria-pressed={effectiveWakeStatus==='active'} {...bindTap({kind:'action',id:'timer.screen.toggle'},{onTrigger:()=>{if(owner())setKeepScreen(!keepScreen);}})}
                    className="mt-3 px-4 py-1 rounded-full bg-app-primary text-white text-[12px] flex items-center gap-1"
                  >
                    <IcSun size={14} />
                    {effectiveWakeStatus==='active'?s.timer_screen_on_active:effectiveWakeStatus==='pending'?s.timer_keep_pending:effectiveWakeStatus==='unavailable'?s.timer_keep_unavailable:s.timer_screen_on}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-20 pb-28">
              <button type="button" aria-label={s.timer_stop} {...bindTap({kind:'action',id:'timer.run.stop'},{onTrigger:handleStop})} className="w-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary">
                <IcStop size={20} />
              </button>
              {running ? (
                <button type="button" aria-label={s.timer_pause} {...bindTap({kind:'action',id:'timer.run.pause'},{onTrigger:handlePause})} className="w-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary">
                  <IcPause size={22} />
                </button>
              ) : (
                <button type="button" aria-label={s.timer_resume} {...bindTap({kind:'action',id:'timer.run.resume'},{onTrigger:handleResume})} className="w-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary">
                  <IcPlay size={22} />
                </button>
              )}
            </div>
          </>
        )}
       </div>
      </div>
    </div>
  );
};
