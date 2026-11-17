import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FSNode } from '@/os/types';
const fs = vi.hoisted(() => ({ getNode: vi.fn(), deleteNode: vi.fn() }));
vi.mock('@/os/FileSystemService', () => fs);
import { deleteNodes } from '@/system/FileManager/utils/deleteNodes';
const target = (id: string) => ({ id, path: `/sdcard/${id}.txt`, name: `${id}.txt`, type: 'file' }) as FSNode;
describe('confirmed virtual file deletion', () => {
  beforeEach(() => {
    vi.resetAllMocks(); fs.getNode.mockImplementation(path => target(path.split('/').pop()!.replace('.txt', '')));
    fs.deleteNode.mockResolvedValue(true);
  });
  it('counts only actual successful top-level deletions', async () => {
    const targets = [target('a'), target('b')];
    expect(await deleteNodes(targets)).toEqual({ deleted: targets, failed: [], changed: [] });
  });
  it('refuses a replacement with a different identity at the same path', async () => {
    fs.getNode.mockReturnValue({ ...target('a'), id: 'replacement' });
    expect(await deleteNodes([target('a')])).toEqual({ deleted: [], failed: [], changed: [target('a')] });
    expect(fs.deleteNode).not.toHaveBeenCalled();
  });
  it('does not claim a missing or moved target was deleted', async () => {
    fs.getNode.mockReturnValue(null);
    expect((await deleteNodes([target('gone')])).changed).toEqual([target('gone')]);
    expect(fs.deleteNode).not.toHaveBeenCalled();
  });
  it('reports false results separately from successful siblings', async () => {
    fs.deleteNode.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await deleteNodes([target('a'), target('b')])).toEqual({ deleted: [target('a')], failed: [target('b')], changed: [] });
  });
  it('reports an exception without skipping later independent items', async () => {
    fs.deleteNode.mockRejectedValueOnce(new Error('controlled IO failure')).mockResolvedValueOnce(true);
    expect(await deleteNodes([target('a'), target('b')])).toEqual({ deleted: [target('b')], failed: [target('a')], changed: [] });
  });
  it('deduplicates the same selected identity', async () => {
    expect((await deleteNodes([target('a'), target('a')])).deleted).toHaveLength(1);
    expect(fs.deleteNode).toHaveBeenCalledTimes(1);
  });
  it('handles an empty confirmation without mutation', async () => {
    expect(await deleteNodes([])).toEqual({ deleted: [], failed: [], changed: [] });
    expect(fs.deleteNode).not.toHaveBeenCalled();
  });
});
