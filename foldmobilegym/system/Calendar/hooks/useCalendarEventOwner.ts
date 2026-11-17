import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useActivityId } from '../../../os/ActivityContext';
import { useCalendarStore } from '../state';
import { isCalendarForeground } from './useCalendarForeground';

/** A live editor owns one source object, Activity and rendered history entry. */
export function useCalendarEventOwner(eventId?: string) {
  const source = useCalendarStore(state => eventId ? state.events.find(event => event.id === eventId) : undefined);
  const sourceRef = useRef(source), activityId = useActivityId(), location = useLocation();
  const liveKey = useRef(location.key), mounted = useRef(true); liveKey.current = location.key;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return { sourceRef, sameSource: !eventId || source === sourceRef.current,
    isCurrent: () => {
      const state = window.__OS__?.getState();
      return mounted.current && liveKey.current === location.key && isCalendarForeground(state, activityId)
        && (!eventId || useCalendarStore.getState().events.find(event => event.id === eventId) === sourceRef.current);
    } };
}
