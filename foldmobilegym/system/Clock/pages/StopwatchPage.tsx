import React, { useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { CollapsingToolbar, ToolbarIconButton, TOOLBAR_SPACER_HEIGHT } from '../../../os/components/CollapsingToolbar';
import { IcMoreVert, IcFlag, IcPlay, IcPause, IcStop, IcReset } from '../res/icons';
import { pad2 } from '../utils';
import { useActivityId } from '../../../os/ActivityContext';
import { useOS } from '../../../os/OSContext';
import { stopwatchRuntime, useStopwatchRuntime } from '../stopwatchRuntime';
import { useClockGestures } from '../hooks/useClockGestures';

const formatStopwatchTime = (ms: number) => {
  const totalCentis = Math.floor(ms / 10);
  const centis = totalCentis % 100;
  const totalSeconds = Math.floor(totalCentis / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return `${pad2(minutes)}:${pad2(seconds)}.${pad2(centis)}`;
};

const StopwatchDisplay: React.FC<{ hasLaps: boolean }> = ({ hasLaps }) => {
  const elapsed = useStopwatchRuntime(state => state.elapsedMs);
  return (
    <div className={`font-medium text-black tabular-nums ${hasLaps ? 'text-[40px]' : 'text-[64px]'}`}>
      {formatStopwatchTime(elapsed)}
    </div>
  );
};

const StopwatchDial: React.FC = () => {
  const elapsed = useStopwatchRuntime(state => state.elapsedMs);
  const secondsAngle = (elapsed % 60000) / 60000 * 360;
  const minutesAngle = (elapsed % 1800000) / 1800000 * 360;
  return (
    <svg className="clock-stopwatch-dial" viewBox="0 0 240 240" aria-hidden="true" data-clock-stopwatch-dial>
      <circle cx="120" cy="120" r="116" fill="var(--app-surface, white)" />
      {Array.from({ length: 120 }, (_, i) => (
        <line key={i} x1="120" y1="7" x2="120" y2={i % 10 === 0 ? 13 : 10}
          stroke={i % 10 === 0 ? '#25272b' : '#c6c9cd'} strokeWidth={i % 10 === 0 ? 1.4 : 0.8}
          transform={`rotate(${i * 3} 120 120)`} />
      ))}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = i * Math.PI / 6;
        return <text key={i} x={120 + 95 * Math.sin(angle)} y={120 - 95 * Math.cos(angle)}
          textAnchor="middle" dominantBaseline="central" fontSize="18" fontWeight="600" fill="#17191d">{i === 0 ? 60 : i * 5}</text>;
      })}
      <circle cx="120" cy="120" r="37" fill="none" stroke="#d9dce0" strokeWidth="1" strokeDasharray="1 2" />
      {Array.from({ length: 6 }, (_, i) => {
        const angle = i * Math.PI / 3;
        return <text key={i} x={120 + 27 * Math.sin(angle)} y={120 - 27 * Math.cos(angle)}
          textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#303238">{i === 0 ? 30 : i * 5}</text>;
      })}
      <line x1="120" y1="120" x2="120" y2="87" stroke="#303238" strokeWidth="1.5"
        transform={`rotate(${minutesAngle} 120 120)`} />
      <line x1="120" y1="134" x2="120" y2="19" stroke="#3275fa" strokeWidth="2.5" strokeLinecap="round"
        transform={`rotate(${secondsAngle} 120 120)`} data-clock-stopwatch-hand />
      <circle cx="120" cy="120" r="2.5" fill="#3275fa" />
    </svg>
  );
};

