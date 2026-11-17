import { describe, expect, it, vi } from 'vitest';
import type { FSNode } from '../os/types';
import { captureFileManagerShareSources, createFileManagerImageShareIntent, shareNodesAsImages } from '../system/FileManager/utils/fileOperations';
import { beginFileContentWrite, endFileContentWrite, fileContentToken } from '../os/fileContentRevision';

function file(path: string, mimeType: string, id = path): FSNode {
  return { id, name: path.split('/').at(-1)!, path, mimeType, type: 'file', parentId: 'pictures',
    size: 100, createdAt: 1, modifiedAt: 1, storage: 'indexeddb' };
}

describe('FileManager image share source and MIME contract', () => {
  it('uses the live PNG MIME for a single PNG', () => {
    const png = file('/sdcard/Pictures/a.png', 'image/png');
    expect(createFileManagerImageShareIntent([png], () => png)).toEqual({ action: 'ACTION_SEND', type: 'image/png',
      data: { stream: png.path, mimeType: 'image/png' } });
  });
  it('uses a family wildcard for different image formats without dropping members', () => {
    const jpg = file('/sdcard/Pictures/a.jpg', 'image/jpeg'); const webp = file('/sdcard/Pictures/b.webp', 'image/webp');
    expect(createFileManagerImageShareIntent([jpg, webp], path => path === jpg.path ? jpg : webp)).toEqual({ action: 'ACTION_SEND', type: 'image/*',
      data: { stream: [jpg.path, webp.path], mimeType: 'image/*' } });
  });
  it.each([
    ['missing', (_path: string) => null],
    ['recreated', (_path: string) => file('/sdcard/Pictures/a.png', 'image/png', 'new-id')],
    ['rewritten', (_path: string) => file('/sdcard/Pictures/a.png', 'image/jpeg')],
    ['non-image', (_path: string) => file('/sdcard/Pictures/a.txt', 'text/plain')],
  ])('rejects an all-or-nothing %s source', (_name, getNode) => {
    const selected = file('/sdcard/Pictures/a.png', 'image/png');
    expect(createFileManagerImageShareIntent([selected], getNode)).toBeNull();
  });
  it('rejects the whole selection when only one member is stale', () => {
    const live = file('/sdcard/Pictures/live.jpg', 'image/jpeg'); const stale = file('/sdcard/Pictures/stale.png', 'image/png');
    expect(createFileManagerImageShareIntent([live, stale], path => path === live.path ? live : null)).toBeNull();
  });
  it('keeps the caller selection and live nodes immutable', () => {
    const selected = [file('/sdcard/Pictures/a.jpg', 'image/jpeg')]; const before = JSON.stringify(selected);
    createFileManagerImageShareIntent(selected, () => selected[0]);
    expect(JSON.stringify(selected)).toBe(before);
  });
});

