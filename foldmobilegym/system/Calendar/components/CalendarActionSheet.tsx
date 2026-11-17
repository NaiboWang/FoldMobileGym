import React, { useLayoutEffect, useId, useRef } from 'react';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
import { useAppStrings } from '@/os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useActivityId } from '@/os/ActivityContext';

export interface CalendarActionSheetItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  tapProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}

/** Mounted only while the owning URL state is open. */
export const CalendarActionSheet: React.FC<{
  title: string;
  items: CalendarActionSheetItem[];
  returnFocus?: HTMLElement | null;
}> = ({ title, items, returnFocus }) => {
  const { bindBack, back } = useCalendarGestures();
  const s = useAppStrings(strings, stringsEn), titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const activityId = useActivityId();
  useLayoutEffect(() => {
    // Capture at the opener, before inert auto-blurs it; post-commit activeElement may already be BODY.
    const previous = returnFocus ?? document.activeElement as HTMLElement | null;
    const ownsActivity = () => {
      const state = window.__OS__?.getState();
      return state?.tasks.find(task => task.taskId === state.activeTaskId)?.stack.at(-1)?.activityId === activityId;
    };
    if (ownsActivity()) (panel.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
      ?? panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();
    return () => { queueMicrotask(() => { if (ownsActivity() && previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true }); }); };
  }, [returnFocus, activityId]);
  const choice = items.some(item => item.selected !== undefined);
  return <div className="calendar-action-sheet-overlay">
    <button className="calendar-action-sheet-backdrop" aria-label={s.close} tabIndex={-1} {...bindBack()} />
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId}
      className="calendar-action-sheet-panel" data-scroll-container="sheet" data-scroll-direction="vertical"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); back(); }
        if (event.key === 'Tab') {
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          const index = controls.indexOf(document.activeElement as HTMLButtonElement);
          event.preventDefault(); controls[(index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length]?.focus();
        }
      }}>
      <div className="calendar-action-sheet-options">
        <h2 id={titleId}>{title}</h2>
        <div role={choice ? 'radiogroup' : undefined} aria-labelledby={choice ? titleId : undefined}>
          {items.map(item => <button key={item.id} type="button" disabled={item.disabled}
            role={choice ? 'radio' : undefined} aria-checked={choice ? !!item.selected : undefined}
            {...item.tapProps}>
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            <span className="calendar-action-sheet-label"><span>{item.title}</span>
              {item.subtitle && <small>{item.subtitle}</small>}</span>
            {item.selected && <span aria-hidden="true">✓</span>}
          </button>)}
        </div>
      </div>
      <button type="button" className="calendar-action-sheet-cancel" {...bindBack()}>{s.cancel}</button>
    </div>
  </div>;
};

