interface TimeoutClock {
  now: () => number;
  schedule: (callback: () => void, delay: number) => number;
  cancel: (id: number) => void;
}

/** One load attempt owns one visible-time budget, paused while off screen. */
export function createVisibleLoadTimeout(expire: () => void, delay: number, clock: TimeoutClock) {
  let remaining = delay, startedAt: number | null = null, timer: number | undefined;
  let revision = 0, disposed = false, fired = false;
  const pause = () => {
    revision++;
    if (startedAt !== null) remaining = Math.max(0, remaining - Math.max(0, clock.now() - startedAt));
    startedAt = null;
    if (timer !== undefined) clock.cancel(timer);
    timer = undefined;
  };
  const resume = () => {
    if (disposed || fired || timer !== undefined) return;
    startedAt = clock.now();
    const ownRevision = ++revision;
    timer = clock.schedule(() => {
      if (disposed || fired || ownRevision !== revision) return;
      timer = undefined; startedAt = null; remaining = 0; fired = true;
      expire();
    }, remaining);
  };
  return { pause, resume, dispose: () => { pause(); disposed = true; } };
}
