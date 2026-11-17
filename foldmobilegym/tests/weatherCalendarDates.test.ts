import { describe, expect, it } from 'vitest';
import { parseForecastDate } from '../apps/Weather/utils/dateFormat';
describe('forecast calendar dates', () => {
  it.each([['2026-10-14', 2026, 9, 14, 3], ['2024-02-29', 2024, 1, 29, 4], ['2025-01-01', 2025, 0, 1, 3]])('preserves calendar parts for %s', (input, year, month, day, weekday) => {
    const date = parseForecastDate(input);
    expect(date && [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCDay()]).toEqual([year, month, day, weekday]);
  });
  it.each(['', '2025-02-29', '2026-13-01', '2026-10-14T00:00:00Z', '2026-1-01'])('rejects invalid day-only date %s', input => {
    expect(parseForecastDate(input)).toBeNull();
  });
});
