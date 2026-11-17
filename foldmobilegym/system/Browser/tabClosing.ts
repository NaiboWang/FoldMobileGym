import type { Tab } from './state';

export interface TabClosePlan {
  tabs: Tab[];
  activeTabId: string;
  closed: boolean;
  newActiveTabHasUrl: boolean;
}

/** Preserve surviving source objects and the existing first-remaining policy. */
export function planBrowserTabClose(tabs: Tab[], activeTabId: string, id: string, expected?: Tab): TabClosePlan {
  const active = tabs.find(tab => tab.id === activeTabId);
  const matches = tabs.filter(tab => tab.id === id);
  const unchanged = { tabs, activeTabId, closed: false, newActiveTabHasUrl: Boolean(active?.url) };
  if (!active || matches.length !== 1 || (expected && expected !== matches[0])) return unchanged;
  if (tabs.length === 1) {
    return { tabs: [{ id: '1', url: '', title: '主页' }], activeTabId: '1', closed: true, newActiveTabHasUrl: false };
  }
  const remaining = tabs.filter(tab => tab.id !== id);
  const next = id === activeTabId ? remaining[0] : active;
  return { tabs: remaining, activeTabId: next.id, closed: true, newActiveTabHasUrl: Boolean(next.url) };
}
