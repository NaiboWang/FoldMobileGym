import { describe, expect, it } from 'vitest';
import { getLocalizedMinutelySummary } from '../apps/Weather/utils/localizedText';
import { strings } from '../apps/Weather/res/strings';
import { stringsEn } from '../apps/Weather/res/strings.en';
const en = { ...strings, ...stringsEn };

describe('precipitation summary translation', () => {
  it.each([
    ['未来两小时无降水', 'No precipitation expected in the next 2 hours'],
    ['未来1小时无降水', 'No precipitation expected in the next 1 hour'],
    ['未来3小时无明显降水', 'No significant precipitation expected in the next 3 hours'],
    ['短时内无明显降水', 'No significant precipitation expected in the near term'],
    ['无明显降水', 'No significant precipitation expected'],
    ['未来两小时有大雨', 'Heavy rain expected in the next 2 hours'],
    ['15分钟后开始下小雨', 'Light rain expected to start in 15 minutes'],
  ])('translates %s without inventing duration or intensity', (source, expected) => {
    expect(getLocalizedMinutelySummary(source, en)).toBe(expected);
  });
  it.each(['未来两小时无降水，之后可能有暴雨', '未来1小时无雨但有雪', '降水概率30%', '未来两小时可能有雷雨'])('retains unsupported information rather than guessing: %s', source => {
    expect(getLocalizedMinutelySummary(source, en)).toBe(source);
  });
  it('preserves existing Chinese and English inputs and empty data', () => {
    expect(getLocalizedMinutelySummary('未来1小时无降水', strings)).toBe('未来1小时无降水');
    expect(getLocalizedMinutelySummary('Rain expected in 15 minutes', en)).toBe('Rain expected in 15 minutes');
    expect(getLocalizedMinutelySummary(undefined, en)).toBe('');
  });
});
