import * as TimeService from '@/os/TimeService';

export function dateInputValue(timestamp: number): string {
  const date = TimeService.fromTimestamp(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function replaceCalendarDate(timestamp: number, value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const original = TimeService.fromTimestamp(timestamp);
  const date = TimeService.fromLocalParts(year, month - 1, day, original.getHours(), original.getMinutes());
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.getTime();
}
