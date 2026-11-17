import { useEffect, useRef } from 'react';
import type { PointerEvent, RefObject } from 'react';

type Pointer = Pick<PointerEvent, 'pointerId' | 'isPrimary' | 'button' | 'clientX' | 'clientY'>;

/** Item-local gesture controller; no pointer capture, so native scrolling remains free. */
export function createFileLongPress<T>(onLongPress: (item: T) => void, suppressClick: (value: boolean) => void) {
  let pointer: { id: number; x: number; y: number } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const dispose = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null; pointer = null;
  };
  const cancel = (event: Pick<Pointer, 'pointerId'>) => {
    if (pointer?.id !== event.pointerId) return;
    dispose(); suppressClick(true);
  };
  return {
    start: (item: T, event: Pointer) => {
      if (!event.isPrimary || event.button !== 0 || pointer) return;
      suppressClick(false);
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      timer = setTimeout(() => { timer = null; suppressClick(true); onLongPress(item); }, 500);
    },
    move: (event: Pick<Pointer, 'pointerId' | 'clientX' | 'clientY'>) => {
      if (pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 10) cancel(event);
    },
    end: (event: Pick<Pointer, 'pointerId'>) => { if (pointer?.id === event.pointerId) dispose(); },
    cancel,
    dispose,
  };
}

export function useFileLongPress<T>(onLongPress: (item: T) => void, suppressed: RefObject<boolean>, scopeKey: string) {
  const callback = useRef(onLongPress);
  callback.current = onLongPress;
  const controller = useRef<ReturnType<typeof createFileLongPress<T>> | null>(null);
  if (!controller.current) controller.current = createFileLongPress<T>(item => callback.current(item), value => { suppressed.current = value; });
  const gesture = controller.current;
  useEffect(() => () => gesture.dispose(), [gesture, scopeKey]);
  return (item: T) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => gesture.start(item, event),
    onPointerMove: gesture.move,
    onPointerUp: gesture.end,
    onPointerCancel: gesture.cancel,
    onPointerLeave: gesture.cancel,
  });
}