function shareFixture(nodes = [file('/sdcard/Pictures/source.png', 'image/png')]) {
  const files = new Map(nodes.map(node => [node.path, node]));
  const startActivity = vi.fn(() => true), getNode = vi.fn((path: string) => files.get(path) ?? null);
  const sources = captureFileManagerShareSources(nodes, fileContentToken), ids = nodes.map(node => node.id);
  const platform = { getNode, getToken: fileContentToken, startActivity };
  return { nodes, files, sources, ids, platform, startActivity,
    send: (owns = () => true) => shareNodesAsImages(ids, sources, owns, platform) };
}
describe('FileManager actual sharing ownership and displayed versions', () => {
  it('starts the existing newTask image protocol with actual MIME, not a delivery claim', () => {
    const h = shareFixture(); expect(h.send()).toBe('started');
    expect(h.startActivity).toHaveBeenCalledExactlyOnceWith({ action: 'ACTION_SEND', type: 'image/png',
      data: { stream: h.nodes[0].path, mimeType: 'image/png' } }, { newTask: true });
  });
  it('rejects background and empty selection without even reading a file', () => {
    const h = shareFixture(); h.platform.getNode.mockClear();
    expect(h.send(() => false)).toBe('ignored');
    expect(shareNodesAsImages([], h.sources, () => true, h.platform)).toBe('ignored');
    expect(h.platform.getNode).not.toHaveBeenCalled(); expect(h.startActivity).not.toHaveBeenCalled();
  });
  it('requires every selected ID to have a displayed source instead of dropping missing members', () => {
    const h = shareFixture(); expect(shareNodesAsImages([...h.ids, 'uncaptured'], h.sources, () => true, h.platform)).toBe('source-changed');
    expect(h.startActivity).not.toHaveBeenCalled();
  });
  it('rejects mixed image/non-image selections without sending the image subset', () => {
    const h = shareFixture([file('/sdcard/a.png', 'image/png'), file('/sdcard/b.txt', 'text/plain')]);
    expect(h.send()).toBe('unsupported'); expect(h.startActivity).not.toHaveBeenCalled();
  });
  it('deduplicates the same selected identity without mutating input records', () => {
    const h = shareFixture(); const before = JSON.stringify(h.nodes);
    expect(shareNodesAsImages([...h.ids, ...h.ids], h.sources, () => true, h.platform)).toBe('started');
    expect(JSON.stringify(h.nodes)).toBe(before); expect(h.startActivity.mock.calls[0]).toHaveLength(2);
  });
  it('does not accept a same-ID replacement with identical metadata', () => {
    const h = shareFixture(); h.files.set(h.nodes[0].path, { ...h.nodes[0] });
    expect(h.send()).toBe('source-changed'); expect(h.startActivity).not.toHaveBeenCalled();
  });
  it.each(['id', 'path', 'name', 'parentId', 'type', 'size', 'mimeType', 'createdAt', 'modifiedAt', 'storage', 'thumbnailUri', 'width', 'height', 'duration'] as const)(
    'rejects in-place displayed metadata changes: %s', key => {
      const h = shareFixture(), node = h.nodes[0];
      Object.assign(node, { [key]: typeof node[key] === 'number' ? Number(node[key]) + 1 : 'changed' });
      expect(h.send()).toBe('source-changed'); expect(h.startActivity).not.toHaveBeenCalled();
    },
  );
  it('rejects pending and equal-metadata byte replacement using real content revisions', () => {
    const h = shareFixture(), node = h.nodes[0], before = JSON.stringify(node);
    beginFileContentWrite(node); expect(h.send()).toBe('source-changed'); endFileContentWrite(node);
    expect(JSON.stringify(node)).toBe(before); expect(h.send()).toBe('source-changed');
    expect(h.startActivity).not.toHaveBeenCalled();
  });
  it('does not renew invalid source snapshots on a second submit', () => {
    const h = shareFixture(); beginFileContentWrite(h.nodes[0]); endFileContentWrite(h.nodes[0]);
    expect(h.send()).toBe('source-changed'); expect(h.send()).toBe('source-changed');
    const refreshed = captureFileManagerShareSources(h.nodes, fileContentToken);
    expect(shareNodesAsImages(h.ids, refreshed, () => true, h.platform)).toBe('started');
  });
  it('preflights the entire batch when a later image disappears', () => {
    const h = shareFixture([file('/sdcard/a.png', 'image/png'), file('/sdcard/b.jpg', 'image/jpeg')]);
    h.files.delete(h.nodes[1].path); expect(h.send()).toBe('source-changed'); expect(h.startActivity).not.toHaveBeenCalled();
  });
  it('rechecks foreground ownership after FS inspection', () => {
    const h = shareFixture(); let owned = true;
    h.platform.getNode.mockImplementation(path => { owned = false; return h.files.get(path) ?? null; });
    expect(h.send(() => owned)).toBe('ignored'); expect(h.startActivity).not.toHaveBeenCalled();
  });
  it('reports receiver refusal without pretending the image was sent', () => {
    const h = shareFixture(); h.startActivity.mockReturnValue(false);
    expect(h.send()).toBe('unavailable'); expect(h.startActivity).toHaveBeenCalledTimes(1);
  });
  it('reports unavailable when the local bridge is missing or throws', () => {
    const h = shareFixture(); expect(shareNodesAsImages(h.ids, h.sources, () => true, { ...h.platform, startActivity: undefined })).toBe('unavailable');
    h.startActivity.mockImplementation(() => { throw Error('No receiver'); }); expect(h.send()).toBe('unavailable');
  });
});
