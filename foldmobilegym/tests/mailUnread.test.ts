import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../os/createAppStore', async () => {
  const { createStore } = await import('zustand/vanilla');
  return { createAppStoreWithActions: (_id: string, initial: object, actions: (set: unknown) => object) =>
    createStore(set => ({ ...initial, ...actions(set) })), registerStateAdapter: vi.fn() };
});
import { useMailStore } from '../apps/Mail/state';
const initial = useMailStore.getState();
beforeEach(() => useMailStore.setState(initial, true));
describe('local unread membership', () => {
  it('marks and clears only the current source without changing message or draft data', () => {
    const source = initial.messages[0];
    expect(initial.setUnread(source, true)).toBe(true);
    expect(useMailStore.getState().unreadIds).toEqual([source.id]);
    expect(useMailStore.getState().messages).toBe(initial.messages);
    expect(useMailStore.getState().drafts).toBe(initial.drafts);
    expect(useMailStore.getState().archivedIds).toBe(initial.archivedIds);
    expect(useMailStore.getState().setUnread(source, false)).toBe(true);
    expect(useMailStore.getState().unreadIds).toEqual([]);
  });
  it('rejects stale, missing and ambiguous sources without changes', () => {
    const source = initial.messages[0];
    expect(initial.setUnread({ ...source }, true)).toBe(false);
    useMailStore.setState({ messages: [{ ...source }, ...initial.messages.slice(1)] });
    expect(useMailStore.getState().setUnread(source, true)).toBe(false);
    useMailStore.setState({ messages: [source, { ...source }] });
    expect(useMailStore.getState().setUnread(source, true)).toBe(false);
    expect(useMailStore.getState().unreadIds).toBeUndefined();
  });
  it('treats duplicate writes as no-ops', () => {
    const source = initial.messages[0];
    expect(initial.setUnread(source, true)).toBe(true);
    const snapshot = useMailStore.getState();
    expect(snapshot.setUnread(source, true)).toBe(false);
    expect(useMailStore.getState()).toBe(snapshot);
  });
});
