import React, { useMemo } from 'react';
import locatedIcon from '../assets/drawables/ic_manager_item_located.svg';
import cloudDark from '../assets/weather-bg/cloud_dark.webp';
import fogDark from '../assets/weather-bg/fog_dark.webp';
import { setSelectedCityId } from '../utils/weatherStore';
import { useWeatherStore } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useWeatherGestures } from '../hooks/useWeatherGestures';
import type { TempUnit, WeatherBundle } from '../types';
import { convertTemp } from '../utils/unitConversion';
import { getLocalizedWeatherText } from '../utils/localizedText';
import { getLocalizedLocationName, getLocalizedWeatherCityName } from '../utils/cityNames';
import { IcAdd, IcNavBack, IcSearch } from '../res/icons';
import { useWeatherMinute } from '../hooks/useWeatherMinute';
import { dailyForDate, toLocalDateKey } from '../utils/dateFormat';
import './weather-city-reference.css';

type CityPreview = {
  name: string;
  weatherText: string;
  tempText: string;
  highLowText: string;
};

function previewFromBundle(name: string, bundle: WeatherBundle | undefined, tempUnit: TempUnit, s: typeof strings, todayKey: string): CityPreview {
  const now = bundle?.now;
  const day0 = dailyForDate(Array.isArray(bundle?.daily) ? bundle.daily : undefined, todayKey);
  const unitLabel = tempUnit === 'fahrenheit' ? 'F' : 'C';
  const temp = typeof now?.temp === 'string' && now.temp.length > 0
    ? `${convertTemp(now.temp, tempUnit)}°${unitLabel}`
    : `--°${unitLabel}`;
  const weatherText = getLocalizedWeatherText(now?.text, s);
  const highLowText = day0?.tempMax && day0?.tempMin
    ? `${convertTemp(day0.tempMin, tempUnit)}° / ${convertTemp(day0.tempMax, tempUnit)}°`
    : '--° / --°';
  return { name, weatherText, tempText: temp, highLowText };
}

function cardBackground(weatherText: string): string {
  const normalized = weatherText.toLowerCase();
  return normalized.includes('fog') || normalized.includes('haze') || normalized.includes('雾')
    ? fogDark
    : cloudDark;
}

function displayCityName(name: string, s: typeof strings): string {
  return s.app_name === strings.app_name ? name.replace(/市$/, '') : name;
}

const WeatherCityManagerPage: React.FC = () => {
  const { bindTap, bindBack } = useWeatherGestures();
  const s = useAppStrings(strings, stringsEn);
  const weatherState = useWeatherStore();
  const tempUnit = weatherState.settings.tempUnit;
  const todayKey = toLocalDateKey(useWeatherMinute());

  const setWeatherState = (updater: (prev: typeof weatherState) => typeof weatherState) => {
    useWeatherStore.setState(updater(useWeatherStore.getState()), true);
  };

  const cards = useMemo(() => {
    const locatedEntry = weatherState.bundlesByCityId.located;
    const locatedName = getLocalizedLocationName(locatedEntry?.locationName, s);
    const locatedPreview = previewFromBundle(locatedName, locatedEntry?.bundle, tempUnit, s, todayKey);
    const added = weatherState.savedCities.map((city) => {
      const entry = weatherState.bundlesByCityId[city.id];
      return {
        cityId: city.id,
        preview: previewFromBundle(displayCityName(getLocalizedWeatherCityName(city, s), s), entry?.bundle, tempUnit, s, todayKey),
      };
    });
    return [{ cityId: 'located', preview: locatedPreview, located: true }, ...added.map(item => ({ ...item, located: false }))];
  }, [s, tempUnit, todayKey, weatherState.bundlesByCityId, weatherState.savedCities]);

  return (
    <div className="weather-city-page weather-city-manager" data-status-bar-foreground="light">
      <header className="weather-city-header">
        <button type="button" className="weather-city-icon-button" {...bindBack<HTMLButtonElement>()} aria-label={s.back}>
          <IcNavBack size={25} />
        </button>
        <h1>{s.city_manager_title}</h1>
        <button type="button" className="weather-city-icon-button" {...bindTap<HTMLButtonElement>('city.search.open')} aria-label={s.city_search_title}>
          <IcAdd size={29} />
        </button>
      </header>

      <main className="weather-city-card-list" data-scroll-container="main" data-scroll-direction="vertical">
        {cards.map(({ cityId, preview, located }) => (
          <button
            type="button"
            key={cityId}
            className="weather-city-card"
            style={{ backgroundImage: `linear-gradient(90deg, rgba(8,12,25,.3), rgba(8,12,25,.06)), url(${cardBackground(preview.weatherText)})` }}
            {...bindBack<HTMLButtonElement>({
              beforeTrigger: () => setWeatherState(previous => setSelectedCityId(previous, cityId)),
            })}
          >
            <span className="weather-city-card-name">
              {preview.name}
              {located ? <img src={locatedIcon} alt="" /> : null}
            </span>
            <span className="weather-city-card-temperature">{preview.tempText}</span>
            <span className="weather-city-card-weather">{preview.weatherText}</span>
            <span className="weather-city-card-range">{preview.highLowText}</span>
          </button>
        ))}
      </main>

      <button type="button" className="weather-city-search-entry" {...bindTap<HTMLButtonElement>('city.search.open')}>
        <IcSearch size={18} />
        <span>{s.city_manager_search_placeholder}</span>
      </button>
    </div>
  );
};

export default WeatherCityManagerPage;
