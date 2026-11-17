import type React from 'react';
/** App-local keyboard containment; never captures keyboard events in another pane. */
export function trapHistoryFocus(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab') return;
  const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]'));
  const first = focusable[0], last = focusable.at(-1);
  if (event.shiftKey && event.target === first) { event.preventDefault(); last?.focus({ preventScroll: true }); }
  else if (!event.shiftKey && event.target === last) { event.preventDefault(); first?.focus({ preventScroll: true }); }
}
