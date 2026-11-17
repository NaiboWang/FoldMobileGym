import { describe, expect, it } from 'vitest';
import { summarizeReadingMonths } from '../apps/WechatReading/utils/readingCalendar';

describe('reading calendar summaries', () => {
  it('counts unique reading days while summing actual sessions in each month', () => {
    expect(summarizeReadingMonths([
      { date: '2026-01-01', duration: 12 }, { date: '2026-01-01', duration: 8 },
      { date: '2026-01-02', duration: 5 }, { date: '2026-02-01', duration: 9 },
    ])).toEqual({ '2026-1': { days: 2, minutes: 25 }, '2026-2': { days: 1, minutes: 9 } });
  });
  it('does not manufacture reading days from invalid dates or nonpositive durations', () => {
    expect(summarizeReadingMonths([
      { date: 'bad', duration: 10 }, { date: '2026-99-99', duration: 10 },
      { date: '2026-02-30', duration: 10 }, { date: '2026-01-01', duration: 0 },
      { date: '2026-01-01', duration: -1 }, { date: '2026-01-01', duration: NaN },
    ])).toEqual({});
  });
});
