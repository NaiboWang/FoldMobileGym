import { useEffect, type RefObject } from 'react';
import { useActivityId } from '@/os/ActivityContext';

/** Focus belongs to the actual current Activity and the opener captured before inert. */
export function useRailwayDialogFocus<T extends HTMLElement>(panel: RefObject<T | null>, returnFocus: RefObject<HTMLElement | null>) {
  const activityId = useActivityId();
  useEffect(() => {
    const opener = returnFocus.current;
    panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    return () => { queueMicrotask(() => {
      const os = window.__OS__?.getState(), top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
      if (top?.activityId === activityId && opener?.isConnected && opener.checkVisibility() && !opener.closest('[inert]')) opener.focus({ preventScroll: true });
    }); };
  }, [activityId, panel, returnFocus]);
}
export function trapRailwayDialogFocus(event: React.KeyboardEvent<HTMLElement>, close: () => void) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
  if (event.key === 'Tab') {
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]'));
    const index = buttons.indexOf(document.activeElement as HTMLElement); event.preventDefault();
    buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
  }
}
