import type { Tab } from './state';

export interface BrowserHistoryEntry { url: string; title: string; scrollTop?: number }
export interface BrowserTabHistory { entries: BrowserHistoryEntry[]; index: number }
const position = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;

/** Old/imported tabs own only their actual current page, never invented visits. */
export function readBrowserTabHistory(tab: Tab): BrowserTabHistory {
  const history = tab.history;
  if (history && Array.isArray(history.entries) && history.entries.length > 0
      && Number.isInteger(history.index) && history.index >= 0 && history.index < history.entries.length
      && history.entries.every(entry => entry && typeof entry.url === 'string' && typeof entry.title === 'string'
        && (entry.scrollTop === undefined || (Number.isFinite(entry.scrollTop) && entry.scrollTop >= 0)))
      && history.entries[history.index].url === tab.url && history.entries[history.index].title === tab.title) return history;
  return { entries: [{ url: tab.url, title: tab.title, scrollTop: 0 }], index: 0 };
}

export function rememberBrowserScroll(tab: Tab, scrollTop: number): Tab {
  const history = readBrowserTabHistory(tab), value = position(scrollTop);
  if ((history.entries[history.index].scrollTop ?? 0) === value) return tab;
  const entries = history.entries.map((entry, index) => index === history.index ? { ...entry, scrollTop: value } : entry);
  return { ...tab, history: { entries, index: history.index } };
}

export function navigateBrowserTab(tab: Tab, url: string, title: string, scrollTop = 0): Tab {
  const history = readBrowserTabHistory(tab);
  const entries = history.entries.map((entry, index) => index === history.index ? { ...entry, scrollTop: position(scrollTop) } : entry);
  if (tab.url === url) {
    entries[history.index] = { ...entries[history.index], title };
    return { ...tab, url, title, history: { entries, index: history.index } };
  }
  const branch = [...entries.slice(0, history.index + 1), { url, title, scrollTop: 0 }];
  return { ...tab, url, title, history: { entries: branch, index: branch.length - 1 } };
}

export function moveBrowserTab(tab: Tab, direction: -1 | 1, scrollTop = 0): Tab | undefined {
  const history = readBrowserTabHistory(tab), index = history.index + direction;
  if (index < 0 || index >= history.entries.length) return undefined;
  const entries = history.entries.map((entry, current) => current === history.index ? { ...entry, scrollTop: position(scrollTop) } : entry);
  const target = entries[index];
  return { ...tab, url: target.url, title: target.title, history: { entries, index } };
}

/** Home on an already blank source is idempotent, not a title/history rewrite. */
export function navigateBrowserHome(tab: Tab, title: string, scrollTop = 0): Tab {
  return tab.url ? navigateBrowserTab(tab, '', title, scrollTop) : tab;
}

/** Owned HTTP(S) navigation attempts remain visible to the existing safety counter. */
export const isExternalBrowserUrl = (url: string) => /^https?:\/\//i.test(url);
