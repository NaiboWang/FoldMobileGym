import { describe, expect, it } from 'vitest';
import { buildShortForecastDays } from '../apps/Weather/utils/shortForecast';
import type { WeatherDaily } from '../apps/Weather/types';
const day = (fxDate: string) => ({ fxDate } as WeatherDaily);
describe('recorded recent forecast ordering', () => {
  const forecast = ['2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17'].map(day);
  it('prepends available previous-day data and retains available forecast days', () => {
    expect(buildShortForecastDays(forecast, day('2026-10-12')).map(d => d.fxDate)).toEqual(['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17']);
  });
  it('limits the window to eight days including an actual yesterday', () => {
    const longForecast = [...forecast, day('2026-10-18'), day('2026-10-19'), day('2026-10-20'), day('2026-10-21')];
    expect(buildShortForecastDays(longForecast, day('2026-10-12')).map(d => d.fxDate)).toEqual(['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18','2026-10-19']);
    expect(buildShortForecastDays(longForecast)).toHaveLength(8);
  });
  it('does not manufacture yesterday or insert stale/duplicate historical data', () => {
    for (const historical of [null, day('2026-10-10'), day('2026-10-13'), day('invalid')]) {
      expect(buildShortForecastDays(forecast, historical).map(d => d.fxDate)).toEqual(forecast.map(d => d.fxDate));
    }
  });
  it('handles month and leap-year boundaries', () => {
    expect(buildShortForecastDays([day('2024-03-01')],day('2024-02-29')).map(d=>d.fxDate)).toEqual(['2024-02-29','2024-03-01']);
    expect(buildShortForecastDays([day('2025-03-01')],day('2025-02-29')).map(d=>d.fxDate)).toEqual(['2025-03-01']);
  });
});
