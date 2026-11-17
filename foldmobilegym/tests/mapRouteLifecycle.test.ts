import { beforeEach, describe, expect, it, vi } from 'vitest';
// Deterministic scheduler runs the actual production hook and effect callbacks.
// All asynchronous SDK/offline boundaries are controlled; no real navigation.
const h = vi.hoisted(() => ({ values: [] as any[], refs: [] as any[], si: 0, ri: 0, effects: [] as Array<() => void | (() => void)>, location: { state: {} as any }, google: null as any, live: false, owns: true, offline: vi.fn(), cache: vi.fn(), active: vi.fn(), modes: vi.fn(), replace: vi.fn() }));
vi.mock('react', () => ({ useState: (initial: unknown) => { const i = h.si++; if (!(i in h.values))
        h.values[i] = initial; return [h.values[i], (v: any) => { h.values[i] = typeof v === 'function' ? v(h.values[i]) : v; }]; }, useRef: (initial: unknown) => { const i = h.ri++; return h.refs[i] ??= { current: initial }; }, useMemo: (f: () => unknown) => f(), useCallback: (f: unknown) => f, useEffect: (f: () => void | (() => void)) => { h.effects.push(f); } }));
vi.mock('../apps/Map/hooks/useMapInteractionOwner', () => ({useMapInteractionOwner: () => () => h.owns}));
vi.mock('react-router-dom', () => ({ useLocation: () => h.location }));
vi.mock('../apps/Map/hooks/useMapGestures', () => ({ useMapGestures: () => ({ replaceState: h.replace }) }));
vi.mock('../apps/Map/state', () => ({ selectGoogle: (s: any) => s.google, useMapStore: (select: any) => select({ google: h.google, setActiveRoute: h.active, setRouteModes: h.modes }) }));
vi.mock('../apps/Map/locale', () => ({ useLocale: () => 'en' }));
vi.mock('../apps/Map/res/icons', () => ({ IcBike: () => null, IcBus: () => null, IcCar: () => null, IcWalk: () => null }));
vi.mock('../apps/Map/utils/placeUtils', () => ({ getMapStrings: () => ({ route_origin_dest_too_close: 'too close', route_not_found_detail: 'not found', route_failed: 'failed' }), formatRouteDistanceMeters: (m: number) => `${m} m`, googleLangCode: () => 'en', parseDistanceTextToMeters: () => 100, toJudgeTravelMode: (m: string) => m.toUpperCase() }));
vi.mock('../apps/Map/utils/offlineRouteStore', () => ({ getOfflineRoutePayload: h.offline, cacheRouteByKey: h.cache, makePointPairRouteCacheKey: () => 'synthetic' }));
vi.mock('../apps/Map/utils/googleMapsConfig', () => ({ hasGoogleMapsApiKey: () => h.live }));
import { useRouting } from '../apps/Map/hooks/useRouting';
const start = { lat: 1, lng: 1, name: 'Synthetic start' }, end = { lat: 2, lng: 2, name: 'Synthetic end' };
const payload = { duration: '5 min', distance: '100 m', distance_meters: 100, encodedPolyline: null, steps: [], endLocation: end };
function deferred<T>() { let resolve!: (v: T) => void, reject!: (e: Error) => void; const promise = new Promise<T>((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; }
const flush = async () => { for (let i = 0; i < 16; i++)
    await Promise.resolve(); };
let map: any;
function render() { h.si = 0; h.ri = 0; h.effects = []; return useRouting({ mapInstance: map, currentLocation: { latitude: 0, longitude: 0 } }); }
function mount() { render(); const cleanup = h.effects.map(f => f()); return () => cleanup.forEach(f => { if (typeof f === 'function')
    f(); }); }
function sdk() { const compute = vi.fn().mockResolvedValue({ routes: [] }), polyline = vi.fn(function () { return { setMap: vi.fn() }; }), imports = vi.fn().mockResolvedValue({ Route: { computeRoutes: compute } }); h.google = { maps: { Polyline: polyline, importLibrary: imports } }; return { compute, polyline, imports }; }
beforeEach(() => { vi.clearAllMocks(); h.values = []; h.refs = []; h.effects = []; h.location = { state: { origin: start, destination: end } }; h.google = null; h.live = false; h.owns = true; map = {}; h.offline.mockReset().mockResolvedValue(payload); });
describe('Map route request ownership', () => {
    it('commits the current offline route and four durations', async () => { mount(); await flush(); expect(render().routeInfo).toMatchObject({ duration: '5 min', distanceMeters: 100 }); expect(render().modeDurations).toEqual({ DRIVING: '5 min', TRANSIT: '5 min', WALKING: '5 min', BICYCLING: '5 min' }); });
    it('ignores late durations after cleanup', async () => { const old = deferred<any>(); h.offline.mockReturnValue(old.promise); const close = mount(); close(); old.resolve(payload); await flush(); expect(render().routeInfo).toBeNull(); expect(render().modeDurations).toEqual({}); });
    it('does not replace newer route/durations with old responses', async () => { const old = deferred<any>(); h.offline.mockReturnValue(old.promise); const close = mount(); close(); h.location = { state: { origin: start, destination: { ...end, lat: 3 } } }; h.offline.mockResolvedValue({ ...payload, duration: '9 min' }); mount(); await flush(); old.resolve(payload); await flush(); expect(render().routeInfo?.duration).toBe('9 min'); expect(Object.values(render().modeDurations)).toEqual(['9 min', '9 min', '9 min', '9 min']); });
    it('ignores an obsolete offline miss', async () => { const old = deferred<any>(); h.offline.mockReturnValue(old.promise); const close = mount(); close(); h.offline.mockResolvedValue(payload); mount(); await flush(); old.resolve(null); await flush(); expect(render().routeInfo?.duration).toBe('5 min'); expect(render().routeError).toBeNull(); });
    it('does not attach old polyline after delayed geometry import', async () => { const { polyline, imports } = sdk(), geometry = deferred<any>(); imports.mockReturnValue(geometry.promise); h.offline.mockResolvedValue({ ...payload, encodedPolyline: 'synthetic' }); const close = mount(); await flush(); close(); geometry.resolve({ encoding: { decodePath: () => [start, end] } }); await flush(); expect(polyline).not.toHaveBeenCalled(); expect(render().routeInfo).toBeNull(); });
    it('does not start online requests after obsolete SDK import', async () => { const { compute, imports } = sdk(), routes = deferred<any>(); h.live = true; imports.mockReturnValue(routes.promise); h.offline.mockResolvedValue(null); const close = mount(); await flush(); close(); routes.resolve({ Route: { computeRoutes: compute } }); await flush(); expect(compute).not.toHaveBeenCalled(); });
    it('ignores late online durations and route', async () => { const { compute } = sdk(), online = deferred<any>(); h.live = true; compute.mockReturnValue(online.promise); h.offline.mockResolvedValue(null); const close = mount(); await flush(); expect(compute).toHaveBeenCalled(); close(); online.resolve({ routes: [{ localizedValues: { duration: 'late' }, legs: [] }] }); await flush(); expect(render().modeDurations).toEqual({}); expect(render().routeInfo).toBeNull(); expect(h.cache).not.toHaveBeenCalled(); });
    it('ignores late rejected duration promises', async () => { const old = deferred<any>(); h.offline.mockReturnValue(old.promise); const close = mount(); close(); old.reject(new Error('late')); await flush(); expect(render().modeDurations).toEqual({}); expect(render().routeError).toBeNull(); });
    it('clears previous route when a new mode begins loading', async () => { const close = mount(); await flush(); close(); render().setSelectedTransportMode('walking'); h.offline.mockReturnValue(new Promise(() => { })); mount(); expect(render().routeInfo).toBeNull(); expect(render().routeSteps).toEqual([]); expect(render().routeEndLocation).toBeNull(); });
    it('clears previous route and durations for coincident endpoints', async () => { const close = mount(); await flush(); close(); h.location = { state: { origin: start, destination: start } }; mount(); await flush(); expect(render().routeError).toBe('too close'); expect(render().routeInfo).toBeNull(); expect(render().routeSteps).toEqual([]); expect(render().routeEndLocation).toBeNull(); expect(render().modeDurations).toEqual({}); });
    it('clears route and durations when destination is removed', async () => { const close = mount(); await flush(); close(); h.location = { state: { origin: start } }; mount(); await flush(); expect(render().routeInfo).toBeNull(); expect(render().routeError).toBeNull(); expect(render().modeDurations).toEqual({}); });
    it('attaches and publishes a current offline geometry result', async () => {
        const {polyline,imports}=sdk();
        imports.mockResolvedValue({encoding:{decodePath:()=>[start,end]}});
        h.offline.mockResolvedValue({...payload,encodedPolyline:'synthetic'});
        mount();await flush();
        expect(polyline).toHaveBeenCalledTimes(1);
        expect(render().routeInfo?.duration).toBe('5 min');
    });
    it('reports a current offline miss without attempting a live SDK', async () => {
        h.offline.mockResolvedValue(null);mount();await flush();
        expect(render().routeError).toBe('not found');
        expect(render().modeDurations).toEqual({DRIVING:'N/A',TRANSIT:'N/A',WALKING:'N/A',BICYCLING:'N/A'});
    });
    it('reports a current failed request', async () => {
        h.offline.mockRejectedValue(new Error('current failure'));mount();await flush();
        expect(render().routeError).toBe('failed');expect(render().routeInfo).toBeNull();
    });

});

function pinSdk() {
    const geocode = vi.fn().mockResolvedValue({results: []});
    const geocoder = vi.fn(function () {return {geocode};});
    const search = vi.fn().mockResolvedValue({places: []});
    const imports = vi.fn().mockResolvedValue({Place: {searchNearby: search}});
    h.google = {maps: {Geocoder: geocoder, importLibrary: imports}};
    map = {getCenter: () => ({lat: () => 1.5, lng: () => 1.5})};
    return {geocode, geocoder, search, imports};
}
function openPin(side: 'origin' | 'destination') {
    render().setSelectionMode(side);render().setIsPinPicking(true);return render();
}
const places = () => ({Place:{searchNearby:vi.fn().mockResolvedValue({places:[]})}});
describe('Map pin selection ownership and offline behavior', () => {
    it('does not make a live lookup without a configured key', async () => {
        const {imports,geocoder}=pinSdk();await openPin('destination').handlePinPickerConfirm();
        expect(imports).not.toHaveBeenCalled();expect(geocoder).not.toHaveBeenCalled();
        expect(h.replace).toHaveBeenCalledWith(expect.objectContaining({origin:start,destination:{lat:1.5,lng:1.5,name:'1.5000,1.5000',isCurrentLocation:false}}));
    });
    it('retains the existing origin when choosing a destination', async () => {
        pinSdk();h.live=true;await openPin('destination').handlePinPickerConfirm();expect(h.replace.mock.calls[0][0].origin).toEqual(start);
    });
    it('retains the existing destination when choosing an origin', async () => {
        pinSdk();await openPin('origin').handlePinPickerConfirm();expect(h.replace.mock.calls[0][0].destination).toEqual(end);expect(h.replace.mock.calls[0][0].origin.isCurrentLocation).toBe(false);
    });
    it('preserves a legitimate (0,0) device location', async () => {
        pinSdk();h.location={state:{origin:start}};await openPin('origin').handlePinPickerConfirm();expect(h.replace.mock.calls[0][0].destination).toMatchObject({lat:0,lng:0,isCurrentLocation:true});
    });
    it('rejects confirm outside an active pin picker', async () => {
        const {imports}=pinSdk();await render().handlePinPickerConfirm();expect(h.replace).not.toHaveBeenCalled();expect(imports).not.toHaveBeenCalled();
    });
    it('rejects a background confirm', async () => {
        pinSdk();h.owns=false;await openPin('destination').handlePinPickerConfirm();expect(h.replace).not.toHaveBeenCalled();
    });
    it('submits once when invoked twice before render', async () => {
        pinSdk();const confirm=openPin('destination').handlePinPickerConfirm;await Promise.all([confirm(),confirm()]);expect(h.replace).toHaveBeenCalledTimes(1);
    });
    it('ignores a response after same-frame cancellation', async () => {
        const {imports}=pinSdk(),pending=deferred<any>();h.live=true;imports.mockReturnValue(pending.promise);
        const confirm=openPin('destination').handlePinPickerConfirm();render().setIsPinPicking(false);render().setSelectionMode(null);pending.resolve(places());await confirm;expect(h.replace).not.toHaveBeenCalled();
    });
    it('ignores a response after route/Activity ownership changes', async () => {
        const {imports}=pinSdk(),pending=deferred<any>();h.live=true;imports.mockReturnValue(pending.promise);
        const confirm=openPin('destination').handlePinPickerConfirm();h.owns=false;pending.resolve(places());await confirm;expect(h.replace).not.toHaveBeenCalled();
    });
    it('allows a reopened picker while the old request is pending', async () => {
        const {imports}=pinSdk(),pending=deferred<any>();h.live=true;imports.mockReturnValue(pending.promise);
        const old=openPin('destination').handlePinPickerConfirm();render().setIsPinPicking(false);h.live=false;
        const next=openPin('origin').handlePinPickerConfirm();pending.resolve(places());await Promise.all([old,next]);
        expect(h.replace).toHaveBeenCalledTimes(1);expect(h.replace.mock.calls[0][0].anchorSide).toBe('origin');
    });
    it('falls back when the optional places SDK import rejects', async () => {
        const {imports}=pinSdk();h.live=true;imports.mockRejectedValue(new Error('SDK unavailable'));
        await expect(openPin('destination').handlePinPickerConfirm()).resolves.toBeUndefined();expect(h.replace).toHaveBeenCalledTimes(1);
    });
    it('discards coordinates when the map moves before resolution', async () => {
        const {imports}=pinSdk(),pending=deferred<any>();h.live=true;imports.mockReturnValue(pending.promise);
        const confirm=openPin('destination').handlePinPickerConfirm();map.getCenter=()=>({lat:()=>4,lng:()=>4});pending.resolve(places());await confirm;expect(h.replace).not.toHaveBeenCalled();
    });
    it('rejects a retained old confirm callback after reopening another picker', async () => {
        pinSdk();const stale=openPin('destination').handlePinPickerConfirm;
        render().setIsPinPicking(false);openPin('origin');await stale();expect(h.replace).not.toHaveBeenCalled();
    });

});
