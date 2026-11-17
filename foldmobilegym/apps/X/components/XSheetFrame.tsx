import React, { useId, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useActivityId } from '../../../os/ActivityContext';
import { useXGestures } from '../hooks/useXGestures';
import { useXStrings } from '../hooks/useXStrings';
import { useXOverlayControls } from '../hooks/useXOverlayControls';
import { IcClose } from '../res/icons';

export const XSheetFrame: React.FC<React.PropsWithChildren<{ kind: 'retweet' | 'replySort' | 'quoteSort'; title: string }>> = ({ kind, title, children }) => {
  const { bindBack } = useXGestures(), s = useXStrings(), titleId = useId();
  const { isCurrent } = useXOverlayControls();
  const backProps = bindBack();
  const ownedBackProps = { ...backProps, onClick: (event: React.MouseEvent<HTMLElement>) => {
    if (isCurrent()) backProps.onClick?.(event);
  } };
  const location = useLocation(), activityId = useActivityId(), panel = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const state = window.__OS__?.getState(), top = state?.tasks.find(task => task.taskId === state.activeTaskId)?.stack.at(-1);
    if (top?.activityId === activityId) panel.current?.focus({ preventScroll: true });
  }, [location.key, activityId]);
  return <div data-x-dialog={kind} className={`absolute inset-0 z-[100] flex items-end justify-center pt-10 pb-4 px-2 ${kind !== 'retweet' ? 'x-sort-sheet' : ''}`}>
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" {...ownedBackProps} />
    <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
      className="x-sheet-panel relative w-full max-w-sm max-h-full min-h-0 flex flex-col rounded-2xl bg-app-bg text-app-text overflow-hidden outline-none shadow-xl">
      {kind === 'retweet' ? <h2 id={titleId} className="sr-only">{title}</h2> : <header className="relative shrink-0 p-4 border-b border-app-border">
        <h2 id={titleId} className="font-bold text-lg text-center">{title}</h2>
        <button type="button" {...ownedBackProps} aria-label={s.follow_menu_close_aria_label} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full"><IcClose size={20} /></button>
      </header>}
      <div className="min-h-0 overflow-y-auto p-2" data-scroll-container="menu" data-scroll-direction="vertical">{children}</div>
      <footer className="p-2 pt-0 shrink-0"><button type="button" {...ownedBackProps} className="w-full py-3.5 font-bold rounded-full bg-app-surface active:opacity-70">{s.common_cancel}</button></footer>
    </section>
  </div>;
};
