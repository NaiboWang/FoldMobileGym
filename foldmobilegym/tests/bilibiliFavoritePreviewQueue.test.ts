import { describe, expect, it } from 'vitest';
import { createFavoritePreviewQueue, nextFavoritePreview } from '../apps/Bilibili/utils/favoritePreviewQueue';

describe('favorite simulated-preview queue', () => {
  const available = new Set(['a', 'b', 'c']);
  it('preserves saved order and duplicate entries while skipping missing records', () => {
    const input = ['b', 'missing', 'a', 'a'];
    const queue = createFavoritePreviewQueue(input, available);
    expect(queue).toEqual({ ids: ['b', 'a', 'a'], index: 0 });
    expect(input).toEqual(['b', 'missing', 'a', 'a']);
    expect(nextFavoritePreview(queue, 'b', available)).toEqual({ ids: ['b', 'a', 'a'], index: 1 });
    expect(nextFavoritePreview({ ids: ['b', 'a', 'a'], index: 1 }, 'a', available)).toEqual({ ids: ['b', 'a', 'a'], index: 2 });
    expect(nextFavoritePreview({ ids: ['b', 'a', 'a'], index: 2 }, 'a', available)).toBeNull();
  });
  it('does not create a queue when no entry is available', () => {
    expect(createFavoritePreviewQueue(['missing'], available)).toBeNull();
    expect(createFavoritePreviewQueue([], available)).toBeNull();
  });
  it('skips entries no longer in the live catalog without changing saved IDs', () => {
    const queue = { ids: ['a', 'b', 'c'], index: 0 };
    expect(nextFavoritePreview(queue, 'a', new Set(['a', 'c']))).toEqual({ ids: ['a', 'b', 'c'], index: 2 });
    expect(queue).toEqual({ ids: ['a', 'b', 'c'], index: 0 });
  });
  it('rejects stale, malformed or mismatched route state', () => {
    for (const state of [null, {}, { ids: ['a'], index: -1 }, { ids: ['a'], index: 1 }, { ids: ['a', 5], index: 0 }, { ids: ['a'], index: 0.5 }]) {
      expect(nextFavoritePreview(state, 'a', available)).toBeNull();
    }
    expect(nextFavoritePreview({ ids: ['a', 'b'], index: 0 }, 'c', available)).toBeNull();
  });
});
