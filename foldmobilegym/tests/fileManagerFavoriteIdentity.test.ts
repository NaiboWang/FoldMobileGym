import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FSNode } from '@/os/types';

const mocks = vi.hoisted(() => ({ getNode: vi.fn(), getNodeById: vi.fn(), transfer: vi.fn() }));
vi.mock('@/system/FileManager/utils/fileOperations', () => ({ transferNodesToDirectory: mocks.transfer }));
vi.mock('@/os/FileSystemService', () => ({
  getNode: mocks.getNode,
  getNodeById: mocks.getNodeById,
  getDestructiveOperationCounts: () => ({ moved: 0, deleted: 0 }),
  subscribeDestructiveOperationCounts: () => () => {},
}));
vi.mock('@/os/createAppStore', async () => {
  const { create } = await import('zustand');
  return {
    createAppStoreWithActions: (_id: string, initial: object, actions: Function) => create((set, get) => ({ ...initial, ...actions(set, get) })),
    registerStateAdapter: vi.fn(), invalidateStateCache: vi.fn(),
    memoSelector: (select: Function, derive: Function) => (state: object) => derive(select(state)),
  };
});

import { normalizeFavoriteIds, useFileManagerStore as store } from '@/system/FileManager/state';
const item = { id: 'original', path: '/sdcard/example.txt', name: 'example.txt', type: 'file' } as FSNode;

describe('File Manager favorite source identity', () => {
  beforeEach(() => {
    store.setState({ favoritePaths: [], favoriteIds: {}, privateIds: [] });
    mocks.getNode.mockReset();
  });

  it('stores the currently matching node identity and removes it with the path', () => {
    mocks.getNode.mockReturnValue(item);
    store.getState().addFavorites([item]);
    expect(store.getState()).toMatchObject({ favoritePaths: [item.path], favoriteIds: { [item.path]: item.id } });
    store.getState().removeFavorite(item.path);
    expect(store.getState()).toMatchObject({ favoritePaths: [], favoriteIds: {} });
  });

  it('rejects an obsolete node after the same path is replaced', () => {
    mocks.getNode.mockReturnValue({ ...item, id: 'replacement' });
    store.getState().addFavorites([item]);
    expect(store.getState()).toMatchObject({ favoritePaths: [], favoriteIds: {} });
  });

  it('does not let an obsolete same-path selection overwrite the valid identity', () => {
    mocks.getNode.mockReturnValue(item);
    expect(store.getState().addFavorites([item, { ...item, id: 'obsolete' }])).toBe(false);
    expect(store.getState().favoritePaths).toEqual([]);
  });

  it('does not duplicate a favorite when the same node moves and is favorited again', () => {
    mocks.getNode.mockReturnValue(item);
    store.getState().addFavorites([item]);
    const moved = { ...item, path: '/sdcard/renamed.txt' };
    mocks.getNode.mockReturnValue(moved);
    store.getState().addFavorites([moved]);
    expect(store.getState().favoritePaths).toEqual([item.path]);
    expect(store.getState().favoriteIds).toEqual({ [item.path]: item.id });
  });

  it('retains both favorites when the old path is reused after a move', () => {
    mocks.getNode.mockReturnValue(item);
    store.getState().addFavorites([item]);
    const moved = { ...item, path: '/sdcard/moved.txt' };
    const replacement = { ...item, id: 'replacement' };
    mocks.getNode.mockImplementation(path => path === moved.path ? moved : replacement);
    store.getState().addFavorites([replacement]);
    expect(Object.values(store.getState().favoriteIds)).toEqual(expect.arrayContaining([item.id, replacement.id]));
  });

  it('normalizes missing and malformed persisted identity maps', () => {
    expect(normalizeFavoriteIds(undefined)).toEqual({});
    expect(normalizeFavoriteIds(null)).toEqual({});
    expect(normalizeFavoriteIds(['bad'])).toEqual({});
    expect(normalizeFavoriteIds({ good: 'id', empty: '', invalid: 42 })).toEqual({ good: 'id' });
  });

  it('removes either record independently after the old path is reused', () => {
    mocks.getNode.mockReturnValue(item);
    store.getState().addFavorites([item]);
    const replacement = { ...item, id: 'replacement' };
    mocks.getNode.mockReturnValue(replacement);
    store.getState().addFavorites([replacement]);
    const originalKey = store.getState().favoritePaths.find(path => store.getState().favoriteIds[path] === item.id)!;
    store.getState().removeFavorite(originalKey);
    expect(store.getState().favoriteIds).toEqual({ [item.path]: replacement.id });
    store.getState().removeFavorite(item.path);
    expect(store.getState()).toMatchObject({ favoritePaths: [], favoriteIds: {} });
  });

  it('stores private files by stable identity and removes them independently', () => {
    mocks.getNode.mockReturnValue(item);
    expect(store.getState().setPrivate([item])).toBe(true);
    expect(store.getState().privateIds).toEqual([item.id]);
    store.getState().removePrivate(item.id);
    expect(store.getState().privateIds).toEqual([]);
  });
});
