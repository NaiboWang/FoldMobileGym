import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Map offline snapshot loading', () => {
  it('retries a place snapshot after a transient request failure', async () => {
    vi.resetModules();
    const snapshot = { location: { lat: 39.9, lng: 116.3 }, places: {}, search_index: {} };
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('temporarily offline'))
      .mockResolvedValueOnce({ ok: true, json: async () => snapshot });
    vi.stubGlobal('fetch', fetchMock);

    const { loadPlacesSnapshot } = await import('../apps/Map/utils/offlinePlaceStore');
    expect(await loadPlacesSnapshot()).toBeNull();
    expect(await loadPlacesSnapshot()).toEqual(snapshot);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries route data without refetching the already loaded places', async () => {
    vi.resetModules();
    const origin = { lat: 39.9794688, lng: 116.3323982 };
    const destination = { lat: 39.9804, lng: 116.3335 };
    const places = {
      location: origin,
      places: { dest: { placeId: 'dest', name: 'Dest', ...destination, types: [], formattedAddress: '' } },
      search_index: {},
    };
    const route = {
      mode: 'WALKING', duration: '5 min', distance: '200 m',
      distance_meters: 200, duration_seconds: 300,
      encodedPolyline: null, endLocation: destination, steps: [],
    };
    let routeRequests = 0;
    let placeRequests = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('places.json')) {
        placeRequests++;
        return { ok: true, json: async () => places };
      }
      routeRequests++;
      if (routeRequests === 1) return { ok: false, status: 503 };
      return { ok: true, json: async () => ({ location: origin, routes: { 'current>dest>WALKING': route } }) };
    }));

    const { getOfflineRoutePayload } = await import('../apps/Map/utils/offlineRouteStore');
    const query = { origin, destination, travelMode: 'WALKING' as const, locale: 'en' as const };
    expect(await getOfflineRoutePayload(query)).toBeNull();
    expect(await getOfflineRoutePayload(query)).toMatchObject({ duration: '5 min', distance_meters: 200 });
    expect(routeRequests).toBe(2);
    expect(placeRequests).toBe(1);
  });
});
