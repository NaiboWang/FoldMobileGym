import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../apps/Reddit/data/index', () => ({ processPosts: (posts: unknown[]) => posts }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('Reddit lazy corpus retry', () => {
  it('shares loading, announces errors and really retries after a failed fetch', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ok: true, json: async () => ({ posts: [] }) });
    vi.stubGlobal('fetch', fetcher);
    const loader = await import('../apps/Reddit/data/loader');
    const states: string[] = [];
    const unsubscribe = loader.subscribePosts(() => states.push(loader.getPostsLoadState()));
    const first = loader.loadPosts();
    expect(loader.loadPosts()).toBe(first);
    await expect(first).rejects.toThrow('offline');
    expect(loader.getPostsSync()).toBeNull();
    expect(loader.getPostsLoadState()).toBe('error');
    await expect(loader.loadPosts()).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(states).toEqual(['loading', 'error', 'loading', 'ready']);
    const result = loader.getPostsSync();
    expect(await loader.loadPosts()).toBe(result);
    expect(fetcher).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
  it('rejects HTTP errors rather than treating an error document as the corpus', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const loader = await import('../apps/Reddit/data/loader');
    await expect(loader.loadPosts()).rejects.toThrow('HTTP 503');
    expect(loader.getPostsLoadState()).toBe('error');
  });
});
