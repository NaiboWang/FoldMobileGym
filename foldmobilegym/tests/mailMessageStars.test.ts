import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../os/createAppStore', async () => {
  const { createStore } = await import('zustand/vanilla');
  return { createAppStoreWithActions: (_id: string, initial: object, actions: (set: unknown) => object) =>
    createStore(set => ({ ...initial, ...actions(set) })), registerStateAdapter: vi.fn() };
});
import { useMailStore } from '../apps/Mail/state';
const initial = useMailStore.getState();
beforeEach(() => useMailStore.setState(initial, true));
describe('Mail source-bound stars', () => {
  it('toggles only the chosen message relationship, retaining source and drafts', () => {
    const [a, b] = initial.messages;
    initial.toggleStar(a); initial.toggleStar(b);
    expect(useMailStore.getState().starredIds).toEqual([a.id, b.id]);
    initial.toggleStar(a);
    expect(useMailStore.getState().starredIds).toEqual([b.id]);
    expect(useMailStore.getState().messages).toBe(initial.messages);
    expect(useMailStore.getState().drafts).toBe(initial.drafts);
    expect(useMailStore.getState().verifiedIds).toBe(initial.verifiedIds);
  });
  it('rejects a removed source rather than creating a relationship', () => {
    const source = initial.messages[0];
    useMailStore.setState({ messages: initial.messages.filter(item => item.id !== source.id) });
    const before = useMailStore.getState(); initial.toggleStar(source);
    expect(useMailStore.getState()).toBe(before);
  });
  it('rejects an old callback after same-ID content replacement', () => {
    const source = initial.messages[0], replacement = { ...source, body: 'Replacement source' };
    useMailStore.setState({ messages: [replacement, ...initial.messages.slice(1)] });
    const before = useMailStore.getState(); initial.toggleStar(source);
    expect(useMailStore.getState()).toBe(before);
    initial.toggleStar(replacement);
    expect(useMailStore.getState().starredIds).toEqual([replacement.id]);
  });
  it('does not accept a caller-supplied copy as the live source', () => {
    const before = useMailStore.getState(); initial.toggleStar({ ...initial.messages[0] });
    expect(useMailStore.getState()).toBe(before);
  });
});
