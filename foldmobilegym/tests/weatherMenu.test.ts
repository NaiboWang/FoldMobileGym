import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { getWeatherHomeMenu, isWeatherHomeView, weatherHomeMenuFallback } from '../apps/Weather/utils/homeView';
import { NAVIGATION_DECLARATION } from '../apps/Weather/navigation.declaration';
import { strings } from '../apps/Weather/res/strings';
import { stringsEn } from '../apps/Weather/res/strings.en';
const source = readFileSync(new URL('../apps/Weather/components/WeatherHomeMenu.tsx', import.meta.url), 'utf8');
describe('Weather owned menu hierarchy', () => {
  it.each(['', '?forecastLayout=list'])('owns nested menu history over %s', search => {
    const suffix = search ? '&forecastLayout=list' : '';
    expect(getWeatherHomeMenu('/', '?menu=temperature'+suffix)).toBe('temperature');
    expect(isWeatherHomeView('/', '?menu=temperature'+suffix)).toBe(false);
    expect(weatherHomeMenuFallback('/', '?menu=temperature'+suffix)).toBe('/?menu=more'+suffix);
    expect(weatherHomeMenuFallback('/', '?menu=temperature'+suffix, {pathname:'/',search:'?menu=more'+suffix})).toBeNull();
    expect(weatherHomeMenuFallback('/', '?menu=more'+suffix)).toBe(search ? '/?forecastLayout=list' : '/');
  });
  it('rejects foreign paths and reconstructs a missing or wrong submenu owner', () => {
    expect(getWeatherHomeMenu('/settings','?menu=temperature')).toBeNull();
    expect(weatherHomeMenuFallback('/', '?menu=temperature&forecastLayout=list', {pathname:'/',search:'?menu=more'})).toBe('/?menu=more&forecastLayout=list');
    expect(weatherHomeMenuFallback('/', '?menu=temperature', {pathname:'/settings',search:''})).toBe('/?menu=more');
  });
  it('declares real unique selection actions in both foreground view contexts', () => {
    const states = NAVIGATION_DECLARATION.routes[0].uiStates;
    const ids = states.flatMap(s => 'actions' in s ? s.actions.map(a => a.id) : []);
    expect(ids).toHaveLength(4); expect(new Set(ids).size).toBe(4);
    expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === 'menu.temperature.open')).toMatchObject({from:{path:'/',search:{menu:'more'}},to:'/',search:{menu:'temperature'},mode:'push'});
  });
  it('localizes unsupported boundaries rather than fabricating an interval or unread count', () => {
    expect(strings.menu_desktop_weather).toBe('桌面天气');
    expect(strings.menu_weather_news).toBe('天气资讯');
    expect(stringsEn.menu_unavailable).toBe('Not supported yet');
    expect(source.match(/disabled title=\{s.menu_unavailable\}/g)).toHaveLength(3);
    expect(source).not.toContain('35');
    expect(source).not.toContain('1小时');
  });
  it('guards stale, duplicate and background callbacks using the live route and Activity owner', () => {
    expect(source).toContain('live.key === location.key');
    expect(source).toContain('active?.activityId === activityId');
    expect(source).toContain('!os?.isLauncherVisible');
    expect(source).toContain('closed.current === location.key');
    expect(source).toContain('opening.current === location.key');
  });
});
