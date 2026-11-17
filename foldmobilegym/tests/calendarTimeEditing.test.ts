import { describe, expect, it } from 'vitest';
import * as TimeService from '../os/TimeService';
import { calendarTimeTextAfterSync, parseCalendarTime, replaceCalendarTime, resolveCalendarSaveTime } from '../system/Calendar/timeEditing';
describe('Calendar time text validation', () => {
  it('accepts padded, one-digit and spaced existing supported formats', () => {
    expect(parseCalendarTime('09:15')).toEqual({ hour: 9, minute: 15 });
    expect(parseCalendarTime(' 9 : 5 ')).toEqual({ hour: 9, minute: 5 });
  });
  it('accepts both day boundaries', () => {
    expect(parseCalendarTime('00:00')).toEqual({ hour: 0, minute: 0 });
    expect(parseCalendarTime('23:59')).toEqual({ hour: 23, minute: 59 });
  });
  it('rejects impossible hours/minutes rather than normalizing', () => {
    for (const value of ['24:00', '25:99', '09:60', '-1:00', '1:999']) expect(parseCalendarTime(value)).toBeNull();
  });
  it('rejects blank, partial and trailing text', () => {
    for (const value of ['', ' ', '09:', '9', '9am', '09:15x', '09:15:00']) expect(parseCalendarTime(value)).toBeNull();
  });
  it('changes hours/minutes while retaining the selected local date', () => {
    const before = TimeService.fromLocalParts(2026, 9, 12, 14, 30, 41).getTime();
    const result = TimeService.fromTimestamp(replaceCalendarTime(before, '09:15')!);
    expect([result.getFullYear(), result.getMonth(), result.getDate(), result.getHours(), result.getMinutes(), result.getSeconds()])
      .toEqual([2026, 9, 12, 9, 15, 0]);
  });
  it('returns null for invalid time without substituting the previous value', () => {
    expect(replaceCalendarTime(1000, '25:99')).toBeNull();
  });
  it('rejects nonfinite dates', () => {
    expect(replaceCalendarTime(NaN, '09:15')).toBeNull();
    expect(replaceCalendarTime(Infinity, '09:15')).toBeNull();
  });
  it('rejects finite timestamps outside the supported date range', () => {
    expect(replaceCalendarTime(1e20, '09:15')).toBeNull();
  });
  it('preserves seconds and milliseconds when save did not change the displayed time', () => {
    const before = TimeService.fromLocalParts(2026, 9, 12, 14, 30, 41, 123).getTime();
    expect(resolveCalendarSaveTime(before, '14:30')).toBe(before);
    const changed = resolveCalendarSaveTime(before, '09:15');
    expect(TimeService.fromTimestamp(changed!).getHours()).toBe(9);
    expect(TimeService.fromTimestamp(changed!).getSeconds()).toBe(0);
    expect(resolveCalendarSaveTime(before, '25:99')).toBeNull();
  });
  it('retains an independent malformed time during coupled synchronization', () => {
    expect(calendarTimeTextAfterSync('25:99', 1000, 5000)).toBe('25:99');
    expect(calendarTimeTextAfterSync('', 1000, 5000)).toBe('');
  });
  it('retains a syntactically valid end that is earlier than the current start', () => {
    const start = TimeService.fromLocalParts(2026, 9, 12, 9, 30).getTime();
    expect(calendarTimeTextAfterSync('08:00', start, start + 3600000, start)).toBe('08:00');
  });
  it('still updates a valid dependent time and formats supported input canonically', () => {
    const before = TimeService.fromLocalParts(2026, 9, 12, 9, 30).getTime();
    const after = TimeService.fromLocalParts(2026, 9, 12, 10, 45).getTime();
    expect(calendarTimeTextAfterSync(' 9 : 30 ', before, after)).toBe('10:45');
  });
  it('accepts an end exactly at its lower bound rather than treating it as invalid', () => {
    const start = TimeService.fromLocalParts(2026, 9, 12, 9, 30).getTime();
    expect(calendarTimeTextAfterSync('09:30', start, start + 3600000, start)).toBe('10:30');
  });
});
