import React, { createContext, useContext, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getPlaybackEntryKey } from '../utils/playerNavigation';
import { rebaseVideoDetailOffset, recoverVideoBodyOffset } from '../utils/detailHeader';
import type { VideoPlayback } from '../utils/videoPlayback';
type ScrollPosition = { top: number; extent: number };
const PlaybackContext = createContext<{
  sessions: Map<string, VideoPlayback>; positions: Map<string, ScrollPosition>;
} | null>(null);
/** One registry per mounted Activity; never global or persisted as business state. */
export const VideoPlaybackProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const memory = useRef({ sessions: new Map<string, VideoPlayback>(), positions: new Map<string, ScrollPosition>() });
  return <PlaybackContext.Provider value={memory.current}>{children}</PlaybackContext.Provider>;
};
export function usePlaybackRegistry() {
  const registry = useContext(PlaybackContext);
  if (!registry) throw new Error('Video playback requires its Activity provider');
  return registry.sessions;
}

/** Real scroll owner with Activity/entry/tab memory and coordinated header consumption.
 * Compensating padding grows with the released viewport: scroll range stays stable,
 * avoiding resize/scroll feedback and double movement while the header collapses.
 */
export const VideoDetailScroll: React.FC<React.PropsWithChildren<{
  className: string; ready: boolean; suspended?: boolean; collapseMax: number; collapseOffset: number;
  onScrollTop: (top: number) => void;
}>> = ({ children, className, ready, suspended = false, collapseMax, collapseOffset, onScrollTop }) => {
  const memory = useContext(PlaybackContext), location = useLocation();
  const key = JSON.stringify([getPlaybackEntryKey(location), new URLSearchParams(location.search).get('tab') || 'intro']);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (suspended) return;
    const element = ref.current;
    if (!element || !ready || !element.getClientRects().length || getComputedStyle(element).visibility === 'hidden') { if (!ready) onScrollTop(0); return; }
    const saved = memory?.positions.get(key);
    element.scrollTop = saved ? rebaseVideoDetailOffset(saved.top, saved.extent, collapseMax) : 0;
    memory?.positions.set(key, { top: element.scrollTop, extent: collapseMax });
    onScrollTop(element.scrollTop);
  }, [key, memory, ready, suspended, collapseMax, onScrollTop]);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !ready || suspended || collapseMax <= 0) return;
    const recoverViewport = () => {
      // A visible short Activity can have no body viewport until its existing
      // collapsible header is consumed. Hidden apps must not invent scroll.
      const next = recoverVideoBodyOffset(element.scrollTop, element.clientHeight, collapseMax,
        element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
      if (next === null) return;
      element.scrollTop = next;
      memory?.positions.set(key, { top: element.scrollTop, extent: collapseMax });
      onScrollTop(element.scrollTop);
    };
    recoverViewport();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(recoverViewport);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [key, memory, ready, suspended, collapseMax, onScrollTop]);
  return <div ref={ref} className={className} style={{ paddingTop: collapseOffset, overflowAnchor: 'none' }}
    data-scroll-container="main" data-scroll-direction="vertical"
    onScroll={event => {
      if (suspended || !ready || !event.currentTarget.getClientRects().length || getComputedStyle(event.currentTarget).visibility === 'hidden') return;
      const top = event.currentTarget.scrollTop;
      memory?.positions.set(key, { top, extent: collapseMax });
      onScrollTop(top);
    }}>{children}</div>;
};
