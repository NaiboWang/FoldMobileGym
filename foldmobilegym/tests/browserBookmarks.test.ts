import { describe, expect, it } from 'vitest';
import { addBrowserBookmark } from '../system/Browser/bookmarks';
describe('Browser exact-URL bookmarks', () => {
  const tab = { id: 'tab', url: 'benchmark://card', title: 'Card' };
  it('supports old state and stores complete URL identity', () => {
    expect(addBrowserBookmark(undefined, tab, 'Title')).toEqual({ [tab.url]: { id: tab.url, url: tab.url, title: 'Title' } });
  });
  it('is idempotent without overwriting an existing saved title', () => {
    const saved = addBrowserBookmark({}, tab, 'Original');
    expect(addBrowserBookmark(saved, tab, 'New')).toBe(saved);
  });
  it('never merges equal titles with different local/external URLs', () => {
    const saved = addBrowserBookmark({}, tab, 'Same');
    const next = addBrowserBookmark(saved, { ...tab, url: 'https://example.test/card' }, 'Same');
    expect(Object.keys(next)).toHaveLength(2); expect(next[tab.url]).toBe(saved[tab.url]);
  });
  it('does not bookmark an empty home tab', () => {
    const saved = {}; expect(addBrowserBookmark(saved, { ...tab, url: '' }, 'Home')).toBe(saved);
  });
});
