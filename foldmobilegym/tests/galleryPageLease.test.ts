import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listeners } = vi.hoisted(() => ({ listeners: new Set<() => void>() }));
vi.mock('../os/TaskManager', () => ({ default: {
  subscribe(listener: () => void) {
    listener();
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
} }));
import { captureGalleryPageLease } from '../system/Gallery/pageLease';

beforeEach(() => { listeners.clear(); });
const notify = () => { for (const listener of listeners) listener(); };

describe('Gallery pending-operation ownership', () => {
  it('does not revive a pending operation after leaving and returning', () => {
    let owner = true;
    const lease = captureGalleryPageLease(() => owner);
    expect(lease.isCurrent()).toBe(true);
    owner = false; notify();
    owner = true; notify();
    expect(lease.isCurrent()).toBe(false);
    lease.release();
  });
  it('does not revoke work for unrelated state updates while the page stays owned', () => {
    const lease = captureGalleryPageLease(() => true);
    notify(); notify();
    expect(lease.isCurrent()).toBe(true);
    lease.release();
  });
  it('rejects acquisition while backgrounded, even after returning', () => {
    let owner = false;
    const lease = captureGalleryPageLease(() => owner);
    owner = true; notify();
    expect(lease.isCurrent()).toBe(false);
    lease.release();
  });
  it('checks current route/unmount ownership even without a task broadcast', () => {
    let owner = true;
    const lease = captureGalleryPageLease(() => owner);
    owner = false;
    expect(lease.isCurrent()).toBe(false);
    lease.release();
  });
  it('unsubscribes idempotently and rejects a completed lease', () => {
    const lease = captureGalleryPageLease(() => true);
    expect(listeners.size).toBe(1);
    lease.release(); lease.release();
    expect(listeners.size).toBe(0);
    expect(lease.isCurrent()).toBe(false);
  });
  it('allows a fresh explicit operation after an earlier operation was revoked', () => {
    let owner = true;
    const previous = captureGalleryPageLease(() => owner);
    owner = false; notify(); owner = true; notify();
    const next = captureGalleryPageLease(() => owner);
    expect(previous.isCurrent()).toBe(false);
    expect(next.isCurrent()).toBe(true);
    previous.release();
    expect(listeners.size).toBe(1);
    next.release();
    expect(listeners.size).toBe(0);
  });
});
