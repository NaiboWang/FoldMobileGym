import React, { useEffect, useId, useRef } from 'react';
import type { CalendarEventType } from '../types';
import { IcBookmark, IcCake, IcCalendarDays, IcTimer } from '../res/icons';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function CalendarEventTypeSheet({
  value,
  onSelect,
  editing,
}: {
  value: CalendarEventType;
  onSelect: (value: CalendarEventType) => void;
  editing: boolean;
}) {
  const s = useAppStrings(strings, stringsEn);
  const { bindBack, bindTap, back } = useCalendarGestures();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const options = [
    { id: 'event' as const, label: s.event_type_normal, icon: <IcCalendarDays size={20} /> },
    { id: 'birthday' as const, label: s.event_type_birthday, icon: <IcCake size={20} /> },
    { id: 'anniversary' as const, label: s.event_type_anniversary, icon: <IcBookmark size={20} /> },
    { id: 'countdown' as const, label: s.event_type_countdown, icon: <IcTimer size={20} /> },
  ];

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (panel.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
      ?? panel.current?.querySelector<HTMLButtonElement>('button'))?.focus();
    return () => {
      queueMicrotask(() => {
        if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true });
      });
    };
  }, []);

  const choose = (next: CalendarEventType) => {
    onSelect(next);
    back();
  };

  return <div className="calendar-event-type-overlay">
    <button type="button" className="calendar-event-type-backdrop" aria-label={s.cancel} tabIndex={-1} {...bindBack()} />
    <div ref={panel} className="calendar-event-type-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}
      data-scroll-container="type" data-scroll-direction="vertical"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); back(); }
        if (event.key === 'Tab') {
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
          const index = controls.indexOf(document.activeElement as HTMLButtonElement);
          event.preventDefault();
          controls[(index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length]?.focus();
        }
      }}>
      <div className="calendar-event-type-options" role="radiogroup" aria-labelledby={titleId}>
        <h2 id={titleId}>{s.label_type}</h2>
        {options.map(option => <button key={option.id} type="button" role="radio" aria-checked={value === option.id}
          {...(editing
            ? bindTap({ kind: 'action', id: 'calendar.edit.type.select' }, { params: { type: option.id }, onTrigger: () => choose(option.id) })
            : bindTap({ kind: 'action', id: 'calendar.new.type.select' }, { params: { type: option.id }, onTrigger: () => choose(option.id) }))}>
          <span className="calendar-event-type-option-icon" aria-hidden="true">{option.icon}</span>
          <span>{option.label}</span>
          <span className="calendar-event-type-radio" aria-hidden="true">{value === option.id ? '✓' : ''}</span>
        </button>)}
      </div>
      <button type="button" className="calendar-event-type-cancel" {...bindBack()}>{s.cancel}</button>
    </div>
  </div>;
}
