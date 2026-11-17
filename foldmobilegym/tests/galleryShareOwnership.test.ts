import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  captureShareSources, createGalleryShareIntent, resolveGallerySharePaths, sendGalleryShare, shareSourcesCurrent,
} from '../system/Gallery/shareOwnership';
import { beginFileContentWrite, endFileContentWrite, fileContentToken } from '../os/fileContentRevision';
import type { FSNode, MediaItem } from '../os/types';
import type { IntentPayload } from '../os/types/manifest';

function file(path = '/sdcard/DCIM/a.jpg', mimeType = 'image/jpeg'): FSNode {
  return { id: path, name: path.split('/').at(-1)!, path, mimeType, type: 'file', parentId: 'dcim',
    size: 4096, createdAt: 100, modifiedAt: 100, storage: 'indexeddb' };
}
function media(node: FSNode): MediaItem {
  return { id: node.id, path: node.path, name: node.name, type: node.mimeType?.startsWith('video/') ? 'video' : 'image',
    uri: 'blob:displayed-source', mimeType: node.mimeType!, size: node.size, createdAt: node.createdAt };
}
function setup(nodes = [file()]) {
  const files = new Map(nodes.map(node => [node.path, node]));
  const getNode = vi.fn((path: string) => files.get(path) ?? null);
  const startActivity = vi.fn((_intent: IntentPayload, _options: { newTask: boolean }) => true);
  const platform = { getNode, getToken: fileContentToken, startActivity };
  const sources = captureShareSources(nodes.map(media), getNode, fileContentToken);
  const paths = nodes.map(node => node.path);
  return { files, sources, paths, platform, startActivity, getNode,
    send: (owns: () => boolean) => sendGalleryShare(paths, owns, sources, platform) };
}