export const StopwatchPage: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  const phase = useStopwatchRuntime(state => state.phase);
  const laps = useStopwatchRuntime(state => state.laps);
  const revision = useStopwatchRuntime(state => state.revision);
  const { bindTap } = useClockGestures();
  const location = useLocation();
  const currentLocation = useRef(location);
  currentLocation.current = location;
  const activityId = useActivityId();
  useOS();
  const running = phase === 'running';
  const owner = () => {
    const os = window.__OS__?.getState();
    const top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
    return !os?.isLauncherVisible && !os?.isRecentsVisible
      && top?.activityId === activityId && currentLocation.current.pathname === '/stopwatch'
      && currentLocation.current.key === location.key
      && useStopwatchRuntime.getState().revision === revision;
  };
  const action = (id: 'stopwatch.run.start' | 'stopwatch.run.pause' | 'stopwatch.run.lap' | 'stopwatch.run.reset', run: () => void) =>
    bindTap({ kind: 'action', id }, { onTrigger: () => { if (owner()) run(); } });
  const start = () => stopwatchRuntime.start(revision);
  const pause = () => stopwatchRuntime.pause(revision);
  const lap = () => stopwatchRuntime.lap(revision);
  const reset = () => stopwatchRuntime.reset(revision);

  return (
    <div className="h-full w-full bg-app-bg relative flex flex-col">
      <CollapsingToolbar
        title={s.stopwatch_tab}
        bgClass="bg-app-bg"
        rightContent={<ToolbarIconButton icon={IcMoreVert} label={s.toolbar_more} />}
      />
      <div className="shrink-0" style={{ height: TOOLBAR_SPACER_HEIGHT }} aria-hidden />
      <div className="px-[26px] pb-2">
        <h1 className="text-[32px] font-normal text-app-text">{s.stopwatch_tab}</h1>
      </div>
      <div className="clock-stopwatch-scroll px-6 flex-1 min-h-0 overflow-y-auto overscroll-contain" data-scroll-container="main" data-scroll-direction="vertical">
       <div className="clock-stopwatch-scroll-content min-h-full flex flex-col">
        {laps.length === 0 && <StopwatchDial />}
        <div className={laps.length > 0 ? 'flex items-center justify-center py-4' : 'flex-1 flex items-center justify-center'}>
          <StopwatchDisplay
            hasLaps={laps.length > 0}
          />
        </div>
        {laps.length > 0 && (
          <div className="clock-stopwatch-laps flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {laps.map(item => (
              <div key={item.id} className="h-(--app-stopwatch-lap-height) flex items-center justify-between text-[20px] text-app-text-muted px-1 border-b border-gray-100">
                <span>{pad2(item.number)}</span>
                <span>+ {formatStopwatchTime(item.lapMs)}</span>
                <span className="text-black font-medium">{formatStopwatchTime(item.totalMs)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="clock-stopwatch-controls flex items-center justify-center gap-20 mt-auto pb-28">
          <div className="clock-stopwatch-controls-compact flex items-center justify-center gap-20">
          {running ? (
            <>
              <button type="button" {...action('stopwatch.run.lap', lap)} className="px-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary">
                <IcFlag size={22} />
              </button>
              <button type="button" {...action('stopwatch.run.pause', pause)} className="px-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary">
                <IcPause size={22} />
              </button>
            </>
          ) : phase === 'idle' ? (
            <button type="button" {...action('stopwatch.run.start', start)} className="clock-stopwatch-start px-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary">
              <IcPlay size={28} />
            </button>
          ) : (
            <>
              <button type="button" {...action('stopwatch.run.reset', reset)} className="px-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary">
                <IcStop size={20} />
              </button>
              <button type="button" {...action('stopwatch.run.start', start)} className="px-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary">
                <IcPlay size={28} />
              </button>
            </>
          )}
          </div>
          <div className="clock-stopwatch-controls-expanded items-center justify-center gap-14">
            <button type="button" {...(phase === 'idle' ? {} : action('stopwatch.run.reset', reset))} aria-label={s.stopwatch_tab}
              className="clock-stopwatch-secondary w-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-gray-300">
              <IcReset size={20} />
            </button>
            {running ? (
              <button type="button" {...action('stopwatch.run.pause', pause)} className="clock-stopwatch-start w-[70px] h-[70px] rounded-full bg-app-primary shadow flex items-center justify-center text-white">
                <IcPause size={25} />
              </button>
            ) : (
              <button type="button" {...(phase === 'idle' ? action('stopwatch.run.start', start) : action('stopwatch.run.start', start))} className="clock-stopwatch-start w-[70px] h-[70px] rounded-full bg-app-primary shadow flex items-center justify-center text-white">
                <IcPlay size={28} />
              </button>
            )}
            <button type="button" {...(running ? action('stopwatch.run.lap', lap) : {})} aria-label={s.stopwatch_tab}
              className="clock-stopwatch-secondary w-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-gray-300">
              <IcFlag size={20} />
            </button>
          </div>
        </div>
       </div>
      </div>
    </div>
  );
};
