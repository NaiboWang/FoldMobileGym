import { describe, expect, it, vi } from 'vitest';
import type { FSNode } from '../os/types';
import { captureFileListObservation, createFileListObserver } from '../system/FileManager/utils/fileListObserver';
const node: FSNode = { id: 'list-file', name: 'a.svg', path: '/sdcard/a.svg', parentId: 'root', type: 'file', size: 10, storage: 'indexeddb', createdAt: 1, modifiedAt: 1, mimeType: 'image/svg+xml' };
describe('FileManager live list observation', () => {
  it('captures immutable comparison evidence for in-place edits and fixed-metadata rewrites', () => {
    const live = { ...node }, token = vi.fn((): number | null => 0), children = vi.fn(() => 0);
    const before = captureFileListObservation([live], token, children);
    live.name = 'b.svg'; expect(captureFileListObservation([live], token, children).key).not.toBe(before.key);
    live.name = node.name; token.mockReturnValue(2); expect(captureFileListObservation([live], token, children).key).not.toBe(before.key);
    token.mockReturnValue(null); expect(captureFileListObservation([live], token, children).key).not.toBe(before.key);
    expect(children).not.toHaveBeenCalled();
  });
  it('includes directory child counts without reading file bytes', () => {
    const dir: FSNode = { ...node, type: 'directory' }, token = vi.fn(() => 0), children = vi.fn(() => 1);
    const before = captureFileListObservation([dir], token, children); children.mockReturnValue(2);
    expect(captureFileListObservation([dir], token, children).key).not.toBe(before.key); expect(token).not.toHaveBeenCalled();
  });
  it('publishes once for unchanged metadata and object identities', () => {
    const read = vi.fn(() => ({ nodes: [node], key: 'a' })), refresh = vi.fn();
    const observer = createFileListObserver({ active: () => true, read, refresh });
    observer.poll(); observer.poll(); observer.poll(); expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('detects source-object replacement even if all visible metadata is identical', () => {
    const read = vi.fn(() => ({ nodes: [node], key: 'a' })), refresh = vi.fn();
    const observer = createFileListObserver({ active: () => true, read, refresh }); observer.poll();
    read.mockReturnValue({ nodes: [{ ...node }], key: 'a' }); observer.poll(); expect(refresh).toHaveBeenCalledTimes(2);
  });
  it('detects addition, removal, ordering and metadata changes', () => {
    const other = { ...node, id: 'other' }, read = vi.fn(() => ({ nodes: [node], key: 'a' })), refresh = vi.fn();
    const observer = createFileListObserver({ active: () => true, read, refresh }); observer.poll();
    for (const state of [{ nodes: [node, other], key: 'a,b' }, { nodes: [other, node], key: 'b,a' }, { nodes: [node], key: 'changed' }, { nodes: [], key: 'empty' }]) { read.mockReturnValue(state); observer.poll(); }
    expect(refresh).toHaveBeenCalledTimes(5);
  });
  it('does not scan or renew interaction snapshots while blocked and reconciles on return', () => {
    let active = true; const read = vi.fn(() => ({ nodes: [node], key: 'a' })), refresh = vi.fn();
    const observer = createFileListObserver({ active: () => active, read, refresh }); observer.poll();
    active = false; read.mockReturnValue({ nodes: [], key: 'deleted' }); observer.poll(); observer.poll();
    expect(read).toHaveBeenCalledTimes(1); expect(refresh).toHaveBeenCalledTimes(1);
    active = true; observer.poll(); expect(refresh).toHaveBeenCalledTimes(2);
  });
  it('cannot refresh after unmount/disposal', () => {
    const read = vi.fn(() => ({ nodes: [node], key: 'a' })), refresh = vi.fn();
    const observer = createFileListObserver({ active: () => true, read, refresh }); observer.dispose(); observer.poll();
    expect(read).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
  });
});