// Pure protocol + real volatile content-token tests, not a GUI/receiver acceptance test.
describe('Gallery share Activity/source ownership', () => {
  it('deduplicates existing image/video paths in selection order', () => {
    const image = file(), video = file('/sdcard/DCIM/a.mp4', 'video/mp4');
    const h = setup([image, video]);
    expect(resolveGallerySharePaths([image.path, image.path, video.path], () => true, h.getNode)).toEqual(h.paths);
  });
  it('rejects stale background callbacks before reading any file or starting an intent', () => {
    const h = setup(); h.getNode.mockClear();
    expect(h.send(() => false)).toBe('ignored');
    expect(h.getNode).not.toHaveBeenCalled();
    expect(h.startActivity).not.toHaveBeenCalled();
  });
  it('does not alter the source list, source metadata or bytes', () => {
    const node = Object.freeze(file());
    const paths = Object.freeze([node.path, node.path]);
    const before = JSON.stringify(node);
    expect(resolveGallerySharePaths(paths, () => true, () => node)).toEqual([node.path]);
    expect(paths).toEqual([node.path, node.path]);
    expect(JSON.stringify(node)).toBe(before);
  });
  it.each(['', '/missing'])('rejects invalid/missing paths atomically: %s', path => {
    const h = setup();
    expect(createGalleryShareIntent([...h.paths, path], () => true, h.getNode)).toBeNull();
  });
  it('rejects directories and nodes from a different path', () => {
    const folder: FSNode = { ...file('/sdcard/DCIM'), type: 'directory', mimeType: 'inode/directory' };
    expect(resolveGallerySharePaths([folder.path], () => true, () => folder)).toEqual([]);
    expect(createGalleryShareIntent(['/another.jpg'], () => true, () => file())).toBeNull();
  });
  it.each(['application/octet-stream', 'audio/mp4', 'image/*', 'video/*', 'image/', 'image/jpeg;evil'])('requires real media MIME rather than filename extension: %s', mime => {
    const node = file('/sdcard/DCIM/photo.jpg', mime);
    expect(createGalleryShareIntent([node.path], () => true, () => node)).toBeNull();
  });
  it.each(['image/png', 'image/jpeg', 'image/webp', 'video/mp4'])('keeps exact single-file MIME and stream string: %s', mime => {
    const node = file('/sdcard/DCIM/source', mime);
    expect(createGalleryShareIntent([node.path], () => true, () => node)).toEqual({
      action: 'ACTION_SEND', type: mime, data: { stream: node.path, mimeType: mime },
    });
  });
  it('keeps exact MIME for multiple identical formats and a stream array', () => {
    const h = setup([file(), file('/sdcard/DCIM/b.jpg')]);
    expect(h.send(() => true)).toBe('started');
    expect(h.startActivity).toHaveBeenCalledExactlyOnceWith({ action: 'ACTION_SEND', type: 'image/jpeg',
      data: { stream: h.paths, mimeType: 'image/jpeg' } }, { newTask: true });
  });
  it.each([
    ['image/jpeg', 'image/png', 'image/*'],
    ['video/mp4', 'video/webm', 'video/*'],
    ['image/jpeg', 'video/mp4', '*/*'],
    ['video/mp4', 'image/png', '*/*'],
  ])('uses truthful common MIME for %s + %s: %s (mixed media is not rejected)', (a, b, expected) => {
    const h = setup([file('/sdcard/DCIM/a', a), file('/sdcard/DCIM/b', b)]);
    expect(h.send(() => true)).toBe('started');
    expect(h.startActivity).toHaveBeenCalledExactlyOnceWith({ action: 'ACTION_SEND', type: expected,
      data: { stream: h.paths, mimeType: expected } }, { newTask: true });
  });
  it('preserves stream-array order and does not expand duplicate selections', () => {
    const h = setup([file(), file('/sdcard/DCIM/b.png', 'image/png')]);
    const paths = [h.paths[1], h.paths[0], h.paths[1]];
    expect(sendGalleryShare(paths, () => true, h.sources, h.platform)).toBe('started');
    expect(h.startActivity.mock.calls[0][0].data?.stream).toEqual([h.paths[1], h.paths[0]]);
    expect(paths).toEqual([h.paths[1], h.paths[0], h.paths[1]]);
  });
  it('rechecks ownership before returning a prepared intent', () => {
    const node = file(); let reads = 0;
    expect(createGalleryShareIntent([node.path], () => ++reads < 3, () => node)).toBeNull();
  });
  it('fails the entire batch when any selected source is deleted; never shares the remaining subset', () => {
    const h = setup([file(), file('/sdcard/DCIM/b.png', 'image/png')]);
    h.files.delete(h.paths[1]);
    expect(h.send(() => true)).toBe('source-changed');
    expect(h.startActivity).not.toHaveBeenCalled();
  });
  it('rejects a deleted/recreated file even when every metadata field matches', () => {
    const h = setup();
    h.files.set(h.paths[0], { ...h.files.get(h.paths[0])! });
    expect(h.send(() => true)).toBe('source-changed');
    expect(h.startActivity).not.toHaveBeenCalled();
  });
  it.each(['id', 'path', 'name', 'type', 'size', 'mimeType', 'createdAt', 'modifiedAt', 'storage', 'thumbnailUri', 'width', 'height', 'duration'] as const)(
    'rejects in-place selected-source metadata changes: %s', key => {
      const h = setup(); const node = h.files.get(h.paths[0])!;
      Object.assign(node, { [key]: typeof node[key] === 'number' ? Number(node[key]) + 1 : 'changed' });
      expect(h.send(() => true)).toBe('source-changed');
      expect(h.startActivity).not.toHaveBeenCalled();
    },
  );
  it('rejects pending writes and equal-size/equal-time byte replacement using the real FS token helper', () => {
    const h = setup(); const node = h.files.get(h.paths[0])!; const metadata = JSON.stringify(node);
    beginFileContentWrite(node);
    expect(h.send(() => true)).toBe('source-changed');
    endFileContentWrite(node);
    expect(JSON.stringify(node)).toBe(metadata);
    expect(h.send(() => true)).toBe('source-changed');
    expect(h.startActivity).not.toHaveBeenCalled();
  });
  it('does not capture missing, pending or metadata-mismatched sources', () => {
    const node = file(), item = media(node);
    for (const sources of [
      captureShareSources([item], () => null, fileContentToken),
      captureShareSources([{ ...item, id: 'stale-provider-id' }], () => node, fileContentToken),
      captureShareSources([item], () => node, () => null),
    ]) {
      expect(shareSourcesCurrent([node.path], sources, () => node, fileContentToken)).toBe(false);
    }
  });
  it('never recaptures or renews a stale list snapshot when Share is pressed again', () => {
    const h = setup(); const node = h.files.get(h.paths[0])!;
    beginFileContentWrite(node); endFileContentWrite(node);
    expect(h.send(() => true)).toBe('source-changed'); expect(h.send(() => true)).toBe('source-changed');
    const fresh = captureShareSources([media(node)], h.getNode, fileContentToken);
    expect(sendGalleryShare(h.paths, () => true, fresh, h.platform)).toBe('started');
    expect(h.send(() => true)).toBe('source-changed');
    expect(h.startActivity).toHaveBeenCalledTimes(1);
  });
  it('rejects an uncaptured extra path rather than sharing it as a new selection', () => {
    const h = setup(); const extra = file('/sdcard/DCIM/new.jpg'); h.files.set(extra.path, extra);
    expect(sendGalleryShare([...h.paths, extra.path], () => true, h.sources, h.platform)).toBe('source-changed');
    expect(h.startActivity).not.toHaveBeenCalled();
  });
  it('rechecks source versions changed during intent preparation', () => {
    const h = setup(); const node = h.files.get(h.paths[0])!;
    let reads = 0;
    h.platform.getNode = vi.fn(path => {
      if (++reads === 3) { beginFileContentWrite(node); endFileContentWrite(node); }
      return h.files.get(path) ?? null;
    });
    expect(h.send(() => true)).toBe('source-changed');
    expect(h.startActivity).not.toHaveBeenCalled();
  });
  it('rechecks foreground ownership after reading a source', () => {
    const h = setup(); let owned = true;
    h.platform.getNode = vi.fn(path => { owned = false; return h.files.get(path) ?? null; });
    expect(h.send(() => owned)).toBe('ignored');
    expect(h.startActivity).not.toHaveBeenCalled();
  });
  it('keeps an empty selection inert', () => {
    const h = setup();
    expect(sendGalleryShare([], () => true, h.sources, h.platform)).toBe('ignored');
    expect(h.startActivity).not.toHaveBeenCalled();
  });
  it('reports no matching receiver without claiming a send or coercing MIME to images', () => {
    const h = setup([file(), file('/sdcard/DCIM/a.mp4', 'video/mp4')]);
    h.startActivity.mockReturnValue(false);
    expect(h.send(() => true)).toBe('unavailable');
    expect(h.startActivity).toHaveBeenCalledExactlyOnceWith({ action: 'ACTION_SEND', type: '*/*',
      data: { stream: h.paths, mimeType: '*/*' } }, { newTask: true });
  });
  it('reports unavailable when the OS bridge is missing or throws', () => {
    const h = setup();
    expect(sendGalleryShare(h.paths, () => true, h.sources, { ...h.platform, startActivity: undefined })).toBe('unavailable');
    h.startActivity.mockImplementation(() => { throw new Error('receiver unavailable'); });
    expect(h.send(() => true)).toBe('unavailable');
  });
});

