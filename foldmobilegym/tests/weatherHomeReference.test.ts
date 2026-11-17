import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { strings } from '../apps/Weather/res/strings';
import { stringsEn } from '../apps/Weather/res/strings.en';

const app = readFileSync(new URL('../apps/Weather/WeatherApp.tsx', import.meta.url), 'utf8');
const daily = readFileSync(new URL('../apps/Weather/components/DailyForecastShort.tsx', import.meta.url), 'utf8');
const warning = readFileSync(new URL('../apps/Weather/components/WarningCard.tsx', import.meta.url), 'utf8');
const navigation = readFileSync(new URL('../apps/Weather/navigation.declaration.ts', import.meta.url), 'utf8');

describe('Weather recorded home hierarchy', () => {
  it('keeps hourly weather before the responsive recent forecast', () => {
    expect(app.indexOf('<HourlyForecastChart')).toBeLessThan(app.indexOf('<DailyForecastShort'));
    expect(daily).toContain('buildShortForecastDays(daily ?? [], yesterday)');
    expect(daily).toContain('weather-home-daily-chart');
    expect(daily).toContain('weather-home-daily-list');
    expect(warning).toContain('return null;');
  });

  it('localizes the recorded forecast title and declares both real home scrollers', () => {
    expect(strings.recent_forecast_title).toBe('近7日天气');
    expect(stringsEn.recent_forecast_title).toBe('7-day forecast');
    expect(navigation).toContain("name: 'main', direction: 'vertical'");
    expect(navigation).toContain("name: 'cities', direction: 'horizontal'");
  });
});