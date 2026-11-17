import * as TimeService from '../../../os/TimeService';

export function summarizeReadingMonths(records: { date: string; duration: number }[]) {
  const months: Record<string, { days: number; minutes: number }> = {};
  const seen = new Map<string, Set<number>>();
  for (const record of records) {
    if (!Number.isFinite(record.duration) || record.duration <= 0) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date)) continue;
    const timestamp = TimeService.parseToTimestamp(record.date);
    if (!Number.isFinite(timestamp)) continue;
    const date = TimeService.fromTimestamp(timestamp);
    const normalized = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (normalized !== record.date) continue;
    const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    const days = seen.get(key) || new Set<number>();
    days.add(date.getDate()); seen.set(key, days);
    months[key] = { days: days.size, minutes: (months[key]?.minutes || 0) + record.duration };
  }
  return months;
}
