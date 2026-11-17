import { useEffect, useRef, type RefObject } from 'react';
import * as TimeService from '@/os/TimeService';
import { MapLongPressGesture } from '../utils/mapLongPress';
import { clientPointToLatLng } from '../utils/mapViewport';
import { useMapInteractionOwner } from './useMapInteractionOwner';

/** Observe pointer input without stealing the SDK's own pointer capture/pan. */
export function useMapLongPress(map: google.maps.Map | null, api: typeof google | undefined,
  wrapperRef: RefObject<HTMLDivElement | null>, handlerRef: RefObject<((event: google.maps.MapMouseEvent) => void) | undefined>) {
  const controllerRef = useRef<MapLongPressGesture | null>(null), owner = useMapInteractionOwner(), ownerRef = useRef(owner);
  ownerRef.current = owner;
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!map || !api || !wrapper) return;
    const controller = new MapLongPressGesture(TimeService.realNow); controllerRef.current = controller;
    const down = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const rect = wrapper.getBoundingClientRect(), hit = document.elementFromPoint(event.clientX, event.clientY);
      const eligible = !!handlerRef.current && !!target && wrapper.contains(target) && !!hit && wrapper.contains(hit)
        && wrapper.checkVisibility({ visibilityProperty: true }) && rect.width > 0 && rect.height > 0
        && !target.closest('button,a,input,textarea,select,[role="button"],gmp-advanced-marker');
      const location = eligible ? clientPointToLatLng(map, event.clientX, event.clientY) : null;
      const ownsAtStart = ownerRef.current;
      controller.down(event, location ? () => {
        const current = wrapper.getBoundingClientRect();
        if (!ownsAtStart() || !wrapper.isConnected || !wrapper.checkVisibility({ visibilityProperty: true }) || !handlerRef.current
          || Math.abs(current.width - rect.width) > .5 || Math.abs(current.height - rect.height) > .5
          || Math.abs(current.left - rect.left) > .5 || Math.abs(current.top - rect.top) > .5) return false;
        let stopped = false;
        handlerRef.current({ latLng: new api.maps.LatLng(location.lat, location.lng), domEvent: event, stop: () => { stopped = true; } });
        return !stopped && ownsAtStart();
      } : null);
    };
    const move = (event: PointerEvent) => controller.move(event), up = (event: PointerEvent) => controller.up(event);
    const cancel = (event: PointerEvent) => controller.cancel(event.pointerId), reset = () => controller.reset();
    const interrupt = () => controller.cancelPending();
    const hidden = () => { if (document.hidden) reset(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') interrupt(); };
    window.addEventListener('pointerdown', down, { capture: true, passive: true });
    window.addEventListener('pointermove', move, { capture: true, passive: true });
    window.addEventListener('pointerup', up, { capture: true, passive: true });
    window.addEventListener('pointercancel', cancel, { capture: true, passive: true });
    window.addEventListener('blur', reset); window.addEventListener('resize', interrupt); window.addEventListener('keydown', key, true);
    document.addEventListener('visibilitychange', hidden);
    let observedRect = wrapper.getBoundingClientRect();
    const observer = new ResizeObserver(() => {
      const next = wrapper.getBoundingClientRect();
      if (Math.abs(next.width - observedRect.width) > .5 || Math.abs(next.height - observedRect.height) > .5) interrupt();
      observedRect = next;
    }); observer.observe(wrapper);
    // After touchcancel the SDK can announce dragstart for a stationary new finger.
    // Actual pointer movement and camera changes, not that legacy flag, cancel a hold.
    const listeners = ['center_changed', 'zoom_changed'].map(type => map.addListener(type, interrupt));
    return () => {
      controller.reset(); observer.disconnect(); listeners.forEach(listener => listener.remove());
      window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('blur', reset); window.removeEventListener('resize', interrupt); window.removeEventListener('keydown', key, true);
      document.removeEventListener('visibilitychange', hidden);
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [api, handlerRef, map, wrapperRef]);
  return controllerRef;
}
