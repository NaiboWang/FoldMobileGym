import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { IcBike, IcBus, IcCar, IcWalk } from '../res/icons';
import { useMapGestures } from './useMapGestures';
import { useMapInteractionOwner } from './useMapInteractionOwner';
import { buildPickedRouteSelection, resolvePickedPoint, validRouteCoordinates } from '../utils/pickedRoutePoint';
import { useMapStore, selectGoogle } from '../state';
import { useLocale } from '../locale';
import {
  formatRouteDistanceMeters,
  getMapStrings,
  parseDistanceTextToMeters,
  toJudgeTravelMode,
} from '../utils/placeUtils';
import {
  cacheRouteByKey,
  getOfflineRoutePayload,
  makePointPairRouteCacheKey,
} from '../utils/offlineRouteStore';
import { hasGoogleMapsApiKey } from '../utils/googleMapsConfig';

export type RoutePoint = {
  lat: number;
  lng: number;
  name: string;
  address?: string;
  isCurrentLocation?: boolean;
};
type TransportModeKey = 'driving' | 'transit' | 'walking' | 'cycling';
type RouteTravelModeValue =
  | google.maps.TravelMode
  | 'DRIVING'
  | 'TRANSIT'
  | 'WALKING'
  | 'BICYCLING';

export function isCurrentLocationRoutePoint(point: RoutePoint | null | undefined): boolean {
  return point?.isCurrentLocation === true;
}

function normalizeTransportMode(mode: unknown): TransportModeKey {
  return mode === 'transit' || mode === 'walking' || mode === 'cycling' || mode === 'driving'
    ? mode
    : 'driving';
}

function resolveTravelMode(
  uiMode: TransportModeKey,
  maps: typeof google.maps | undefined,
): RouteTravelModeValue {
  if (uiMode === 'transit') return maps?.TravelMode?.TRANSIT ?? 'TRANSIT';
  if (uiMode === 'walking') return maps?.TravelMode?.WALKING ?? 'WALKING';
  if (uiMode === 'cycling') return maps?.TravelMode?.BICYCLING ?? 'BICYCLING';
  return maps?.TravelMode?.DRIVING ?? 'DRIVING';
}

function modeStorageKey(mode: RouteTravelModeValue): string {
  return String(mode).toUpperCase();
}

/** JS Routes API 的 `Route.computeRoutes` 在 @types/google.maps 的 RoutesLibrary 中尚未补齐 */
type RouteComputeApi = {
  computeRoutes: (request: {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    travelMode: google.maps.TravelMode;
    computeAlternativeRoutes?: boolean;
    fields?: string[];
  }) => Promise<{
    routes?: Array<{
      path?: google.maps.LatLng[];
      localizedValues?: { duration?: string };
      legs?: Array<{
        durationMillis?: number;
        localizedValues?: { duration?: string };
        distanceMeters?: number;
        steps?: Array<{
          instructions?: string;
          distanceMeters?: number;
          maneuver?: string;
        }>;
        endLocation?: { lat: number; lng: number };
      }>;
      routeLabels?: string[];
    }>;
  }>;
};

async function importRoutesLibrary(
  maps: typeof google.maps,
): Promise<google.maps.RoutesLibrary & { Route: RouteComputeApi }> {
  return (await maps.importLibrary('routes')) as google.maps.RoutesLibrary & { Route: RouteComputeApi };
}

export interface RouteStep {
  instructions: string;
  distanceText: string;
  distanceMeters: number;
  maneuver?: string;
}

export interface RouteInfo {
  duration: string;
  distance: string;
  distanceMeters?: number;
  routeLabels?: string[];
}

