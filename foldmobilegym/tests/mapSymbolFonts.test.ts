import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

const app = path.resolve('apps/Map');
const source = fs.readFileSync(path.join(app, 'sw/map-sw.js'), 'utf8');
const assets = path.join(app, 'assets/offline-fonts');
const manifest = JSON.parse(fs.readFileSync(path.join(assets, 'manifest.json'), 'utf8')) as {
  entries: { url: string; file: string; size: number; sha256: string; contentType: string }[];
};
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const body = (index = 0) => fs.readFileSync(path.join(assets, manifest.entries[index].file));
const response = (index = 0) => new Response(body(index), { headers: { 'Content-Type': 'font/woff2' } });

function worker(href = 'http://localhost/map-sw.js?cdnBase=/cdn') {
  const stores = new Map<string, Map<string, Response>>();
  const events = new Map<string, (event: any) => void>();
  const cache = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      match: vi.fn(async (key: string) => store.get(key)?.clone()),
      put: vi.fn(async (key: string, value: Response) => { store.set(key, value.clone()); }),
      delete: vi.fn(async (key: string) => store.delete(key)),
    };
  };
  const cacheObjects = new Map<string, ReturnType<typeof cache>>();
  const caches = {
    open: vi.fn(async (name: string) => {
      if (!cacheObjects.has(name)) cacheObjects.set(name, cache(name));
      return cacheObjects.get(name)!;
    }),
    keys: vi.fn(async () => [...stores.keys()]),
    delete: vi.fn(async (name: string) => stores.delete(name)),
  };
  const fetch = vi.fn(async (url: string) => {
    const entry = manifest.entries.find(e => new URL(url).pathname.endsWith('/offline-fonts/' + e.file));
    return entry ? new Response(fs.readFileSync(path.join(assets, entry.file)))
      : new Response(JSON.stringify({ entries: [] }), { headers: { 'Content-Type': 'application/json' } });
  });
  const claim = vi.fn(async () => {});
  const context = vm.createContext({
    URL, URLSearchParams, Response, Headers, Uint8Array, crypto: webcrypto,
    caches, fetch, console: { warn: vi.fn() },
    self: { location: new URL(href), addEventListener: (name: string, fn: any) => events.set(name, fn),
      clients: { claim, matchAll: async () => [] }, skipWaiting: async () => {} },
  });
  const api = vm.runInContext(source + `
;({
    matchExactRobotoSymbols, handleRequest, ROBOTO_SYMBOL_FONTS, ROBOTO_SYMBOLS_CACHE_NAME,
    BOOTSTRAP_CACHE_NAME, VECTOR_CACHE_NAME, RASTER_CACHE_NAME
  });`, context);
  events.get('message')!({ data: { type: 'MAP_GOOGLE_NETWORK_MODE', offlineOnly: true } });
  return { api, stores, caches, fetch, events, claim };
}

