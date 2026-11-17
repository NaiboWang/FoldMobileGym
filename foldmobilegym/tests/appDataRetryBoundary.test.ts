import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from '../os/components/AppErrorBoundary';

describe('app data load recovery', () => {
  it('asks the parent for a fresh lazy component before clearing a data error', () => {
    const onRetry = vi.fn();
    const boundary = new AppErrorBoundary({ appId: 'redbook', children: null, onRetry });
    boundary.state = { hasError: true, error: new Error('HTTP 503 for notes.json') };
    const setState = vi.fn();
    (boundary as unknown as { setState: typeof setState }).setState = setState;

    (boundary as unknown as { handleRetry: () => void }).handleRetry();

    expect(onRetry).toHaveBeenCalledOnce();
    expect(setState).toHaveBeenCalledWith({ hasError: false, error: null });
  });

  it('keeps an app-specific factory for retrying rejected React.lazy loads', () => {
    const source = readFileSync(new URL('../os/data/appRegistry.tsx', import.meta.url), 'utf8');
    expect(source).toContain('AppComponentFactories[appId] = createComponent');
    expect(source).toContain('AppComponentFactories[appId]()');
    expect(source).toContain('onRetry={() => setAttempt(value => value + 1)}');
  });
});
