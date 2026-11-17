import React, { useEffect, useId, useRef, useState } from 'react';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function CalendarReminderSheet({ value, onSelect, editing }: { value: number | null; onSelect: (minutes: number | null) => void; editing: boolean }) {
  const s = useAppStrings(strings, stringsEn);
  const { bindBack, bindTap, back } = useCalendarGestures();
  const panel = useRef<HTMLDivElement>(null), titleId = useId();
  const [pending, setPending] = useState<number | null>(value);
  const options = [
    { id: 'none', value: null, label: s.remind_none }, { id: '0', value: 0, label: s.label_at_start },
    { id: '5', value: 5, label: s.remind_5_min_before }, { id: '10', value: 10, label: s.remind_10_min_before },
    { id: '15', value: 15, label: s.remind_15_min_before },
    { id: '30', value: 30, label: s.remind_30_min_before }, { id: '60', value: 60, label: s.remind_1_hour_before },
    { id: '120', value: 120, label: s.remind_2_hour_before }, { id: '1440', value: 1440, label: s.remind_1_day_before },
    { id: '2880', value: 2880, label: s.remind_2_day_before },
  ];
  const confirm = () => { onSelect(pending); back(); };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const selected = panel.current?.querySelector<HTMLButtonElement>('button[aria-checked="true"]');
    (selected ?? panel.current?.querySelector<HTMLButtonElement>('button'))?.focus();
    return () => { queueMicrotask(() => { if (previous?.isConnected && !previous.closest('[inert]')) previous.focus(); }); };
  }, []);
  return <div className="calendar-reminder-overlay">
    <button type="button" className="calendar-reminder-backdrop" aria-label={s.cancel} {...bindBack()} />
    <div ref={panel} className="calendar-reminder-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}
      data-scroll-container="reminder" data-scroll-direction="vertical"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); back(); }
        if (event.key === 'Tab') {
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          event.preventDefault(); buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
        }
      }}>
      <div className="calendar-reminder-options" role="radiogroup" aria-labelledby={titleId}>
        <h2 id={titleId}>{s.label_reminder}</h2>
        {options.map(option => <button key={option.id} type="button" role="radio" aria-checked={pending === option.value}
          {...(editing
            ? bindTap({ kind: 'action', id: 'calendar.edit.reminder.select' }, { params: { minutes: option.id }, onTrigger: () => setPending(option.value) })
            : bindTap({ kind: 'action', id: 'calendar.new.reminder.select' }, { params: { minutes: option.id }, onTrigger: () => setPending(option.value) }))}>
          <span>{option.label}</span><span className="calendar-reminder-radio" aria-hidden="true">{pending === option.value ? '✓' : ''}</span>
        </button>)}
      </div>
      <div className="calendar-reminder-actions">
        <button type="button" className="calendar-reminder-cancel" {...bindBack()}>{s.cancel}</button>
        <button type="button" className="calendar-reminder-confirm"
          {...(editing
            ? bindTap({ kind: 'action', id: 'calendar.edit.reminder.confirm' }, { onTrigger: confirm })
            : bindTap({ kind: 'action', id: 'calendar.new.reminder.confirm' }, { onTrigger: confirm }))}>{s.confirm}</button>
      </div>
    </div>
  </div>;
}
