import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMapStore, selectIsLoaded, selectLoadError, selectGoogle } from '../state';
import { GOOGLE_MAP_VECTOR_MAP_ID, OFFLINE_GOOGLE_MAP_VECTOR_MAP_ID } from '../constants';
import { hasGoogleMapsApiKey } from '../utils/googleMapsConfig';
import { useMapLongPress } from '../hooks/useMapLongPress';
import { mapClickClientPoint } from '../utils/mapLongPress';

interface GoogleMapProps {
  center: { lat: number; lng: number };
  zoom: number;
  className?: string;
  onMapLoad?: (map: google.maps.Map) => void;
  onClick?: (e: google.maps.MapMouseEvent) => void;
  onLongPress?: (e: google.maps.MapMouseEvent) => void;
  onIdle?: (map: google.maps.Map) => void;
  options?: google.maps.MapOptions;
}

// The Maps SDK has no public Map.dispose() API. Keep one map canvas for this
// single-instance app instead of constructing a new vector map on every launch.
let reusableMap: { instance: google.maps.Map; element: HTMLDivElement; mapsApi: typeof google } | null = null;

const GOOGLE_MAP_ERROR_TEXTS = [
  '糟糕！出了点问题。',
  '此页面未能正确加载 Google 地图',
  '您是否拥有此网站',
  "This page can't load Google Maps correctly",
  'Do you own this website',
];
const GOOGLE_MAP_DEV_WATERMARK_TEXT = 'For development purposes only';

function suppressOfflineGoogleErrorOverlay(root: HTMLElement) {
  root.dataset.mapOfflineGoogleOverlaySuppressed = 'true';
  const style = document.createElement('style');
  style.textContent = `
    [data-map-offline-google-overlay-suppressed="true"] .gm-err-container,
    [data-map-offline-google-overlay-suppressed="true"] .gm-err-autocomplete {
      display: none !important;
    }
  `;
  root.appendChild(style);

  const hideElement = (el: HTMLElement) => {
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
  };

  const hideOverlay = () => {
    root
      .querySelectorAll<HTMLElement>('.gm-err-container, .gm-err-autocomplete')
      .forEach(hideElement);

    const rootRect = root.getBoundingClientRect();

    root.querySelectorAll<HTMLElement>('div, button').forEach((el) => {
      const text = el.textContent || '';
      if (GOOGLE_MAP_ERROR_TEXTS.some((item) => text.includes(item))) {
        hideElement(el);
        return;
      }

      const computed = window.getComputedStyle(el);
      const bg = computed.backgroundColor.replace(/\s+/g, '');
      const zIndex = Number.parseInt(computed.zIndex || '0', 10);
      const rect = el.getBoundingClientRect();
      const coversMap =
        rootRect.width > 0 &&
        rootRect.height > 0 &&
        rect.width >= rootRect.width * 0.8 &&
        rect.height >= rootRect.height * 0.8;
      const isDevDimmer =
        computed.position === 'absolute' &&
        coversMap &&
        Number.isFinite(zIndex) &&
        zIndex >= 10 &&
        bg.startsWith('rgba(0,0,0,') &&
        bg !== 'rgba(0,0,0,0)';
      if (isDevDimmer) {
        hideElement(el);
      }
    });

    root.querySelectorAll<HTMLElement>('span, div').forEach((el) => {
      if ((el.textContent || '').trim() !== GOOGLE_MAP_DEV_WATERMARK_TEXT) return;
      hideElement(el);
    });
  };

  hideOverlay();
  const observer = new MutationObserver(hideOverlay);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  return () => {
    observer.disconnect();
    style.remove();
    delete root.dataset.mapOfflineGoogleOverlaySuppressed;
  };
}

