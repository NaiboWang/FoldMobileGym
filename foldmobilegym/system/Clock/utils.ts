import type { Alarm, AlarmRepeat } from './types';
import type { strings } from './res/strings';
import * as TimeService from '@/os/TimeService';
import { workCalendarDay } from './workCalendar';

export const pad2 = (value: number) => value.toString().padStart(2, '0');

export function formatAlarmToneLabel(tone: Alarm['tone'], s: typeof strings): string {
  switch (tone) {
    case 'soft': return s.alarm_tone_soft;
    case 'bright': return s.alarm_tone_bright;
    default: return s.alarm_tone_classic;
  }
}

/** Sheets follow the current pointer, including a return to/above origin. */
export const clampSheetDragOffset = (delta: number, maxOffset: number): number =>
  Math.max(0, Math.min(delta, maxOffset));

/** Allocate against current records, even when simulated time/entropy repeats. */
export const createAlarmId = (alarms: readonly Pick<Alarm, 'id'>[], candidate = `a-${TimeService.now()}-${Math.random().toString(36).slice(2, 6)}`): string => {
  const occupied = new Set(alarms.map(alarm => alarm.id));
  let id = candidate;
  let suffix = 1;
  while (occupied.has(id)) id = `${candidate}-${suffix++}`;
  return id;
};

export const formatAlarmTime = (hour: number, minute: number) => `${pad2(hour)}:${pad2(minute)}`;

export const getRepeatLabel = (repeat: AlarmRepeat, s: typeof strings): string => {
  const labels: Record<AlarmRepeat, string> = {
    once: s.alarm_repeat_once,
    daily: s.alarm_repeat_daily,
    workday: s.alarm_repeat_workday,
    holiday: s.alarm_repeat_holiday,
    weekday: s.alarm_repeat_weekday,
  };
  return labels[repeat] ?? s.alarm_repeat_once;
};

export const formatGmtLabel = (offsetMinutes: number) => {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `GMT${sign}${hours}:${pad2(minutes)}`;
};

export const getNextTrigger = (alarm: Alarm, baseDate: Date) => {
  if (!Number.isFinite(baseDate.getTime()) || !Number.isInteger(alarm.hour) || alarm.hour < 0 || alarm.hour > 23
    || !Number.isInteger(alarm.minute) || alarm.minute < 0 || alarm.minute > 59) return Infinity;
  const next = TimeService.fromTimestamp(baseDate.getTime());
  next.setHours(alarm.hour, alarm.minute, 0, 0);
  const moveToNextDay = () => {
    next.setDate(next.getDate() + 1);
  };

  if (alarm.repeat === 'weekday' || alarm.repeat === 'workday' || alarm.repeat === 'holiday') {
    let guard = 0;
    while (guard < 732) {
      // A past candidate needs no calendar verdict; the next future civil date
      // may be covered even when the elapsed date is outside the dataset.
      if (next.getTime() <= baseDate.getTime()) { moveToNextDay(); guard += 1; continue; }
      const day = next.getDay();
      const isWeekday = day >= 1 && day <= 5;
      const calendar = alarm.repeat === 'weekday' ? null : workCalendarDay(next);
      if (calendar === 'unavailable') return Infinity;
      const isRepeatDay = alarm.repeat === 'weekday' ? isWeekday : calendar === (alarm.repeat === 'holiday' ? 'rest' : 'workday');
      if (isRepeatDay && next.getTime() > baseDate.getTime()) return next.getTime();
      moveToNextDay();
      guard += 1;
    }
    return Infinity;
  }

  if (next.getTime() > baseDate.getTime()) {
    return next.getTime();
  }

  moveToNextDay();
  return next.getTime();
};

export const formatCountdownText = (targetTime: number, baseTime: number, hoursInfix: string, minutesSuffix: string, unavailableText = '') => {
  if (!Number.isFinite(targetTime) || !Number.isFinite(baseTime)) return unavailableText;
  const diffMs = Math.max(0, targetTime - baseTime);
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}${hoursInfix}${minutes}${minutesSuffix}`;
  }
  return `${minutes}${minutesSuffix}`;
};

export const getNextAlarmText = (alarms: Alarm[], noAlarmsText: string, hoursInfix: string, minutesSuffix: string, now = TimeService.getDate(), unavailableText = noAlarmsText) => {
  const active = alarms.filter(item => item.enabled);
  if (active.length === 0) return noAlarmsText;
  const baseTime = now.getTime();
  let nextTime = Infinity;
  for (const alarm of active) {
    const trigger = getNextTrigger(alarm, now);
    if (!Number.isFinite(trigger)) return unavailableText;
    if (trigger < nextTime) nextTime = trigger;
  }
  if (nextTime === Infinity) return noAlarmsText;
  return formatCountdownText(nextTime, baseTime, hoursInfix, minutesSuffix);
};

export const getCityTime = (offsetMinutes: number, base: Date) => {
  const utc = base.getTime() + base.getTimezoneOffset() * 60000;
  return TimeService.fromTimestamp(utc + offsetMinutes * 60000);
};

export const formatCityDiff = (offsetMinutes: number, base: Date, s: Record<
  'world_clock_local_time' | 'world_clock_diff_ahead' | 'world_clock_diff_behind' | 'world_clock_diff_minutes', string
>) => {
  const localOffsetHours = -base.getTimezoneOffset() / 60;
  const cityOffsetHours = offsetMinutes / 60;
  const diff = cityOffsetHours - localOffsetHours;
  if (diff === 0) return s.world_clock_local_time;
  const absolute = Math.abs(diff), hours = Math.floor(absolute);
  const minutes = Math.round((absolute - hours) * 60);
  const minuteText = minutes ? s.world_clock_diff_minutes.replace('{minutes}', String(minutes)) : '';
  return (diff > 0 ? s.world_clock_diff_ahead : s.world_clock_diff_behind)
    .replace('{hours}', String(hours)).replace('{minutes}', minuteText);
};

/** Pointer deltas are viewport pixels; transforms use app-local CSS pixels. */
export const sheetDragOffset = (viewportDelta: number, scale: number, sheetHeight: number): number => {
  if (!Number.isFinite(viewportDelta) || !Number.isFinite(scale) || scale <= 0 || !Number.isFinite(sheetHeight)) return 0;
  return clampSheetDragOffset(viewportDelta / scale, Math.max(0, sheetHeight));
};

export const formatCityDate = (date: Date, monthSuffix: string, daySuffix: string) =>
  `${date.getMonth() + 1}${monthSuffix}${date.getDate()}${daySuffix}`;
