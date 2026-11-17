import * as TimeService from '../../../os/TimeService';
import type { WeatherDaily } from '../types';

const clockMinutes = (value: string | undefined): number | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
};

/** Only use a night forecast for today when both solar times and a night icon are supplied. */
export function isNightForecast(day: WeatherDaily, todayKey: string, timestamp: number): boolean {
  if (day.fxDate !== todayKey || !day.iconNight?.trim()) return false;
  const rise = clockMinutes(day.sunrise), set = clockMinutes(day.sunset);
  if (rise === null || set === null || set <= rise) return false;
  const current = TimeService.fromTimestamp(timestamp);
  const minutes = current.getHours() * 60 + current.getMinutes();
  return minutes < rise || minutes >= set;
}