describe('Map exact Roboto symbols offline delivery', () => {
  it('pins the unmodified source bytes and retains the OFL copyright and license', () => {
    const { api } = worker();
    expect([...api.ROBOTO_SYMBOL_FONTS.values()]).toEqual(manifest.entries);
    expect(manifest.entries).toHaveLength(2);
    for (const [index, entry] of manifest.entries.entries()) {
      expect(entry.url).toBe('https://fonts.gstatic.com/s/roboto/v51/' + entry.file);
      const css = fs.readFileSync(index === 0 ? path.join(app, 'sw/files/87e857d8b02e10a1.css')
        : path.resolve('mobilegym-data/map/vector/files/d9154cd59f8b0884.css'), 'utf8');
      expect(css).toContain(entry.url);
      expect(body(index).subarray(0, 4).toString()).toBe('wOF2');
      expect(body(index).length).toBe(entry.size);
      expect(digest(body(index))).toBe(entry.sha256);
    }
    expect(new Set(manifest.entries.map(e => e.sha256)).size).toBe(2);
    const license = fs.readFileSync(path.join(assets, 'OFL.txt'), 'utf8');
    expect(license).toContain('Copyright 2011 The Roboto Project Authors');
    expect(license).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  it.each([0, 1])('serves exact request %i offline and verifies warm cache bytes again', async index => {
    const { api, fetch } = worker();
    const entry = manifest.entries[index];
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await api.handleRequest(new Request(entry.url));
      expect(result.status).toBe(200);
      expect(result.headers.get('content-type')).toBe('font/woff2');
      expect(result.headers.get('access-control-allow-origin')).toBe('*');
      expect(result.headers.get('x-map-offline-font')).toBe(entry.sha256);
      expect(digest(new Uint8Array(await result.arrayBuffer()))).toBe(entry.sha256);
    }
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('http://localhost/@app-assets/Map/offline-fonts/' + entry.file);
  });

  it.each([0, 1])('evicts a corrupt cached response %i and recovers only from original local bytes', async index => {
    const { api, caches, fetch } = worker();
    const entry = manifest.entries[index];
    const cache = await caches.open(api.ROBOTO_SYMBOLS_CACHE_NAME);
    const corrupt = Buffer.from(body(index)); corrupt[corrupt.length - 1] ^= 1;
    await cache.put(entry.url, new Response(corrupt));
    const result = await api.matchExactRobotoSymbols(entry.url);
    expect(digest(new Uint8Array(await result.arrayBuffer()))).toBe(entry.sha256);
    expect(cache.delete).toHaveBeenCalledWith(entry.url);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(digest(new Uint8Array(await (await cache.match(entry.url))!.arrayBuffer()))).toBe(entry.sha256);
  });

  it.each(['html', 'short', 'wrong-signature', 'wrong-hash', '404', 'network'])('rejects %s local content, without caching or reporting a font success', async kind => {
    const { api, caches, fetch } = worker();
    const bytes = Buffer.from(body());
    if (kind === 'wrong-signature') bytes[0] = 0;
    if (kind === 'wrong-hash') bytes[bytes.length - 1] ^= 1;
    fetch.mockImplementation(async () => {
      if (kind === 'network') throw new Error('local offline');
      return new Response(kind === 'short' ? bytes.subarray(0, 4) : bytes, {
        status: kind === '404' ? 404 : 200,
        headers: { 'Content-Type': kind === 'html' ? 'text/html' : 'font/woff2' },
      });
    });
    expect(await api.matchExactRobotoSymbols(manifest.entries[0].url)).toBeNull();
    const cache = await caches.open(api.ROBOTO_SYMBOLS_CACHE_NAME);
    expect(cache.put).not.toHaveBeenCalled();
  });

  it.each(['open', 'match', 'put'])('keeps verified local delivery when CacheStorage %s fails', async operation => {
    const { api, caches } = worker();
    if (operation === 'open') caches.open.mockRejectedValue(new Error('storage denied'));
    else {
      const cache = await caches.open(api.ROBOTO_SYMBOLS_CACHE_NAME);
      cache[operation as 'match' | 'put'].mockRejectedValue(new Error('storage denied'));
    }
    const result = await api.matchExactRobotoSymbols(manifest.entries[0].url);
    expect(digest(new Uint8Array(await result.arrayBuffer()))).toBe(manifest.entries[0].sha256);
  });

  it('does not alias hosts, queries, unknown fonts or the existing Latin subset', async () => {
    const { api } = worker();
    const original = manifest.entries[0].url;
    for (const url of [original + '?v=1', original.replace('https:', 'http:'),
      original.replace('fonts.gstatic.com', 'other.test'), original.replace('GEe.', 'unknown.')]) {
      expect(await api.matchExactRobotoSymbols(url)).toBeNull();
    }
    const result = await api.handleRequest(new Request(original.replace('GEe.', 'unknown.')));
    expect(result.status).toBe(504);
    expect(result.headers.get('x-map-offline-font')).toBeNull();
  });

  it('preserves a genuine offline miss when the admitted local file is unavailable', async () => {
    const { api, fetch } = worker();
    fetch.mockImplementation(async () => new Response('not found', { status: 404 }));
    const result = await api.handleRequest(new Request(manifest.entries[0].url));
    expect(result.status).toBe(504);
    expect(result.headers.get('x-map-offline-font')).toBeNull();
    expect(fetch.mock.calls.every(([url]) => new URL(url).hostname === 'localhost')).toBe(true);
  });

  it('never serves a stale generic cache response for an admitted exact URL', async () => {
    const { api, caches, fetch } = worker();
    const cache = await caches.open(api.BOOTSTRAP_CACHE_NAME);
    await cache.put(manifest.entries[0].url, new Response('<html>stale</html>'));
    fetch.mockImplementation(async () => new Response('not found', { status: 404 }));
    expect((await api.handleRequest(new Request(manifest.entries[0].url))).status).toBe(504);
  });

  it.each([true, false])('validates the exact live fallback too (valid=%s)', async valid => {
    const { api, events, fetch } = worker();
    events.get('message')!({ data: { type: 'MAP_GOOGLE_NETWORK_MODE', offlineOnly: false } });
    fetch.mockImplementation(async (url: any) => typeof url === 'string'
      ? new Response('not found', { status: 404 })
      : valid ? response() : new Response('<html>invalid</html>'));
    const result = await api.handleRequest(new Request(manifest.entries[0].url));
    expect(result.status).toBe(valid ? 200 : 504);
    expect(result.headers.get('x-map-offline-font')).toBe(valid ? manifest.entries[0].sha256 : null);
  });

  it('uses the actual worker base for subpath deployments', async () => {
    const { api, fetch } = worker('http://localhost/sim/map-sw.js?cdnBase=/cdn');
    expect(await api.matchExactRobotoSymbols(manifest.entries[0].url)).not.toBeNull();
    expect(fetch.mock.calls[0][0]).toContain('http://localhost/sim/@app-assets/Map/offline-fonts/');
  });

  it('activation prunes only superseded owned versions and keeps unrelated/current caches', async () => {
    const { api, caches, stores, events, claim } = worker();
    const current = [api.ROBOTO_SYMBOLS_CACHE_NAME, api.BOOTSTRAP_CACHE_NAME, api.VECTOR_CACHE_NAME, api.RASTER_CACHE_NAME];
    for (const name of [...current, 'another-app-cache', 'map-roboto-symbols-cache-v0', 'map-bootstrap-cache-old']) await caches.open(name);
    let completion: Promise<unknown> = Promise.resolve();
    events.get('activate')!({ waitUntil: (p: Promise<unknown>) => { completion = p; } });
    await completion;
    expect([...stores.keys()].sort()).toEqual([...current, 'another-app-cache'].sort());
    expect(claim).toHaveBeenCalledTimes(1);
  });
});
