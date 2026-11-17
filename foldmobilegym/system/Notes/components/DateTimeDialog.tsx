import { useLocation } from 'react-router-dom';
import { isFullNoteEditor } from '../editorView';
import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as TimeService from '@/os/TimeService';
import { useLocale } from '../../../os/locale';
import { useNotesGestures } from '../hooks/useNotesGestures';
import { colors } from '../res/colors';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import {
  buildReminderTimestamp,
  clampReminderSelection,
  getReminderDateOptions,
  getReminderHourOptions,
  getReminderMinuteOptions,
  startOfLocalDay,
} from './dateTimePickerModel';

type PickerOption<T extends string | number> = {
  value: T;
  label: string;
};

const ITEM_HEIGHT = 56;
const PAD_HEIGHT = ITEM_HEIGHT;
const VISIBLE_HEIGHT = ITEM_HEIGHT * 3;
const SELECTED_TEXT = '#4A86FF';
const MUTED_TEXT = '#C6C6C6';

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

const PickerColumn = <T extends string | number>({ value, options, onChange, className = '', action, scrollName, label }: {
  value: T; options: PickerOption<T>[]; onChange: (value: T) => void; className?: string;
  action: { id: string }; scrollName: string; label: string;
}) => {
  const optionPrefix = useId();
  const containerRef = useRef<HTMLDivElement | null>(null), raf = useRef(0), snapTimer = useRef(0);
  const latest = useRef({ value, options, onChange }); latest.current = { value, options, onChange };
  const align = () => {
    const el = containerRef.current, current = latest.current;
    if (!el?.clientHeight || !el.getClientRects().length) return;
    const index = current.options.findIndex(option => option.value === current.value);
    if (index >= 0) el.scrollTop = index * ITEM_HEIGHT;
  };
  const snap = () => {
    const el = containerRef.current;
    if (!el?.clientHeight || !el.getClientRects().length) return;
    const index = Math.max(0, Math.min(Math.round(el.scrollTop / ITEM_HEIGHT), latest.current.options.length - 1));
    el.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' });
  };
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const onScroll = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        if (!el.clientHeight || !el.getClientRects().length) return;
        const current = latest.current;
        const index = Math.max(0, Math.min(Math.round(el.scrollTop / ITEM_HEIGHT), current.options.length - 1));
        const option = current.options[index];
        if (option && option.value !== current.value) current.onChange(option.value);
        window.clearTimeout(snapTimer.current); snapTimer.current = window.setTimeout(snap, 80);
      });
    };
    const observer = new ResizeObserver(align); observer.observe(el);
    el.addEventListener('scroll', onScroll); align();
    return () => { observer.disconnect(); el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf.current); window.clearTimeout(snapTimer.current); };
  }, []);
  const signature = options.map(option => String(option.value)).join('|');
  useLayoutEffect(align, [value, signature]);
  return <div className={`relative min-w-0 ${className}`} style={{ height: VISIBLE_HEIGHT }}>
    <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-[18px] pointer-events-none" style={{ height: ITEM_HEIGHT, backgroundColor: 'rgba(74,134,255,0.08)' }} />
    <div ref={containerRef} role="listbox" tabIndex={0} aria-label={label} aria-activedescendant={`${optionPrefix}-${value}`} data-reminder-column={scrollName}
      data-scroll-container={scrollName} data-scroll-direction="vertical"
      data-action={action.id} data-action-type="input" data-action-params={JSON.stringify({ value })}
      className="relative h-full overflow-y-auto no-scrollbar" style={{ scrollSnapType: 'y mandatory' }}
      onPointerUp={snap} onPointerCancel={snap}
      onKeyDown={event => {
        const index = options.findIndex(option => option.value === value);
        const next = event.key === 'ArrowDown' ? Math.min(options.length - 1, index + 1) : event.key === 'ArrowUp' ? Math.max(0, index - 1) : -1;
        if (next < 0) return;
        event.preventDefault(); onChange(options[next].value);
      }}>
      <div style={{ height: PAD_HEIGHT }} />
      {options.map(option => <button key={String(option.value)} id={`${optionPrefix}-${option.value}`} tabIndex={-1} role="option" aria-selected={option.value === value}
        className="w-full h-[56px] px-2 flex items-center justify-center text-center"
        style={{ color: option.value === value ? SELECTED_TEXT : MUTED_TEXT, fontSize: option.value === value ? 18 : 17, fontWeight: option.value === value ? 700 : 500, scrollSnapAlign: 'center' }}
        onClick={() => { onChange(option.value); }}>
        {option.label}
      </button>)}
      <div style={{ height: PAD_HEIGHT }} />
    </div>
  </div>;
};

