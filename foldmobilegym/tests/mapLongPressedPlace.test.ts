import { describe, expect, it, vi } from 'vitest';
import { resolveLongPressedPlace } from '../apps/Map/utils/longPressedPlace';
const location = { lat: () => 39.98085, lng: () => 116.33017 } as google.maps.LatLng;
function harness(onlineAllowed = true) {
  let current = true;
  const complete = vi.fn(), request = new Promise<google.maps.GeocoderResponse>(() => {});
  const geocode = vi.fn((_request: google.maps.GeocoderRequest, _callback: Parameters<google.maps.Geocoder['geocode']>[1]) => request);
  const createGeocoder = vi.fn(() => ({ geocode }));
  const run = () => resolveLongPressedPlace({ location, label: 'Dropped pin', onlineAllowed, createGeocoder, isCurrent: () => current, complete });
  return { run, complete, createGeocoder, geocode, setCurrent: (value: boolean) => { current = value; },
    reply: (results: google.maps.GeocoderResult[] | null, status: string) => geocode.mock.calls[0]?.[1]?.(results, status as google.maps.GeocoderStatus) };
}
describe('Map long-pressed point metadata ownership', () => {
  it('finishes no-key selection with the exact point and never constructs a live geocoder', () => {
    const h = harness(false); h.run(); expect(h.createGeocoder).not.toHaveBeenCalled();
    expect(h.complete).toHaveBeenCalledWith({ name: 'Dropped pin', geometry: { location }, vicinity: '39.98085, 116.33017' });
    expect(h.complete.mock.calls[0][0].geometry.location).toBe(location);
    expect(h.complete.mock.calls[0][0]).not.toHaveProperty('place_id'); expect(h.complete.mock.calls[0][0]).not.toHaveProperty('formatted_address');
  });
  it('does not start or complete an already invalid request', () => {
    const h = harness(); h.setCurrent(false); h.run(); expect(h.createGeocoder).not.toHaveBeenCalled(); expect(h.complete).not.toHaveBeenCalled();
  });
  it('uses one configured geocoder request and keeps its real provider facts', () => {
    const h = harness(), geometry = { location }, result = { place_id: 'local-qa', formatted_address: 'Local QA address', geometry } as google.maps.GeocoderResult;
    h.run(); expect(h.geocode).toHaveBeenCalledTimes(1); expect(h.geocode.mock.calls[0][0]).toEqual({ location: { lat: 39.98085, lng: 116.33017 } });
    h.reply([result], 'OK'); expect(h.complete).toHaveBeenCalledWith({ place_id: 'local-qa', name: 'Dropped pin', formatted_address: 'Local QA address', geometry,
      types: ['point_of_interest'], vicinity: 'Local QA address' }); expect(h.complete.mock.calls[0][0].geometry).toBe(geometry);
  });
  it.each(['ZERO_RESULTS', 'REQUEST_DENIED', 'ERROR'])('retains exact coordinates rather than inventing an address on %s', status => {
    const h = harness(); h.run(); h.reply(null, status); expect(h.complete).toHaveBeenCalledTimes(1);
    expect(h.complete.mock.calls[0][0].vicinity).toBe('39.98085, 116.33017'); expect(h.complete.mock.calls[0][0]).not.toHaveProperty('formatted_address');
  });
  it('ignores a delayed response after selection is closed, superseded or unmounted', () => {
    const h = harness(); h.run(); h.setCurrent(false); h.reply([{ place_id: 'old' } as google.maps.GeocoderResult], 'OK'); expect(h.complete).not.toHaveBeenCalled();
  });
  it('does not commit twice if a provider calls its callback twice', () => {
    const h = harness(); h.run(); h.reply(null, 'ZERO_RESULTS'); h.reply([{ place_id: 'late' } as google.maps.GeocoderResult], 'OK'); expect(h.complete).toHaveBeenCalledTimes(1);
  });
  it('finishes truthfully when the configured provider constructor throws', () => {
    const complete = vi.fn(); resolveLongPressedPlace({ location, label: 'Dropped pin', onlineAllowed: true,
      createGeocoder: () => { throw new Error('controlled initialization failure'); }, isCurrent: () => true, complete });
    expect(complete.mock.calls[0][0].vicinity).toBe('39.98085, 116.33017');
  });
  it('finishes truthfully when a provider throws before returning its request', () => {
    const h = harness(); h.geocode.mockImplementationOnce(() => { throw new Error('controlled synchronous failure'); }); h.run();
    expect(h.complete.mock.calls[0][0].vicinity).toBe('39.98085, 116.33017');
  });
  it('handles promise rejection without an unhandled error or invented provider facts', async () => {
    const h = harness(); h.geocode.mockImplementationOnce(() => Promise.reject(new Error('controlled provider rejection'))); h.run();
    await Promise.resolve(); expect(h.complete).toHaveBeenCalledTimes(1); expect(h.complete.mock.calls[0][0]).not.toHaveProperty('place_id');
  });
  it('does not reopen a cancelled point when the provider promise later rejects', async () => {
    const h = harness(); let reject!: (error: Error) => void;
    h.geocode.mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest; })); h.run(); h.setCurrent(false);
    reject(new Error('controlled late rejection')); await Promise.resolve(); expect(h.complete).not.toHaveBeenCalled();
  });
  it('keeps a successful callback when a provider subsequently rejects its promise', async () => {
    const h = harness(); let reject!: (error: Error) => void;
    h.geocode.mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest; })); h.run();
    h.reply([{ place_id: 'current', geometry: { location } } as google.maps.GeocoderResult], 'OK'); reject(new Error('controlled duplicate completion'));
    await Promise.resolve(); expect(h.complete).toHaveBeenCalledTimes(1); expect(h.complete.mock.calls[0][0].place_id).toBe('current');
  });
});