export function useRouting(options: {
  mapInstance: google.maps.Map | null;
  currentLocation: { latitude: number; longitude: number };
}) {
  const { mapInstance, currentLocation } = options;
  const { replaceState } = useMapGestures();
  const location = useLocation();
  const google = useMapStore(selectGoogle);
  const hasRealGoogleMapsKey = hasGoogleMapsApiKey();
  const locale = useLocale();
  const s = useMemo(() => getMapStrings(locale), [locale]);
  const setActiveRoute = useMapStore((s) => s.setActiveRoute);
  const setRouteModes = useMapStore((s) => s.setRouteModes);

  const destination = location.state?.destination as RoutePoint | undefined;

  const routePolylineRef = useRef<google.maps.Polyline | null>(null);

  const clearRoutePolyline = useCallback(() => {
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
  }, []);

  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeEndLocation, setRouteEndLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [travelMode, setTravelMode] = useState<google.maps.TravelMode>('DRIVING' as google.maps.TravelMode);
  const [selectedTransportMode, setSelectedTransportMode] = useState<TransportModeKey>(
    normalizeTransportMode((location.state as { mode?: unknown } | null)?.mode),
  );

  const [isNavigating, setIsNavigating] = useState(false);

  const [origin, setOrigin] = useState<RoutePoint | null>(location.state?.origin || null);

  const [selectionMode, setSelectionModeState] = useState<'origin' | 'destination' | null>(null);
  const [isPinPicking, setIsPinPickingState] = useState(false);
  const [isPinConfirming, setIsPinConfirming] = useState(false);
  const pinEpoch = useRef(0);
  const pendingPin = useRef<number | null>(null);
  const ownsPin = useMapInteractionOwner();
  const invalidatePin = useCallback(() => {
    pinEpoch.current += 1;
    pendingPin.current = null;
  }, []);
  const setSelectionMode = useCallback((mode: 'origin' | 'destination' | null) => {
    invalidatePin();
    setIsPinConfirming(false);
    setSelectionModeState(mode);
  }, [invalidatePin]);
  const setIsPinPicking = useCallback((enabled: boolean) => {
    invalidatePin();
    setIsPinConfirming(false);
    setIsPinPickingState(enabled);
  }, [invalidatePin]);
  useEffect(() => () => invalidatePin(), [invalidatePin, mapInstance, origin, destination, locale, selectedTransportMode, location.key]);

  const [anchorSide, setAnchorSide] = useState<'origin' | 'destination'>(
    location.state?.anchorSide || 'origin',
  );

  const [modeDurations, setModeDurations] = useState<Record<string, string>>({});

  useEffect(() => {
    if (currentLocation.latitude && !origin) {
      const defaultOrigin = {
        lat: currentLocation.latitude,
        lng: currentLocation.longitude,
        name: s.your_location,
        isCurrentLocation: true,
      };
      setOrigin(defaultOrigin);
    }
  }, [currentLocation, origin, s]);

  useEffect(() => {
    return () => {
      clearRoutePolyline();
    };
  }, [mapInstance, clearRoutePolyline]);

  useEffect(() => {
    if (!destination) {
      clearRoutePolyline();
    }
  }, [destination, clearRoutePolyline]);

  useEffect(() => {
    let isCancelled = false;
    // Route results belong to this exact endpoint/mode request, not the next
    // render. Never display the previous route while a replacement is loading.
    clearRoutePolyline();
    setRouteInfo(null);
    setRouteSteps([]);
    setCurrentStepIndex(0);
    setRouteEndLocation(null);
    setRouteError(null);

    if (destination && origin) {
      const latDiff = Math.abs(origin.lat - destination.lat);
      const lngDiff = Math.abs(origin.lng - destination.lng);
      if (latDiff < 0.0001 && lngDiff < 0.0001) {
        console.log('Origin and destination too close, skipping route calculation');
        setRouteError(s.route_origin_dest_too_close);
        return;
      }

      const mode = resolveTravelMode(selectedTransportMode, google?.maps);

      const clearAndResetError = (msg: string) => {
        clearRoutePolyline();
        setRouteInfo(null);
        setRouteSteps([]);
        setCurrentStepIndex(0);
        setRouteEndLocation(null);
        setRouteError(msg);
      };

      void (async () => {
        try {
          const offlinePayload = await getOfflineRoutePayload({
            origin: { lat: origin.lat, lng: origin.lng },
            destination: { lat: destination.lat, lng: destination.lng },
            travelMode: mode as google.maps.TravelMode,
            locale,
          });

          if (isCancelled) return;
          if (offlinePayload) {
            console.log(`[Map][离线] 路线: ${mode} -> ${offlinePayload.duration} / ${offlinePayload.distance}`);
            if (isCancelled) return;
            clearRoutePolyline();
            if (offlinePayload.encodedPolyline && google && mapInstance) {
              const geometryLib = (await google.maps.importLibrary(
                'geometry',
              )) as google.maps.GeometryLibrary;
              if (isCancelled) return;
              const path = geometryLib.encoding.decodePath(offlinePayload.encodedPolyline);
              if (path?.length) {
                routePolylineRef.current = new google.maps.Polyline({
                  path,
                  strokeColor: '#6200EE',
                  strokeWeight: 8,
                  map: mapInstance,
                  geodesic: true,
                });
              }
            }

            setRouteInfo({
              duration: offlinePayload.duration,
              distance: offlinePayload.distance,
              distanceMeters: offlinePayload.distance_meters,
              routeLabels: offlinePayload.routeLabels,
            });

            const steps: RouteStep[] = (offlinePayload.steps || []).map((s) => ({
              instructions: s.instruction,
              distanceText: formatRouteDistanceMeters(s.distanceMeters, locale),
              distanceMeters: s.distanceMeters,
              maneuver: s.maneuver,
            }));
            setRouteSteps(steps);
            setCurrentStepIndex(0);
            setRouteEndLocation(offlinePayload.endLocation);
            setRouteError(null);
            return;
          }

          if (!google || !hasRealGoogleMapsKey) {
            const reason = google ? '未配置真实 key' : 'Google SDK 不可用';
            console.log(`[Map][离线未命中] 路线: ${mode} 未命中离线路线，${reason}`);
            clearAndResetError(s.route_not_found_detail);
            return;
          }

          console.log(`[Map][在线] 路线: ${mode} 离线未命中，调用 Google Routes`);
          const { Route } = await importRoutesLibrary(google.maps);
          if (isCancelled) return;
          const { routes } = await Route.computeRoutes({
            origin: { lat: origin.lat, lng: origin.lng },
            destination: { lat: destination.lat, lng: destination.lng },
            travelMode: mode as google.maps.TravelMode,
            computeAlternativeRoutes: true,
            fields: ['path', 'legs', 'distanceMeters', 'localizedValues', 'routeLabels'],
          });

          if (isCancelled) return;

          const route = routes?.[0];
          if (!route || !mapInstance) {
            clearAndResetError(s.route_not_found_detail);
            return;
          }

          clearRoutePolyline();
          const path = route.path;
          if (path && path.length) {
            routePolylineRef.current = new google.maps.Polyline({
              path,
              strokeColor: '#6200EE',
              strokeWeight: 8,
              map: mapInstance,
              geodesic: true,
            });
          }

          const leg = route.legs?.[0];
          if (leg) {
            const durationMs = leg.durationMillis ?? 0;
            const durationText = leg.localizedValues?.duration
              || `${Math.round(durationMs / 60000)} ${s.route_minute_unit}`;
            const distanceText = formatRouteDistanceMeters(leg.distanceMeters, locale);

            setRouteInfo({
              duration: durationText,
              distance: distanceText,
              distanceMeters: leg.distanceMeters,
              routeLabels: route.routeLabels,
            });
            console.log(`[Map][在线] 路线: ${mode} -> ${durationText} / ${distanceText}`);

            const steps: RouteStep[] = (leg.steps || []).map(
              (s: { instructions?: string; distanceMeters?: number; maneuver?: string }) => {
                const dm = s.distanceMeters ?? 0;
                return {
                  instructions: s.instructions || '',
                  distanceText: formatRouteDistanceMeters(dm, locale),
                  distanceMeters: dm,
                  maneuver: s.maneuver || undefined,
                };
              },
            );
            setRouteSteps(steps);
            setCurrentStepIndex(0);

            const endLoc = leg.endLocation;
            setRouteEndLocation(
              endLoc ? { lat: endLoc.lat, lng: endLoc.lng } : null,
            );
            setRouteError(null);

            const ck = makePointPairRouteCacheKey(
              { lat: origin.lat, lng: origin.lng },
              { lat: destination.lat, lng: destination.lng },
              mode,
            );
            const routeModeKey = modeStorageKey(mode);
            if (
              ck &&
              leg.distanceMeters != null &&
              (routeModeKey === 'WALKING' || routeModeKey === 'DRIVING')
            ) {
              cacheRouteByKey(ck, {
                mode: routeModeKey === 'WALKING' ? 'WALKING' : 'DRIVING',
                duration: durationText,
                distance: distanceText,
                distance_meters: leg.distanceMeters,
                duration_seconds: Math.round(durationMs / 1000),
                encodedPolyline: null,
                endLocation: endLoc ? { lat: endLoc.lat, lng: endLoc.lng } : null,
                routeLabels: route.routeLabels,
                steps: (leg.steps || []).map(
                  (s: { instructions?: string; distanceMeters?: number; maneuver?: string }) => {
                    const dm = s.distanceMeters ?? 0;
                    return {
                      instruction: s.instructions || '',
                      distance: formatRouteDistanceMeters(dm, locale),
                      distanceMeters: dm,
                      maneuver: s.maneuver || undefined,
                    };
                  },
                ),
              });
            }
          }
        } catch (e) {
          if (isCancelled) return;
          console.warn('computeRoutes failed:', e);
          clearAndResetError(s.route_failed);
        }
      })();
    }

    return () => {
      isCancelled = true;
    };
  }, [
    destination,
    origin,
    google,
    hasRealGoogleMapsKey,
    selectedTransportMode,
    mapInstance,
    clearRoutePolyline,
    locale,
    s,
  ]);

  const handleSwapRoute = useCallback(() => {
    if (destination && origin) {
      const oldOrigin = origin;
      const oldDest = destination;

      setOrigin({
        lat: oldDest.lat,
        lng: oldDest.lng,
        name: oldDest.name,
        address: oldDest.address,
        isCurrentLocation: oldDest.isCurrentLocation,
      });

      const newAnchorSide = anchorSide === 'origin' ? 'destination' : 'origin';
      setAnchorSide(newAnchorSide);

      replaceState({
        ...location.state,
        anchorSide: newAnchorSide,
        origin: {
          lat: oldDest.lat,
          lng: oldDest.lng,
          name: oldDest.name,
          address: oldDest.address,
          isCurrentLocation: oldDest.isCurrentLocation,
        },
        destination: {
          lat: oldOrigin.lat,
          lng: oldOrigin.lng,
          name: oldOrigin.name,
          address: oldOrigin.address,
          isCurrentLocation: oldOrigin.isCurrentLocation,
        },
      });
    }
  }, [destination, origin, anchorSide, location.state, replaceState]);

  useEffect(() => {
    if (!mapInstance || !google || !routeEndLocation || !destination) return;

    let isActive = true;
    const cleanupFunctions: (() => void)[] = [];

    const renderWalkingPath = async () => {
      let geometry = google.maps.geometry;
      if (!geometry) {
        try {
          geometry = (await google.maps.importLibrary('geometry')) as google.maps.GeometryLibrary;
        } catch (e) {
          console.error('Failed to load geometry library', e);
          return;
        }
      }

      const destLatLng = new google.maps.LatLng(destination.lat, destination.lng);
      const endLatLng = new google.maps.LatLng(routeEndLocation.lat, routeEndLocation.lng);
      const dist = geometry.spherical.computeDistanceBetween(endLatLng, destLatLng);

      if (dist > 20 && isActive) {
        const lineSymbol = {
          path: 'M 0,-1 0,1',
          strokeOpacity: 1,
          scale: 3,
          strokeColor: '#4285F4',
        };

        const walkingPolyline = new google.maps.Polyline({
          path: [endLatLng, destLatLng],
          strokeOpacity: 0,
          icons: [
            {
              icon: lineSymbol,
              offset: '0',
              repeat: '12px',
            },
          ],
          map: mapInstance,
          zIndex: 10,
        });
        cleanupFunctions.push(() => walkingPolyline.setMap(null));
      }
    };

    void renderWalkingPath();

    return () => {
      isActive = false;
      cleanupFunctions.forEach((fn) => fn());
    };
  }, [mapInstance, google, destination, routeEndLocation]);

  useEffect(() => {
    let isCancelled = false;
    setModeDurations({});
    if (!destination || !origin) return;

    const latDiff = Math.abs(origin.lat - destination.lat);
    const lngDiff = Math.abs(origin.lng - destination.lng);
    if (latDiff < 0.0001 && lngDiff < 0.0001) {
      return;
    }

    const modesToFetch: RouteTravelModeValue[] = [
      google?.maps?.TravelMode?.DRIVING ?? 'DRIVING',
      google?.maps?.TravelMode?.TRANSIT ?? 'TRANSIT',
      google?.maps?.TravelMode?.WALKING ?? 'WALKING',
      google?.maps?.TravelMode?.BICYCLING ?? 'BICYCLING',
    ];

    void (async () => {
      const routeApi = google && hasRealGoogleMapsKey
        ? await importRoutesLibrary(google.maps).catch(() => null)
        : null;

      if (isCancelled) return;
      await Promise.all(
        modesToFetch.map(async (mode) => {
          const key = modeStorageKey(mode);
          try {
            const offlineDur = await getOfflineRoutePayload({
              origin: { lat: origin.lat, lng: origin.lng },
              destination: { lat: destination.lat, lng: destination.lng },
              travelMode: mode,
              locale,
            });
            if (isCancelled) return;
            if (offlineDur) {
              console.log(`[Map][离线] 路线时长: ${mode} -> ${offlineDur.duration}`);
              setModeDurations((prev) => ({
                ...prev,
                [key]: offlineDur.duration,
              }));
              return;
            }

            if (!routeApi) {
              const reason = google ? '未配置真实 key' : 'Google Routes 不可用';
              console.log(`[Map][离线未命中] 路线时长: ${mode} 未命中离线时长，${reason}`);
              setModeDurations((prev) => ({
                ...prev,
                [key]: 'N/A',
              }));
              return;
            }

            const { routes } = await routeApi.Route.computeRoutes({
              origin: { lat: origin.lat, lng: origin.lng },
              destination: { lat: destination.lat, lng: destination.lng },
              travelMode: mode as google.maps.TravelMode,
              fields: ['localizedValues'],
            });

            if (isCancelled) return;
            const durationText = routes?.[0]?.localizedValues?.duration;
            console.log(`[Map][在线] 路线时长: ${mode} -> ${durationText || 'N/A'}`);
            setModeDurations((prev) => ({
              ...prev,
              [key]: durationText || 'N/A',
            }));
          } catch {
            if (isCancelled) return;
            setModeDurations((prev) => ({
              ...prev,
              [key]: 'N/A',
            }));
          }
        }),
      );
    })();
    return () => { isCancelled = true; };
  }, [destination, origin, google, hasRealGoogleMapsKey, locale]);

  useEffect(() => {
    if (!destination || !origin) {
      setRouteModes({});
      return;
    }

    const modes: Record<string, Record<string, unknown>> = {};
    for (const [mode, duration] of Object.entries(modeDurations)) {
      modes[mode] = { duration };
    }

    const activeMode = toJudgeTravelMode(selectedTransportMode);
    if (routeInfo) {
      modes[activeMode] = {
        ...(modes[activeMode] || {}),
        duration: routeInfo.duration,
        distance: routeInfo.distance,
        distance_meters: routeInfo.distanceMeters ?? parseDistanceTextToMeters(routeInfo.distance),
      };
    }

    setRouteModes(
      Object.keys(modes).length > 0
        ? {
            origin: {
              lat: origin.lat,
              lng: origin.lng,
              name: origin.name,
            },
            destination: {
              lat: destination.lat,
              lng: destination.lng,
              name: destination.name,
            },
            modes,
          }
        : {},
    );
  }, [destination, origin, modeDurations, routeInfo, selectedTransportMode, setRouteModes]);

  useEffect(() => {
    if (!destination || !origin || !routeInfo || routeError) {
      setActiveRoute(null);
      return;
    }

    setActiveRoute({
      mode: toJudgeTravelMode(selectedTransportMode),
      origin: {
        lat: origin.lat,
        lng: origin.lng,
        name: origin.name,
      },
      destination: {
        lat: destination.lat,
        lng: destination.lng,
        name: destination.name,
      },
      duration: routeInfo.duration,
      distance: routeInfo.distance,
      distance_meters: routeInfo.distanceMeters ?? parseDistanceTextToMeters(routeInfo.distance),
      steps: routeSteps.map((step) => ({
        instruction: step.instructions,
        distance: step.distanceText,
      })),
    });
  }, [destination, origin, routeInfo, routeError, routeSteps, selectedTransportMode, setActiveRoute]);

  const modes = useMemo(
    () => [
      { key: 'driving', mode: (google?.maps?.TravelMode?.DRIVING ?? 'DRIVING') as google.maps.TravelMode, icon: IcCar, label: s.route_driving, subLabel: s.route_fastest },
      { key: 'transit', mode: (google?.maps?.TravelMode?.TRANSIT ?? 'TRANSIT') as google.maps.TravelMode, icon: IcBus, label: s.route_transit, subLabel: '' },
      { key: 'walking', mode: (google?.maps?.TravelMode?.WALKING ?? 'WALKING') as google.maps.TravelMode, icon: IcWalk, label: s.route_walking, subLabel: '' },
      { key: 'cycling', mode: (google?.maps?.TravelMode?.BICYCLING ?? 'BICYCLING') as google.maps.TravelMode, icon: IcBike, label: s.route_cycling, subLabel: '' },
    ],
    [google, s],
  );

  const renderedPinEpoch = pinEpoch.current;
  const handlePinPickerConfirm = useCallback(async () => {
    if (!mapInstance || !isPinPicking || !selectionMode || !ownsPin() || pinEpoch.current !== renderedPinEpoch || pendingPin.current !== null) return;
    const center = mapInstance.getCenter();
    if (!center) return;
    const lat = center.lat(), lng = center.lng();
    if (!validRouteCoordinates({ lat, lng })) return;
    const epoch = pinEpoch.current;
    pendingPin.current = epoch;
    setIsPinConfirming(true);
    const isCurrent = () => {
      const current = mapInstance.getCenter();
      return pinEpoch.current === epoch && pendingPin.current === epoch && ownsPin()
        && current?.lat() === lat && current.lng() === lng;
    };
    try {
      const resolved = await resolvePickedPoint({ lat, lng, google, onlineAllowed: hasRealGoogleMapsKey, locale, isCurrent });
      if (!resolved || !isCurrent()) return;
      const next = buildPickedRouteSelection({
        side: selectionMode,
        picked: { lat, lng, ...resolved, isCurrentLocation: false },
        origin, destination, currentLocation, currentLocationName: s.your_location,
        mode: selectedTransportMode,
      });
      if (!next) return;
      setOrigin(next.origin);
      replaceState(next);
      setIsPinPicking(false);
      setSelectionMode(null);
    } finally {
      // An old request must not clear a newer picker's busy flag/token.
      if (pendingPin.current === epoch) {
        pendingPin.current = null;
        setIsPinConfirming(false);
      }
    }
  }, [
    renderedPinEpoch, mapInstance, isPinPicking, selectionMode, ownsPin, google, hasRealGoogleMapsKey,
    locale, origin, destination, currentLocation, selectedTransportMode, s,
    replaceState, setIsPinPicking, setSelectionMode,
  ]);

  return {
    destination,
    location,
    origin,
    setOrigin,
    anchorSide,
    setAnchorSide,
    selectionMode,
    setSelectionMode,
    isPinPicking,
    isPinConfirming,
    setIsPinPicking,
    routeInfo,
    setRouteInfo,
    routeError,
    setRouteError,
    routeSteps,
    currentStepIndex,
    setCurrentStepIndex,
    routeEndLocation,
    setRouteEndLocation,
    travelMode,
    setTravelMode,
    selectedTransportMode,
    setSelectedTransportMode,
    modeDurations,
    isNavigating,
    setIsNavigating,
    clearRoutePolyline,
    handleSwapRoute,
    handlePinPickerConfirm,
    modes,
  };
}