// Real MemoryRouter history with a layout lifecycle shim; mocked OS, not GUI acceptance.
const ownerHarness = vi.hoisted(() => ({
  cleanup: [] as Array<() => void>,
  state: {
    activeTaskId: 'gallery-task', isLauncherVisible: false, isRecentsVisible: false,
    tasks: [{ taskId: 'gallery-task', stack: [{ activityId: 'gallery-activity' }] }],
  },
}));
vi.mock('../os/TaskManager', () => ({ default: { getState: () => ownerHarness.state } }));
vi.mock('react', async importOriginal => {
  const react = await importOriginal<typeof import('react')>();
  return { ...react, useLayoutEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (cleanup) ownerHarness.cleanup.push(cleanup);
  } };
});
import { createElement, useContext } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, UNSAFE_NavigationContext, useLocation, type Navigator } from 'react-router-dom';
import { ActivityContext } from '../os/ActivityContext';
import { useGalleryPageOwner } from '../system/Gallery/useGalleryPageOwner';

let owner: (() => boolean) | undefined;
let history: (Navigator & { location: { key: string } }) | undefined;
let renderedKey: string | undefined;
function OwnerProbe() {
  owner = useGalleryPageOwner();
  history = useContext(UNSAFE_NavigationContext).navigator as typeof history;
  renderedKey = useLocation().key;
  return null;
}
function mountOwner(activityId = 'gallery-activity') {
  renderToString(createElement(ActivityContext.Provider, {
    value: { activityId, appId: 'gallery', taskId: 'gallery-task' },
  }, createElement(MemoryRouter, {
    initialEntries: ['/', '/?selection=on', '/photo/selected'], initialIndex: 1,
  }, createElement(OwnerProbe))));
  expect(owner).toBeDefined();
  expect(history).toBeDefined();
}

