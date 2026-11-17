import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  effect: undefined as undefined | (() => void | (() => void)),
  setData: vi.fn(),
  getVideosSync: vi.fn(),
  loadVideos: vi.fn(),
}));
vi.mock('react', () => ({
  useState: (initial: () => unknown) => [initial(), harness.setData],
  useEffect: (effect: () => void | (() => void)) => { harness.effect = effect; },
}));
vi.mock('../apps/Bilibili/data/loader', () => ({
  getVideosSync: harness.getVideosSync,
  loadVideos: harness.loadVideos,
}));
import { useVideos } from '../apps/Bilibili/hooks/useData';

describe('Bilibili lazy data lifecycle', () => {
  beforeEach(() => {
    harness.effect = undefined;
    harness.setData.mockReset();
    harness.getVideosSync.mockReset();
    harness.loadVideos.mockReset();
  });

  it('adopts data cached between initial render and effect', () => {
    const videos = [{ id: 'video-a' }];
    harness.getVideosSync.mockReturnValueOnce(null).mockReturnValueOnce(videos);
    expect(useVideos()).toEqual([]);
    harness.effect?.();
    expect(harness.setData).toHaveBeenCalledWith(videos);
    expect(harness.loadVideos).not.toHaveBeenCalled();
  });

  it('publishes a completed asynchronous load while mounted', async () => {
    const videos = [{ id: 'video-a' }];
    harness.getVideosSync.mockReturnValue(null);
    harness.loadVideos.mockResolvedValue(videos);
    useVideos();
    harness.effect?.();
    await Promise.resolve();
    expect(harness.setData).toHaveBeenCalledWith(videos);
    expect(harness.loadVideos).toHaveBeenCalledOnce();
  });

  it('does not publish a pending result after unmount', async () => {
    let resolve!: (data: unknown[]) => void;
    harness.getVideosSync.mockReturnValue(null);
    harness.loadVideos.mockReturnValue(new Promise(r => { resolve = r; }));
    useVideos();
    const cleanup = harness.effect?.();
    if (typeof cleanup === 'function') cleanup();
    resolve([{ id: 'video-a' }]);
    await Promise.resolve();
    expect(harness.setData).not.toHaveBeenCalled();
  });
});
