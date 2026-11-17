import { describe, expect, it } from 'vitest';
import {
  buildReminderTimestamp,
  getReminderBounds,
  getReminderDateOptions,
  getReminderHourOptions,
  getReminderMinuteOptions,
  startOfLocalDay,
} from '../system/Notes/components/dateTimePickerModel';

describe('reminder wall-time boundaries', () => {
  it('offers only future options today and respects the final day limit', () => {
    const now = new Date(2026, 5, 1, 23, 51).getTime();
    const today = startOfLocalDay(now);
    expect(getReminderHourOptions(today, now)).toEqual([23]);
    expect(getReminderMinuteOptions(today, 23, now)).toEqual([55]);
    const lastDay = getReminderDateOptions(now).at(-1)!.value;
    expect(getReminderHourOptions(lastDay, now)).toEqual(Array.from({ length: 12 }, (_, hour) => hour));
    expect(getReminderMinuteOptions(lastDay, 11, now).at(-1)).toBe(55);
    expect(buildReminderTimestamp(lastDay, 11, 55, now)).toBe(getReminderBounds(now).maxTs);
  });
});

describe.skipIf(process.env.TZ !== 'America/New_York')('New York clock changes', () => {
  it('does not offer the nonexistent spring-forward hour', () => {
    const day = startOfLocalDay(Date.parse('2026-03-08T12:00:00-04:00'));
    const hours = getReminderHourOptions(day, Date.parse('2026-03-07T12:00:00-05:00'));
    expect(hours).not.toContain(2);
    expect(hours).toContain(1);
    expect(hours).toContain(3);
  });
  it('offers still-future minutes in the repeated fall-back hour', () => {
    const now = Date.parse('2026-11-01T01:40:00-04:00');
    const minutes = getReminderMinuteOptions(startOfLocalDay(now), 1, now);
    expect(minutes).toContain(30);
    expect(minutes).toContain(45);
  });
  it('selects a future occurrence and preserves the current offset when possible', () => {
    const now = Date.parse('2026-11-01T01:40:00-04:00');
    const day = startOfLocalDay(now);
    expect(buildReminderTimestamp(day, 1, 30, now, now)).toBe(Date.parse('2026-11-01T01:30:00-05:00'));
    expect(buildReminderTimestamp(day, 1, 45, now, now)).toBe(Date.parse('2026-11-01T01:45:00-04:00'));
    expect(buildReminderTimestamp(day, 1, 45, now, Date.parse('2026-11-01T01:30:00-05:00'))).toBe(Date.parse('2026-11-01T01:45:00-05:00'));
  });
});

describe.skipIf(process.env.TZ !== 'Australia/Lord_Howe')('Lord Howe half-hour clock changes', () => {
  it('omits nonexistent minutes in the spring-forward hour', () => {
    const now = Date.parse('2026-10-03T12:00:00+10:30');
    const day = startOfLocalDay(Date.parse('2026-10-04T12:00:00+11:00'));
    expect(getReminderMinuteOptions(day, 2, now)).toEqual([30, 35, 40, 45, 50, 55]);
  });
  it('finds the later occurrence of a repeated minute', () => {
    const now = Date.parse('2026-04-05T01:50:00+11:00');
    const day = startOfLocalDay(now);
    expect(getReminderMinuteOptions(day, 1, now)).toContain(40);
    expect(buildReminderTimestamp(day, 1, 40, now, now)).toBe(Date.parse('2026-04-05T01:40:00+10:30'));
  });
});
