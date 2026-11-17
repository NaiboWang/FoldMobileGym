import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeService } from '../os/ThemeService';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
function response(id: string) {
  return new Response(JSON.stringify({version: 1, themes: [{id, title: id}], fonts: [], aod: []}), {headers: {'content-type': 'application/json'}});
}
afterEach(() => vi.unstubAllGlobals());
describe('theme manifest concurrent reloads', () => {
  it('keeps the newest reload cached when an older response arrives later', async () => {
    const old = deferred<Response>(); const fresh = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise));
    const first = ThemeService.getInstalledThemes(true);
    const second = ThemeService.getInstalledThemes(true);
    fresh.resolve(response('new')); expect((await second)[0].id).toBe('new');
    old.resolve(response('old')); expect((await first)[0].id).toBe('old');
    expect((await ThemeService.getInstalledThemes())[0].id).toBe('new');
    expect(ThemeService.getCatalogStatus()).toBe('ready');
  });
  it('continues sharing the newest pending reload after an older one finishes', async () => {
    const old = deferred<Response>(); const fresh = deferred<Response>();
    const fetchMock = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    vi.stubGlobal('fetch', fetchMock);
    const first = ThemeService.getInstalledThemes(true);
    const second = ThemeService.getInstalledThemes(true);
    old.resolve(response('old')); await first;
    const shared = ThemeService.getInstalledThemes();
    fresh.resolve(response('new')); await second;
    expect((await shared)[0].id).toBe('new');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('does not let an older failure replace a newer successful status', async () => {
    let reject!: (reason: Error) => void;
    const old = new Promise<Response>((_, r) => { reject = r; });
    const fresh = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(old).mockReturnValueOnce(fresh.promise));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const first = ThemeService.getInstalledThemes(true);
      const second = ThemeService.getInstalledThemes(true);
      fresh.resolve(response('new')); await second;
      reject(new Error('offline')); await first;
      expect(ThemeService.getCatalogStatus()).toBe('ready');
      expect((await ThemeService.getInstalledThemes())[0].id).toBe('new');
    } finally { warning.mockRestore(); }
  });

});
