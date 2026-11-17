import { describe, expect, it, vi } from 'vitest';

vi.mock('../apps/Railway12306/services/catalogService', () => ({
  loadCatalog: vi.fn().mockResolvedValue(undefined),
  queryDirectFromCatalog: vi.fn(() => []),
  queryTransferFromCatalog: vi.fn(() => []),
  normalizeTrainType: vi.fn(() => 'G'),
}));

vi.mock('../apps/Railway12306/services/stationService', () => ({
  // A pending online station load must not hold up an offline catalog hit.
  initStations: vi.fn(() => new Promise<never>(() => {})),
  getStationCode: vi.fn(),
  getStationName: vi.fn(),
}));

vi.mock('../apps/Railway12306/data/loader', () => ({
  loadStations: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../apps/Railway12306/data/stations', () => ({
  getAllStations: vi.fn(() => [
    { name: '上海', code: 'SHH' },
    { name: '杭州', code: 'HZH' },
  ]),
}));

vi.mock('../apps/Railway12306/services/railwayApi', () => ({
  initSession: vi.fn().mockRejectedValue(new Error('offline')),
  queryTickets: vi.fn(),
  queryTransfer: vi.fn(),
  isSessionValid: vi.fn(),
}));

import { queryDirectTrains, queryTransferPlans } from '../apps/Railway12306/services/trainService';
import { initStations } from '../apps/Railway12306/services/stationService';
import { queryTransferFromCatalog } from '../apps/Railway12306/services/catalogService';
import { initSession } from '../apps/Railway12306/services/railwayApi';

describe('Railway catalog-first queries', () => {
  it('does not wait for online station initialization on direct or transfer hits', async () => {
    expect(await queryDirectTrains('上海', '南京', '2026-09-12')).toEqual({ trains: [] });
    expect(await queryTransferPlans('上海', '南京', '2026-09-12')).toEqual([]);
    expect(initStations).not.toHaveBeenCalled();
  }, 1000);

  it('uses local station codes when an uncatalogued transfer needs online fallback', async () => {
    vi.mocked(queryTransferFromCatalog).mockReturnValueOnce(null);
    await expect(queryTransferPlans('上海', '杭州', '2026-10-09')).rejects.toThrow('NETWORK_UNAVAILABLE');
    expect(initStations).not.toHaveBeenCalled();
    expect(initSession).toHaveBeenCalled();
  }, 1000);
});
