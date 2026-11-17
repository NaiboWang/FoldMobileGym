import * as TimeService from '@/os/TimeService';

/** Physical screen-pixel thresholds, independent of CSS zoom. */
export function monthSwipeDelta(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy) * 1.2) return 0;
  return dx < 0 ? 1 : -1;
}

export function shiftMonthTimestamp(timestamp: number, delta: number): number {
  const date = TimeService.fromTimestamp(timestamp), day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + delta);
  const last = TimeService.fromLocalParts(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, last));
  return date.getTime();
}
