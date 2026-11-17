import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import type { WeatherDaily } from '../apps/Weather/types';
vi.mock('../apps/Weather/state', () => ({ useWeatherStore: (selector: (state: unknown) => unknown) => selector({settings:{tempUnit:'celsius'}}) }));
vi.mock('../apps/Weather/hooks/useWeatherMinute', () => ({ useWeatherMinute: () => new Date(2026, 9, 13, 12).getTime() }));
vi.mock('@/os/locale', () => ({ useLocale: () => 'zh-Hans' }));
import { DailyForecastShort } from '../apps/Weather/components/DailyForecastShort';
const day = (fxDate: string) => ({fxDate,tempMax:'25',tempMin:'18',textDay:'晴',textNight:'晴',iconDay:'100',iconNight:'150'} as WeatherDaily);
const daily=['2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17'].map(day);
const render = (yesterday: WeatherDaily | null) => renderToStaticMarkup(React.createElement(DailyForecastShort,{daily,yesterday,layout:'chart',chartButtonProps:{},listButtonProps:{}}));
describe('recent forecast rendering', () => {
  it('shows actual previous day dimmed before Today, with dotted connector', () => {
    const html=render(day('2026-10-12'));
    expect(html).toContain('data-weather-day-date="2026-10-12" data-weather-day-past="true"');
    expect(html.indexOf('data-weather-day-date="2026-10-12"')).toBeLessThan(html.indexOf('data-weather-day-date="2026-10-13"'));
    expect(html).toContain('stroke-dasharray="2 5"');
    expect(html).toContain('<strong>今天</strong>');
  });
  it('aligns eight chart columns with the actual SVG date window', () => {
    const more = [...daily, day('2026-10-18'), day('2026-10-19'), day('2026-10-20')];
    const html = renderToStaticMarkup(React.createElement(DailyForecastShort, { daily: more, yesterday: day('2026-10-12'), layout: 'chart', chartButtonProps: {}, listButtonProps: {} }));
    expect(html).toContain('viewBox="0 0 800 250"');
    expect(html).toMatch(/grid-template-columns:repeat\(8,\s*minmax\(0,\s*1fr\)\)/);
    expect(html).toContain('data-weather-day-date="2026-10-19"');
    expect(html).not.toContain('data-weather-day-date="2026-10-20"');
  });
  it('starts with today and has no dotted connector if history is missing', () => {
    const html=render(null);
    expect(html).not.toContain('2026-10-12');
    expect(html).not.toContain('stroke-dasharray="2 5"');
    expect(html).toContain('<strong>今天</strong>');
  });
});
