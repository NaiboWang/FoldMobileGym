import type { WeatherDaily } from '../types';
import * as TimeService from '../../../os/TimeService';

// Date keys are calendar dates, not instants; compare in UTC to avoid DST gaps.
const calendarDay = (value: string): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const date = TimeService.fromTimestamp(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.getTime();
};

export function buildShortForecastDays(daily: WeatherDaily[], yesterday?: WeatherDaily | null): WeatherDaily[] {
  const forecast = daily?.slice(0, 8) ?? [];
  const first = forecast[0] && calendarDay(forecast[0].fxDate);
  const previous = yesterday && calendarDay(yesterday.fxDate);
  return yesterday && first != null && previous != null && first - previous === 86400000
    ? [yesterday, ...forecast].slice(0, 8) : forecast;
}
