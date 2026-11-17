import { beforeEach, describe, expect, it } from 'vitest';
import { useClockStore } from '../system/Clock/state';
import type { Alarm } from '../system/Clock/types';

const target: Alarm = { id: 'target', hour: 7, minute: 15, enabled: false, repeat: 'once', note: 'Original' };
const other: Alarm = { id: 'other', hour: 9, minute: 30, enabled: false, repeat: 'once', note: 'Other' };
beforeEach(() => useClockStore.setState({ alarms: [{ ...target }, { ...other }] }));

describe('Clock existing-alarm update identity', () => {
  it('updates only the matching existing alarm and preserves order/other records', () => {
    const next = { ...target, hour: 8, note: 'Edited' };
    expect(useClockStore.getState().updateAlarm(next)).toBe(true);
    expect(useClockStore.getState().alarms).toEqual([next, other]);
  });
  it('missing IDs are a no-op, not an implicit create', () => {
    const before = useClockStore.getState();
    expect(before.updateAlarm({ ...target, id: 'missing' })).toBe(false);
    expect(useClockStore.getState()).toBe(before);
  });
  it('deleting a target while editing cannot resurrect it on save', () => {
    useClockStore.getState().deleteAlarms(new Set([target.id]));
    const before = useClockStore.getState();
    expect(before.updateAlarm({ ...target, note: 'Stale editor' })).toBe(false);
    expect(useClockStore.getState()).toBe(before);
    expect(before.alarms).toEqual([other]);
  });
  it('restoring the exact same ID allows an existing-object update again', () => {
    useClockStore.getState().deleteAlarms(new Set([target.id]));
    useClockStore.getState().saveAlarm(target);
    expect(useClockStore.getState().updateAlarm({ ...target, minute: 20 })).toBe(true);
    expect(useClockStore.getState().alarms.find(alarm => alarm.id === target.id)?.minute).toBe(20);
  });
  it('legacy saveAlarm retains its explicit upsert behavior for callers and new alarms', () => {
    useClockStore.getState().saveAlarm({ ...target, id: 'new' });
    expect(useClockStore.getState().alarms).toHaveLength(3);
    useClockStore.getState().saveAlarm({ ...target, hour: 10 });
    expect(useClockStore.getState().alarms).toHaveLength(3);
    expect(useClockStore.getState().alarms.find(alarm => alarm.id === target.id)?.hour).toBe(10);
  });
});
