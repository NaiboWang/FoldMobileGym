import { useClockGestures } from '../hooks/useClockGestures';
import React, { useState } from 'react';
import type { Alarm } from '../types';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { useClockNow } from '../hooks/useClockNow';
import { IcClose, IcCheck, IcNavForward } from '../res/icons';
import { Switch } from '../components/Switch';
import { WheelColumn } from '../components/WheelColumn';
import { formatAlarmToneLabel, formatCountdownText, getNextTrigger, getRepeatLabel } from '../utils';
import { useSheetDrag } from '../hooks/useSheetDrag';

export const AlarmEditorSheet: React.FC<{
  alarm: Alarm;
  isEdit?: boolean;
  available?: boolean;
  onClose: () => void;
  onSave: (alarm: Alarm) => void;
  onOpenRepeat: () => void;
  onOpenRingtone: () => void;
}> = ({ alarm, isEdit = false, available = true, onClose, onSave, onOpenRepeat, onOpenRingtone }) => {
  const s = useAppStrings(strings, stringsEn);
  const { bindTap, bindBack } = useClockGestures();
  const [hour, setHour] = useState(alarm.hour);
  const [minute, setMinute] = useState(alarm.minute);
  const [vibrate, setVibrate] = useState(alarm.vibrate ?? true);
  const [autoDelete, setAutoDelete] = useState(alarm.autoDelete ?? false);
  const [note, setNote] = useState(alarm.note ?? '');

  const now = useClockNow();
  const tempAlarm: Alarm = { ...alarm, hour, minute };
  const countdownText = formatCountdownText(getNextTrigger(tempAlarm, now), now.getTime(), s.alarm_rings_in_hours_infix, s.alarm_rings_in_minutes_suffix, s.alarm_schedule_unavailable);

  const { sheetRef, dragOffset, isDragging, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel } = useSheetDrag(onClose);

  return (
    <div className="absolute inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" {...bindBack()} />
      <div
        ref={sheetRef}
        role="dialog" aria-modal="true" aria-label={isEdit ? s.alarm_edit_title : s.alarm_add_title}
        data-clock-dialog="editor"
        className="clock-alarm-sheet absolute top-10 left-0 right-0 bottom-0 bg-app-bg rounded-t-[24px] px-5 pt-4 pb-6 flex flex-col"
        style={{ transform: `translateY(${dragOffset}px)`, transition: !isDragging ? 'transform var(--app-duration-short) var(--app-easing-decelerate)' : undefined }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div
          className="flex justify-center pt-2 pb-3 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={handlePointerDown}
        >
          <div className="w-16 h-1 rounded-full bg-gray-300 -mt-4" aria-hidden />
        </div>
        <div className="flex items-center justify-between mb-4">
          <button className="w-10 h-10 flex items-center justify-center text-app-text-muted shrink-0" {...bindBack()}>
            <IcClose size={26} />
          </button>
          <div className="flex flex-col items-center gap-0.5 min-w-0 flex-1 px-2">
            <span className="text-[20px] font-medium">{isEdit ? s.alarm_edit_title : s.alarm_add_title}</span>
            <span role={!available ? 'status' : undefined} className="text-[16px] text-app-text-muted">{available ? countdownText : s.alarm_unavailable}</span>
          </div>
          <button
            className="w-10 h-10 flex items-center justify-center text-black shrink-0 disabled:opacity-40"
            disabled={!available}
            {...(isEdit
              ? bindTap({ kind: 'action', id: 'alarm.edit.save.submit' }, { onTrigger: () => { if (available) onSave({ ...alarm, hour, minute, note, vibrate, autoDelete }); } })
              : bindTap({ kind: 'action', id: 'alarm.add.save.submit' }, { onTrigger: () => { if (available) onSave({ ...alarm, hour, minute, note, vibrate, autoDelete }); } }))}
          >
            <IcCheck size={26} />
          </button>
        </div>
        {available && <>
        <div data-hide-on-keyboard className="shrink-0 flex items-center justify-center gap-6 pt-2">
          <div className="flex flex-col items-center">
            <span className="text-[16px] text-app-text-muted mb-2">{s.alarm_hour_label}</span>
            <WheelColumn label={s.wheel_hour_label} value={hour} options={Array.from({ length: 24 }, (_, i) => i)} onChange={setHour} medium wrap />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[16px] text-app-text-muted mb-2">{s.alarm_minute_label}</span>
            <WheelColumn label={s.wheel_minute_label} value={minute} options={Array.from({ length: 60 }, (_, i) => i)} onChange={setMinute} medium wrap />
          </div>
        </div>
        <div data-scroll-container="alarmEditor" data-scroll-direction="vertical" className="flex-1 min-h-0 overflow-y-auto no-scrollbar pt-6">
          <div className="bg-app-surface rounded-2xl overflow-hidden mb-3">
            <button
              {...bindTap('alarm.repeat.open', { onTrigger: onOpenRepeat })}
              className="w-full px-4 py-5 flex items-center justify-between text-left"
            >
              <span className="text-[16px] text-black">{s.alarm_repeat}</span>
              <div className="flex items-center gap-2 text-gray-400 text-[16px]">
                <span>{getRepeatLabel(alarm.repeat, s)}</span>
                <IcNavForward size={18} />
              </div>
            </button>
            <button type="button" {...bindTap('alarm.ringtone.open', { onTrigger: onOpenRingtone })}
              className="w-full px-4 py-5 flex items-center justify-between text-left">
              <span className="text-[16px] text-black">{s.alarm_ringtone}</span>
              <span className="text-[16px] text-app-text-muted">{formatAlarmToneLabel(alarm.tone, s)} <span aria-hidden="true">›</span></span>
            </button>
            <div className="px-4 py-5 flex items-center justify-between">
              <span className="text-[16px] text-black">{s.alarm_note}</span>
              <input
                aria-label={s.alarm_note}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={s.alarm_note_placeholder}
                className="bg-transparent text-right text-[16px] text-app-text-muted placeholder:text-gray-300 outline-none w-40"
              />
            </div>
            <div className="px-4 py-5 flex items-center justify-between">
              <span className="text-[16px] text-black">{s.alarm_vibrate}</span>
              <Switch value={vibrate} onChange={setVibrate} />
            </div>
            <div className="px-4 py-5 flex items-center justify-between">
              <span className="text-[16px] text-black">{s.alarm_auto_delete}</span>
              <Switch value={autoDelete} onChange={setAutoDelete} />
            </div>
          </div>
          <div className="h-16" aria-hidden />
        </div>
        </>}
      </div>
    </div>
  );
};
