import { useCalendarMainScrollName } from './CalendarSurfaceContext';
import React from 'react';
import { generateWeekDays, getWeekNumber, getLunarInfo, isSameDay, formatCalendarDateKey } from '../utils/calendarUtils';
import { buildWeekEventLayout, formatWeekMinute } from '../utils/weekEventLayout';
import { useCalendarWeekViewports, retainWeekOffset } from './CalendarWeekViewport';
import type { CalendarEvent } from '../types';
import { dimens } from '../res/dimens';
import * as TimeService from '@/os/TimeService';
import { useSystemEvent } from '@/os/hooks/useSystemEvent';
import { ACTION_TIME_SET, ACTION_TIME_TICK } from '@/os/BroadcastBus';
import { useAppStrings } from '@/os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

interface CalendarWeekViewProps {
  currentDate: Date;
  events: readonly CalendarEvent[];
  dayTapProps: (date: Date) => React.ButtonHTMLAttributes<HTMLButtonElement>;
  eventTapProps: (event: CalendarEvent, dateKey: string) => React.ButtonHTMLAttributes<HTMLButtonElement>;
  weekStartDay?: 'monday' | 'sunday';
}

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({ currentDate, events, dayTapProps, eventTapProps, weekStartDay = 'monday' }) => {
    const mainScrollName = useCalendarMainScrollName();
  const s = useAppStrings(strings, stringsEn), snapshots = useCalendarWeekViewports();
  const labels = weekStartDay === 'sunday'
    ? [s.weekday_sun, s.weekday_mon, s.weekday_tue, s.weekday_wed, s.weekday_thu, s.weekday_fri, s.weekday_sat]
    : [s.weekday_mon, s.weekday_tue, s.weekday_wed, s.weekday_thu, s.weekday_fri, s.weekday_sat, s.weekday_sun];
  const days = generateWeekDays(currentDate, weekStartDay, labels);
  const layout = buildWeekEventLayout(events, days.map(day => day.date));
  const weekKey = layout[0].dateKey, dateKey = formatCalendarDateKey(currentDate);
  const columns = React.useRef<HTMLDivElement>(null), main = React.useRef<HTMLDivElement>(null), allDay = React.useRef<HTMLDivElement>(null);
  const geometry = React.useRef(''), resizing = React.useRef(false), resizeFrame = React.useRef<number | undefined>(undefined);
  const [now, setNow] = React.useState(() => TimeService.getDate());
  const updateNow = React.useCallback(() => setNow(TimeService.getDate()), []);
  useSystemEvent(ACTION_TIME_SET, updateNow); useSystemEvent(ACTION_TIME_TICK, updateNow);
  const nowKey = formatCalendarDateKey(now), nowMinute = now.getHours() * 60 + now.getMinutes();
  const pxPerMinute = dimens.weekHourHeight / 60;
  const gridColumns = `${dimens.weekGutterWidth}px repeat(7, minmax(0, 1fr))`;
  const earliest = Math.min(...layout.flatMap(day => day.timed.map(event => event.startMinutes)));
  const initialTop = Math.max(0, (Number.isFinite(earliest) ? earliest - 60 : 8 * 60) * pxPerMinute);
  const selectedIndex = Math.max(0, layout.findIndex(day => day.dateKey === dateKey));
  const desiredLeft = Math.max(0, dimens.weekGutterWidth + (selectedIndex + .5) * dimens.weekColumnMinWidth - (columns.current?.clientWidth ?? 320) / 2);

  const remember = () => {
    const previous = snapshots.get(weekKey);
    const vertical = main.current, horizontal = columns.current, allDayList = allDay.current;
    if (horizontal) horizontal.style.setProperty('--calendar-week-scroll-left', `${horizontal.scrollLeft}px`);
    if (horizontal && vertical) {
      const current = `${horizontal.clientWidth}:${vertical.clientHeight}`;
      if (geometry.current && geometry.current !== current) { resizing.current = true; return; }
      if (resizing.current) return;
    }
    snapshots.set(weekKey, {
      top: vertical ? retainWeekOffset(previous?.top ?? initialTop, vertical.scrollTop, vertical.scrollHeight - vertical.clientHeight) : previous?.top ?? initialTop,
      left: horizontal ? retainWeekOffset(previous?.left ?? desiredLeft, horizontal.scrollLeft, horizontal.scrollWidth - horizontal.clientWidth) : previous?.left ?? desiredLeft,
      allDayTop: allDayList ? retainWeekOffset(previous?.allDayTop, allDayList.scrollTop, allDayList.scrollHeight - allDayList.clientHeight) : previous?.allDayTop ?? 0,
    });
    if (snapshots.size > 32) snapshots.delete(snapshots.keys().next().value!);
  };
  // Explicit entry snapshot: do not reinitialize the remembered week on a locale/event/editor render.
  const restoreInput = React.useRef({ initialTop, desiredLeft, remember });
  restoreInput.current = { initialTop, desiredLeft, remember };
  React.useLayoutEffect(() => {
    const { initialTop, desiredLeft, remember } = restoreInput.current;
    const horizontal = columns.current, vertical = main.current, allDayList = allDay.current;
    if (!horizontal || !vertical) return;
    geometry.current = `${horizontal.clientWidth}:${vertical.clientHeight}`; resizing.current = false;
    const cached = snapshots.get(weekKey);
    vertical.scrollTop = cached?.top ?? initialTop;
    if (allDayList) allDayList.scrollTop = cached?.allDayTop ?? 0;
    const restoreColumns = () => {
      horizontal.scrollLeft = Math.min(snapshots.get(weekKey)?.left ?? desiredLeft, Math.max(0, horizontal.scrollWidth - horizontal.clientWidth));
      horizontal.style.setProperty('--calendar-week-scroll-left', `${horizontal.scrollLeft}px`);
      vertical.scrollTop = Math.min(snapshots.get(weekKey)?.top ?? initialTop, Math.max(0, vertical.scrollHeight - vertical.clientHeight));
    };
    restoreColumns(); remember();
    const onResize = () => {
      resizing.current = true;
      geometry.current = `${horizontal.clientWidth}:${vertical.clientHeight}`;
      restoreColumns();
      if (resizeFrame.current !== undefined) cancelAnimationFrame(resizeFrame.current);
      // Programmatic restoration can emit scroll after the ResizeObserver frame.
      // Keep those transient/clamped offsets out of the remembered user viewport.
      resizeFrame.current = requestAnimationFrame(() => {
        resizeFrame.current = requestAnimationFrame(() => {
          if (`${horizontal.clientWidth}:${vertical.clientHeight}` !== geometry.current) onResize();
          else resizing.current = false;
        });
      });
    };
    const resize = new ResizeObserver(onResize); resize.observe(horizontal); resize.observe(vertical);
    return () => { remember(); resize.disconnect(); if (resizeFrame.current !== undefined) cancelAnimationFrame(resizeFrame.current); };
    // Restore on entering a week, not every event/time/locale/posture render.
  }, [weekKey, snapshots]);

  const hasAllDay = layout.some(day => day.allDay.length > 0), empty = layout.every(day => !day.timed.length && !day.allDay.length);
  return <div className="calendar-week-view">
    <div ref={columns} className="calendar-week-columns" data-scroll-container="weekColumns" data-scroll-direction="horizontal" onScroll={remember}>
      <div className="calendar-week-canvas" style={{ minWidth: dimens.weekGutterWidth + 7 * dimens.weekColumnMinWidth }}>
        <div className="calendar-week-header" style={{ gridTemplateColumns: gridColumns }}>
          <span title={s.week_number.replace('{{week}}', String(getWeekNumber(currentDate)))}>{getWeekNumber(currentDate)}</span>
          {days.map((day, index) => {
            const selected = isSameDay(day.date, currentDate), key = layout[index].dateKey;
            return <button key={key} type="button" {...dayTapProps(day.date)} aria-pressed={selected}
              aria-label={`${key} ${day.weekDay}`} aria-current={day.isToday ? 'date' : undefined} data-calendar-week-date={key} data-calendar-week-today={day.isToday}>
              <span>{day.weekDay}</span><strong>{day.date.getDate()}</strong><small>{getLunarInfo(day.date).label}</small>
            </button>;
          })}
        </div>
        {hasAllDay && <div ref={allDay} className="calendar-week-allday" style={{ gridTemplateColumns: gridColumns }}
          data-scroll-container="weekAllDay" data-scroll-direction="vertical" onScroll={remember}>
          <span className="calendar-week-allday-label">{s.label_all_day_value}</span>
          {layout.map(day => <div key={day.dateKey}>{day.allDay.map(event =>
            <button key={event.id} type="button" className="calendar-week-all-event" {...eventTapProps(event, day.dateKey)}
              data-calendar-week-event={event.id} data-calendar-week-day={day.dateKey}
              aria-label={`${day.dateKey} ${s.label_all_day_value} ${event.title}`} title={event.title}>{event.title}</button>)}</div>)}
        </div>}
        {empty && <div className="calendar-week-empty">{s.week_empty}</div>}
        <div ref={main} className="calendar-week-time-scroll" data-scroll-container={mainScrollName} data-scroll-direction="vertical" onScroll={remember}>
          <div className="calendar-week-time" style={{ height: 24 * dimens.weekHourHeight }}>
            <div className="calendar-week-gutter" style={{ width: dimens.weekGutterWidth }} aria-hidden="true" />
            {Array.from({ length: 24 }, (_, hour) => <div key={hour} className="calendar-week-hour" data-hour={hour} style={{ top: hour * dimens.weekHourHeight }}>
              <span style={{ width: dimens.weekGutterWidth }}>{formatWeekMinute(hour * 60)}</span><i />
            </div>)}
            <div className="calendar-week-days" style={{ left: dimens.weekGutterWidth }}>
              {layout.map(day => <div key={day.dateKey} className="calendar-week-day-column">
                {day.timed.map(segment => {
                  const label = `${formatWeekMinute(segment.startMinutes)}–${formatWeekMinute(segment.endMinutes)}`;
                  const continues = segment.continuesBefore || segment.continuesAfter;
                  return <button key={segment.event.id} type="button" className="calendar-week-timed-event"
                    {...eventTapProps(segment.event, day.dateKey)} data-calendar-week-event={segment.event.id} data-calendar-week-day={day.dateKey}
                    aria-label={`${day.dateKey} ${segment.event.title} ${label}${continues ? ' ' + s.week_continues : ''}`}
                    title={`${segment.event.title} · ${label}`}
                    style={{ top: segment.topMinutes * pxPerMinute, height: (segment.bottomMinutes - segment.topMinutes) * pxPerMinute,
                      left: `calc(${segment.lane * 100 / segment.laneCount}% + 2px)`, width: `calc(${100 / segment.laneCount}% - 4px)` }}>
                    <strong>{segment.event.title}</strong><small>{label}</small>{continues && <span aria-hidden="true">↔</span>}
                  </button>;
                })}
                {day.dateKey === nowKey && <div className="calendar-week-now" style={{ top: nowMinute * pxPerMinute }} aria-hidden="true"><span>{formatWeekMinute(nowMinute)}</span></div>}
              </div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>;
};
