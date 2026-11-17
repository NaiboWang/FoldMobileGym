import { describe, expect, it } from 'vitest';
import { formatFavoriteCount } from '../apps/Bilibili/utils/favoriteLocale';
import { formatBilibiliStat } from '../apps/Bilibili/utils/localize';
import { strings } from '../apps/Bilibili/res/strings';
import { stringsEn } from '../apps/Bilibili/res/strings.en';
import { resolveAppStrings } from '../os/useAppStrings';

describe('Bilibili favorites localized labels', () => {
  const en = resolveAppStrings(strings, stringsEn, 'en');
  it.each([[0, '0 items'], [1, '1 item'], [2, '2 items']] as const)('formats %s items in English', (n, expected) => {
    expect(formatFavoriteCount(n, en)).toBe(expected);
  });
  it('keeps Chinese count format and converts displayed compact statistics by locale', () => {
    expect(formatFavoriteCount(1, strings)).toBe('1个内容');
    expect(formatBilibiliStat('1.2万', 'en')).toBe('12.0K');
    expect(formatBilibiliStat('1.2万', 'zh-Hans')).toBe('1.2万');
  });
});
