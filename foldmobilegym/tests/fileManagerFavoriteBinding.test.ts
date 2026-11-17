import { describe, expect, it } from 'vitest';
import { favoriteBindingIsCurrent } from '../system/FileManager/utils/favoriteBinding';
describe('FileManager favorite row binding', () => {
  const path = '/sdcard/source.txt';
  it('allows the currently displayed identity without changing preferences', () => {
    const state = { favoritePaths: [path], favoriteIds: { [path]: 'original' } };
    const before = JSON.stringify(state);
    expect(favoriteBindingIsCurrent(state, path, 'original')).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('rejects a reassigned path instead of removing the replacement favorite', () => {
    expect(favoriteBindingIsCurrent({ favoritePaths: [path], favoriteIds: { [path]: 'replacement' } }, path, 'original')).toBe(false);
  });
  it('rejects removed preferences and stale legacy callbacks after identity binding', () => {
    expect(favoriteBindingIsCurrent({ favoritePaths: [], favoriteIds: { [path]: 'original' } }, path, 'original')).toBe(false);
    expect(favoriteBindingIsCurrent({ favoritePaths: [path], favoriteIds: { [path]: 'original' } }, path, undefined)).toBe(false);
  });
  it('preserves existing path-only legacy behavior without guessing an identity', () => {
    expect(favoriteBindingIsCurrent({ favoritePaths: [path] }, path, undefined)).toBe(true);
    expect(favoriteBindingIsCurrent({ favoritePaths: [path], favoriteIds: {} }, path, 'missing')).toBe(false);
  });
  it('keeps preserved-ID aliases independent from a reused path', () => {
    const alias = 'favorite-id:original';
    const state = { favoritePaths: [path, alias], favoriteIds: { [path]: 'replacement', [alias]: 'original' } };
    expect(favoriteBindingIsCurrent(state, alias, 'original')).toBe(true);
    expect(favoriteBindingIsCurrent(state, path, 'original')).toBe(false);
    expect(favoriteBindingIsCurrent(state, path, 'replacement')).toBe(true);
  });
});
