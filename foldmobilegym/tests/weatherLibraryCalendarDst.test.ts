import { afterEach, describe, expect, it } from 'vitest';
import * as TimeService from '../os/TimeService';
import { materializeAirForecast, materializeBundle, materializeHistorical } from '../apps/Weather/utils/weatherLibrary';
import type { AirQualityForecastDay, WeatherBundle, WeatherDaily } from '../apps/Weather/types';

const raw = {
  now: {}, daily: Array.from({ length: 4 }, (_, index) => ({ fxDate: `original-${index}` })),
  hourly: [{ fxTime: '' }, { fxTime: '' }], indices: [], warnings: [], airQuality: null, minutely: null,
} as unknown as WeatherBundle;
const air = Array.from({ length: 4 }, () => ({} as AirQualityForecastDay));
const setTime = (value: string) => TimeService.initTimeService({ mode: 'simulated', simulatedTime: value, flowing: false });
afterEach(() => TimeService.useRealTime());

describe('weather local calendar materialization', () => {
  it('handles year boundaries without changing fixture data or hourly elapsed intervals', () => {
    TimeService.initTimeService({ mode: 'simulated', simulatedTime: new Date(2026, 11, 31, 12, 30).getTime(), flowing: false });
    const result = materializeBundle(raw);
    expect(result.daily.map(day => day.fxDate)).toEqual(['2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
    expect(Date.parse(result.hourly[1].fxTime) - Date.parse(result.hourly[0].fxTime)).toBe(3_600_000);
    expect(raw.daily[0].fxDate).toBe('original-0');
  });
});

describe.skipIf(process.env.TZ !== 'America/New_York')('New York weather dates across DST', () => {
  it('keeps daily and air-quality forecasts consecutive over autumn fallback', () => {
    setTime('2026-11-01T00:30:00-04:00');
    expect(materializeBundle(raw).daily.map(day => day.fxDate)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
    expect(materializeAirForecast(air).map(day => day.forecastStartTime)).toEqual(['2026-11-01T00:00:00', '2026-11-02T00:00:00', '2026-11-03T00:00:00', '2026-11-04T00:00:00']);
    expect(materializeAirForecast(air)[1].forecastEndTime).toBe('2026-11-02T23:59:59');
  });
  it('uses the preceding calendar date after the spring change', () => {
    setTime('2026-03-09T00:30:00-04:00');
    expect(materializeHistorical({ fxDate: 'original' } as WeatherDaily)?.fxDate).toBe('2026-03-08');
    expect(materializeHistorical(null)).toBeNull();
  });
});

describe.skipIf(process.env.TZ !== 'Australia/Lord_Howe')('Lord Howe half-hour DST', () => {
  it('keeps daily forecasts consecutive during the autumn transition', () => {
    setTime('2026-04-05T00:15:00+11:00');
    expect(materializeBundle(raw).daily.map(day => day.fxDate)).toEqual(['2026-04-05', '2026-04-06', '2026-04-07', '2026-04-08']);
    expect(materializeAirForecast(air)[1].forecastStartTime).toBe('2026-04-06T00:00:00');
  });
  it('uses the prior date after the spring transition', () => {
    setTime('2026-10-05T00:15:00+11:00');
    expect(materializeHistorical({ fxDate: 'original' } as WeatherDaily)?.fxDate).toBe('2026-10-04');
  });
});
