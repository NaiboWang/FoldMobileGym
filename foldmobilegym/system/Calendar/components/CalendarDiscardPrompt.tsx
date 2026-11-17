import React, { useEffect, useId, useRef } from 'react';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function CalendarDiscardPrompt({ editing, onDiscard }: { editing: boolean; onDiscard: () => void }) {
  const s = useAppStrings(strings, stringsEn);
  const { bindTap, back } = useCalendarGestures();
  const panel = useRef<HTMLElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    return () => {
      queueMicrotask(() => {
        if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true });
      });
    };
  }, []);

  return <section ref={panel} tabIndex={-1} className="calendar-discard-prompt" role="alertdialog" aria-modal="true" aria-labelledby={titleId}
    data-scroll-container="discard" data-scroll-direction="vertical"
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); back(); }
      if (event.key === 'Tab') { event.preventDefault(); button.current?.focus({ preventScroll: true }); }
    }}>
    <h2 id={titleId}>{editing ? s.discard_edit_title : s.discard_new_title}</h2>
    <button ref={button} type="button"
      {...(editing
        ? bindTap({ kind: 'action', id: 'calendar.edit.discard.submit' }, { onTrigger: onDiscard })
        : bindTap({ kind: 'action', id: 'calendar.new.discard.submit' }, { onTrigger: onDiscard }))}>
      {s.discard_changes}
    </button>
  </section>;
}
