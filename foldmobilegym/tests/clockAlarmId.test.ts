import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAlarmId } from '../system/Clock/utils';
import * as TimeService from '../os/TimeService';

afterEach(() => vi.restoreAllMocks());

describe('Clock new-alarm ID allocation', () => {
  it('retains an unoccupied candidate', () => {
    expect(createAlarmId([{ id: 'old' }], 'new')).toBe('new');
  });
  it('skips the candidate and all occupied suffixes', () => {
    const records = [{ id: 'new' }, { id: 'new-1' }, { id: 'new-2' }];
    expect(createAlarmId(records, 'new')).toBe('new-3');
    expect(records).toEqual([{ id: 'new' }, { id: 'new-1' }, { id: 'new-2' }]);
  });
  it('uses the first free suffix without assuming list order or contiguity', () => {
    expect(createAlarmId([{ id: 'new-3' }, { id: 'new' }, { id: 'new-1' }], 'new')).toBe('new-2');
  });
  it('uses exact string membership, including object-property-like IDs', () => {
    expect(createAlarmId([{ id: '__proto__' }, { id: 'constructor' }], '__proto__')).toBe('__proto__-1');
    expect(createAlarmId([{ id: 'newer' }], 'new')).toBe('new');
  });
  it('allocates independent IDs with frozen time and repeated entropy', () => {
    vi.spyOn(TimeService, 'now').mockReturnValue(1791768600000);
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    const records: { id: string }[] = [];
    for (let index = 0; index < 25; index++) records.push({ id: createAlarmId(records) });
    expect(new Set(records.map(record => record.id)).size).toBe(25);
    expect(records[0].id).toMatch(/^a-1791768600000-/);
    expect(records[24].id).toBe(`${records[0].id}-24`);
  });
});
