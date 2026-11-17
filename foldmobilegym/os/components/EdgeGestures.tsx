import React, { useEffect, useRef, useState } from 'react';
import { SIMULATOR_CONFIG } from '../data';
import { TaskManager } from '../TaskManager';
import * as TimeService from '../TimeService';

const { edgeGestureWidth, swipeThreshold, zIndexEdgeGestures, backIndicatorSize, backIndicatorOpacity } = SIMULATOR_CONFIG.framework;
type Side = 'left' | 'right';
type Drag = {
  x: number; y: number; scale: number; side: Side; taskId: string | null;
  pair: string; touchId?: number;
};

/** Reserve inward edge swipes for the pane under the gesture's starting point.
 * Fullscreen and system overlays keep the existing system Back behavior.
 */
export const EdgeGestures = () => {
  const [indicator, setIndicator] = useState<{ side: Side; progress: number; y: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  useEffect(() => {
    let ignoreMouseUntil = 0;
    let suppressClick: { x: number; y: number; until: number } | null = null;
    const pairKey = () => {
      const multi = window.__FOLDAGENT__?.getState().multi_window;
      return multi?.mode === 'split' ? `${multi.primary_task_id}:${multi.secondary_task_id}` : '';
    };
    const cancel = () => { drag.current = null; setIndicator(null); };
    const start = (x: number, y: number, touchId?: number) => {
      cancel();
      suppressClick = null;
      const state = TaskManager.getState();
      if (state.isRecentsVisible) return;
      const root = document.getElementById('root');
      if (!root) return;
      const rect = root.getBoundingClientRect();
      // offsetWidth is the actual current CSS canvas width, not the fixed phone
      // design width. This matters on unfolded screens and smaller host windows.
      const scale = rect.width / root.offsetWidth;
      const edge = edgeGestureWidth * scale;
      if (y < rect.top || y > rect.bottom) return;
      const side: Side | null = x >= rect.left - edge && x <= rect.left + edge ? 'left'
        : x >= rect.right - edge && x <= rect.right + edge ? 'right' : null;
      if (!side) return;
      const hit = document.elementFromPoint(Math.min(rect.right - 1, Math.max(rect.left + 1, x)), y);
      // The full-width divider in a stacked layout is a resize target, not an
      // application pane. It must not fall through to root Back/Home.
      if (hit?.closest('[role="separator"]')) return;
      const pane = hit?.closest<HTMLElement>('[data-foldagent-pane]')?.dataset.foldagentPane;
      const multi = window.__FOLDAGENT__?.getState().multi_window;
      const taskId = !state.isLauncherVisible && multi?.mode === 'split'
        ? pane === 'primary' ? multi.primary_task_id : pane === 'secondary' ? multi.secondary_task_id : null
        : null;
      drag.current = { x, y, scale, side, taskId, pair: pairKey(), touchId };
      setIndicator({ side, progress: 0, y: (y - rect.top) / scale });
    };
    const move = (x: number, y: number) => {
      const current = drag.current;
      if (!current) return;
      const dx = (current.side === 'left' ? x - current.x : current.x - x);
      // Vertical scrolling or reversing out of the screen cannot dismiss apps.
      if (Math.abs(y - current.y) > Math.max(swipeThreshold * current.scale, Math.abs(dx))) { cancel(); return; }
      setIndicator(previous => previous && { ...previous, progress: Math.max(0, Math.min(1, dx / (swipeThreshold * current.scale))) });
    };
    const end = (x: number, y: number) => {
      const current = drag.current;
      cancel();
      if (!current) return;
      const dx = current.side === 'left' ? x - current.x : current.x - x;
      const committed = dx >= swipeThreshold * current.scale && Math.abs(y - current.y) < dx;
      if (current.taskId || committed) suppressClick = { x, y, until: TimeService.realNow() + 500 };
      if (!committed || TaskManager.getState().isRecentsVisible) return;
      if (current.taskId) {
        // A posture/layout change or task switch during the gesture invalidates it.
        if (pairKey() !== current.pair || TaskManager.getState().isLauncherVisible) return;
        window.__OS__?.closeTask(current.taskId);
      } else {
        window.__OS__?.handleBack();
      }
    };
    const mouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || TimeService.realNow() < ignoreMouseUntil) return;
      start(event.clientX, event.clientY);
      if (drag.current?.taskId) { event.preventDefault(); event.stopPropagation(); }
    };
    const mouseMove = (event: MouseEvent) => {
      if (TimeService.realNow() < ignoreMouseUntil) return;
      move(event.clientX, event.clientY);
      if (drag.current?.taskId) { event.preventDefault(); event.stopPropagation(); }
    };
    const mouseUp = (event: MouseEvent) => {
      if (event.button !== 0 || TimeService.realNow() < ignoreMouseUntil) return;
      const reserved = !!drag.current?.taskId;
      end(event.clientX, event.clientY);
      if (reserved) { event.preventDefault(); event.stopPropagation(); }
    };
    const touchStart = (event: TouchEvent) => {
      ignoreMouseUntil = TimeService.realNow() + 800;
      if (event.touches.length !== 1) { cancel(); return; }
      const touch = event.touches[0];
      start(touch.clientX, touch.clientY, touch.identifier);
      // Claim a split edge before native scrolling and compatibility mouse
      // events can mutate the underlying app or trigger a second Back.
      if (drag.current?.taskId) { event.preventDefault(); event.stopPropagation(); }
    };
    const touchMove = (event: TouchEvent) => {
      const touch = [...event.touches].find(t => t.identifier === drag.current?.touchId);
      if (!touch) return;
      const reserved = !!drag.current?.taskId;
      move(touch.clientX, touch.clientY);
      if (reserved) { event.preventDefault(); event.stopPropagation(); }
    };
    const touchEnd = (event: TouchEvent) => {
      ignoreMouseUntil = TimeService.realNow() + 800;
      const touch = [...event.changedTouches].find(t => t.identifier === drag.current?.touchId);
      if (!touch) return;
      const reserved = !!drag.current?.taskId;
      end(touch.clientX, touch.clientY);
      if (reserved) { event.preventDefault(); event.stopPropagation(); }
    };
    const click = (event: MouseEvent) => {
      if (!suppressClick || TimeService.realNow() > suppressClick.until
        || Math.abs(event.clientX - suppressClick.x) > 3 || Math.abs(event.clientY - suppressClick.y) > 3) return;
      suppressClick = null;
      event.preventDefault(); event.stopPropagation();
    };
    document.addEventListener('mousedown', mouseDown, true);
    document.addEventListener('mousemove', mouseMove, true);
    document.addEventListener('mouseup', mouseUp, true);
    document.addEventListener('click', click, true);
    document.addEventListener('touchstart', touchStart, { capture: true, passive: false });
    document.addEventListener('touchmove', touchMove, { capture: true, passive: false });
    document.addEventListener('touchend', touchEnd, { capture: true, passive: false });
    document.addEventListener('touchcancel', cancel, true);
    window.addEventListener('blur', cancel);
    window.addEventListener('foldagent:posturechange', cancel);
    window.addEventListener('foldagent:windowchange', cancel);
    return () => {
      document.removeEventListener('mousedown', mouseDown, true);
      document.removeEventListener('mousemove', mouseMove, true);
      document.removeEventListener('mouseup', mouseUp, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('touchstart', touchStart, true);
      document.removeEventListener('touchmove', touchMove, true);
      document.removeEventListener('touchend', touchEnd, true);
      document.removeEventListener('touchcancel', cancel, true);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('foldagent:posturechange', cancel);
      window.removeEventListener('foldagent:windowchange', cancel);
    };
  }, []);
  if (!indicator) return null;
  return <div className={`fixed ${indicator.side === 'left' ? 'left-0' : 'right-0'} top-0 bottom-0 w-1 pointer-events-none`}
    style={{ zIndex: zIndexEdgeGestures }}>
    <div className="absolute rounded-full backdrop-blur-sm flex items-center justify-center" style={{
      top: indicator.y - 24, [indicator.side]: 0, width: backIndicatorSize, height: backIndicatorSize,
      backgroundColor: `rgba(255, 255, 255, ${backIndicatorOpacity})`, opacity: indicator.progress,
      transform: `translateX(${(indicator.side === 'left' ? -1 : 1) * (24 - indicator.progress * 40)}px) scale(${0.5 + indicator.progress * 0.5})`,
    }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
      <path d="M15 18l-6-6 6-6" />
    </svg></div>
  </div>;
};
