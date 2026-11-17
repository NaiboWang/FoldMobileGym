import { beforeEach, describe, expect, it } from 'vitest';
import { useClockStore } from '../system/Clock/state';
import type { Alarm } from '../system/Clock/types';

const occupied: Alarm = { id: 'candidate', hour: 11, minute: 22, enabled: false, repeat: 'once', note: 'Inserted' };
const other: Alarm = { ...occupied, id: 'other', note: 'Other' };
const draft: Alarm = { ...occupied, hour: 7, minute: 30, note: 'Draft', vibrate: true, autoDelete: true };
beforeEach(() => useClockStore.setState({ alarms: [{ ...other }] }));

describe('Clock create-only store identity', () => {
  it('keeps a free draft ID and complete business fields', () => {
    expect(useClockStore.getState().createAlarm(draft)).toBe(draft.id);
    expect(useClockStore.getState().alarms).toEqual([draft, other]);
  });
  it('late same-ID insertion cannot be overwritten by a new draft', () => {
    useClockStore.getState().setAlarms([occupied, other]);
    const id = useClockStore.getState().createAlarm(draft);
    expect(id).toBe('candidate-1');
    expect(useClockStore.getState().alarms).toEqual([{ ...draft, id }, occupied, other]);
    expect(draft.id).toBe('candidate');
  });
  it('checks the live occupied suffix chain at mutation time', () => {
    const records = [occupied, { ...occupied, id: 'candidate-1' }, { ...occupied, id: 'candidate-2' }, other];
    useClockStore.getState().setAlarms(records);
    const id = useClockStore.getState().createAlarm(draft);
    expect(id).toBe('candidate-3');
    expect(useClockStore.getState().alarms).toEqual([{ ...draft, id }, ...records]);
  });
  it('two explicit create calls are independent, not legacy upserts', () => {
    const first = useClockStore.getState().createAlarm(draft);
    const second = useClockStore.getState().createAlarm({ ...draft, note: 'Second' });
    expect(second).not.toBe(first);
    expect(useClockStore.getState().alarms).toEqual([{ ...draft, id: second, note: 'Second' }, { ...draft, id: first }, other]);
  });
});
