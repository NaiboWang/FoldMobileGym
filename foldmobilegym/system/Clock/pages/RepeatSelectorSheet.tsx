import { useClockGestures } from '../hooks/useClockGestures';
import React from 'react';
import type { AlarmRepeat } from '../types';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { IcNavBack, IcNavForward, IcCheck } from '../res/icons';
import { useSheetDrag } from '../hooks/useSheetDrag';

type RepeatOption = { id: AlarmRepeat; label: string; subLabel?: string; tapProps: React.HTMLAttributes<HTMLButtonElement> };

export const RepeatSelectorSheet: React.FC<{
  value: AlarmRepeat;
  isEdit: boolean;
  onSelect: (repeat: AlarmRepeat) => void;
  onClose: () => void;
}> = ({ value, isEdit, onSelect, onClose }) => {
  const s = useAppStrings(strings, stringsEn);
  const { bindTap, bindBack } = useClockGestures();
  const repeatOptions: RepeatOption[] = [
    {
      id: 'once', label: s.alarm_repeat_once,
      tapProps: isEdit
        ? bindTap({ kind: 'action', id: 'alarm.edit.repeat.select.once' }, { onTrigger: () => onSelect('once') })
        : bindTap({ kind: 'action', id: 'alarm.add.repeat.select.once' }, { onTrigger: () => onSelect('once') }),
    },
    {
      id: 'daily', label: s.alarm_repeat_daily,
      tapProps: isEdit
        ? bindTap({ kind: 'action', id: 'alarm.edit.repeat.select.daily' }, { onTrigger: () => onSelect('daily') })
        : bindTap({ kind: 'action', id: 'alarm.add.repeat.select.daily' }, { onTrigger: () => onSelect('daily') }),
    },
    {
      id: 'workday', label: s.alarm_repeat_workday, subLabel: s.alarm_repeat_workday_sub,
      tapProps: isEdit
        ? bindTap({ kind: 'action', id: 'alarm.edit.repeat.select.workday' }, { onTrigger: () => onSelect('workday') })
        : bindTap({ kind: 'action', id: 'alarm.add.repeat.select.workday' }, { onTrigger: () => onSelect('workday') }),
    },
    {
      id: 'holiday', label: s.alarm_repeat_holiday, subLabel: s.alarm_repeat_holiday_sub,
      tapProps: isEdit
        ? bindTap({ kind: 'action', id: 'alarm.edit.repeat.select.holiday' }, { onTrigger: () => onSelect('holiday') })
        : bindTap({ kind: 'action', id: 'alarm.add.repeat.select.holiday' }, { onTrigger: () => onSelect('holiday') }),
    },
    {
      id: 'weekday', label: s.alarm_repeat_weekday,
      tapProps: isEdit
        ? bindTap({ kind: 'action', id: 'alarm.edit.repeat.select.weekday' }, { onTrigger: () => onSelect('weekday') })
        : bindTap({ kind: 'action', id: 'alarm.add.repeat.select.weekday' }, { onTrigger: () => onSelect('weekday') }),
    },
  ];
  const { sheetRef, dragOffset, isDragging, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel } = useSheetDrag(onClose);

  return (
    <div className="absolute inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" {...bindBack()} />
      <div
        ref={sheetRef}
        role="dialog" aria-modal="true" aria-label={s.alarm_repeat}
        data-clock-dialog="repeat"
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
          <div className="w-16 h-1 rounded-full bg-gray-300 -mt-1.5" aria-hidden />
        </div>
        <div className="flex items-center justify-between mb-4">
          <button className="w-10 h-10 flex items-center justify-center text-app-text-muted shrink-0" {...bindBack()}>
            <IcNavBack size={26} />
          </button>
          <span className="text-[20px] font-medium flex-1 text-center">{s.alarm_repeat}</span>
          <div className="w-10 shrink-0" />
        </div>

        <div data-scroll-container="alarmRepeat" data-scroll-direction="vertical" className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          <p className="px-4 pb-3 text-xs text-app-text-muted">{s.alarm_calendar_scope}</p>
          <div className="bg-app-surface rounded-2xl overflow-hidden mb-3">
            {repeatOptions.map(option => (
              <button
                key={option.id}
                {...option.tapProps}
                className="w-full px-4 py-5 flex items-center justify-between text-left"
              >
                <span className={`text-[16px] ${value === option.id ? 'text-app-primary font-medium' : 'text-black'}`}>
                  {option.subLabel ? `${option.label}（${option.subLabel}）` : option.label}
                </span>
                {value === option.id ? <IcCheck size={22} className="text-app-primary shrink-0" /> : null}
              </button>
            ))}
          </div>

          <div className="bg-app-surface rounded-2xl overflow-hidden">
            <div className="px-4 py-5 flex items-center justify-between text-gray-400">
              <span className="text-[16px] text-black">{s.alarm_shift}</span>
              <IcNavForward size={18} />
            </div>
            <div className="px-4 py-5 flex items-center justify-between text-gray-400">
              <span className="text-[16px] text-black">{s.alarm_custom}</span>
              <IcNavForward size={18} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
