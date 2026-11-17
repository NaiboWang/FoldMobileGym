import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCalendarStore } from '../system/Calendar/state';
import * as TimeService from '../os/TimeService';
import type { CalendarEvent } from '../system/Calendar/types';

const fields: Omit<CalendarEvent, 'id'> = {
  type: 'event', title: 'Public event', description: 'Public notes', location: 'Public room',
  allDay: false, startTs: 1000, endTs: 2000, reminderMinutesBefore: 15, alarmEnabled: true,
};
beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.25);
  vi.spyOn(TimeService, 'now').mockReturnValue(1000);
  useCalendarStore.setState({ events: [], createdCount: 0, deletedCount: 3, mutationCount: 4 });
});
afterEach(() => vi.restoreAllMocks());

describe('Calendar creation identity', () => {
  it('two intentional creates with frozen time and repeated entropy remain independent', () => {
    const first = useCalendarStore.getState().createEvent(fields);
    const second = useCalendarStore.getState().createEvent({ ...fields, title: 'Second' });
    expect(first).not.toBe(second);
    useCalendarStore.getState().updateEvent(first, { description: 'Changed' });
    expect(useCalendarStore.getState().events.find(event => event.id === second)?.description).toBe('Public notes');
    expect(useCalendarStore.getState()).toMatchObject({ createdCount: 2, deletedCount: 3, mutationCount: 7 });
  });
  it('keeps unused candidate and all complete fields unchanged', () => {
    const id = useCalendarStore.getState().createEvent(fields);
    expect(id).toBe('evt_9rs');
    expect(useCalendarStore.getState().events).toEqual([{ ...fields, id }]);
    expect(fields.title).toBe('Public event');
  });
  it('skips occupied suffixes without mutating existing records', () => {
    const old = ['evt_9rs', 'evt_9rs-1', 'evt_9rs-2'].map(id => ({ ...fields, id }));
    useCalendarStore.setState({ events: old });
    const id = useCalendarStore.getState().createEvent(fields);
    expect(id).toBe('evt_9rs-3');
    expect(useCalendarStore.getState().events.slice(1)).toEqual(old);
  });
  it('handles zero entropy and intentional identical event text', () => {
    vi.mocked(Math.random).mockReturnValue(0);
    const first = useCalendarStore.getState().createEvent(fields);
    const second = useCalendarStore.getState().createEvent(fields);
    expect(first).toBe('evt_rs');
    expect(second).toBe('evt_rs-1');
    expect(useCalendarStore.getState().events).toHaveLength(2);
  });
  it('deleting one newly created event preserves the other and count semantics', () => {
    const first = useCalendarStore.getState().createEvent(fields);
    const second = useCalendarStore.getState().createEvent(fields);
    useCalendarStore.getState().deleteEvent(first);
    expect(useCalendarStore.getState().events).toEqual([{ ...fields, id: second }]);
    expect(useCalendarStore.getState()).toMatchObject({ createdCount: 2, deletedCount: 4, mutationCount: 7 });
  });
});
