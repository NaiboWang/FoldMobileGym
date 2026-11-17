import { useClockGestures } from '../hooks/useClockGestures';
import React, { useState } from 'react';
import type { Alarm } from '../types';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { useClockNow } from '../hooks/useClockNow';
import { WheelColumn } from '../components/WheelColumn';
import { formatCountdownText, getNextTrigger } from '../utils';

export const AlarmEditModal: React.FC<{
  alarm: Alarm;
  available?: boolean;
  onClose: () => void;
  onSave: (alarm: Alarm) => void;
  onMoreSettings: (hour: number, minute: number) => void;
}> = ({ alarm, available = true, onClose, onSave, onMoreSettings }) => {
  const s = useAppStrings(strings, stringsEn);
  const { bindTap, bindBack } = useClockGestures();
  const [hour, setHour] = useState(alarm.hour);
  const [minute, setMinute] = useState(alarm.minute);
  const now = useClockNow();
  const tempAlarm: Alarm = { ...alarm, hour, minute };
  const countdownText = formatCountdownText(getNextTrigger(tempAlarm, now), now.getTime(), s.alarm_rings_in_hours_infix, s.alarm_rings_in_minutes_suffix, s.alarm_schedule_unavailable);

  const handleDone = () => {
    if (!available) return;
    onSave({ ...alarm, hour, minute });
  };

  const handleMoreSettings = () => {
    onMoreSettings(hour, minute);
  };

  return (
    <div className="clock-alarm-quick absolute inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/25 backdrop-blur-md"
        {...bindBack()}
        aria-hidden
      />
      <div
        role="dialog" aria-modal="true" aria-label={s.alarm_modify_title}
        data-clock-dialog="quick"
        className="relative w-full max-w-[340px] bg-app-surface rounded-2xl shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-2 text-center">
          <h2 className="text-[22px] font-semibold text-black">{s.alarm_modify_title}</h2>
          <p role={!available ? 'status' : undefined} className="text-[15px] text-app-text-muted mt-1">{available ? countdownText : s.alarm_unavailable}</p>
        </div>
        {available && <div className="flex items-center justify-center gap-6 py-4">
          <div className="flex flex-col items-center">
            <span className="text-[16px] text-app-text-muted mb-2">{s.alarm_hour_label}</span>
            <WheelColumn label={s.wheel_hour_label} value={hour} options={Array.from({ length: 24 }, (_, i) => i)} onChange={setHour} medium wrap />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[16px] text-app-text-muted mb-2">{s.alarm_minute_label}</span>
            <WheelColumn label={s.wheel_minute_label} value={minute} options={Array.from({ length: 60 }, (_, i) => i)} onChange={setMinute} medium wrap />
          </div>
        </div>}
        <div className="flex gap-3 px-6 pb-6 pt-2">
          <button
            {...(available ? bindTap('alarm.editor.more.open', { onTrigger: handleMoreSettings }) : bindBack())}
            className="flex-1 py-3 rounded-xl bg-gray-100 text-black text-[16px] font-medium"
          >
            {available ? s.alarm_more_settings : s.cancel}
          </button>
          <button
            {...bindTap({ kind: 'action', id: 'alarm.quick.save.submit' }, { onTrigger: handleDone })}
            disabled={!available}
            className="flex-1 py-3 rounded-xl bg-app-primary text-white text-[16px] font-medium disabled:opacity-40"
          >
            {s.alarm_done}
          </button>
        </div>
      </div>
    </div>
  );
};
