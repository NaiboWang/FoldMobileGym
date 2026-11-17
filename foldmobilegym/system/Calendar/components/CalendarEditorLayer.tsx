import React, { useLayoutEffect, useRef } from 'react';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
import { useCalendarForeground } from '../hooks/useCalendarForeground';
import { useAppStrings } from '@/os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

function focusControl(panel: HTMLElement, target: HTMLElement) {
  target.focus({ preventScroll: true });
  const owner = target.closest<HTMLElement>('[data-scroll-container]');
  if (!owner || !panel.contains(owner)) return;
  const frame = owner.getBoundingClientRect(), rect = target.getBoundingClientRect();
  const scale = frame.height > 0 ? owner.clientHeight / frame.height : 1;
  if (rect.top < frame.top) owner.scrollTop -= (frame.top - rect.top) * scale;
  else if (rect.bottom > frame.bottom) owner.scrollTop += (rect.bottom - frame.bottom) * scale;
}

export function CalendarEditorLayer({ children, editing, returnFocus }: React.PropsWithChildren<{ editing: boolean; returnFocus: HTMLElement | null }>) {
  const { bindBack } = useCalendarGestures(), s = useAppStrings(strings, stringsEn);
  const panel = useRef<HTMLDivElement>(null);
  const { active, foregroundState, owns } = useCalendarForeground();
  const back = bindBack();
  useLayoutEffect(() => {
    const node = panel.current;
    if (active && node?.checkVisibility() && !node.contains(document.activeElement)) node.focus({ preventScroll: true });
  }, [active, foregroundState]);
  useLayoutEffect(() => () => {
    queueMicrotask(() => {
      if (owns() && returnFocus?.isConnected && !returnFocus.closest('[inert]') && returnFocus.checkVisibility()) {
        returnFocus.focus({ preventScroll: true });
      }
    });
  }, [owns, returnFocus]);
  return <div className="calendar-editor-layer" data-calendar-editor-layer>
    <button type="button" className="calendar-editor-backdrop" aria-label={s.close} tabIndex={-1}
      {...back} onClick={event => { if (owns()) back.onClick?.(event); }} />
    <div ref={panel} className="calendar-editor-panel" role="dialog" aria-modal={active || undefined}
      aria-label={editing ? s.edit_event : s.create_event} tabIndex={-1}
      onKeyDown={event => {
        if (event.defaultPrevented || !owns() || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key === 'Escape') {
          event.preventDefault(); event.stopPropagation(); window.__OS__?.handleBack();
        }
        if (event.key === 'Tab') {
          const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex]',
          )].filter(element => element.tabIndex >= 0 && !element.closest('[inert]') && !element.matches(':disabled') && element.checkVisibility());
          event.preventDefault();
          if (!controls.length) { panel.current?.focus({ preventScroll: true }); return; }
          const index = controls.indexOf(document.activeElement as HTMLElement);
          const next = event.shiftKey ? (index <= 0 ? controls.length - 1 : index - 1) : (index + 1) % controls.length;
          focusControl(event.currentTarget, controls[next]);
        }
      }}>{children}</div>
  </div>;
}
