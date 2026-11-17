import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadBook } from '../apps/WechatReading/utils/bookLoader';

afterEach(() => vi.unstubAllGlobals());

describe('Wechat Reading book assets', () => {
  it('retries a failed text request instead of caching the failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, text: async () => '第一回　测试章节\n正文一\n第二回　第二章节\n正文二' });
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadBook('红楼梦.txt')).rejects.toThrow('503');
    const parsed = await loadBook('红楼梦.txt');
    expect(parsed?.chapters).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent loads and caches a successful book', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => 'short book text' });
    vi.stubGlobal('fetch', fetchMock);
    const [first, second] = await Promise.all([loadBook('国富论.txt'), loadBook('国富论.txt')]);
    expect(first).toBe(second);
    expect(await loadBook('国富论.txt')).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
