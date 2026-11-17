import React, { createContext, useContext, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// UI-only memory belongs to this Activity; refreshing/restarting starts fresh.
const ScrollMemory = createContext<Map<string, number> | null>(null);

export function StoreScrollMemory({ children }: { children: React.ReactNode }) {
  const positions = useRef(new Map<string, number>());
  return <ScrollMemory.Provider value={positions.current}>{children}</ScrollMemory.Provider>;
}

export function StorePage({ children, scrollName = 'main' }: {
  children: React.ReactNode;
  scrollName?: 'main' | 'catalog';
}) {
  const positions = useContext(ScrollMemory);
  const location = useLocation();
  const ref = useRef<HTMLElement>(null);
  // Keep the persistent detail sidebar stable when selecting a different app.
  const key = scrollName === 'catalog' ? 'catalog' : location.key;
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.scrollTop = positions?.get(key) ?? 0;
    // Do not read during unmount: removing the tab bar can resize/clamp the
    // outgoing list before layout cleanup, overwriting its real prior offset.
  }, [key, positions]);
  return <section ref={ref} className="appstore-page" data-scroll-container={scrollName}
    data-scroll-direction="vertical" onScroll={event => positions?.set(key, event.currentTarget.scrollTop)}>
    {children}
  </section>;
}
