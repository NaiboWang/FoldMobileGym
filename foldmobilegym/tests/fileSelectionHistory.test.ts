import { describe, expect, it, vi } from 'vitest';
import { rewindSelectionHistory } from '@/system/FileManager/utils/selectionHistory';
import { getTracker, syncTracker } from '@/os/utils/memoryHistoryTracker';
import { readFileSync } from 'node:fs';

describe('File Manager menu history', () => {
  it('rewinds actual history and aligns the shadow tracker before a push', () => {
    const navigator = { index: 0, go: vi.fn((delta: number) => { navigator.index += delta; }) };
    const base = { pathname: '/folder', search: '?path=%2Fsdcard%2Fspace%20folder' };
    syncTracker(navigator, { pathname: '/', search: '' });
    navigator.index = 1; syncTracker(navigator, base);
    navigator.index = 2; syncTracker(navigator, { pathname: '/folder', search: base.search + '&mode=select' });
    navigator.index = 3; syncTracker(navigator, { pathname: '/folder', search: base.search + '&mode=select&modal=more' });
    expect(rewindSelectionHistory(navigator, 2)).toBe(true);
    expect(navigator.go).toHaveBeenCalledTimes(1); expect(navigator.go).toHaveBeenCalledWith(-2);
    expect(navigator.index).toBe(1);
    expect(getTracker(navigator)?.index).toBe(1);
    expect(getTracker(navigator)?.stack).toEqual([{ pathname: '/', search: '' }, base]);
  });
  it.each([0, -1, 1.5, NaN, Infinity, 4])('does not navigate an invalid/overlarge delta %s', steps => {
    const navigator = { index: 3, go: vi.fn() };
    expect(rewindSelectionHistory(navigator, steps)).toBe(false);
    expect(navigator.go).not.toHaveBeenCalled();
  });
  it.each([null, {}, { index: 2 }, { go: () => {} }])('rejects an incomplete navigator %j', navigator => {
    expect(rewindSelectionHistory(navigator, 2)).toBe(false);
  });
  it('works without a shadow tracker, using the authoritative memory index', () => {
    const navigator = { index: 2, go: vi.fn() };
    expect(rewindSelectionHistory(navigator, 2)).toBe(true);
    expect(navigator.go).toHaveBeenCalledTimes(1); expect(navigator.go).toHaveBeenCalledWith(-2);
  });
  it('rejects a callback whose source location is no longer current', () => {
    const navigator = { index: 3, location: { key: 'new-page' }, go: vi.fn() };
    expect(rewindSelectionHistory(navigator, 2, 'old-menu')).toBe(false);
    expect(navigator.go).not.toHaveBeenCalled();
  });
  it('consumes a menu source once even before React renders a new location', () => {
    const navigator = { index: 3, location: { key: 'menu' }, go: vi.fn((delta: number) => {
      navigator.index += delta; navigator.location = { key: 'base' };
    }) };
    expect(rewindSelectionHistory(navigator, 2, 'menu')).toBe(true);
    expect(rewindSelectionHistory(navigator, 2, 'menu')).toBe(false);
    expect(navigator.go).toHaveBeenCalledTimes(1);
  });
  it('fails closed when a keyed source has no authoritative location', () => {
    const navigator = { index: 3, go: vi.fn() };
    expect(rewindSelectionHistory(navigator, 2, 'menu')).toBe(false);
    expect(navigator.go).not.toHaveBeenCalled();
  });
  it.each(['BrowseHomePage', 'FolderPage', 'RecentPage'])('%s does not schedule menu navigation after a timeout', page => {
    const source = readFileSync(`system/FileManager/pages/${page}.tsx`, 'utf8');
    expect(source).not.toMatch(/setTimeout\([^\n]*go\(/);
    expect(source.match(/popSteps: 2/g)).toHaveLength(2);
  });
});
