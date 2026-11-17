import { describe, expect, it } from 'vitest';
import { resolveFavoriteEntries } from '../apps/Bilibili/utils/favoriteEntries';
import type { BilibiliVideo } from '../apps/Bilibili/types';

describe('favorite folder entry identity', () => {
  const first = { id: 'a', title: 'A' } as BilibiliVideo;
  const second = { id: 'b', title: 'B' } as BilibiliVideo;

  it('keeps stored order rather than catalog order and retains unavailable IDs', () => {
    const ids = ['b', 'missing', 'a'];
    expect(resolveFavoriteEntries(ids, [first, second])).toEqual([
      { id: 'b', video: second }, { id: 'missing', video: undefined }, { id: 'a', video: first },
    ]);
    expect(ids).toEqual(['b', 'missing', 'a']);
  });

  it('keeps duplicates as separate records without mutating the inputs', () => {
    const catalog = [first, second];
    expect(resolveFavoriteEntries(['a', 'a'], catalog)).toEqual([{ id: 'a', video: first }, { id: 'a', video: first }]);
    expect(catalog).toEqual([first, second]);
  });

  it('does not invent records or metadata for empty inputs', () => {
    expect(resolveFavoriteEntries(undefined, [first])).toEqual([]);
    expect(resolveFavoriteEntries(['a'], [])).toEqual([{ id: 'a', video: undefined }]);
  });
});
