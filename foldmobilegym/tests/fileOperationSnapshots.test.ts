import { describe, expect, it, vi } from 'vitest';
import * as fs from '@/os/FileSystemService';
import { getAllStoreStates } from '@/os/createAppStore';
import { useFileManagerStore } from '@/system/FileManager/state';

describe('filesystem-derived evaluation snapshots', () => {
  it('refreshes delete counters without changing the app store reference', async () => {
    const node = await fs.writeFile('/sdcard/snapshot-delete-test.txt', 'fixture');
    const raw = useFileManagerStore.getState();
    const before = getAllStoreStates().file_manager;
    expect(await fs.deleteNode(node.path)).toBe(true);
    const after = getAllStoreStates().file_manager;
    expect(useFileManagerStore.getState()).toBe(raw);
    expect(after.deleted_count).toBe(before.deleted_count + 1);
    expect(getAllStoreStates().file_manager).toBe(after);
  });
  it('refreshes file and recursive directory move counters', async () => {
    const base = '/sdcard/snapshot-move-test';
    const node = await fs.writeFile(`${base}/a.txt`, 'fixture');
    const before = getAllStoreStates().file_manager;
    await fs.moveNode(node.path, `${base}/b.txt`);
    expect(getAllStoreStates().file_manager.moved_count).toBe(before.moved_count + 1);
    await fs.moveNode(base, `${base}-moved`);
    expect(getAllStoreStates().file_manager.moved_count).toBe(before.moved_count + 2);
  });
  it('supports unsubscribe and isolates an observer error from successful IO', async () => {
    const stopped = vi.fn(), continuing = vi.fn();
    const offStopped = fs.subscribeDestructiveOperationCounts(stopped);
    const offThrow = fs.subscribeDestructiveOperationCounts(() => { throw new Error('observer failure'); });
    const offContinuing = fs.subscribeDestructiveOperationCounts(continuing);
    offStopped();
    try {
      const node = await fs.writeFile('/sdcard/snapshot-observer-test.txt', 'fixture');
      expect(await fs.deleteNode(node.path)).toBe(true);
      expect(stopped).not.toHaveBeenCalled();
      expect(continuing).toHaveBeenCalledTimes(1);
    } finally { offThrow(); offContinuing(); }
  });
});
