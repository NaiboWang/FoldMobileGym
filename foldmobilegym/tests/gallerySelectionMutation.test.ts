import { describe, expect, it, vi } from 'vitest';
import type { FSNode, MediaItem } from '../os/types';
import { beginFileContentWrite, endFileContentWrite, fileContentToken } from '../os/fileContentRevision';
import { captureShareSources } from '../system/Gallery/shareOwnership';
import { galleryMutationReadiness, mutateGallerySelection } from '../system/Gallery/selectionMutation';

function file(path: string): FSNode {
  return { id: path, name: path.split('/').at(-1)!, path, mimeType: 'image/jpeg', type: 'file', parentId: 'dcim',
    size: 100, createdAt: 1, modifiedAt: 1, storage: 'indexeddb' };
}
function media(node: FSNode): MediaItem {
  return { id: node.id, path: node.path, name: node.name, type: 'image', uri: `blob:${node.path}`,
    mimeType: node.mimeType!, size: node.size, createdAt: node.createdAt };
}
function setup() {
  const nodes = [file('/sdcard/DCIM/a.jpg'), file('/sdcard/DCIM/b.jpg')];
  const files = new Map(nodes.map(node => [node.path, node]));
  const getNode = (path: string) => files.get(path) ?? null;
  const sources = captureShareSources(nodes.map(media), getNode, fileContentToken);
  return { nodes, files, sources, getNode, access: { getNode, getToken: fileContentToken } };
}

