import fs from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = fs.readFileSync(new URL('../apps/Map/sw/map-sw.js', import.meta.url), 'utf8');
const entries = (count: number) => Array.from({ length: count }, (_, i) => ({
  url: 'https://maps.googleapis.com/maps/vt/pb=!1m2!1i' + i + '!2sm!3i123?key=offline-demo',
  file: 'tile-' + i + '.pbf',
}));
function worker(data: unknown[]) {
  const events = new Map<string, (event: any) => void>();
  const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ entries: data }) }));
  const schedule = vi.fn(function () { return new MessageChannel(); });
  const context = vm.createContext({ URL, URLSearchParams, fetch, MessageChannel: schedule,
    self: { location: new URL('http://localhost/map-sw.js?cdnBase=/cdn'), addEventListener: (name: string, fn: any) => events.set(name, fn) },
  });
  const api = vm.runInContext(source + ';({loadManifestIndex, loadVectorManifestIndex, canonicalUrl})', context);
  return { api, events, fetch, schedule };
}
const sourceLocation = [{ manifestUrl: 'http://localhost/cdn/map/vector/manifest.json', filesBase: 'http://localhost/cdn/map/vector/files/' }];

describe('Root-scoped Map worker manifest scheduling, not a larger media timeout', () => {
  it('allows an unrelated local-image fetch task before a large index is complete', async () => {
    const { api, events } = worker(entries(1025));
    let complete = false, bypassedBeforeComplete = false;
    const loading = api.loadManifestIndex(sourceLocation).then((index: Map<string, unknown>) => { complete = true; return index; });
    const otherChannel = new MessageChannel();
    const otherTask = new Promise<void>(resolve => {
      otherChannel.port1.onmessage = () => {
        const respondWith = vi.fn();
        events.get('fetch')!({ request: new Request('http://localhost/cdn/spotify/images/probe.jpg'), respondWith });
        bypassedBeforeComplete = !complete && respondWith.mock.calls.length === 0;
        otherChannel.port1.close();
        otherChannel.port2.close();
        resolve();
      };
      otherChannel.port2.postMessage(null);
    });
    const [index] = await Promise.all([loading, otherTask]);
    expect(bypassedBeforeComplete).toBe(true);
    expect(index.size).toBe(1025);
  });
  it('does not add a task delay to the small bootstrap manifest', async () => {
    const { api, schedule } = worker(entries(100));
    const index = await api.loadManifestIndex(sourceLocation);
    expect(index.size).toBe(100); expect(schedule).not.toHaveBeenCalled();
  });
  it('preserves canonical keys, last-source-record precedence and source bytes without mutation', async () => {
    const data = entries(1025); data.push({ ...data[0], file: 'last-record.pbf' });
    const before = JSON.stringify(data), { api } = worker(data);
    const index = await api.loadManifestIndex(sourceLocation);
    expect(index.size).toBe(1025);
    expect(index.get(api.canonicalUrl(data[0].url))).toEqual({ ...data.at(-1), filesBase: sourceLocation[0].filesBase });
    expect(index.get(api.canonicalUrl(data[1024].url))).toEqual({ ...data[1024], filesBase: sourceLocation[0].filesBase });
    expect(JSON.stringify(data)).toBe(before);
  });
  it('keeps concurrent vector lookups on one atomically completed shared promise', async () => {
    const { api, fetch } = worker(entries(1025));
    const first = api.loadVectorManifestIndex(), second = api.loadVectorManifestIndex();
    expect(first).toBe(second);
    const [one, two] = await Promise.all([first, second]);
    expect(one).toBe(two); expect(one.size).toBe(1025); expect(fetch).toHaveBeenCalledTimes(1);
  });
});
