import * as TimeService from '../../../os/TimeService';

export function toLocalDateKey(ts: number) {
  const date = TimeService.fromTimestamp(ts);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Select by calendar date rather than assuming a retained forecast starts today. */
export function dailyForDate<T extends { fxDate: string }>(daily: readonly T[] | undefined, dateKey: string): T | null {
  return daily?.find(day => day.fxDate === dateKey) ?? null;
}

/** A forecast date is a calendar day, not a UTC instant in the viewer's time zone. */
export function parseForecastDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const date = TimeService.fromTimestamp(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}
