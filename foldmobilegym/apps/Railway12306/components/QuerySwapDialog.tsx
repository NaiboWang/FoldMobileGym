import React, { useRef } from 'react';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayDialogFocus, trapRailwayDialogFocus } from '../hooks/useRailwayDialogFocus';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
export function QuerySwapDialog({ onConfirm, returnFocus }: { onConfirm: () => boolean; returnFocus: React.RefObject<HTMLElement | null> }) {
  const { bindBack, bindTap, back } = useRailwayGestures(), s = useRailwayStrings();
  const panel = useRef<HTMLDivElement>(null), submitted = useRef(false), titleId = React.useId();
  useRailwayDialogFocus(panel, returnFocus);
  return <div className="railway-query-overlay absolute inset-0 z-[80] flex items-center justify-center" data-status-bar-foreground="light">
    <button type="button" className="absolute inset-0 bg-black/40" tabIndex={-1} aria-label={s.swap_dialog_cancel} {...bindBack()} />
    <div ref={panel} role="alertdialog" aria-modal="true" aria-labelledby={titleId} className="railway-query-swap relative bg-app-surface rounded-2xl overflow-hidden shadow-xl"
      onKeyDown={event => trapRailwayDialogFocus(event, back)}>
      <div className="pt-6 pb-3 px-6 text-center"><h2 id={titleId} className="text-base font-semibold text-gray-900 mb-3">{s.swap_dialog_title}</h2><p className="text-sm text-gray-600">{s.swap_dialog_message}</p></div>
      <div className="flex border-t border-gray-200">
        <button type="button" className="flex-1 py-3 text-gray-600 border-r border-gray-200" {...bindBack()}>{s.swap_dialog_cancel}</button>
        <button type="button" className="flex-1 py-3 text-app-primary" {...bindTap({ kind: 'action', id: 'query.swap.confirm.submit' }, { onTrigger: () => { if (submitted.current) return; submitted.current = onConfirm(); } })}>{s.swap_dialog_confirm}</button>
      </div>
    </div>
  </div>;
}
