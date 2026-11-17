import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeService } from '../os/ThemeService';

function response(id: string) {
  return new Response(JSON.stringify({version: 1, themes: [{id, title: id}], fonts: [], aod: []}), {headers: {'content-type': 'application/json'}});
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('theme manifest refresh failure', () => {
  it('still allows cold start when no cached catalog exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await ThemeService.getInstalledThemes(true)).toEqual([]);
    expect(ThemeService.getCatalogStatus()).toBe('unavailable');
  });
  it('retains last usable catalog when a later refresh fails, and can retry', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response('cached')).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response('recovered'));
    vi.stubGlobal('fetch', fetchMock); vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await ThemeService.getInstalledThemes(true))[0].id).toBe('cached');
    expect(ThemeService.getCatalogStatus()).toBe('ready');
    expect((await ThemeService.getInstalledThemes(true))[0].id).toBe('cached');
    expect(ThemeService.getCatalogStatus()).toBe('stale');
    expect((await ThemeService.getInstalledThemes())[0].id).toBe('cached');
    expect((await ThemeService.getInstalledThemes(true))[0].id).toBe('recovered');
    expect(ThemeService.getCatalogStatus()).toBe('ready');
  });
});
