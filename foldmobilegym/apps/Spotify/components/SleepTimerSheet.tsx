import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IcCheck, IcClose } from '../res/icons';
import { useSpotifyStore } from '../state';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import * as TimeService from '../../../os/TimeService';

const TIMER_OPTIONS = [5, 10, 15, 30, 45, 60] as const;
const DISMISS_THRESHOLD = 80;

export interface SleepTimerSheetProps {
  backdropProps?: React.HTMLAttributes<HTMLDivElement>;
  onClose: () => void;
}

/**
 * 睡眠定时器底部面板：播放器 overlay 与队列内嵌共用同一实现。
 * 状态来自 `settings.playback`，与 store 单一数据源一致。
 */
export const SleepTimerSheet: React.FC<SleepTimerSheetProps> = ({ backdropProps, onClose }) => {
  const s = useSpotifyStrings();
  const { bindTap } = useSpotifyGestures();
  const sleepTimer = useSpotifyStore(st => st.settings.playback.sleepTimer);
  const deadline = useSpotifyStore(st => st.settings.playback.sleepTimerDeadlineMs ?? 0);
  const setSleepTimer = useSpotifyStore(st => st.setSleepTimer);
  const [now, setNow] = useState(() => TimeService.now());

  useEffect(() => {
    if (!deadline) return;
    const timer = window.setInterval(() => setNow(TimeService.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  const remainingSeconds = deadline > 0 ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  const remainingLabel = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`;

  const dragStartY = useRef(0);
  const barRef = useRef<HTMLDivElement>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY;
    setIsDragging(true);
    barRef.current?.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const dy = Math.max(0, e.clientY - dragStartY.current);
      setDragOffsetY(dy);
    },
    [isDragging],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (barRef.current?.hasPointerCapture(e.pointerId)) {
        barRef.current.releasePointerCapture(e.pointerId);
      }
      if (!isDragging) return;
      setIsDragging(false);
      if (dragOffsetY >= DISMISS_THRESHOLD) {
        setDragOffsetY(0);
        onClose();
        return;
      }
      setDragOffsetY(0);
    },
    [dragOffsetY, isDragging, onClose],
  );

  return (
    <>
      <div {...backdropProps} className="absolute inset-0 bg-black/60 z-[55] backdrop-blur-sm transition-opacity" />
      <div
        className="absolute bottom-0 left-0 right-0 bg-[#2A2A2A] text-white z-[56] rounded-t-[20px] pb-12 animate-in slide-in-from-bottom duration-300"
        style={{
          transform: `translateY(${dragOffsetY}px)`,
          transition: !isDragging ? 'transform var(--app-duration-short) var(--app-easing-decelerate)' : undefined,
        }}
        onPointerMove={onPointerMove}
        onPointerLeave={e => e.buttons === 0 && onPointerUp(e)}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={barRef}
          className="w-full flex cursor-grab items-center justify-center pt-3 pb-2"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
        >
          <div className="w-10 h-1 bg-gray-600 rounded-full" />
        </div>

        <div className="px-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold">{s.player_sleep_timer}</h2>
            <button type="button" onClick={onClose}>
              <IcClose size={24} className="text-gray-400" />
            </button>
          </div>

          {deadline > 0 && <p className="mb-3 text-sm text-gray-300" role="status" data-sleep-timer-remaining>
            {s.player_timer_remaining.replace('{{time}}', remainingLabel)}
          </p>}

          <div className="space-y-2">
            {TIMER_OPTIONS.map(min => (
              <div
                key={min}
                {...bindTap(
                  { kind: 'action', id: 'player.timer.set' },
                  {
                    params: { minutes: min },
                    onTrigger: () => {
                      setSleepTimer(min);
                      onClose();
                    },
                  },
                )}
                className="flex justify-between items-center py-3 active:bg-white/5 rounded px-2 cursor-pointer"
              >
                <span>
                  {min} {s.player_minutes}
                </span>
                {sleepTimer === min && <IcCheck size={20} className="text-app-primary" />}
              </div>
            ))}
            <div
              {...bindTap(
                { kind: 'action', id: 'player.timer.set' },
                {
                  params: { minutes: 0 },
                  onTrigger: () => {
                    setSleepTimer(0);
                    onClose();
                  },
                },
              )}
              className="flex justify-between items-center py-3 active:bg-white/5 rounded px-2 cursor-pointer"
            >
              <span>{s.player_close_timer}</span>
              {sleepTimer === 0 && <IcCheck size={20} className="text-app-primary" />}
            </div>
          </div>

          <p className="mt-6 border-t border-white/10 pt-4 text-xs text-gray-400" role="note">
            {s.player_fade_simulation_unavailable}
          </p>
        </div>
      </div>
    </>
  );
};
