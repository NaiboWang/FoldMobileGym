import * as TimeService from '@/os/TimeService';

export const REMINDER_STEP_MINUTES = 5;
const REMINDER_STEP_MS = REMINDER_STEP_MINUTES * 60 * 1000;
const REMINDER_MAX_DAY_OFFSET = 366;
const REMINDER_MAX_HOUR = 11;
const REMINDER_MAX_MINUTE = 55;
const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

export type ReminderBounds = {
  minTs: number;
  maxTs: number;
};

export type ReminderDateOption = {
  value: number;
  label: string;
};

export function roundUpToReminderStep(timestamp: number): number {
  return Math.ceil(timestamp / REMINDER_STEP_MS) * REMINDER_STEP_MS;
}

export function startOfLocalDay(timestamp: number): number {
  const date = TimeService.fromTimestamp(timestamp);
  return TimeService.fromLocalParts(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function getReminderBounds(nowTs: number): ReminderBounds {
  const minTs = roundUpToReminderStep(nowTs);
  const maxDate = TimeService.fromTimestamp(startOfLocalDay(nowTs));
  maxDate.setDate(maxDate.getDate() + REMINDER_MAX_DAY_OFFSET);
  maxDate.setHours(REMINDER_MAX_HOUR, REMINDER_MAX_MINUTE, 0, 0);

  return {
    minTs,
    maxTs: maxDate.getTime(),
  };
}

export function clampReminderSelection(timestamp: number, nowTs: number): number {
  const { minTs, maxTs } = getReminderBounds(nowTs);
  const rounded = roundUpToReminderStep(timestamp);
  return Math.min(maxTs, Math.max(minTs, rounded));
}

export function buildReminderTimestamp(dayStartTs: number, hour: number, minute: number, nowTs?: number, referenceTs?: number): number {
  // Repeated wall-clock times can refer to two different instants. Prefer the
  // current offset when it is still selectable; otherwise use the first future occurrence.
  if (nowTs !== undefined) {
    const matches = getSelectableInstants(dayStartTs, nowTs).filter(timestamp => {
      const date = TimeService.fromTimestamp(timestamp);
      return date.getHours() === hour && date.getMinutes() === minute;
    });
    if (matches.length) {
      const offset = referenceTs === undefined ? undefined : TimeService.fromTimestamp(referenceTs).getTimezoneOffset();
      return matches.find(timestamp => TimeService.fromTimestamp(timestamp).getTimezoneOffset() === offset) ?? matches[0];
    }
  }
  // A changed day/hour can make the old minute unavailable. Preserve the
  // existing date normalization + bounds-clamping behavior for that case.
  const date = TimeService.fromTimestamp(dayStartTs);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

export function formatReminderDateLabel(dayStartTs: number): string {
  const date = TimeService.fromTimestamp(dayStartTs);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAY_LABELS[date.getDay()]}`;
}

export function getReminderDateOptions(nowTs: number): ReminderDateOption[] {
  const { minTs, maxTs } = getReminderBounds(nowTs);
  const options: ReminderDateOption[] = [];
  const startDay = startOfLocalDay(minTs);
  const endDay = startOfLocalDay(maxTs);

  // Calendar days are not always 24 elapsed hours when local clocks change.
  for (let dayStart = startDay; dayStart <= endDay;) {
    options.push({
      value: dayStart,
      label: formatReminderDateLabel(dayStart),
    });
    const day = TimeService.fromTimestamp(dayStart);
    dayStart = TimeService.fromLocalParts(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
  }

  return options;
}

/** Enumerate actual instants, not assumed 24-hour wall-clock labels. */
function getSelectableInstants(dayStartTs: number, nowTs: number): number[] {
  const { minTs, maxTs } = getReminderBounds(nowTs);
  const dayStart = startOfLocalDay(dayStartTs);
  const day = TimeService.fromTimestamp(dayStart);
  const nextDay = TimeService.fromLocalParts(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
  const result: number[] = [];
  for (let timestamp = roundUpToReminderStep(Math.max(dayStart, minTs)); timestamp < nextDay && timestamp <= maxTs; timestamp += REMINDER_STEP_MS) {
    result.push(timestamp);
  }
  return result;
}

export function getReminderHourOptions(dayStartTs: number, nowTs: number): number[] {
  return [...new Set(getSelectableInstants(dayStartTs, nowTs).map(timestamp => TimeService.fromTimestamp(timestamp).getHours()))].sort((a, b) => a - b);
}

export function getReminderMinuteOptions(dayStartTs: number, hour: number, nowTs: number): number[] {
  const minutes = getSelectableInstants(dayStartTs, nowTs).map(timestamp => TimeService.fromTimestamp(timestamp))
    .filter(date => date.getHours() === hour).map(date => date.getMinutes());
  return [...new Set(minutes)].sort((a, b) => a - b);
}
