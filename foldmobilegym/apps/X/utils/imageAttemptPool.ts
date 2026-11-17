import { createVisibleLoadTimeout } from './visibleLoadTimeout';
import { isXIntrinsicImageSize, type XIntrinsicImageSize } from './intrinsicImageFootprint';

export type ImagePhase = 'direct' | 'proxy' | 'failed';
export interface ImageAttemptClock {
  now: () => number;
  schedule: (callback: () => void, delay: number) => number;
  cancel: (id: number) => void;
}
export interface ImageAttemptSnapshot { phase: ImagePhase; intrinsicSize?: XIntrinsicImageSize }
export interface ImageAttemptLease {
  setVisible: (visible: boolean) => void;
  loaded: () => void;
  release: () => void;
}
export interface ImageAttempt {
  getSnapshot: () => ImageAttemptSnapshot;
  subscribe: (listener: () => void) => () => void;
  connect: () => ImageAttemptLease;
  fail: (phase: ImagePhase) => void;
  rememberIntrinsic: (size: XIntrinsicImageSize) => void;
}

/** Volatile page-owned attempts survive virtual rows, but never enter business snapshots. */
export function createImageAttemptPool(clock: ImageAttemptClock, options: { budgetMs?: number; maxIdle?: number; failedRetryMs?: number } = {}) {
  const budgetMs = options.budgetMs ?? 5000, maxIdle = options.maxIdle ?? 128, failedRetryMs = options.failedRetryMs ?? 30000;
  type Entry = ImageAttempt & { leases: Map<symbol, { visible: boolean; pending: boolean }>; lastUsed: number; successful: boolean; dispose: () => void };
  const entries = new Map<string, Entry>(); let disposed = false;
  // Idle eviction releases cache ownership, not a controller React may reconnect
  // during effect replay. Zero leases already pause/cancel its clock.
  const prune = () => {
    const idle = [...entries.entries()].filter(([, entry]) => !entry.leases.size).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (const [source, entry] of idle.slice(0, Math.max(0, idle.length - maxIdle))) { entries.delete(source); }
  };
  const createEntry = (source: string): Entry => {
    let snapshot: ImageAttemptSnapshot = { phase: 'direct' }, dead = false;
    const listeners = new Set<() => void>(), leases = new Map<symbol, { visible: boolean; pending: boolean }>();
    let timer: ReturnType<typeof createVisibleLoadTimeout> | undefined;
    const synchronize = () => {
      if (dead || snapshot.phase === 'failed') return;
      if ([...leases.values()].some(lease => lease.visible && lease.pending)) timer?.resume();
      else timer?.pause();
    };
    const fail = (phase: ImagePhase) => {
      if (dead || disposed || snapshot.phase !== phase || phase === 'failed') return;
      timer?.dispose();
      snapshot = { ...snapshot, phase: phase === 'direct' && /^https?:\/\//i.test(source) ? 'proxy' : 'failed' };
      entry.successful = false;
      makeTimer(); synchronize(); listeners.forEach(listener => listener());
    };
    const makeTimer = () => {
      const phase = snapshot.phase;
      timer = phase === 'failed' ? undefined : createVisibleLoadTimeout(() => fail(phase), budgetMs, clock);
    };
    const entry: Entry = {
      leases, lastUsed: clock.now(), successful: false,
      getSnapshot: () => snapshot,
      subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
      fail,
      rememberIntrinsic: size => {
        if (dead || disposed || !isXIntrinsicImageSize(size)
          || (snapshot.intrinsicSize?.width === size.width && snapshot.intrinsicSize?.height === size.height)) return;
        snapshot = { ...snapshot, intrinsicSize: { width: size.width, height: size.height } };
        listeners.forEach(listener => listener()); // Presentation metadata must not restart/pause any attempt clock.
      },
      connect: () => {
        const token = Symbol(), lease = { visible: false, pending: true }; let released = false;
        if (!dead && !disposed) {
          leases.set(token, lease);
          if (!entries.has(source)) entries.set(source, entry);
        }
        entry.lastUsed = clock.now();
        return {
          setVisible: visible => { if (released || dead || disposed) return; lease.visible = visible; synchronize(); },
          loaded: () => {
            if (released || dead || disposed) return;
            lease.pending = false; entry.successful = ![...leases.values()].some(item => item.pending); synchronize();
          },
          release: () => {
            if (released) return; released = true; leases.delete(token); entry.lastUsed = clock.now(); synchronize();
            // Successful bytes already have the browser cache; a later mount gets a real fresh budget.
            if (!leases.size && entry.successful && entries.get(source) === entry) entries.delete(source);
            prune();
          },
        };
      },
      dispose: () => { if (dead) return; dead = true; timer?.dispose(); listeners.clear(); leases.clear(); },
    };
    makeTimer(); return entry;
  };
  return {
    get: (source: string): ImageAttempt => {
      let entry = entries.get(source);
      if (entry && !entry.leases.size && entry.getSnapshot().phase === 'failed' && clock.now() - entry.lastUsed >= failedRetryMs) {
        entry.dispose(); entries.delete(source); entry = undefined;
      }
      if (!entry) { entry = createEntry(source); if (disposed) entry.dispose(); else entries.set(source, entry); }
      entry.lastUsed = clock.now(); return entry;
    },
    dispose: () => { disposed = true; entries.forEach(entry => entry.dispose()); entries.clear(); },
  };
}
export type ImageAttemptPool = ReturnType<typeof createImageAttemptPool>;
