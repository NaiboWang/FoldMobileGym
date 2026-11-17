import { describe, expect, it, vi } from 'vitest';
vi.mock('../os/createAppStore', () => ({
  createAppStoreWithActions: (_id: string, initial: Record<string, unknown>, build: (set: (patch: unknown) => void, get: () => unknown) => Record<string, unknown>) => {
    let state = { ...initial };
    const set = (patch: unknown) => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch as object) }; };
    const actions = build(set, () => state); state = { ...state, ...actions };
    return Object.assign((selector: (value: unknown) => unknown) => selector(state), { getState: () => state, setState: set });
  },
  memoSelector: (selector: unknown) => selector,
  registerStateAdapter: () => {},
}));
import { useBrowserStore } from '../system/Browser/state';
import { navigateBrowserTab, moveBrowserTab, isExternalBrowserUrl } from '../system/Browser/tabHistory';
const seed = (tabs = [{ id: 'one', url: '', title: 'Imported Home' }], activeTabId = tabs[0].id) => {
  useBrowserStore.setState({ tabs, activeTabId, externalNavigationCount: 0, bookmarks: {}, visitedUrls: [] });
  return useBrowserStore.getState();
};
const active = () => { const state = useBrowserStore.getState(); return state.tabs.find(tab => tab.id === state.activeTabId)!; };

describe('Browser owned history/reload external-attempt accounting', () => {
  it.each(['https://example.invalid/page', 'http://example.invalid/page', 'HTTPS://example.invalid/page'])('recognizes external URL attempts without connecting: %s', url => {
    expect(isExternalBrowserUrl(url)).toBe(true);
  });
  it.each(['', 'benchmark://local', 'about:blank', 'data:text/plain,local'])('does not count a local/internal source as external: %s', url => {
    expect(isExternalBrowserUrl(url)).toBe(false);
  });
  it('records reload exactly once without changing title, URL or history length/index', () => {
    const tab = navigateBrowserTab({ id: 'one', url: '', title: 'Home' }, 'https://example.invalid/page', 'Exact retained title');
    const state = seed([tab]);
    expect(state.reloadTab(tab.id, tab, 0)).toBe(true);
    expect(useBrowserStore.getState().externalNavigationCount).toBe(1);
    expect(active()).toBe(tab); expect(active().history).toBe(tab.history);
  });
  it('keeps controlled navigation, refresh, Home and Back free of external attempts', () => {
    const state = seed(); state.navigateTab('one', 'benchmark://a', active(), 0);
    useBrowserStore.getState().reloadTab('one', active(), 0);
    useBrowserStore.getState().goHome('one', active(), 0);
    useBrowserStore.getState().moveTab('one', -1, active(), 0);
    expect(useBrowserStore.getState().externalNavigationCount).toBe(0);
  });
  it('records history navigation into an external page, but not return to Home', () => {
    const tab = navigateBrowserTab({ id: 'one', url: '', title: 'Home' }, 'https://example.invalid/page', 'External');
    const back = moveBrowserTab(tab, -1)!; seed([back]);
    useBrowserStore.getState().moveTab('one', 1, active(), 0);
    expect(useBrowserStore.getState().externalNavigationCount).toBe(1);
    useBrowserStore.getState().moveTab('one', -1, active(), 0);
    expect(useBrowserStore.getState().externalNavigationCount).toBe(1);
  });
  it('records selecting an external source once, not reselecting the same visible tab', () => {
    seed([{ id: 'one', url: 'benchmark://local', title: 'Local' }, { id: 'two', url: 'https://example.invalid/page', title: 'External' }]);
    useBrowserStore.getState().setActiveTabId('two', active(), 0);
    expect(useBrowserStore.getState().externalNavigationCount).toBe(1);
    useBrowserStore.getState().setActiveTabId('two', active(), 0);
    expect(useBrowserStore.getState().externalNavigationCount).toBe(1);
  });
  it('records an external tab becoming visible through an active close, never an inactive removal', () => {
    seed([{ id: 'one', url: 'benchmark://local', title: 'Local' }, { id: 'two', url: 'https://example.invalid/page', title: 'External' }]);
    useBrowserStore.getState().closeTab('one', active());
    expect(useBrowserStore.getState().externalNavigationCount).toBe(1);
    seed([{ id: 'one', url: 'benchmark://local', title: 'Local' }, { id: 'two', url: 'https://example.invalid/page', title: 'External' }]);
    useBrowserStore.getState().closeTab('two');
    expect(useBrowserStore.getState().externalNavigationCount).toBe(0);
  });
  it('rejects inactive/replaced reload and history callbacks before either request accounting or mutation', () => {
    seed([{ id: 'one', url: 'benchmark://local', title: 'Local' }, { id: 'two', url: 'https://example.invalid/page', title: 'External' }]);
    const state = useBrowserStore.getState(), other = state.tabs[1], before = structuredClone(state.tabs);
    expect(state.reloadTab('two', other, 0)).toBe(false);
    expect(state.moveTab('two', -1, other, 0)).toBeUndefined();
    expect(state.navigateTab('one', 'https://example.invalid/new', { ...active() }, 0)).toBe(false);
    expect(useBrowserStore.getState().externalNavigationCount).toBe(0);
    expect(useBrowserStore.getState().tabs).toEqual(before);
  });
  it('a blank Home reload does not manufacture metadata or rewrite an imported title', () => {
    const state = seed(), tab = active(); expect(state.reloadTab(tab.id, tab, 0)).toBe(true);
    expect(active()).toBe(tab); expect(active().title).toBe('Imported Home'); expect(active().history).toBeUndefined();
  });
});