export const DateTimeDialog: React.FC<{
  title: string;
  initialTimestamp?: number;
  available?: boolean;
  onConfirm: (timestamp: number) => void;
  onClear?: () => void;
}> = ({ title, initialTimestamp, available = true, onConfirm, onClear }) => {
  const s = useAppStrings(strings, stringsEn);
  const location = useLocation(), focused = isFullNoteEditor(location.pathname, location.search);
  const locale = useLocale();
  const { bindTap, bindBack } = useNotesGestures();
  const [openedAtTs] = useState(() => TimeService.now());
  const [selectedTs, setSelectedTs] = useState(() =>
    clampReminderSelection(initialTimestamp ?? openedAtTs, openedAtTs),
  );
  const [reminderEnabled, setReminderEnabled] = useState(() => !onClear || typeof initialTimestamp === 'number');

  const selectedDate = TimeService.fromTimestamp(selectedTs);
  const selectedDayStart = startOfLocalDay(selectedTs);
  const selectedHour = selectedDate.getHours();
  const selectedMinute = selectedDate.getMinutes();

  const dateOptions = useMemo(() => getReminderDateOptions(openedAtTs).map(option => ({ ...option,
    label: locale === 'en' ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', weekday: 'short' }).format(TimeService.fromTimestamp(option.value)) : option.label,
  })), [openedAtTs, locale]);
  const hourOptions = useMemo(
    () => getReminderHourOptions(selectedDayStart, openedAtTs),
    [openedAtTs, selectedDayStart],
  );
  const minuteOptions = useMemo(
    () => getReminderMinuteOptions(selectedDayStart, selectedHour, openedAtTs),
    [openedAtTs, selectedDayStart, selectedHour],
  );

  useEffect(() => {
    if (!hourOptions.includes(selectedHour)) {
      const fallbackHour = hourOptions[0];
      setSelectedTs(prev => {
        const prevDate = TimeService.fromTimestamp(prev);
        return clampReminderSelection(
          buildReminderTimestamp(selectedDayStart, fallbackHour, prevDate.getMinutes(), openedAtTs, prev),
          openedAtTs,
        );
      });
      return;
    }

    if (!minuteOptions.includes(selectedMinute)) {
      const fallbackMinute = minuteOptions[0];
      setSelectedTs(prev => {
        const prevDate = TimeService.fromTimestamp(prev);
        return clampReminderSelection(
          buildReminderTimestamp(selectedDayStart, prevDate.getHours(), fallbackMinute, openedAtTs, prev),
          openedAtTs,
        );
      });
    }
  }, [hourOptions, minuteOptions, openedAtTs, selectedDayStart, selectedHour, selectedMinute]);

  return (
    <div className="absolute inset-0 z-[90] flex items-end justify-center px-4 pb-4" data-notes-sheet="reminder" data-keep-keyboard>
      <button className="absolute inset-0 bg-black/35" {...bindBack()} aria-label={s.action_close} />

      <div role="dialog" aria-modal="true" aria-label={title} data-reminder-selected={selectedTs}
        className="relative w-full max-w-[360px] max-h-[95%] overflow-y-auto rounded-[34px] bg-app-surface shadow-2xl px-5 pt-6 pb-5" data-scroll-container="overlay" data-scroll-direction="vertical">
        <div className="text-center text-[18px] font-semibold text-black">{s.datetime_picker_title}</div>

        {!available && <p role="status">{s.editor_overlay_unavailable}</p>}
        <div inert={!available}>
        {onClear && typeof initialTimestamp === 'number' ? (
          <div className="mt-4 flex items-center justify-between px-1">
            <span className="text-[15px] font-medium text-black">{s.action_set_reminder}</span>
            <button
              type="button"
              aria-pressed={reminderEnabled}
              role="switch" aria-label={s.action_set_reminder} aria-checked={reminderEnabled}
              {...bindTap(focused ? { kind: 'action', id: 'notes.focus.editor.reminder.enabled.toggle' } : { kind: 'action', id: 'notes.editor.reminder.enabled.toggle' }, { onTrigger: () => setReminderEnabled(value => !value) })}
              className={`relative h-7 w-12 rounded-full p-0.5 transition-colors ${reminderEnabled ? 'bg-[#4A86FF]' : 'bg-[#d9d9d9]'}`}
            >
              <span
                className={`block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${reminderEnabled ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
        ) : null}

        <div className="mt-3 flex items-center gap-2">
          <PickerColumn
            action={focused ? { id: 'notes.focus.editor.reminder.day.input' } : { id: 'notes.editor.reminder.day.input' }} scrollName="reminderDay" label={s.datetime_date_column}
            value={selectedDayStart}
            options={dateOptions}
            onChange={(dayStart) => {
              setSelectedTs(prev => {
                const prevDate = TimeService.fromTimestamp(prev);
                return clampReminderSelection(
                  buildReminderTimestamp(dayStart, prevDate.getHours(), prevDate.getMinutes(), openedAtTs, prev),
                  openedAtTs,
                );
              });
            }}
            className="flex-[1.8]"
          />
          <PickerColumn
            action={focused ? { id: 'notes.focus.editor.reminder.hour.input' } : { id: 'notes.editor.reminder.hour.input' }} scrollName="reminderHour" label={s.datetime_hour_column}
            value={selectedHour}
            options={hourOptions.map(hour => ({ value: hour, label: `${pad2(hour)} ${s.datetime_hour_suffix}` }))}
            onChange={(hour) => {
              setSelectedTs(prev => {
                const prevDate = TimeService.fromTimestamp(prev);
                return clampReminderSelection(
                  buildReminderTimestamp(selectedDayStart, hour, prevDate.getMinutes(), openedAtTs, prev),
                  openedAtTs,
                );
              });
            }}
            className="flex-1"
          />
          <PickerColumn
            action={focused ? { id: 'notes.focus.editor.reminder.minute.input' } : { id: 'notes.editor.reminder.minute.input' }} scrollName="reminderMinute" label={s.datetime_minute_column}
            value={selectedMinute}
            options={minuteOptions.map(minute => ({ value: minute, label: `${pad2(minute)} ${s.datetime_minute_suffix}` }))}
            onChange={(minute) => {
              setSelectedTs(
                clampReminderSelection(
                  buildReminderTimestamp(selectedDayStart, selectedHour, minute, openedAtTs, selectedTs),
                  openedAtTs,
                ),
              );
            }}
            className="flex-1"
          />
        </div>

        </div>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            className="flex-1 h-14 rounded-[22px] text-[16px] font-semibold"
            style={{ backgroundColor: '#f3f3f3', color: colors.text_secondary_strong }}
            {...bindBack()}
          >
            {s.action_cancel}
          </button>
          <button
            type="button"
            className="flex-1 h-14 rounded-[22px] text-[16px] font-semibold text-white"
            style={{ backgroundColor: '#4A86FF' }}
            disabled={!available}
            {...bindTap(focused ? { kind: 'action', id: 'notes.focus.editor.reminder.save.submit' } : { kind: 'action', id: 'notes.editor.reminder.save.submit' }, { onTrigger: () => {
              if (!available) return;
              if (!reminderEnabled && onClear) { onClear(); return; }
              onConfirm(clampReminderSelection(selectedTs, TimeService.now()));
            } })}
          >
            {s.action_confirm}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DateTimeDialog;
