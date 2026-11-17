import React from 'react';
import { useNotesGestures } from '../hooks/useNotesGestures';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
/** App-contained sheet; child controls are pre-bound at their literal declaration sites. */
export const EditorSheet: React.FC<React.PropsWithChildren<{ title: string; kind: string }>> = ({ title, kind, children }) => {
  const { bindBack } = useNotesGestures();
  const s = useAppStrings(strings, stringsEn);
  return <div className="absolute inset-0 z-[80] flex flex-col justify-end" data-notes-sheet={kind} data-keep-keyboard>
    <button className="absolute inset-0 bg-black/35" {...bindBack()} aria-label={s.action_close} />
    <section role="dialog" aria-modal="true" aria-label={title}
      className="relative max-h-[85%] flex flex-col bg-app-surface rounded-t-[24px] pb-6 min-h-0">
      <h2 className="px-5 py-4 text-[16px] font-medium shrink-0">{title}</h2>
      <div data-scroll-container="overlay" data-scroll-direction="vertical" className="min-h-0 overflow-y-auto overscroll-contain px-3 pb-3">
        {children}
      </div>
      <button className="h-12 mx-3 shrink-0 rounded-[14px] bg-[#f3f3f3] text-[15px]" {...bindBack()}>{s.action_cancel}</button>
    </section>
  </div>;
};
