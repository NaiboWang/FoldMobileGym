/** A no-key point is exact input, not an invented address or a stalled live lookup. */
export function resolveLongPressedPlace(options: {
  location: google.maps.LatLng;
  label: string;
  onlineAllowed: boolean;
  createGeocoder: () => Pick<google.maps.Geocoder, 'geocode'>;
  isCurrent: () => boolean;
  complete: (place: google.maps.places.PlaceResult) => void;
}): void {
  const { location, label, onlineAllowed, createGeocoder, isCurrent, complete } = options;
  const point = { lat: location.lat(), lng: location.lng() };
  const fallback: google.maps.places.PlaceResult = {
    name: label, geometry: { location }, vicinity: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
  };
  let finished = false;
  const finish = (place: google.maps.places.PlaceResult) => {
    if (finished || !isCurrent()) return;
    finished = true; complete(place);
  };
  if (!isCurrent()) return;
  if (!onlineAllowed) { finish(fallback); return; }
  try {
    const request = createGeocoder().geocode({ location: point }, (results, status) => {
      const place = results?.[0];
      if (status === 'OK' && place) finish({
        place_id: place.place_id, name: label, formatted_address: place.formatted_address,
        geometry: place.geometry, types: ['point_of_interest'], vicinity: place.formatted_address,
      });
      else finish(fallback);
    });
    // Some SDK failures reject the promise without completing its callback.
    void request?.catch(() => finish(fallback));
  } catch { finish(fallback); }
}