function readCssZoom(el: Element): number {
  const raw = window.getComputedStyle(el).zoom;
  if (!raw || raw === 'normal') return 1;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function getAncestorVisualScale(el: HTMLElement): number {
  let scale = 1;
  for (let cur = el.parentElement; cur && cur !== document.body; cur = cur.parentElement) {
    scale *= readCssZoom(cur);
  }

  const simScaleRaw = document.documentElement.style.getPropertyValue('--sim-scale');
  const simScale = Number.parseFloat(simScaleRaw || '1');
  if (Number.isFinite(simScale) && simScale > 0) {
    scale *= simScale;
  }

  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

export const GoogleMap: React.FC<GoogleMapProps> = ({
  center,
  zoom,
  className,
  onMapLoad,
  onClick,
  onLongPress,
  onIdle,
  options,
}) => {
  const isLoaded = useMapStore(selectIsLoaded);
  const loadError = useMapStore(selectLoadError);
  const google = useMapStore(selectGoogle);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const mapListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const onClickRef = useRef(onClick);
  const onLongPressRef = useRef(onLongPress);
  const onIdleRef = useRef(onIdle);
  const longPress = useMapLongPress(mapInstance, google, wrapperRef, onLongPressRef);

  useEffect(() => {
    onClickRef.current = onClick;
    onLongPressRef.current = onLongPress;
    onIdleRef.current = onIdle;
  }, [onClick, onLongPress, onIdle]);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return undefined;
    // Never move a canvas that is still mounted in another activity.
    const mapDiv = reusableMap && reusableMap.mapsApi === google && !reusableMap.element.isConnected
      ? reusableMap.element
      : document.createElement('div');
    mapDiv.style.width = '100%';
    mapDiv.style.height = '100%';
    wrapper.appendChild(mapDiv);
    mapRef.current = mapDiv;
    return () => {
      if (mapRef.current === mapDiv) mapRef.current = null;
      mapDiv.remove();
    };
  }, [isLoaded, loadError, google]);

  const applyMapVisualSize = useCallback(() => {
    const wrapper = wrapperRef.current;
    const mapDiv = mapRef.current;
    if (!wrapper || !mapDiv) return false;

    const layoutWidth = wrapper.clientWidth;
    const layoutHeight = wrapper.clientHeight;
    if (layoutWidth <= 0 || layoutHeight <= 0) return false;

    const scale = getAncestorVisualScale(wrapper);
    mapDiv.style.width = `${Math.max(1, layoutWidth * scale)}px`;
    mapDiv.style.height = `${Math.max(1, layoutHeight * scale)}px`;
    if (scale > 0 && Math.abs(scale - 1) > 0.001) {
      mapDiv.style.setProperty('zoom', String(1 / scale));
    } else {
      mapDiv.style.removeProperty('zoom');
    }

    return true;
  }, []);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return undefined;

    let frame = 0;
    const updateSize = () => {
      frame = 0;
      const changed = applyMapVisualSize();
      if (changed && mapInstance && google) {
        google.maps.event.trigger(mapInstance, 'resize');
      }
    };

    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateSize);
    };

    updateSize();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(scheduleUpdate)
      : null;
    observer?.observe(wrapper);
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [applyMapVisualSize, google, mapInstance]);

  // Initialize Map
  useEffect(() => {
    if (isLoaded && google && mapRef.current && !mapInstance) {
      try {
        applyMapVisualSize();
        const hasRealApiKey = hasGoogleMapsApiKey();
        const mapId = options?.mapId
          ?? (hasRealApiKey ? GOOGLE_MAP_VECTOR_MAP_ID : OFFLINE_GOOGLE_MAP_VECTOR_MAP_ID);
        const mapOptions: google.maps.MapOptions = {
          center,
          zoom,
          disableDefaultUI: true, // Clean mobile look
          clickableIcons: true,
          gestureHandling: 'greedy', // Standard mobile gesture handling
          ...options,
          ...(mapId ? { mapId } : {}),
          renderingType: google.maps.RenderingType.VECTOR,
        };
        const map = reusableMap?.element === mapRef.current && reusableMap.mapsApi === google
          ? reusableMap.instance
          : new google.maps.Map(mapRef.current, mapOptions);
        if (reusableMap?.instance === map) {
          map.setOptions({ center, zoom, ...options });
        } else {
          reusableMap = { instance: map, element: mapRef.current, mapsApi: google };
        }

        setMapInstance(map);
        onMapLoad?.(map);

        // 暴露给 snapshot 脚本 (apps/Map/scripts/snapshot_map_assets.mjs) 驱动 pan/zoom
        // 遍历视口、采集瓦片。仅用于离线快照采集；运行时无副作用。
        if (typeof window !== 'undefined') {
          (window as unknown as { __mapInstance?: google.maps.Map }).__mapInstance = map;
        }

        // Bind events
        mapListenersRef.current.push(map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (longPress.current?.consumeClick(mapClickClientPoint(e.domEvent))) { e.stop(); return; }
          onClickRef.current?.(e);
        }));

        mapListenersRef.current.push(map.addListener('idle', () => {
          onIdleRef.current?.(map);
        }));


      } catch (e) {
        console.error("Error initializing map", e);
      }
    }
  }, [isLoaded, google, mapRef, mapInstance, onMapLoad, options, center, zoom, applyMapVisualSize, longPress]);

  useEffect(() => {
    if (!mapInstance || !google) return undefined;
    return () => {
      mapListenersRef.current.forEach((listener) => listener.remove());
      mapListenersRef.current = [];
      const snapshotWindow = window as unknown as { __mapInstance?: google.maps.Map };
      if (snapshotWindow.__mapInstance === mapInstance) delete snapshotWindow.__mapInstance;
    };
  }, [mapInstance, google]);

  useEffect(() => {
    if (!mapInstance || !google) return;
    applyMapVisualSize();
    google.maps.event.trigger(mapInstance, 'resize');
  }, [mapInstance, google, applyMapVisualSize]);

  useEffect(() => {
    if (!isLoaded || !google || !mapRef.current || hasGoogleMapsApiKey()) return;
    return suppressOfflineGoogleErrorOverlay(mapRef.current);
  }, [isLoaded, google]);

  const prevPropsRef = useRef({ center, zoom });

  // Update View
  useEffect(() => {
    if (mapInstance) {
      const { center: prevCenter, zoom: prevZoom } = prevPropsRef.current;
      
      // Check Zoom
      if (prevZoom !== zoom) {
        mapInstance.setZoom(zoom);
      }
      
      // Check Center (Value comparison to avoid object reference issues)
      if (Math.abs(prevCenter.lat - center.lat) > 0.0000001 || Math.abs(prevCenter.lng - center.lng) > 0.0000001) {
         mapInstance.setCenter(center);
      }
      
      prevPropsRef.current = { center, zoom };
    }
  }, [center, zoom, mapInstance]);

  if (loadError) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-app-text-muted p-4 text-center">
          <div>Map unavailable</div>
          <div className="text-xs mt-1">{loadError.message}</div>
          <div className="text-xs text-gray-400 mt-2">Check VITE_GOOGLE_MAPS_API_KEY configuration</div>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-app-text-muted">Loading Map...</div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={className} style={{ overflow: 'hidden' }} />
  );
};
