import type { RoutePoint } from '../hooks/useRouting';
import type { Locale } from '@/os/locale';
import { getMapStrings, googleLangCode } from './placeUtils';

export function validRouteCoordinates(point: { lat: number; lng: number }): boolean {
  return Number.isFinite(point.lat) && Math.abs(point.lat) <= 90
    && Number.isFinite(point.lng) && Math.abs(point.lng) <= 180;
}

/** A map-picked point is not automatically the device location, even at (0, 0). */
export function buildPickedRouteSelection(options: {
  side: 'origin' | 'destination'; picked: RoutePoint;
  origin: RoutePoint | null; destination?: RoutePoint;
  currentLocation: { latitude: number; longitude: number };
  currentLocationName: string; mode: string;
}) {
  const {side, picked, origin, destination, currentLocation, currentLocationName, mode} = options;
  if (!validRouteCoordinates(picked)) return null;
  const current: RoutePoint = {
    lat: currentLocation.latitude, lng: currentLocation.longitude,
    name: currentLocationName, isCurrentLocation: true,
  };
  const counterpart = (side === 'origin' ? destination : origin) ?? current;
  if (!validRouteCoordinates(counterpart)) return null;
  return {
    origin: side === 'origin' ? picked : counterpart,
    destination: side === 'destination' ? picked : counterpart,
    mode, anchorSide: side,
  };
}

/** No-key installations use exact coordinates; never invent a POI or make a live lookup. */
export async function resolvePickedPoint(options: {
  lat: number; lng: number; google: typeof google | null | undefined;
  onlineAllowed: boolean; locale: Locale; isCurrent: () => boolean;
}): Promise<{name: string; address?: string} | null> {
  const {lat, lng, google, onlineAllowed, locale, isCurrent} = options;
  if (!validRouteCoordinates({lat,lng}) || !isCurrent()) return null;
  const fallback = {name: `${lat.toFixed(4)},${lng.toFixed(4)}`};
  if (!onlineAllowed || !google) return fallback;
  const s = getMapStrings(locale);
  try {
    const placesLib = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary;
    if (!isCurrent()) return null;
    const PlaceCtor = placesLib.Place;
    const geocoder = new google.maps.Geocoder();
    const nearbySearchPromise = PlaceCtor.searchNearby({
      fields: ['id', 'displayName', 'location', 'rating', 'userRatingCount', 'types'],
      locationRestriction: { center: { lat, lng }, radius: 50 },
      maxResultCount: 30,
      language: googleLangCode(locale),
    })
      .then((r) => r.places)
      .catch(() => [] as google.maps.places.Place[]);

    const [geoPromise, nearbyResults] = await Promise.all([
      geocoder.geocode({ location: { lat, lng } }).catch(() => ({ results: [] as google.maps.GeocoderResult[] })),
      nearbySearchPromise,
    ]);

    if (!isCurrent()) return null;
    let name: string = s.selected_location;
    const geoResult = geoPromise.results[0] || null;
    const address = geoResult?.formatted_address?.replace(/^中国/, '').trim() || undefined;

    const visibleTypes = [
      'restaurant',
      'lodging',
      'tourist_attraction',
      'museum',
      'park',
      'cafe',
      'bar',
      'shopping_mall',
      'subway_station',
      'transit_station',
      'department_store',
      'supermarket',
      'bakery',
      'library',
      'university',
      'school',
      'hospital',
    ];

    let foundExactPOI = false;

    if (nearbyResults.length > 0) {
      const candidates = nearbyResults.filter((p) => p.types?.some((t) => visibleTypes.includes(t)) && p.location);

      if (candidates.length > 0) {
        const scoredCandidates = candidates.map((p) => {
          const latDiff = Math.abs(p.location!.lat() - lat);
          const lngDiff = Math.abs(p.location!.lng() - lng);
          const distSq = latDiff * latDiff + lngDiff * lngDiff;
          const distPenalty = distSq * 10000000;
          const ratingCount = p.userRatingCount || 0;
          const rating = p.rating || 0;
          let prominenceScore = Math.log(ratingCount + 1) * rating;
          if (p.types?.includes('tourist_attraction')) prominenceScore *= 1.5;
          if (p.types?.includes('lodging')) prominenceScore *= 1.2;
          return { place: p, score: prominenceScore - distPenalty, distSq };
        });

        scoredCandidates.sort((a, b) => b.score - a.score);
        const winner = scoredCandidates[0];
        if (winner && winner.distSq < 0.00005) {
          name = winner.place.displayName!;
          foundExactPOI = true;
        }
      }
    }

    if (!foundExactPOI && geoResult?.place_id) {
      const isGeocoderPrimaryVisible = geoResult.types?.some((t) => visibleTypes.includes(t));
      if (isGeocoderPrimaryVisible) {
        try {
          const geoPlace = new PlaceCtor({ id: geoResult.place_id });
          await geoPlace.fetchFields({ fields: ['displayName'] });
          if (!isCurrent()) return null;
          if (geoPlace.displayName) {
            name = geoPlace.displayName;
            foundExactPOI = true;
          }
        } catch {
          /* ignore */
        }
      }
    }

    if (!isCurrent()) return null;
    if (!foundExactPOI) {
      const majorTypes = [
        'lodging',
        'shopping_mall',
        'transit_station',
        'subway_station',
        'tourist_attraction',
        'museum',
        'park',
        'university',
        'hospital',
        'airport',
        'library',
        'train_station',
        'restaurant',
        'cafe',
        'bar',
      ];

      try {
        const { places: widerResults } = await PlaceCtor.searchNearby({
          fields: ['displayName', 'location', 'types'],
          locationRestriction: { center: { lat, lng }, radius: 100 },
          maxResultCount: 30,
          language: googleLangCode(locale),
        });
        if (!isCurrent()) return null;
        const landmark = widerResults.find((p) => p.types?.some((t) => majorTypes.includes(t)) && p.location);
        if (landmark?.location) {
          const dLat = landmark.location.lat() - lat;
          const dLng = landmark.location.lng() - lng;
          if (dLat * dLat + dLng * dLng < 0.000005) {
            name = landmark.displayName!;
            foundExactPOI = true;
          }
        }
      } catch {
        /* ignore */
      }
    }

    if (!foundExactPOI && geoResult) {
      const result = geoResult;
      const getComp = (type: string) => result.address_components.find((c) => c.types.includes(type))?.long_name;

      const poi = getComp('point_of_interest') || getComp('establishment') || getComp('premise');
      const route = getComp('route');
      const streetNum = getComp('street_number');
      const sublocality = getComp('sublocality') || getComp('sublocality_level_1');

      if (poi) {
        name = poi;
      } else if (route) {
        name = `${route}${streetNum || ''}`;
      } else if (sublocality) {
        name = sublocality;
      } else {
        name = result.formatted_address.replace(/^中国/, '').trim();
      }
    }

    return isCurrent() ? {name, address} : null;
  } catch {
    return isCurrent() ? fallback : null;
  }
}
