import React, { createContext, useContext, useMemo, useState } from 'react';
import { realNow } from '@/os/TimeService';
import { createImageAttemptPool, type ImageAttemptPool } from '../utils/imageAttemptPool';

const ImageAttempts = createContext<{ pool: ImageAttemptPool; active: boolean } | null>(null);
export const makeImageAttemptPool = () => createImageAttemptPool({
  now: realNow, schedule: (callback, delay) => window.setTimeout(callback, delay), cancel: id => window.clearTimeout(id),
});

/** A real page owns loading budgets independently of virtual rows or overlay query state. */
export function XImageAttemptProvider({ children, active = true }: React.PropsWithChildren<{ active?: boolean }>) {
  const [pool] = useState(makeImageAttemptPool);
  // Each mounted image owns a lease; its cleanup pauses timers. No effect-dispose
  // here: StrictMode replays effects while retaining this same page-owned pool.
  const value = useMemo(() => ({ pool, active }), [pool, active]);
  return <ImageAttempts.Provider value={value}>{children}</ImageAttempts.Provider>;
}
export const useXImageAttempts = () => useContext(ImageAttempts);
