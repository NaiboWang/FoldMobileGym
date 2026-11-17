import { createAppStoreWithActions, memoSelector, registerStateAdapter } from '../../os/createAppStore';
import { BROWSER_CONFIG } from './data';
import { addBrowserBookmark, type BrowserBookmark } from './bookmarks';
import { planBrowserTabClose } from './tabClosing';
import { navigateBrowserTab, navigateBrowserHome, moveBrowserTab, rememberBrowserScroll, isExternalBrowserUrl, type BrowserTabHistory } from './tabHistory';

// --- Types ---

export interface Tab {
  id: string;
  url: string;
  title: string;
  history?: BrowserTabHistory;
}

interface BrowserState {
  bookmarks: Record<string, BrowserBookmark>;
  /** Replaceable offline documents; content stays local and renders as text. */
  localPages?: Record<string, { title: string; badge: string; paragraphs: string[] }>;
  tabs: Tab[];
  activeTabId: string;
  visitedUrls: string[];
  externalNavigationCount: number;
  orderCount: number;
  locationPermissionCount: number;
}

interface BrowserActions {
  bookmarkTab: (tabId: string, expectedUrl: string) => void;
  /** Set the active tab by ID */
  setActiveTabId: (id: string, expected?: Tab, scrollTop?: number) => void;
  /** Navigate a tab to a URL (updates url + title) */
  navigateTab: (tabId: string, url: string, expected?: Tab, scrollTop?: number) => boolean;
  moveTab: (tabId: string, direction: -1 | 1, expected: Tab, scrollTop: number) => Tab | undefined;
  rememberScroll: (tabId: string, expected: Tab, scrollTop: number) => void;
  reloadTab: (tabId: string, expected: Tab, scrollTop: number) => boolean;
  /** Add a new empty tab and make it active; returns the new tab ID */
  addTab: (expected?: Tab, scrollTop?: number) => string;
  /** Close a tab; if it's the last one, replaces with a fresh default tab.
   *  Returns { newActiveTabId, newActiveTabHasUrl } so the caller can do router navigation. */
  closeTab: (id: string, expected?: Tab) => { closed: boolean; newActiveTabId: string; newActiveTabHasUrl: boolean };
  /** Reset a tab to the home state (empty URL) */
  goHome: (tabId: string, expected?: Tab, scrollTop?: number) => boolean;
  /** Track a visited URL (no-op if already tracked) */
  trackVisitedUrl: (url: string) => void;
}

// --- Initial state ---

const initialState: BrowserState = {
  bookmarks: {},
  tabs: BROWSER_CONFIG.tabs as Tab[],
  activeTabId: BROWSER_CONFIG.activeTabId,
  visitedUrls: BROWSER_CONFIG.visitedUrls as string[],
  externalNavigationCount: 0,
  orderCount: 0,
  locationPermissionCount: 0,
};

// --- Store ---

