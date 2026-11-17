import { describe, expect, it } from 'vitest';
import { readBrowserTabHistory, navigateBrowserTab, navigateBrowserHome, moveBrowserTab, rememberBrowserScroll, type BrowserTabHistory } from '../system/Browser/tabHistory';
import type { Tab } from '../system/Browser/state';
const home = (): Tab => ({ id: 'one', url: '', title: 'Home' });
const visit = () => navigateBrowserTab(navigateBrowserTab(home(), 'benchmark://a', 'Alpha', 13), 'benchmark://b', 'Beta', 180);

describe('Browser tab-local owned history', () => {
  it('Home on a blank imported source preserves title and optional history exactly', () => {
    const tab = home(); expect(navigateBrowserHome(tab, 'Different display label')).toBe(tab);
    expect(tab.title).toBe('Home'); expect(tab.history).toBeUndefined();
  });
  it('Home from a document is a real entry and Forward can restore that home visit', () => {
    const tab = navigateBrowserHome(visit(), 'Home', 220);
    expect(tab.url).toBe(''); expect(tab.history?.index).toBe(3);
    const previous = moveBrowserTab(tab, -1)!; expect(previous.url).toBe('benchmark://b');
    expect(moveBrowserTab(previous, 1)?.url).toBe('');
    expect(navigateBrowserHome(tab, 'Another home label')).toBe(tab);
  });

  it('migrates an old blank tab without changing default data', () => {
    const tab = home();
    expect(readBrowserTabHistory(tab)).toEqual({ entries: [{ url: '', title: 'Home', scrollTop: 0 }], index: 0 });
    expect(tab.history).toBeUndefined();
  });
  it('does not invent a Home visit behind a legacy current document', () => {
    const tab = { id: 'old', url: 'benchmark://legacy', title: 'Legacy' };
    expect(readBrowserTabHistory(tab).entries.map(entry => entry.url)).toEqual([tab.url]);
    expect(moveBrowserTab(tab, -1)).toBeUndefined();
  });
  it('records actual visits and the departing entry scroll', () => {
    const tab = visit();
    expect(tab.history).toEqual({ index: 2, entries: [
      { url: '', title: 'Home', scrollTop: 13 }, { url: 'benchmark://a', title: 'Alpha', scrollTop: 180 }, { url: 'benchmark://b', title: 'Beta', scrollTop: 0 },
    ] });
  });
  it('Back and Forward restore exact URL/title/entry positions without new visits', () => {
    const tab = visit(), before = structuredClone(tab), back = moveBrowserTab(tab, -1, 240)!;
    expect(back.url).toBe('benchmark://a'); expect(back.title).toBe('Alpha'); expect(back.history?.index).toBe(1);
    expect(back.history?.entries[1].scrollTop).toBe(180);
    const forward = moveBrowserTab(back, 1, 190)!;
    expect(forward.url).toBe('benchmark://b'); expect(forward.history?.entries[2].scrollTop).toBe(240);
    expect(forward.history?.entries[1].scrollTop).toBe(190); expect(tab).toEqual(before);
  });
  it('a new branch truncates only the current forward chain', () => {
    const original = visit(), back = moveBrowserTab(original, -1)!;
    const branch = navigateBrowserTab(back, 'benchmark://c', 'Gamma');
    expect(branch.history?.entries.map(entry => entry.url)).toEqual(['', 'benchmark://a', 'benchmark://c']);
    expect(original.history?.entries.map(entry => entry.url)).toEqual(['', 'benchmark://a', 'benchmark://b']);
    expect(moveBrowserTab(branch, 1)).toBeUndefined();
  });
  it('reloading/re-entering the same URL keeps Forward and does not append', () => {
    const back = moveBrowserTab(visit(), -1)!;
    const reload = navigateBrowserTab(back, back.url, back.title, 220);
    expect(reload.history?.index).toBe(1); expect(reload.history?.entries).toHaveLength(3);
    expect(moveBrowserTab(reload, 1)?.url).toBe('benchmark://b');
  });
  it('distinguishes repeated URLs by their real entry index', () => {
    const tab = navigateBrowserTab(visit(), 'benchmark://a', 'Alpha again');
    const back = moveBrowserTab(tab, -1)!;
    expect(back.url).toBe('benchmark://b');
    expect(moveBrowserTab(back, 1)?.title).toBe('Alpha again');
  });
  it('persists through JSON without borrowing another tab history', () => {
    const one = visit(), two = navigateBrowserTab({ ...home(), id: 'two' }, 'benchmark://other', 'Other');
    const restored = JSON.parse(JSON.stringify(one)) as Tab;
    expect(readBrowserTabHistory(restored)).toEqual(one.history);
    expect(moveBrowserTab(two, -1)?.url).toBe('');
    expect(one.url).toBe('benchmark://b');
  });
  it.each([-1, 1.5, NaN, Infinity, 9])('rejects a malformed persisted index: %s', index => {
    const tab = visit(); tab.history = { ...tab.history!, index };
    expect(readBrowserTabHistory(tab)).toEqual({ index: 0, entries: [{ url: tab.url, title: tab.title, scrollTop: 0 }] });
  });
  it.each(['url', 'title'] as const)('does not reuse imported history after a changed source %s', key => {
    const tab = { ...visit(), [key]: 'replaced source' };
    expect(readBrowserTabHistory(tab).entries).toHaveLength(1);
    expect(moveBrowserTab(tab, -1)).toBeUndefined();
  });
  it.each([{ entries: [] }, { entries: [null] }, { entries: [{ url: 12, title: 'invalid' }] }, { entries: [{ url: 'benchmark://b', title: 'Beta', scrollTop: -1 }] }])('rejects malformed history entries: %j', ({ entries }) => {
    const tab = { ...visit(), history: { entries, index: 0 } as unknown as BrowserTabHistory };
    expect(readBrowserTabHistory(tab).entries).toEqual([{ url: tab.url, title: tab.title, scrollTop: 0 }]);
  });
  it('remembering scroll changes only the actual current entry', () => {
    const tab = visit(), saved = rememberBrowserScroll(tab, 120);
    expect(saved.history?.entries[2].scrollTop).toBe(120);
    expect(saved.history?.entries[1]).toBe(tab.history?.entries[1]);
    expect(tab.history?.entries[2].scrollTop).toBe(0);
    expect(rememberBrowserScroll(saved, 120)).toBe(saved);
  });
  it.each([-3, NaN, Infinity])('invalid viewport positions cannot poison persisted navigation: %s', scroll => {
    const saved = rememberBrowserScroll(visit(), scroll);
    expect(readBrowserTabHistory(saved).entries[2].scrollTop).toBe(0);
  });
  it('does not manufacture a forward page at either boundary', () => {
    const tab = visit(); expect(moveBrowserTab(tab, 1)).toBeUndefined();
    const first = moveBrowserTab(moveBrowserTab(tab, -1)!, -1)!;
    expect(first.url).toBe(''); expect(moveBrowserTab(first, -1)).toBeUndefined();
  });
});
