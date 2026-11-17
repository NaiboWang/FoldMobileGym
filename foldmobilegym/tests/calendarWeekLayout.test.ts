import { describe, expect, it } from 'vitest';
import * as TimeService from '../os/TimeService';
import { buildWeekEventLayout, formatWeekMinute } from '../system/Calendar/utils/weekEventLayout';
import { generateWeekDays } from '../system/Calendar/utils/calendarUtils';
import type { CalendarEvent } from '../system/Calendar/types';
import { NAVIGATION_DECLARATION } from '../system/Calendar/navigation.declaration';
import { retainWeekOffset } from '../system/Calendar/components/CalendarWeekViewport';

const at = (day: number, hour = 0, minute = 0) => TimeService.fromLocalParts(2026, 8, day, hour, minute).getTime();
const event = (id: string, startTs: number, endTs: number, allDay = false): CalendarEvent => ({ id, title: id, type: 'event', startTs, endTs, allDay });
const date = (day: number) => TimeService.fromTimestamp(at(day));

describe('Calendar week interval layout', () => {
  it.each([[187, 3, 3, 187], [187, 0, 0, 187], [187, 20, 100, 20], [undefined, 50, 100, 50]])
    ('retains intended offset %s at actual %s / max %s as %s', (previous, actual, max, expected) => {
      expect(retainWeekOffset(previous, actual, max)).toBe(expected);
    });
  it('splits timed events at local midnight with end-exclusive boundaries', () => {
    const result = buildWeekEventLayout([event('overnight', at(24, 23, 30), at(25, 1))], [date(24), date(25), date(26)]);
    expect(result[0].timed[0]).toMatchObject({ startMinutes: 1410, endMinutes: 1440, continuesBefore: false, continuesAfter: true });
    expect(result[1].timed[0]).toMatchObject({ startMinutes: 0, endMinutes: 60, continuesBefore: true, continuesAfter: false });
    expect(result[2].timed).toEqual([]);
  });
  it('does not add a zero-length segment to the day at an exact midnight end', () => {
    const result = buildWeekEventLayout([event('midnight', at(24, 22), at(25))], [date(24), date(25)]);
    expect(result[0].timed).toHaveLength(1); expect(result[1].timed).toEqual([]);
  });
  it('keeps all-day events out of the hourly lanes and clips multi-day spans', () => {
    const result = buildWeekEventLayout([event('all', at(24), at(26), true)], [date(23), date(24), date(25), date(26)]);
    expect(result.map(day => day.allDay.map(item => item.id))).toEqual([[], ['all'], ['all'], []]);
    expect(result.every(day => day.timed.length === 0)).toBe(true);
  });
  it('assigns distinct lanes to simultaneous events', () => {
    const result = buildWeekEventLayout([
      event('a', at(25, 9), at(25, 10)), event('b', at(25, 9, 15), at(25, 9, 45)), event('c', at(25, 9, 30), at(25, 10, 30)),
    ], [date(25)])[0].timed;
    expect(result.map(item => item.lane)).toEqual([0, 1, 2]); expect(result.every(item => item.laneCount === 3)).toBe(true);
  });
  it('reuses lanes at touching endpoints and resets width for independent clusters', () => {
    const result = buildWeekEventLayout([
      event('a', at(25, 9), at(25, 10)), event('b', at(25, 9, 30), at(25, 10, 30)),
      event('c', at(25, 10), at(25, 11)), event('d', at(25, 12), at(25, 13)),
    ], [date(25)])[0].timed;
    expect(result.map(item => [item.event.id, item.lane, item.laneCount])).toEqual([['a', 0, 2], ['b', 1, 2], ['c', 0, 2], ['d', 0, 1]]);
  });
  it('packs minimum visual hit areas, not just short logical durations', () => {
    const result = buildWeekEventLayout([event('short-a', at(25, 9), at(25, 9, 1)), event('short-b', at(25, 9, 2), at(25, 9, 3))], [date(25)])[0].timed;
    expect(result.every(item => item.bottomMinutes - item.topMinutes >= 24 && item.laneCount === 2)).toBe(true);
  });
  it('keeps very late minimum-size events within the day canvas', () => {
    const result = buildWeekEventLayout([event('late', at(25, 23, 59), at(26))], [date(25)])[0].timed[0];
    expect(result).toMatchObject({ startMinutes: 1439, endMinutes: 1440, topMinutes: 1416, bottomMinutes: 1440 });
  });
  it('ignores invalid/out-of-week intervals without mutating source records', () => {
    const events = [event('outside', at(1), at(2)), event('zero', at(25), at(25)), event('reverse', at(25, 2), at(25, 1)), event('nan', NaN, at(25))];
    const copies = events.map(item => ({ ...item }));
    expect(buildWeekEventLayout(events, [date(25)])[0]).toMatchObject({ timed: [], allDay: [] });
    expect(events).toEqual(copies);
  });
  it.each(['monday', 'sunday'] as const)('uses supplied %s-start week dates, including adjacent months', start => {
    const days = generateWeekDays(TimeService.fromLocalParts(2026, 9, 1), start).map(day => day.date);
    const result = buildWeekEventLayout([event('edge', at(30, 23), TimeService.fromLocalParts(2026, 9, 1, 1).getTime())], days);
    expect(result.filter(day => day.timed.length)).toHaveLength(2);
  });
  it.each([[0, '00:00'], [570.9, '09:30'], [1440, '24:00'], [1500, '24:00']])('formats minute %s as %s', (value, label) => {
    expect(formatWeekMinute(Number(value))).toBe(label);
  });
  it('declares Week agenda entry and date selection without opening background controls', () => {
    expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === 'event.open')?.from)
      .toContainEqual({ path: '/', search: { menu: null, view: 'week' } });
    expect(NAVIGATION_DECLARATION.routes[0].uiStates.find(state => state.search.view === 'week' && !state.search.menu)?.actions)
      .toContainEqual(expect.objectContaining({ id: 'calendar.week.date.input', behavior: 'input', paramsSchema: { value: 'number' } }));
  });
});