describe('Gallery page owner with actual MemoryRouter synchronous history', () => {
  beforeEach(() => {
    ownerHarness.cleanup = [];
    ownerHarness.state = {
      activeTaskId: 'gallery-task', isLauncherVisible: false, isRecentsVisible: false,
      tasks: [{ taskId: 'gallery-task', stack: [{ activityId: 'gallery-activity' }] }],
    };
    owner = undefined; history = undefined; renderedKey = undefined;
  });
  afterEach(() => { for (const cleanup of ownerHarness.cleanup) cleanup(); });
  it('accepts only the foreground top Activity and matching route entry', () => {
    mountOwner(); expect(owner!()).toBe(true);
  });
  it.each(['isLauncherVisible', 'isRecentsVisible'] as const)('rejects %s immediately', flag => {
    mountOwner(); ownerHarness.state[flag] = true; expect(owner!()).toBe(false);
  });
  it('rejects another task (such as Clock) while Gallery stays mounted', () => {
    mountOwner();
    ownerHarness.state.tasks.push({ taskId: 'clock-task', stack: [{ activityId: 'clock-activity' }] });
    ownerHarness.state.activeTaskId = 'clock-task';
    expect(owner!()).toBe(false);
  });
  it('rejects another Activity even when it is another Gallery in the same task', () => {
    mountOwner(); ownerHarness.state.tasks[0].stack.push({ activityId: 'gallery-receiver' });
    expect(owner!()).toBe(false);
  });
  it('rejects a missing Activity context rather than borrowing an empty ID', () => {
    ownerHarness.state.tasks[0].stack[0].activityId = '';
    mountOwner(''); expect(owner!()).toBe(false);
  });
  it('rejects a removed or inactive task', () => {
    mountOwner(); ownerHarness.state.tasks = []; expect(owner!()).toBe(false);
  });
  it.each(['push', 'replace'] as const)('rejects immediate %s before useLocation rerenders, including modal opening', method => {
    mountOwner(); const oldKey = renderedKey;
    history![method]('/?selection=on&modal=delete');
    expect(renderedKey).toBe(oldKey);
    expect(history!.location.key).not.toBe(oldKey);
    expect(owner!()).toBe(false);
  });
  it.each([-1, 1])('rejects immediate history.go(%s) before useLocation rerenders', delta => {
    mountOwner(); const oldKey = renderedKey;
    history!.go(delta);
    expect(renderedKey).toBe(oldKey);
    expect(history!.location.key).not.toBe(oldKey);
    expect(owner!()).toBe(false);
  });
  it('does not equate a new history entry with the same URL to the original key', () => {
    mountOwner(); const oldKey = renderedKey;
    history!.push('/?selection=on');
    expect(history!.location.key).not.toBe(oldKey);
    expect(owner!()).toBe(false);
  });
  it('rejects retained callbacks after unmount cleanup', () => {
    mountOwner(); for (const cleanup of ownerHarness.cleanup) cleanup(); ownerHarness.cleanup = [];
    expect(owner!()).toBe(false);
  });
});
