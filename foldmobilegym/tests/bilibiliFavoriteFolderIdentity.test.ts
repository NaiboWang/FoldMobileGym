import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../os/createAppStore', async () => {
  const { create } = await import('zustand');
  return { createAppStoreWithActions: (_id: string, initial: object, actions: any) => create((set, get) => ({ ...initial, ...actions(set, get) })), memoSelector: (input: any, compute: any) => (state: any) => compute(input(state)) };
});
import * as TimeService from '../os/TimeService';
import { useBilibiliStore } from '../apps/Bilibili/state';
const initial = useBilibiliStore.getInitialState();
beforeEach(() => { useBilibiliStore.setState(initial, true); vi.spyOn(TimeService, 'now').mockReturnValue(1000); });
afterEach(() => vi.restoreAllMocks());
describe('local favorites folder identity under frozen simulator time', () => {
  it('assigns distinct identities for separate valid creations at the same instant', () => {
    const first = useBilibiliStore.getState().createFavFolder('Local one');
    const second = useBilibiliStore.getState().createFavFolder('Local two');
    expect(second).not.toBe(first);
    expect(useBilibiliStore.getState().user.favoritesFolders?.slice(0, 2).map(folder => folder.id)).toEqual([second, first]);
  });
  it('does not reuse a persisted time-based identity or its existing suffix', () => {
    const base = `fav_${(1000).toString(36)}`;
    const folders = [{ id: base, title: 'Existing', videoIds: ['original-video'] }, { id: `${base}_1`, title: 'Existing suffix', videoIds: [] }];
    useBilibiliStore.setState({ user: { ...initial.user, favoritesFolders: folders } });
    const id = useBilibiliStore.getState().createFavFolder('New local folder', 'Local description', false);
    expect(id).not.toBe(base); expect(id).not.toBe(`${base}_1`);
    expect(useBilibiliStore.getState().user.favoritesFolders?.slice(1)).toEqual(folders);
    expect(useBilibiliStore.getState().user.favoritesFolders?.[0]).toEqual({ id, title: 'New local folder', description: 'Local description', isPublic: false, videoIds: [] });
  });
});
