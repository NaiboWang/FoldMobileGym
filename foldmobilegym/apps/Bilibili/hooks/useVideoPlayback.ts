import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { realNow } from '../../../os/TimeService';
import { usePlaybackRegistry } from '../context/VideoPlaybackContext';
import { createVideoPlayback } from '../utils/videoPlayback';
import { getPlaybackEntryKey } from '../utils/playerNavigation';
export function useVideoPlayback(videoId: string, duration: number, onNaturalEnd?: () => void) {
  const onNaturalEndRef = useRef(onNaturalEnd);
  onNaturalEndRef.current = onNaturalEnd;
  const registry = usePlaybackRegistry(), location = useLocation();
  const entry = getPlaybackEntryKey(location);
  const session = useMemo(() => {
    const key = JSON.stringify([entry, videoId, duration]);
    let value = registry.get(key);
    if (!value) { value = createVideoPlayback(duration, realNow); registry.set(key, value); }
    return value;
  }, [registry, entry, videoId, duration]);
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  useEffect(() => {
    session.setActive(true);
    const timer = setInterval(() => { if (session.tick()) onNaturalEndRef.current?.(); }, 250);
    return () => { clearInterval(timer); session.setActive(false); };
  }, [session]);
  return { session, ...snapshot };
}
