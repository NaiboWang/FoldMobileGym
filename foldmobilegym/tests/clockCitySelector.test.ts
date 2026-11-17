import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CLOCK_CONFIG } from '../system/Clock/data';
import { CITY_LABEL_KEYS } from '../system/Clock/constants';
import { getCityLabels, getCityOptions, isCitySelectorOpen, getCitySelectorBackFallback } from '../system/Clock/citySelector';
import { formatCityDiff } from '../system/Clock/utils';
import { strings } from '../system/Clock/res/strings';
import { stringsEn } from '../system/Clock/res/strings.en';
import { NAVIGATION_DECLARATION } from '../system/Clock/navigation.declaration';
const en = { ...strings, ...stringsEn };
const ids = (query: string, locale = 'en') => getCityOptions(CLOCK_CONFIG.cities, query, locale === 'en' ? en : strings, locale).map(option => option.city.id);
const source = (file: string) => readFileSync(new URL('../system/Clock/' + file, import.meta.url), 'utf8');
describe('Clock city presentation and search', () => {
  it.each(CLOCK_CONFIG.cities.map(city => [city.id, city] as const))('localizes %s without modifying its identity or offset', (id, city) => {
    const before = JSON.stringify(city);
    expect(getCityLabels(city, strings)).toEqual({ name: city.name, country: city.country });
    const labels = getCityLabels(city, en);
    expect(labels.name).not.toBe(city.name);
    expect(labels.country).not.toBe(city.country);
    const keys = CITY_LABEL_KEYS[id as keyof typeof CITY_LABEL_KEYS];
    expect(stringsEn[keys.name]).toBeTruthy(); expect(stringsEn[keys.country]).toBeTruthy();
    expect(JSON.stringify(city)).toBe(before);
  });
  it.each(['London', 'lOnDoN', '  london  ', 'Ｌｏｎｄｏｎ', '伦敦', 'United Kingdom', '英国'])('finds the same real city for %s', query => {
    expect(ids(query)).toEqual(['london']);
    expect(ids(query, 'zh-Hans')).toEqual(['london']);
  });
  it.each([
    [480, '本地时间', 'Local time'], [540, '快1小时', '1h ahead'],
    [630, '快2小时30分钟', '2h 30 min ahead'], [0, '慢8小时', '8h behind'],
    [450, '慢0小时30分钟', '0h 30 min behind'],
  ])('localizes the unchanged offset delta %s', (offset, zh, english) => {
    const base = { getTimezoneOffset: () => -480 } as Date;
    expect(formatCityDiff(offset as number, base, strings)).toBe(zh);
    expect(formatCityDiff(offset as number, base, en)).toBe(english);
  });
  it('finds original IDs, half-hour GMT labels, country groups and multiword names', () => {
    expect(ids('newyork')).toEqual(['newyork']);
    expect(ids('New York')).toEqual(['newyork']);
    expect(ids('Los Angeles')).toEqual(['losangeles']);
    expect(ids('GMT+10:30')).toEqual(['adelaide']);
    expect(new Set(ids('United States'))).toEqual(new Set(['newyork', 'losangeles', 'albuquerque']));
    expect(ids('[')).toEqual([]); expect(ids('no matching city')).toEqual([]);
    expect(ids('  ')).toHaveLength(CLOCK_CONFIG.cities.length);
  });
  it('sorts only a derived view and supplies actual English/pinyin index groups', () => {
    const before = JSON.stringify(CLOCK_CONFIG.cities);
    const options = getCityOptions(CLOCK_CONFIG.cities, '', en, 'en');
    expect(options.map(o => o.initial)).toEqual([...options.map(o => o.initial)].sort());
    expect(getCityOptions(CLOCK_CONFIG.cities, 'Tokyo', strings, 'zh-Hans')[0].initial).toBe('D');
    expect(getCityOptions(CLOCK_CONFIG.cities, 'Paris', strings, 'zh-Hans')[0].initial).toBe('B');
    expect(getCityOptions(CLOCK_CONFIG.cities, 'Sydney', strings, 'zh-Hans')[0].initial).toBe('X');
    expect(JSON.stringify(CLOCK_CONFIG.cities)).toBe(before);
  });
  it.each(['custom-city', 'constructor', '__proto__'])('preserves display/search for replaceable unknown ID %s', id => {
    const city = { id, name: '自定义', country: '示例', gmtOffsetMinutes: 90 };
    expect(getCityLabels(city, en)).toEqual({ name: '自定义', country: '示例' });
    expect(getCityOptions([city], '自定义', en, 'en')[0]).toMatchObject({ city, initial: '#' });
  });
});
describe('Clock city selector history and isolation', () => {
  it.each([['/world', '?panel=cities', true], ['/world', '?panel=add', false], ['/alarm', '?panel=cities', false], ['/world', '', false]])('derives visibility from %s %s', (path, search, expected) => {
    expect(isCitySelectorOpen(path as string, search as string)).toBe(expected);
  });
  it('reconstructs only a missing cold-entry parent', () => {
    expect(getCitySelectorBackFallback('/world', '?panel=cities')).toBe('/world');
    expect(getCitySelectorBackFallback('/world', '?panel=cities', { pathname: '/world', search: '' })).toBeNull();
    expect(getCitySelectorBackFallback('/world', '?panel=cities', { pathname: '/alarm', search: '' })).toBe('/world');
    expect(getCitySelectorBackFallback('/alarm', '?panel=cities')).toBeNull();
  });
  it('declares the city state, push entry, four actions and unique scroll surfaces', () => {
    const route = NAVIGATION_DECLARATION.routes.find(r => r.path === '/world')!;
    expect(route.uiStates.map(s => s.search)).toEqual([{}, { selection: 'cities' }, { panel: 'cities' }]);
    expect(route.scrollContainers.map(s => s.name)).toEqual(['main', 'cityPicker', 'cityIndex']);
    expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === 'world.city.selector.open')).toMatchObject({ from: { path: '/world', search: { panel: null, selection: null } }, to: '/world', search: { panel: 'cities' }, mode: 'push' });
    const modal = route.uiStates[2];
    expect('actions' in modal && modal.actions.map(action => action.id)).toEqual(['world.city.item.add.submit', 'world.city.search.input', 'world.city.search.clear', 'world.city.index.jump']);
  });
  it('uses shared pointer ownership, isolated background, latest duplicate state and one close owner', () => {
    const page = source('pages/CitySelectorPage.tsx'), shell = source('ClockApp.tsx');
    expect(page).toContain('useSheetDrag(onClose)'); expect(page).not.toContain('window.innerHeight');
    expect(page).not.toContain('onAlreadySelected');
    expect(page).toContain('data-keep-keyboard="true"');
    expect(shell).not.toMatch(/\[showCitySelector,\s*setShowCitySelector/);
    expect(shell).toContain('inert={ringing || !!overlay.panel || showCitySelector || menuOpen || settingsOpen}');
    expect(shell).toContain('useClockStore.getState().selectedCityIds.includes(city.id)');
    expect(shell).toContain('closedCityEntry.current === location.key');
  });
});
