import { CITY_LABEL_KEYS } from './constants';
import { strings } from './res/strings';
import { stringsEn } from './res/strings.en';
import { formatGmtLabel } from './utils';
import type { WorldCity } from './types';

type CityStrings = Record<keyof typeof strings, string>;
const englishStrings = { ...strings, ...stringsEn };
const cityKeys = (id: string) => Object.prototype.hasOwnProperty.call(CITY_LABEL_KEYS, id)
  ? CITY_LABEL_KEYS[id as keyof typeof CITY_LABEL_KEYS] : undefined;
const normalize = (value: string) => value.normalize('NFKC').trim().toLowerCase();

export function getCityLabels(city: WorldCity, s: CityStrings) {
  const keys = cityKeys(city.id);
  return keys ? { name: s[keys.name], country: s[keys.country] } : { name: city.name, country: city.country };
}

/** Sort/filter presentation only, never rewrite or reorder persisted city IDs. */
export function getCityOptions(cities: WorldCity[], query: string, s: CityStrings, locale: string) {
  const q = normalize(query);
  const collator = new Intl.Collator(locale === 'en' ? 'en' : 'zh-Hans-CN-u-co-pinyin');
  return cities.map(city => {
    const labels = getCityLabels(city, s);
    const english = getCityLabels(city, englishStrings);
    const keys = cityKeys(city.id);
    const initial = locale === 'en' ? labels.name[0]?.toUpperCase() : keys?.initialZh;
    return { city, ...labels, initial: initial && /^[A-Z]$/.test(initial) ? initial : '#',
      searchable: normalize([city.id, city.name, city.country, labels.name, labels.country, english.name, english.country, formatGmtLabel(city.gmtOffsetMinutes)].join(' ')) };
  }).filter(option => !q || option.searchable.includes(q)).sort((a, b) =>
    a.initial.localeCompare(b.initial) || collator.compare(a.name, b.name));
}

export function isCitySelectorOpen(pathname: string, search: string) {
  return pathname === '/world' && new URLSearchParams(search).get('panel') === 'cities';
}

export function getCitySelectorBackFallback(pathname: string, search: string, previous?: { pathname: string; search: string }) {
  if (!isCitySelectorOpen(pathname, search)) return null;
  return previous?.pathname === '/world' && !isCitySelectorOpen(previous.pathname, previous.search) ? null : '/world';
}
