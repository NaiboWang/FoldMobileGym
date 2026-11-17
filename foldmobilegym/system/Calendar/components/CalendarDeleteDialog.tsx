import React, { useContext, useEffect, useId, useRef } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import { getTracker } from '@/os/utils/memoryHistoryTracker';
import { calendarDeletionBackSteps } from '../deleteNavigation';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarStore } from '../state';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function CalendarDeleteDialog({ eventId }: { eventId: string }) {
  const event = useCalendarStore(state => state.events.find(event => event.id === eventId));
  const remove = useCalendarStore(state => state.deleteEvent);
  const { bindBack, bindTap, back } = useCalendarGestures();
  const s = useAppStrings(strings, stringsEn), titleId = useId();
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const location = useLocation();
  const cancel = useRef<HTMLButtonElement>(null), submitted = useRef(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancel.current?.focus();
    return () => { queueMicrotask(() => { if (previous?.isConnected && !previous.closest('[inert]')) previous.focus(); }); };
  }, []);
  const confirm = () => {
    if (!event || submitted.current || !useCalendarStore.getState().events.some(item => item.id === eventId)) return;
    submitted.current = true;
    const tracker = getTracker(navigator as object);
    const index = (navigator as { index?: number }).index ?? tracker?.index ?? 0;
    const steps = calendarDeletionBackSteps(tracker?.stack, index, location.pathname);
    remove(eventId);
    // One back operation skips this event's entries, not an unrelated parent.
    back(steps);
  };
  return <div className="calendar-delete-overlay">
    <section role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={`${titleId}-target`}
      className="calendar-delete-panel" data-scroll-container="confirmation" data-scroll-direction="vertical"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); back(); }
        if (event.key === 'Tab') {
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          event.preventDefault(); buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
        }
      }}>
      <h2 id={titleId}>{s.confirm_delete_event}</h2>
      <p id={`${titleId}-target`}>{event?.title ?? s.event_not_found}</p>
      <div className="calendar-delete-buttons">
        <button ref={cancel} type="button" {...bindBack()}>{s.cancel}</button>
        <button type="button" disabled={!event} {...bindTap({ kind: 'action', id: 'calendar.event.delete.submit' }, {
          params: { eventId }, onTrigger: confirm,
        })}>{s.delete_action}</button>
      </div>
    </section>
  </div>;
}
