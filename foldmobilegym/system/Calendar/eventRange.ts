import * as TimeService from '@/os/TimeService';

const startOfDay = (timestamp: number) => {
  const date = TimeService.fromTimestamp(timestamp); date.setHours(0, 0, 0, 0); return date;
};
/** Civil-day number, independent of a 23/25-hour local day. */
const dayNumber = (timestamp: number): number => {
  const date = startOfDay(timestamp);
  return Math.round((date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000);
};
/** Explicit timed -> all-day conversion covers occupied dates, with an exclusive end. */
export function toCalendarAllDayRange(startTs: number, endTs: number): { startTs: number; endTs: number } {
  const start = startOfDay(startTs), end = startOfDay(Math.max(startTs, endTs));
  if (endTs <= startTs || endTs !== end.getTime()) end.setDate(end.getDate() + 1);
  if (end.getTime() <= start.getTime()) end.setDate(start.getDate() + 1);
  return { startTs: start.getTime(), endTs: end.getTime() };
}
/** A date-only move preserves all-day civil span, not an assumed N * 24 elapsed hours. */
export function moveCalendarAllDayStart(startTs: number, endTs: number, nextStartTs: number): { startTs: number; endTs: number } {
  const end = TimeService.fromTimestamp(endTs);
  end.setDate(end.getDate() + dayNumber(nextStartTs) - dayNumber(startTs));
  return { startTs: nextStartTs, endTs: end.getTime() };
}
export function formatCalendarRange(startTs: number, endTs: number, allDay: boolean, locale: string): { start: string; end: string } | null {
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return null;
  const format = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric',
    ...(allDay ? {} : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const }) });
  try { return { start: format.format(TimeService.fromTimestamp(startTs)), end: format.format(TimeService.fromTimestamp(endTs)) }; }
  catch { return null; }
}

/** Snapshot alias for the same exact instant, not a minute-rounded +08:00 label. */
export function formatCalendarStateTime(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return '';
  const date = TimeService.fromTimestamp(timestamp);
  if (!Number.isFinite(date.getTime()) || date.getTime() !== timestamp) return '';
  if (date.getFullYear() < 0 || date.getFullYear() > 9999) return date.toISOString();
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');
  const offset = -date.getTimezoneOffset(), absolute = Math.abs(offset);
  const fraction = date.getMilliseconds() ? `.${pad(date.getMilliseconds(), 3)}` : '';
  const zone = `${offset >= 0 ? '+' : '-'}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
  const text = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${fraction}${zone}`;
  return TimeService.parseToTimestamp(text) === timestamp ? text : date.toISOString();
}
