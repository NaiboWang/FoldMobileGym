import { describe, expect, it } from 'vitest';
import { formatTimerTotal } from '../system/Clock/timerDisplay';
import { strings } from '../system/Clock/res/strings';
import { stringsEn } from '../system/Clock/res/strings.en';

const en = { ...strings, ...stringsEn };
describe('Clock timer duration label', () => {
  it('keeps the existing whole-minute label', () => {
    expect(formatTimerTotal(1200, strings)).toBe('共20分钟');
    expect(formatTimerTotal(1200, en)).toBe('20 min total');
  });
  it('does not round away seconds from the chosen duration', () => {
    for (const [seconds, text] of [[1, '00:00:01'], [29, '00:00:29'], [90, '00:01:30'], [3661, '01:01:01']] as const) {
      expect(formatTimerTotal(seconds, strings)).toBe(`共${text}`);
      expect(formatTimerTotal(seconds, en)).toBe(`${text} total`);
    }
  });
});
