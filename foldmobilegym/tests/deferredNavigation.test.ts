import { describe, expect, it, vi } from 'vitest';
import { navigateWhenAvailable } from '../os/deferredNavigation';

describe('deferred Activity navigation', () => {
  it('survives bounded waits and invokes the navigator only once', async () => {
    const navigate = vi.fn();
    const wait = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(navigate);
    await expect(navigateWhenAvailable(wait, () => true, '/history', { replace: false })).resolves.toBe(true);
    expect(wait).toHaveBeenCalledTimes(3);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/history', { replace: false });
  });

  it('does not navigate when its Activity is closed or request superseded during a wait', async () => {
    let resolve!: (navigator: ReturnType<typeof vi.fn>) => void;
    const pending = new Promise<ReturnType<typeof vi.fn>>(r => { resolve = r; });
    let current = true;
    const navigate = vi.fn();
    const result = navigateWhenAvailable(() => pending, () => current, '/history');
    current = false;
    resolve(navigate);
    await expect(result).resolves.toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('stops after an unsuccessful wait if the request is no longer current', async () => {
    let current = true;
    const wait = vi.fn(async () => { current = false; return null; });
    await expect(navigateWhenAvailable(wait, () => current, '/history')).resolves.toBe(false);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it('does not start waiting for a stale request', async () => {
    const wait = vi.fn();
    await expect(navigateWhenAvailable(wait, () => false, '/history')).resolves.toBe(false);
    expect(wait).not.toHaveBeenCalled();
  });
});
