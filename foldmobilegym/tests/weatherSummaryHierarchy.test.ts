import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { strings } from '../apps/Weather/res/strings';
vi.mock('../os/useAppStrings', () => ({ useAppStrings: () => strings }));
vi.mock('../os/locale', () => ({ useLocale: () => 'zh-Hans' }));
vi.mock('../apps/Weather/hooks/useWeatherMinute', () => ({ useWeatherMinute: () => Date.now() }));
vi.mock('../apps/Weather/state', () => ({ useWeatherStore: (selector: (s: unknown) => unknown) => selector({settings: {tempUnit: 'celsius'}}) }));
import { HourlyForecastChart } from '../apps/Weather/components/HourlyForecastChart';

const home = readFileSync(new URL('../apps/Weather/WeatherApp.tsx', import.meta.url), 'utf8');
describe('recorded precipitation summary hierarchy', () => {
  it('places the detail grid after the daily forecast without a duplicate precipitation card', () => {
    expect(home.indexOf('<DailyForecastShort')).toBeGreaterThan(home.indexOf('<HourlyForecastChart'));
    expect(home.indexOf('<DetailsGrid')).toBeGreaterThan(home.indexOf('<DailyForecastShort'));
    expect(home.includes('<PrecipitationCard')).toBe(false);
  });
  it('keeps a real summary even when hourly temperatures are absent', () => {
    const html = renderToStaticMarkup(React.createElement(HourlyForecastChart, {hourly: [], minutelySummary: '未来两小时有大雨'}));
    expect(html).toContain('未来两小时有大雨');
    expect(html).not.toContain('data-weather-hourly-scroll');
  });
  it('does not fabricate a summary when there are no forecast slots or summary', () => {
    expect(renderToStaticMarkup(React.createElement(HourlyForecastChart, {hourly: [], minutelySummary: '   '}))).toBe('');
  });
});
