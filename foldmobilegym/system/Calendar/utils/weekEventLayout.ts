import * as TimeService from '@/os/TimeService';
import type { CalendarEvent } from '../types';
import { dimens } from '../res/dimens';
import { formatCalendarDateKey } from './calendarUtils';

export interface WeekTimedEvent {
  event: CalendarEvent;
  startMinutes: number;
  endMinutes: number;
  topMinutes: number;
  bottomMinutes: number;
  lane: number;
  laneCount: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

export interface WeekDayEvents {
  dateKey: string;
  allDay: CalendarEvent[];
  timed: WeekTimedEvent[];
}

const minutes = (timestamp: number) => {
  const date = TimeService.fromTimestamp(timestamp);
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
};
const minimumMinutes = dimens.weekEventMinHeight * 60 / dimens.weekHourHeight;

/** Clip end-exclusive event intervals to local days, then pack visible hit areas. */
export function buildWeekEventLayout(events: readonly CalendarEvent[], dates: readonly Date[]): WeekDayEvents[] {
  return dates.map(date => {
    const start = TimeService.fromTimestamp(date.getTime()); start.setHours(0, 0, 0, 0);
    const end = TimeService.fromTimestamp(start.getTime()); end.setDate(end.getDate() + 1);
    const startTs = start.getTime(), endTs = end.getTime();
    const relevant = events.filter(event => Number.isFinite(event.startTs) && Number.isFinite(event.endTs)
      && event.endTs > event.startTs && event.startTs < endTs && event.endTs > startTs);
    const allDay = relevant.filter(event => event.allDay).sort((a, b) => a.startTs - b.startTs || a.id.localeCompare(b.id));
    const timed: WeekTimedEvent[] = relevant.filter(event => !event.allDay).map(event => {
      const startMinutes = event.startTs <= startTs ? 0 : minutes(event.startTs);
      const endMinutes = event.endTs >= endTs ? 1440 : minutes(event.endTs);
      const topMinutes = Math.min(startMinutes, 1440 - minimumMinutes);
      const bottomMinutes = Math.min(1440, Math.max(topMinutes + minimumMinutes, endMinutes));
      return { event, startMinutes, endMinutes, topMinutes, bottomMinutes, lane: 0, laneCount: 1,
        continuesBefore: event.startTs < startTs, continuesAfter: event.endTs > endTs };
    }).sort((a, b) => a.topMinutes - b.topMinutes || a.bottomMinutes - b.bottomMinutes || a.event.id.localeCompare(b.event.id));
    const pack = (cluster: WeekTimedEvent[]) => {
      const ends: number[] = [];
      for (const segment of cluster) {
        let lane = ends.findIndex(end => end <= segment.topMinutes);
        if (lane < 0) lane = ends.length;
        ends[lane] = segment.bottomMinutes; segment.lane = lane;
      }
      for (const segment of cluster) segment.laneCount = ends.length;
    };
    let cluster: WeekTimedEvent[] = [], clusterEnd = -Infinity;
    for (const segment of timed) {
      if (segment.topMinutes >= clusterEnd && cluster.length) { pack(cluster); cluster = []; }
      cluster.push(segment); clusterEnd = Math.max(clusterEnd, segment.bottomMinutes);
    }
    if (cluster.length) pack(cluster);
    return { dateKey: formatCalendarDateKey(start), allDay, timed };
  });
}

export function formatWeekMinute(value: number): string {
  const minute = Math.max(0, Math.min(1440, Math.floor(value)));
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}
