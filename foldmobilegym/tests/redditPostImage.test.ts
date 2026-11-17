import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaItem } from '../os/types';
const fixture = vi.hoisted(() => ({ node: null as any, getBytes: vi.fn() }));
vi.mock('../os/FileSystemService', () => ({
  initFileSystem: async () => {},
  getNode: (path: string) => fixture.node?.path === path ? fixture.node : null,
  getMediaFiles: () => fixture.node ? [fixture.node] : [],
  readFile: () => fixture.getBytes(),
}));
import { isVirtualPostImage, pickedPostImage, resolveVirtualPostImage, virtualPostImageId } from '../apps/Reddit/utils/postImage';
const item = (patch: Partial<MediaItem> = {}): MediaItem => ({ id: 'source /% 中文', type: 'image', uri: '', path: '/sdcard/DCIM/source.jpg', name: 'source.jpg', mimeType: 'image/jpeg', size: 20, createdAt: 1, ...patch });
beforeEach(() => {
  fixture.node = { id: item().id, path: item().path, type: 'file', mimeType: 'image/jpeg', size: 20, modifiedAt: 1 };
  fixture.getBytes.mockReset().mockImplementation(async () => new Blob(['controlled bytes'], { type: 'image/jpeg' }));
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:decoded');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.stubGlobal('Image', class {
    naturalWidth = 1; naturalHeight = 1; onload: null | (() => void) = null; onerror = null;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    removeAttribute() {}
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('Reddit virtual post-image identity', () => {
  it('stores a stable exact identity, never the empty/session blob URI', async () => {
    const source = await pickedPostImage(item());
    expect(source).toBe('simfs-image:source%20%2F%25%20%E4%B8%AD%E6%96%87');
    expect(virtualPostImageId(source!)).toBe(item().id);
    expect(await resolveVirtualPostImage(source!)).toBe('blob:decoded');
  });
  it('resolves the same identity after a rename, but not a different node at the old path', async () => {
    const source = (await pickedPostImage(item()))!;
    fixture.node = { ...fixture.node, path: '/sdcard/DCIM/renamed.jpg' };
    expect(await resolveVirtualPostImage(source)).toBe('blob:decoded');
    fixture.node = { ...fixture.node, id: 'replacement' };
    expect(await resolveVirtualPostImage(source)).toBeNull();
  });
  it('does not bind an outdated picker identity to another file at that path', async () => {
    fixture.node = { ...fixture.node, id: 'replacement' };
    expect(await pickedPostImage(item())).toBeNull();
  });
  it('rejects video, missing and undecodable bytes instead of fabricating an image', async () => {
    expect(await pickedPostImage(item({ type: 'video' }))).toBeNull();
    fixture.getBytes.mockResolvedValueOnce(null);
    expect(await pickedPostImage(item())).toBeNull();
    vi.stubGlobal('Image', class {
      naturalWidth = 0; naturalHeight = 0; onload: null | (() => void) = null; onerror = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); } removeAttribute() {}
    });
    expect(await pickedPostImage(item())).toBeNull();
  });
  it('rejects a removed or changed source during asynchronous URI resolution', async () => {
    fixture.getBytes.mockImplementationOnce(async () => { fixture.node = null; return new Blob(['old']); });
    expect(await resolveVirtualPostImage('simfs-image:' + encodeURIComponent(item().id))).toBeNull();
  });
  it('snapshots mutable metadata before reading and refuses in-place source changes', async () => {
    fixture.getBytes.mockImplementationOnce(async () => { fixture.node.size++; return new Blob(['changed']); });
    expect(await resolveVirtualPostImage('simfs-image:' + encodeURIComponent(item().id))).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('snapshots metadata across decode and releases the validation blob on rejection', async () => {
    vi.stubGlobal('Image', class {
      naturalWidth = 1; naturalHeight = 1; onload: null | (() => void) = null; onerror = null;
      set src(_value: string) { fixture.node.modifiedAt++; queueMicrotask(() => this.onload?.()); } removeAttribute() {}
    });
    expect(await pickedPostImage(item())).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:decoded');
  });
  it('releases validation blobs after successful decoding too', async () => {
    expect(await pickedPostImage(item())).not.toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:decoded');
  });
  it.each(['', 'https://example.invalid/a.jpg', 'simfs-image:', 'simfs-image:%not-encoded'])('does not parse malformed/unrelated source %s', source => {
    expect(virtualPostImageId(source)).toBeNull();
    expect(isVirtualPostImage(source)).toBe(source.startsWith('simfs-image:'));
  });
});