export const useBrowserStore = createAppStoreWithActions<BrowserState, BrowserActions>(
  'browser',
  initialState,
  (set, get) => ({
    bookmarkTab(tabId, expectedUrl) {
      set(state => {
        const tab = state.tabs.find(tab => tab.id === tabId);
        if (state.activeTabId !== tabId || !tab || !expectedUrl || tab.url !== expectedUrl) return state;
        const title = state.localPages?.[tab.url]?.title ?? tab.title;
        const bookmarks = addBrowserBookmark(state.bookmarks, tab, title);
        return bookmarks === state.bookmarks ? state : { bookmarks };
      });
    },
    setActiveTabId(id: string, expected?: Tab, scrollTop?: number) {
      const state = get(), current = state.tabs.find(tab => tab.id === state.activeTabId);
      const target = state.tabs.find(tab => tab.id === id);
      if (!target || (expected && current !== expected)) return;
      const tabs = current && scrollTop !== undefined
        ? state.tabs.map(tab => tab === current ? rememberBrowserScroll(tab, scrollTop) : tab) : state.tabs;
      set({ tabs, activeTabId: id, externalNavigationCount: state.externalNavigationCount + (id !== state.activeTabId && isExternalBrowserUrl(target.url) ? 1 : 0) });
    },

    navigateTab(tabId: string, url: string, expected?: Tab, scrollTop = 0) {
      const state = get(), tab = state.tabs.find(item => item.id === tabId);
      if (!tab || (expected && (tab !== expected || state.activeTabId !== tabId))) return false;
      const next = navigateBrowserTab(tab, url, url.split('/')[2] || url, scrollTop);
      set({ tabs: state.tabs.map(item => item === tab ? next : item),
        externalNavigationCount: state.externalNavigationCount + (isExternalBrowserUrl(url) ? 1 : 0) });
      return true;
    },

    moveTab(tabId, direction, expected, scrollTop) {
      const state = get(), tab = state.tabs.find(item => item.id === tabId);
      if (!tab || tab !== expected || state.activeTabId !== tabId) return undefined;
      const next = moveBrowserTab(tab, direction, scrollTop);
      if (next) set({ tabs: state.tabs.map(item => item === tab ? next : item), externalNavigationCount: state.externalNavigationCount + (isExternalBrowserUrl(next.url) ? 1 : 0) });
      return next;
    },

    reloadTab(tabId, expected, scrollTop) {
      const state = get(), tab = state.tabs.find(item => item.id === tabId);
      if (!tab || tab !== expected || state.activeTabId !== tabId) return false;
      const next = rememberBrowserScroll(tab, scrollTop);
      const externalNavigationCount = state.externalNavigationCount + (isExternalBrowserUrl(tab.url) ? 1 : 0);
      if (next !== tab || externalNavigationCount !== state.externalNavigationCount) {
        set({ tabs: state.tabs.map(item => item === tab ? next : item), externalNavigationCount });
      }
      return true;
    },

    rememberScroll(tabId, expected, scrollTop) {
      const state = get(), tab = state.tabs.find(item => item.id === tabId);
      if (!tab || tab !== expected || state.activeTabId !== tabId) return;
      const next = rememberBrowserScroll(tab, scrollTop);
      if (next !== tab) set({ tabs: state.tabs.map(item => item === tab ? next : item) });
    },

    addTab(expected?: Tab, scrollTop?: number) {
      const state = get(), current = state.tabs.find(tab => tab.id === state.activeTabId);
      if (expected && current !== expected) return '';
      const newId = Math.random().toString(36).substr(2, 9);
      const tabs = current && scrollTop !== undefined
        ? state.tabs.map(tab => tab === current ? rememberBrowserScroll(tab, scrollTop) : tab) : state.tabs;
      set({ tabs: [...tabs, { id: newId, url: '', title: '主页' }], activeTabId: newId });
      return newId;
    },

    closeTab(id: string, expected?: Tab) {
      const { tabs, activeTabId } = get();
      const plan = planBrowserTabClose(tabs, activeTabId, id, expected);
      if (plan.closed) set({ tabs: plan.tabs, activeTabId: plan.activeTabId,
        externalNavigationCount: get().externalNavigationCount + (plan.activeTabId !== activeTabId && isExternalBrowserUrl(plan.tabs.find(tab => tab.id === plan.activeTabId)?.url ?? '') ? 1 : 0) });
      return { closed: plan.closed, newActiveTabId: plan.activeTabId, newActiveTabHasUrl: plan.newActiveTabHasUrl };
    },

    goHome(tabId: string, expected?: Tab, scrollTop = 0) {
      const state = get(), tab = state.tabs.find(item => item.id === tabId);
      if (!tab || (expected && (tab !== expected || state.activeTabId !== tabId))) return false;
      const next = navigateBrowserHome(tab, '主页', scrollTop);
      if (next !== tab) set({ tabs: state.tabs.map(item => item === tab ? next : item) });
      return true;
    },

    trackVisitedUrl(url: string) {
      if (!url) return;
      const { visitedUrls } = get();
      if (visitedUrls.includes(url)) return;
      set({ visitedUrls: [...visitedUrls, url] });
    },
  }),
);

// --- Memoized selectors ---

/** Derive the active tab from tabs + activeTabId */
export const selectActiveTab = memoSelector(
  (state: BrowserState & BrowserActions) => ({ tabs: state.tabs, activeTabId: state.activeTabId }),
  ({ tabs, activeTabId }) => tabs.find(t => t.id === activeTabId) || tabs[0],
);

registerStateAdapter('browser', (raw: Record<string, any>) => ({
  ...raw,
  external_navigation_count: Number(raw.externalNavigationCount ?? 0),
  order_count: Number(raw.orderCount ?? 0),
  location_permission_count: Number(raw.locationPermissionCount ?? 0),
}));
