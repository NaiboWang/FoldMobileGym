import { describe, it, expect } from 'vitest';
import * as TimeService from '@/os/TimeService';
import { dateInputValue, replaceCalendarDate } from '../system/Calendar/dateEditing';

describe('Calendar date editing', () => {
  const initial = TimeService.fromLocalParts(2026, 9, 10, 14, 25).getTime();
  it('changes month/year while retaining hours and minutes', () => {
    const next = replaceCalendarDate(initial, '2027-01-02');
    expect(next).not.toBeNull();
    expect(dateInputValue(next!)).toBe('2027-01-02');
    expect(TimeService.fromTimestamp(next!).getHours()).toBe(14);
    expect(TimeService.fromTimestamp(next!).getMinutes()).toBe(25);
  });
  it('rejects impossible dates and accepts leap day', () => {
    expect(replaceCalendarDate(initial, '2026-02-29')).toBeNull();
    expect(replaceCalendarDate(initial, '2026-13-01')).toBeNull();
    expect(replaceCalendarDate(initial, '')).toBeNull();
    expect(dateInputValue(replaceCalendarDate(initial, '2028-02-29')!)).toBe('2028-02-29');
  });
});
