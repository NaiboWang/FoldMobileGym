import { describe, expect, it } from 'vitest';
import { dailyForDate } from '../apps/Weather/utils/dateFormat';

describe('daily weather date selection', () => {
  const days = [{fxDate:'2024-02-28', tempMax:'21'}, {fxDate:'2024-02-29', tempMax:'22'}, {fxDate:'2024-03-01', tempMax:'23'}];
  it('matches by calendar date even when the current date is not the first entry', () => {
    expect(dailyForDate(days, '2024-02-29')).toBe(days[1]);
    expect(dailyForDate(days, '2024-03-01')).toBe(days[2]);
  });
  it('does not use a stale or fabricated forecast when the date is absent', () => {
    expect(dailyForDate(days, '2024-03-02')).toBeNull();
    expect(dailyForDate([], '2024-02-28')).toBeNull();
    expect(dailyForDate(undefined, '2024-02-28')).toBeNull();
  });
});
