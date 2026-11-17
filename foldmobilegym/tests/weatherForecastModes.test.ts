import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NAVIGATION_DECLARATION } from '../apps/Weather/navigation.declaration';
import { isWeatherHomeView, weatherHomeMenuFallback } from '../apps/Weather/utils/homeView';
import { strings } from '../apps/Weather/res/strings';
import { stringsEn } from '../apps/Weather/res/strings.en';
const source = readFileSync(new URL('../apps/Weather/components/DailyForecastShort.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../apps/Weather/pages/weather-home-reference.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../apps/Weather/WeatherApp.tsx', import.meta.url), 'utf8');

describe('Weather user-selected forecast view', () => {
  it('declares both actual view transitions as replacement URL state, not business settings', () => {
    const list = NAVIGATION_DECLARATION.transitions.find(t => t.id === 'forecast.layout.list');
    const chart = NAVIGATION_DECLARATION.transitions.find(t => t.id === 'forecast.layout.chart');
    expect(list).toMatchObject({ from: { path: '/', search: { menu: null, forecastLayout: null } }, to: '/', search: { forecastLayout: 'list' }, mode: 'replace' });
    expect(chart).toMatchObject({ from: { path: '/', search: { menu: null, forecastLayout: 'list' } }, to: '/', search: { forecastLayout: null }, mode: 'replace' });
    expect(app).toContain("searchParams.get('forecastLayout') === 'list' ? 'list' : 'chart'");
    const states = NAVIGATION_DECLARATION.routes[0].uiStates;
    expect(states).toContainEqual(expect.objectContaining({ search: { forecastLayout: 'list' } }));
    expect(states).toContainEqual(expect.objectContaining({ search: { menu: 'more', forecastLayout: 'list' } }));
  });

  it('keeps selected view through the more-menu URL and localizes the real controls', () => {
    expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === 'menu.open')).toHaveProperty('preserveParams', ['forecastLayout']);
    expect(strings.forecast_layout_chart).toBe('折线图');
    expect(strings.forecast_layout_list).toBe('列表');
    expect(stringsEn.forecast_layout_chart).toBe('Chart view');
    expect(stringsEn.forecast_layout_list).toBe('List view');
    expect(source).toContain('aria-pressed={layout');
    expect(source).toContain('aria-label={s.forecast_layout_label}');
    expect(app).toContain('inert={isMenuOpen}');
  });

  it('hides by explicit mode without tying the selected display to container width', () => {
    expect(source).toContain("hidden={layout !== 'chart'}");
    expect(source).toContain("hidden={layout !== 'list'}");
    expect(css).not.toMatch(/\.weather-home-daily-(?:chart|list)\s*\{\s*display:/);
    expect(css).toContain('.weather-home-daily-chart[hidden], .weather-home-daily-list[hidden]');
    expect(source).toContain('model.highPoints[index].y - 24');
    expect(source).toContain('model.lowPoints[index].y + 8');
  });
});

describe('Weather root Back owns the home view rather than duplicate root entries', () => {
  it.each(['', '?forecastLayout=list'])('leaves the home view with %s on system Back', search => {
    expect(isWeatherHomeView('/', search)).toBe(true);
    expect(isWeatherHomeView('/forecast/daily', search)).toBe(false);
  });
  it.each(['?menu=more', '?menu=more&forecastLayout=list'])('recognizes the real menu overlay %s', search => {
    expect(isWeatherHomeView('/', search)).toBe(false);
    const base = search.includes('forecastLayout=list') ? '/?forecastLayout=list' : '/';
    expect(weatherHomeMenuFallback('/', search)).toBe(base);
    expect(weatherHomeMenuFallback('/', search, {pathname:'/cities', search:''})).toBe(base);
  });
  it('pops a matching menu parent but safely replaces a missing or different view parent', () => {
    expect(weatherHomeMenuFallback('/', '?menu=more&forecastLayout=list', {pathname:'/', search:'?forecastLayout=list'})).toBeNull();
    expect(weatherHomeMenuFallback('/', '?menu=more&forecastLayout=list', {pathname:'/', search:''})).toBe('/?forecastLayout=list');
    expect(weatherHomeMenuFallback('/', '?menu=more', {pathname:'/', search:'?forecastLayout=list'})).toBe('/');
    expect(weatherHomeMenuFallback('/', '?forecastLayout=list')).toBeNull();
    expect(weatherHomeMenuFallback('/settings', '?menu=more')).toBeNull();
  });
});
