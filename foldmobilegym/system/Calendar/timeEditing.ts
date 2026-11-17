import * as TimeService from '@/os/TimeService';

export function parseCalendarTime(value: string): { hour: number; minute: number } | null {
  const match = value.trim().match(/^(\d{1,2})\s*:\s*(\d{1,2})$/);
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

/** Invalid text stays in the form; never normalize it into a replacement time. */
export function replaceCalendarTime(timestamp: number, value: string): number | null {
  const parsed = parseCalendarTime(value);
  if (!parsed || !Number.isFinite(timestamp)) return null;
  const date = TimeService.fromTimestamp(timestamp);
  date.setHours(parsed.hour, parsed.minute, 0, 0);
  const result = date.getTime();
  return Number.isFinite(result) ? result : null;
}

/** Saving unrelated fields must not round an untouched existing timestamp. */
export function resolveCalendarSaveTime(timestamp: number, value: string): number | null {
  const result = replaceCalendarTime(timestamp, value);
  if (result === null) return null;
  const before = TimeService.fromTimestamp(timestamp), after = TimeService.fromTimestamp(result);
  return before.getHours() === after.getHours() && before.getMinutes() === after.getMinutes() ? timestamp : result;
}

/** Coupled date/time edits must not erase an independent malformed/range error. */
export function calendarTimeTextAfterSync(text: string, currentTimestamp: number, nextTimestamp: number, earliest = -Infinity): string {
  const parsed = replaceCalendarTime(currentTimestamp, text);
  if (parsed === null || parsed < earliest) return text;
  const date = TimeService.fromTimestamp(nextTimestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
