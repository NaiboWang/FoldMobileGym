import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrainInfo, TransferPlan } from '../apps/Railway12306/types';
const queries = vi.hoisted(() => ({ direct: vi.fn(), transfer: vi.fn() }));
vi.mock('../apps/Railway12306/services/trainService', () => ({ queryDirectTrains: queries.direct, queryTransferPlans: queries.transfer }));
import { useRailwayStore } from '../apps/Railway12306/state';
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const trains = (name: string) => [{ trainNo: name }] as TrainInfo[];
describe('Railway query response ownership', () => {
  beforeEach(() => { vi.clearAllMocks(); useRailwayStore.setState({ from: 'Source', to: 'Target', date: '2026-10-19', directTrains: [], transferPlans: [], searchHistory: [], lastQuerySummary: null, _temp: { queryLoading: false, queryError: null } }); });
  it('latest direct request alone commits results, summary and history', async () => {
    const old = deferred<{ trains: TrainInfo[] }>(), current = deferred<{ trains: TrainInfo[] }>(); queries.direct.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const a = useRailwayStore.getState().executeQuery(), b = useRailwayStore.getState().executeQuery();
    current.resolve({ trains: trains('CURRENT') }); await b; old.resolve({ trains: trains('OBSOLETE') }); await a;
    expect(useRailwayStore.getState().directTrains).toEqual(trains('CURRENT')); expect(useRailwayStore.getState().lastQuerySummary).toEqual({ from: 'Source', to: 'Target', date: '2026-10-19', count: 1 });
    expect(useRailwayStore.getState().searchHistory).toEqual(['Source--Target']);
  });
  it('changing a query field invalidates old pending results before another request is started', async () => {
    const old = deferred<{ trains: TrainInfo[] }>(); queries.direct.mockReturnValueOnce(old.promise);
    const pending = useRailwayStore.getState().executeQuery(); useRailwayStore.getState().setDate('2026-10-20'); old.resolve({ trains: trains('WRONG DATE') }); await pending;
    expect(useRailwayStore.getState().directTrains).toEqual([]); expect(useRailwayStore.getState().lastQuerySummary).toBeNull(); expect(useRailwayStore.getState().searchHistory).toEqual([]); expect(useRailwayStore.getState()._temp.queryLoading).toBe(false);
  });
  it('an obsolete transfer error cannot spoil a newer successful direct result', async () => {
    const old = deferred<TransferPlan[]>(); queries.transfer.mockReturnValueOnce(old.promise); queries.direct.mockResolvedValueOnce({ trains: trains('DIRECT') });
    const a = useRailwayStore.getState().executeTransferQuery(); await useRailwayStore.getState().executeQuery(); old.reject(new Error('Obsolete error')); await a;
    expect(useRailwayStore.getState().directTrains).toEqual(trains('DIRECT')); expect(useRailwayStore.getState()._temp).toEqual({ queryLoading: false, queryError: null });
  });
  it('same-condition external temp replacement/reset invalidates a pending request', async () => {
    const old = deferred<{ trains: TrainInfo[] }>(); queries.direct.mockReturnValueOnce(old.promise); const pending = useRailwayStore.getState().executeQuery();
    useRailwayStore.setState({ _temp: { queryLoading: false, queryError: null } }); old.resolve({ trains: trains('BEFORE RESET') }); await pending;
    expect(useRailwayStore.getState().directTrains).toEqual([]); expect(useRailwayStore.getState().lastQuerySummary).toBeNull();
  });
  it('current failure clears loading and preserves the original error contract', async () => {
    queries.direct.mockRejectedValueOnce(new Error('Current failure')); await useRailwayStore.getState().executeQuery();
    expect(useRailwayStore.getState()._temp).toEqual({ queryLoading: false, queryError: 'Current failure' });
  });
});