describe('Gallery selection mutations', () => {
  it('rejects a stale foreground selection before the first write', async () => {
    const h = setup(); const mutate = vi.fn(() => true);
    const result = await mutateGallerySelection(h.nodes.map(n => n.path), () => false, h.sources, { busy: false }, { ...h.access, mutate });
    expect(result).toEqual({ status: 'ignored', completed: [] });
    expect(mutate).not.toHaveBeenCalled();
  });

  it('rejects a deleted/recreated selection before any mutation', async () => {
    const h = setup(); const mutate = vi.fn(() => true);
    h.files.set(h.nodes[0].path, { ...h.nodes[0] });
    expect(galleryMutationReadiness(h.nodes.map(n => n.path), () => true, h.sources, h.access)).toBe('source-changed');
    const result = await mutateGallerySelection(h.nodes.map(n => n.path), () => true, h.sources, { busy: false }, { ...h.access, mutate });
    expect(result.status).toBe('source-changed');
    expect(mutate).not.toHaveBeenCalled();
  });

  it('rejects a pending or replaced content version before writing', async () => {
    const h = setup(); const mutate = vi.fn(() => true); const node = h.nodes[0];
    beginFileContentWrite(node);
    expect(await mutateGallerySelection([node.path], () => true, h.sources, { busy: false }, { ...h.access, mutate })).toMatchObject({ status: 'source-changed' });
    endFileContentWrite(node);
    expect(mutate).not.toHaveBeenCalled();
  });

  it('mutates each current item once and deduplicates paths', async () => {
    const h = setup(); const mutate = vi.fn(async () => true);
    const result = await mutateGallerySelection([h.nodes[0].path, h.nodes[0].path, h.nodes[1].path], () => true, h.sources, { busy: false }, { ...h.access, mutate });
    expect(result).toEqual({ status: 'completed', completed: h.nodes.map(n => n.path) });
    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it('reports only completed items when ownership is lost between items', async () => {
    const h = setup(); let owned = true; const mutate = vi.fn(async (path: string) => { if (path === h.nodes[0].path) owned = false; return true; });
    const result = await mutateGallerySelection(h.nodes.map(n => n.path), () => owned, h.sources, { busy: false }, { ...h.access, mutate });
    expect(result.status).toBe('interrupted');
    expect(result.completed).toEqual([h.nodes[0].path]);
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('prevents re-entrant writes while a submit is in flight', async () => {
    const h = setup(); let release!: () => void; const pending = new Promise<boolean>(resolve => { release = () => resolve(true); });
    const mutate = vi.fn(() => pending); const gate = { busy: false };
    const first = mutateGallerySelection([h.nodes[0].path], () => true, h.sources, gate, { ...h.access, mutate });
    const second = await mutateGallerySelection([h.nodes[1].path], () => true, h.sources, gate, { ...h.access, mutate });
    expect(second).toEqual({ status: 'ignored', completed: [] });
    release(); expect(await first).toEqual({ status: 'completed', completed: [h.nodes[0].path] });
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('preflights every item, not just the first valid member', async () => {
    const h = setup(); h.files.delete(h.nodes[1].path); const mutate = vi.fn(() => true);
    expect(await mutateGallerySelection(h.nodes.map(n => n.path), () => true, h.sources, { busy: false }, { ...h.access, mutate }))
      .toEqual({ status: 'source-changed', completed: [] });
    expect(mutate).not.toHaveBeenCalled();
  });

  it.each(['id', 'path', 'name', 'type', 'size', 'mimeType', 'createdAt', 'modifiedAt', 'storage', 'thumbnailUri', 'width', 'height', 'duration'] as const)(
    'rejects selected metadata changes before writing: %s', async key => {
      const h = setup(); const mutate = vi.fn(() => true);
      Object.assign(h.nodes[1], { [key]: typeof h.nodes[1][key] === 'number' ? Number(h.nodes[1][key]) + 1 : 'changed' });
      expect((await mutateGallerySelection(h.nodes.map(n => n.path), () => true, h.sources, { busy: false }, { ...h.access, mutate })).status).toBe('source-changed');
      expect(mutate).not.toHaveBeenCalled();
    },
  );

  it.each(['false', 'throw'] as const)('does not count a %s result as successful or write later items', async failure => {
    const h = setup(); const gate = { busy: false }; const mutate = vi.fn(() => { if (failure === 'throw') throw new Error('storage failed'); return false; });
    expect(await mutateGallerySelection(h.nodes.map(n => n.path), () => true, h.sources, gate, { ...h.access, mutate }))
      .toEqual({ status: 'unavailable', completed: [] });
    expect(mutate).toHaveBeenCalledTimes(1); expect(gate.busy).toBe(false);
  });

  it('reports a real partial completion instead of full success after a later failure', async () => {
    const h = setup(); const mutate = vi.fn((path: string) => path === h.nodes[0].path);
    expect(await mutateGallerySelection(h.nodes.map(n => n.path), () => true, h.sources, { busy: false }, { ...h.access, mutate }))
      .toEqual({ status: 'unavailable', completed: [h.nodes[0].path] });
  });

  it('does not let deleting the first node invalidate the already completed part', async () => {
    const h = setup(); const mutate = vi.fn((path: string) => h.files.delete(path));
    expect(await mutateGallerySelection(h.nodes.map(n => n.path), () => true, h.sources, { busy: false }, { ...h.access, mutate }))
      .toEqual({ status: 'completed', completed: h.nodes.map(n => n.path) });
  });

  it('checks the next source again after awaiting the previous write', async () => {
    const h = setup(); const mutate = vi.fn(async () => { beginFileContentWrite(h.nodes[1]); endFileContentWrite(h.nodes[1]); return true; });
    expect(await mutateGallerySelection(h.nodes.map(n => n.path), () => true, h.sources, { busy: false }, { ...h.access, mutate }))
      .toEqual({ status: 'source-changed', completed: [h.nodes[0].path] });
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('rechecks ownership after source access before the first write', async () => {
    const h = setup(); let owned = true; const mutate = vi.fn(() => true);
    const access = { ...h.access, getNode: (path: string) => { owned = false; return h.getNode(path); }, mutate };
    expect(await mutateGallerySelection(h.nodes.map(n => n.path), () => owned, h.sources, { busy: false }, access))
      .toEqual({ status: 'ignored', completed: [] });
    expect(mutate).not.toHaveBeenCalled();
  });

  it('keeps an empty selection inert', async () => {
    const h = setup(); const mutate = vi.fn(() => true);
    expect(await mutateGallerySelection([], () => true, h.sources, { busy: false }, { ...h.access, mutate }))
      .toEqual({ status: 'ignored', completed: [] });
    expect(mutate).not.toHaveBeenCalled();
  });

  it('never renews an invalidated source snapshot on retry', async () => {
    const h = setup(); const mutate = vi.fn(() => true);
    beginFileContentWrite(h.nodes[0]); endFileContentWrite(h.nodes[0]);
    for (let n = 0; n < 2; n++) expect((await mutateGallerySelection([h.nodes[0].path], () => true, h.sources, { busy: false }, { ...h.access, mutate })).status).toBe('source-changed');
    expect(mutate).not.toHaveBeenCalled();
  });
});
