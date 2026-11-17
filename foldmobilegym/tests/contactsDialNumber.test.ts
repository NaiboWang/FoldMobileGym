import { describe, expect, it } from 'vitest';
import { dialNumbersMatch } from '../system/Contacts/utils/dialNumber';

describe('dial number identity', () => {
  it('ignores formatting of the same number', () => {
    expect(dialNumbersMatch('(123) 456-7890', '1234567890')).toBe(true);
    expect(dialNumbersMatch('+1 123-456', '+1123456')).toBe(true);
  });
  it('preserves service codes and international prefixes', () => {
    expect(dialNumbersMatch('*123#', '123')).toBe(false);
    expect(dialNumbersMatch('+123', '123')).toBe(false);
    expect(dialNumbersMatch('*123#', '*123#')).toBe(true);
    expect(dialNumbersMatch('', '')).toBe(false);
    expect(dialNumbersMatch('---', '')).toBe(false);
  });
});
