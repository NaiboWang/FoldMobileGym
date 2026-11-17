import React from 'react';

export interface WeekViewport { top: number; left: number; allDayTop: number }
/** A resize-clamped tail offset is not a new user-chosen position. */
export function retainWeekOffset(previous: number | undefined, actual: number, maximum: number): number {
  const max = Math.max(0, maximum), value = Math.max(0, actual);
  return previous !== undefined && previous > max && Math.abs(value - max) <= 1 ? previous : value;
}
const Context = React.createContext<Map<string, WeekViewport> | null>(null);

/** UI-only memory, scoped to each Calendar Activity; never persisted with events. */
export function CalendarWeekViewportProvider({ children }: { children: React.ReactNode }) {
  const snapshots = React.useRef(new Map<string, WeekViewport>());
  return <Context.Provider value={snapshots.current}>{children}</Context.Provider>;
}

export function useCalendarWeekViewports() {
  const snapshots = React.useContext(Context);
  const local = React.useRef(new Map<string, WeekViewport>());
  return snapshots ?? local.current;
}
