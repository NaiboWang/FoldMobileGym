import { describe, expect, it } from 'vitest';
import { nextAudiobookRecommendations } from '../apps/WechatReading/utils/audioRecommendations';

describe('audiobook recommendation refresh', () => {
  it('replaces the full batch whenever sufficient distinct alternatives exist', () => {
    const ids = Array.from({length: 20}, (_, index) => `book-${index}`);
    const current = ids.slice(0, 6);
    const first = nextAudiobookRecommendations(ids, current, 6, () => .5);
    const second = nextAudiobookRecommendations(ids, first, 6, () => .5);
    expect(first).toHaveLength(6);
    expect(new Set(first).size).toBe(6);
    expect(first.every(id => !current.includes(id))).toBe(true);
    expect(second.every(id => !first.includes(id))).toBe(true);
    expect(ids).toEqual(Array.from({length: 20}, (_, index) => `book-${index}`));
  });
  it('prioritizes all alternatives and reuses only as many current ids as necessary', () => {
    const result = nextAudiobookRecommendations(['a','b','c','d','d'], ['a','b','c'], 3, () => 0);
    expect(result[0]).toBe('d');
    expect(new Set(result).size).toBe(3);
    expect(result.filter(id => ['a','b','c'].includes(id))).toHaveLength(2);
  });
  it('handles empty and smaller pools without inventing or duplicating entries', () => {
    expect(nextAudiobookRecommendations([], ['a'])).toEqual([]);
    expect(nextAudiobookRecommendations(['a','a','b'], ['a'], 6, () => 0)).toEqual(['b','a']);
    expect(nextAudiobookRecommendations(['a'], [], 0)).toEqual([]);
  });
});
