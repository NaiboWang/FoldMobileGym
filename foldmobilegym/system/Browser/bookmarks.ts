import type { Tab } from './state';
export interface BrowserBookmark { id: string; url: string; title: string }
export function addBrowserBookmark(bookmarks: Record<string, BrowserBookmark> | undefined, tab: Tab, title: string) {
  const current = bookmarks ?? {};
  if (!tab.url || current[tab.url]) return current;
  return { ...current, [tab.url]: { id: tab.url, url: tab.url, title } };
}
