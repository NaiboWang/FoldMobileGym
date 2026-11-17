import React from 'react';
import { monthSwipeDelta } from '../monthNavigation';
import { realNow } from '@/os/TimeService';

type Bounds = { left: number; top: number; width: number; height: number };
type Start = { id: number; x: number; y: number; bounds: Bounds };
const sameBounds = (a: Bounds, b: Bounds) => Math.abs(a.left - b.left) < 1
  && Math.abs(a.top - b.top) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;

/** Pointer-owned month paging; capture only after dragging, so ordinary date taps survive. */
export function useCalendarMonthSwipe(onShift: (delta: -1 | 1) => void, resetKey: string) {
  const start = React.useRef<Start | null>(null), suppressClick = React.useRef(false);
  React.useEffect(() => { start.current = null; }, [resetKey]);
  const cancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (start.current?.id !== event.pointerId) return;
    start.current = null;
  };
  return {
    'data-action': 'calendar.home.month.shift',
    'data-action-type': 'swipe',
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary || event.button !== 0 || start.current) return;
      suppressClick.current = false;
      start.current = { id: event.pointerId, x: event.clientX, y: event.clientY, bounds: event.currentTarget.getBoundingClientRect() };
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      const origin = start.current;
      if (!origin || origin.id !== event.pointerId) return;
      const dx = event.clientX - origin.x, dy = event.clientY - origin.y;
      if (Math.hypot(dx, dy) > 10) suppressClick.current = true;
      if (monthSwipeDelta(dx, dy) && event.currentTarget.hasPointerCapture?.(event.pointerId) === false) {
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Synthetic cancellation controls have no active native pointer. */ }
      }
    },
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
      const origin = start.current;
      if (!origin || origin.id !== event.pointerId) return;
      start.current = null;
      const dx = event.clientX - origin.x, dy = event.clientY - origin.y;
      if (Math.hypot(dx, dy) > 10) suppressClick.current = true;
      if (!sameBounds(origin.bounds, event.currentTarget.getBoundingClientRect())) return;
      const delta = monthSwipeDelta(dx, dy);
      if (!delta) return;
      event.currentTarget.dataset.actionParams = JSON.stringify({ delta });
      onShift(delta);
      window.dispatchEvent(new CustomEvent('mobilegym:agent-action', { detail: {
        id: 'calendar.home.month.shift', kind: 'action', params: { delta }, timestamp: realNow(),
      } }));
    },
    onPointerCancel: cancel,
    onLostPointerCapture: (event: React.PointerEvent<HTMLDivElement>) => {
      // Touch starts with implicit capture on the tapped child. Its capture-loss
      // bubbles when the grid takes ownership; that is not loss of our capture.
      if (event.target === event.currentTarget) cancel(event);
    },
    onPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) cancel(event);
    },
    onClickCapture: (event: React.MouseEvent<HTMLDivElement>) => {
      if (suppressClick.current && event.detail > 0) {
        suppressClick.current = false;
        event.preventDefault(); event.stopPropagation();
      }
    },
  };
}
