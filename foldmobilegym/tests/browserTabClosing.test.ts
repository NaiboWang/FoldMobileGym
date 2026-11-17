import { describe, expect, it } from 'vitest';
import { planBrowserTabClose } from '../system/Browser/tabClosing';
import type { Tab } from '../system/Browser/state';
import { NAVIGATION_DECLARATION } from '../system/Browser/navigation.declaration';
const fixture = (): Tab[] => [
  { id: 'a', url: 'benchmark://alpha', title: 'Alpha' },
  { id: 'b', url: 'benchmark://beta', title: 'Beta' },
  { id: 'c', url: '', title: 'Blank' },
];

describe('Browser source-owned tab closing', () => {
  it('marks the document-close route as requiring an already existing document, not a cold-start shortcut', () => {
    const transition = NAVIGATION_DECLARATION.transitions.find(item => item.id === 'tab.close.view');
    expect(transition?.ui.condition).toMatchObject({ op: 'notEmpty', ref: 'tabs', filterFn: 'tab => Boolean(tab.url)' });
  });
  it('closes an inactive source without changing the active tab or surviving objects', () => {
    const tabs = fixture(), before = structuredClone(tabs), result = planBrowserTabClose(tabs, 'b', 'a', tabs[0]);
    expect(result.closed).toBe(true); expect(result.activeTabId).toBe('b');
    expect(result.newActiveTabHasUrl).toBe(true); expect(result.tabs).toEqual([tabs[1], tabs[2]]);
    expect(result.tabs[0]).toBe(tabs[1]); expect(tabs).toEqual(before);
  });
  it('keeps the existing first-remaining policy when the active tab closes', () => {
    const tabs = fixture(), result = planBrowserTabClose(tabs, 'b', 'b', tabs[1]);
    expect(result.tabs).toEqual([tabs[0], tabs[2]]); expect(result.activeTabId).toBe('a');
    expect(result.newActiveTabHasUrl).toBe(true);
  });
  it('reports a home destination when the replacement has no URL', () => {
    const tabs = fixture().slice(1), result = planBrowserTabClose(tabs, 'b', 'b', tabs[0]);
    expect(result.activeTabId).toBe('c'); expect(result.newActiveTabHasUrl).toBe(false);
  });
  it('replaces the final valid source with one existing-policy blank tab', () => {
    const tabs = fixture().slice(0, 1), result = planBrowserTabClose(tabs, 'a', 'a', tabs[0]);
    expect(result).toEqual({ tabs: [{ id: '1', url: '', title: '主页' }], activeTabId: '1', closed: true, newActiveTabHasUrl: false });
    expect(tabs[0].url).toBe('benchmark://alpha');
  });
  it.each([1, 2, 3])('does not reset or remove a tab for an absent ID with %i source(s)', count => {
    const tabs = fixture().slice(0, count), result = planBrowserTabClose(tabs, 'a', 'missing');
    expect(result.closed).toBe(false); expect(result.tabs).toBe(tabs); expect(result.activeTabId).toBe('a');
  });
  it('rejects a replaced source object even when ID and values are identical', () => {
    const tabs = fixture(), result = planBrowserTabClose(tabs, 'a', 'a', { ...tabs[0] });
    expect(result.closed).toBe(false); expect(result.tabs).toBe(tabs);
  });
  it('rejects a stale final-tab callback even when the replacement reuses the ID', () => {
    const old = { id: '1', url: 'benchmark://old', title: 'Old' };
    const first = planBrowserTabClose([old], '1', '1', old);
    const stale = planBrowserTabClose(first.tabs, first.activeTabId, '1', old);
    expect(stale.closed).toBe(false); expect(stale.tabs).toBe(first.tabs);
    expect(planBrowserTabClose(first.tabs, '1', '1', first.tabs[0]).closed).toBe(true);
  });
  it('refuses ambiguous duplicate identities without removing both records', () => {
    const tabs = [...fixture(), { ...fixture()[0] }], result = planBrowserTabClose(tabs, 'b', 'a');
    expect(result.closed).toBe(false); expect(result.tabs).toBe(tabs);
  });
  it('does not invent an active source for corrupt or empty input', () => {
    const tabs = fixture();
    expect(planBrowserTabClose(tabs, 'absent', 'a').tabs).toBe(tabs);
    expect(planBrowserTabClose(tabs, 'absent', 'a').closed).toBe(false);
    expect(planBrowserTabClose([], 'absent', 'a').closed).toBe(false);
  });
  it.each(['a/b', 'a?b', '__proto__'])('matches a literal ID without URL/selector interpretation: %s', id => {
    const target = { id, url: 'benchmark://literal', title: 'Literal' }, other = fixture()[0];
    const result = planBrowserTabClose([other, target], 'a', id, target);
    expect(result.closed).toBe(true); expect(result.tabs).toEqual([other]);
  });
});
