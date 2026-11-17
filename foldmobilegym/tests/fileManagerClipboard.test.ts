import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FSNode } from '@/os/types';
const mocks = vi.hoisted(() => ({ transfer: vi.fn(), copyFile: vi.fn(), moveNode: vi.fn(), createDirectory: vi.fn() }));
vi.mock('@/system/FileManager/utils/fileOperations', () => ({ transferNodesToDirectory: mocks.transfer }));
vi.mock('@/os/FileSystemService', () => ({ ...mocks, getDestructiveOperationCounts: () => ({ moved: 0, deleted: 0 }), subscribeDestructiveOperationCounts: () => () => {} }));
// Exercise the real action creator with a non-persistent Zustand store; browser
// review covers the real persisted store and IndexedDB payloads.
vi.mock('@/os/createAppStore', async () => {
  const { create } = await import('zustand');
  return {
    createAppStoreWithActions: (_id: string, initial: object, actions: Function) => create((set, get) => ({ ...initial, ...actions(set, get) })),
    registerStateAdapter: vi.fn(),
    invalidateStateCache: vi.fn(),
    memoSelector: (select: Function, derive: Function) => (state: object) => derive(select(state)),
  };
});
import { useFileManagerStore as store } from '@/system/FileManager/state';
const item = { id: 'bundle', path: '/sdcard/Source/Bundle', name: 'Bundle', type: 'directory' } as FSNode;
const replacement = { ...item, id: 'other', path: '/sdcard/Other' };
describe('File Manager clipboard paste', () => {
  beforeEach(() => { vi.resetAllMocks(); store.getState().clearClipboard(); mocks.transfer.mockResolvedValue(true); });
  it('uses recursive guarded transfer, retaining the copy clipboard after success', async () => {
    store.getState().copy([item]);
    expect(await store.getState().paste('/sdcard/Target')).toBe(true);
    expect(mocks.transfer).toHaveBeenCalledWith([item], '/sdcard/Target', 'copy');
    expect(store.getState().clipboardOperation).toBe('copy');
    expect(store.getState().clipboardItems).toEqual([item]);
  });
  it.each(['copy', 'cut'] as const)('keeps %s clipboard when transfer fails', async operation => {
    mocks.transfer.mockResolvedValue(false);
    store.getState()[operation]([item]);
    expect(await store.getState().paste('/sdcard/Target')).toBe(false);
    expect(store.getState().clipboardItems).toEqual([item]);
    expect(store.getState().clipboardOperation).toBe(operation);
  });
  it('clears cut clipboard only after successful transfer', async () => {
    store.getState().cut([item]);
    expect(await store.getState().paste('/sdcard/Target')).toBe(true);
    expect(mocks.transfer).toHaveBeenCalledWith([item], '/sdcard/Target', 'move');
    expect(store.getState().clipboardItems).toEqual([]);
    expect(store.getState().clipboardOperation).toBeNull();
  });
  it('does not clear a replacement clipboard when an earlier cut finishes', async () => {
    let finish!: (value: boolean) => void;
    mocks.transfer.mockImplementation(() => new Promise<boolean>(resolve => { finish = resolve; }));
    store.getState().cut([item]);
    const pending = store.getState().paste('/sdcard/Target');
    store.getState().copy([replacement]);
    finish(true);
    expect(await pending).toBe(true);
    expect(store.getState().clipboardItems).toEqual([replacement]);
    expect(store.getState().clipboardOperation).toBe('copy');
  });
  it('snapshots caller-owned arrays and nodes', () => {
    const source = { ...item }, selected = [source];
    store.getState().cut(selected);
    source.path = '/sdcard/mutated'; selected.length = 0;
    expect(store.getState().clipboardItems).toEqual([item]);
  });
  it('returns false without dispatching an empty clipboard', async () => {
    expect(await store.getState().paste('/sdcard/Target')).toBe(false);
    expect(mocks.transfer).not.toHaveBeenCalled();
  });
});
