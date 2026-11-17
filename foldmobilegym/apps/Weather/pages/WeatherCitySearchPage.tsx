import React, { useCallback, useMemo, useState } from 'react';
import { useWeatherGestures } from '../hooks/useWeatherGestures';
import { WEATHER_CONFIG, searchCities, type SearchableCity } from '../data';
import {
  setSelectedCityId,
  addSearchHistory,
  clearSearchHistory,
} from '../utils/weatherStore';
import { useWeatherStore } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { getLocalizedWeatherCityName } from '../utils/cityNames';
import { IcNavBack, IcSearch, IcTrash } from '../res/icons';
import './weather-city-reference.css';

const MAJOR_CITIES = WEATHER_CONFIG.majorCities;

function formatResultLine(city: SearchableCity, country: string, s: typeof strings): string {
  const name = getLocalizedWeatherCityName(city, s);
  if (s.app_name !== strings.app_name) return `${name} - ${country}`;
  if (city.name === city.adm2) return `${city.name} - ${country}`;
  return `${city.name} - ${city.adm2}, ${country}`;
}

function displayGridCityName(city: (typeof MAJOR_CITIES)[number], s: typeof strings): string {
  const name = getLocalizedWeatherCityName(city, s);
  return s.app_name === strings.app_name ? name.replace(/市$/, '') : name;
}

const WeatherCitySearchPage: React.FC = () => {
  const { bindTap, bindBack, back } = useWeatherGestures();
  const s = useAppStrings(strings, stringsEn);
  const weatherState = useWeatherStore();
  const [query, setQuery] = useState('');

  const setState = useCallback((updater: (prev: typeof weatherState) => typeof weatherState) => {
    useWeatherStore.setState(updater(useWeatherStore.getState()), true);
  }, []);

  const selectedIds = useMemo(
    () => new Set<string>(weatherState.savedCities.map(city => city.id)),
    [weatherState.savedCities],
  );
  const searchResults = useMemo(() => searchCities(query), [query]);
  const hasQuery = query.trim().length > 0;
  const searchHistory = weatherState.searchHistory ?? [];

  const handleSelectAdded = useCallback((cityId: string) => {
    setState(previous => setSelectedCityId(previous, cityId));
    back(2);
  }, [back, setState]);

  const handleSearchResultTap = useCallback((city: SearchableCity) => {
    setState(previous => addSearchHistory(previous, getLocalizedWeatherCityName(city, s)));
  }, [s, setState]);

  return (
    <div className="weather-city-page weather-city-search" data-status-bar-foreground="light">
      <header className="weather-city-header">
        <button type="button" className="weather-city-icon-button" {...bindBack<HTMLButtonElement>()} aria-label={s.back}>
          <IcNavBack size={25} />
        </button>
        <h1>{s.city_search_title}</h1>
        <span className="weather-city-header-spacer" />
      </header>

      <main className="weather-city-search-content" data-scroll-container="main" data-scroll-direction="vertical">
        {hasQuery ? (
          <section className="weather-city-results" aria-live="polite">
            {searchResults.length === 0 ? (
              <p className="weather-city-empty">{s.city_search_no_results}</p>
            ) : searchResults.map(city => {
              const added = selectedIds.has(city.id);
              return (
                <button
                  key={city.id}
                  type="button"
                  className="weather-city-result-row"
                  {...(added
                    ? {
                        onClick: () => {
                          handleSearchResultTap(city);
                          handleSelectAdded(city.id);
                        },
                      }
                    : bindTap<HTMLButtonElement>('city.preview.open', {
                        params: { cityId: city.id },
                        beforeTrigger: () => handleSearchResultTap(city),
                      }))}
                >
                  <span>{formatResultLine(city, s.city_search_country, s)}</span>
                  {added ? <small>{s.city_manager_added_cities}</small> : null}
                </button>
              );
            })}
          </section>
        ) : (
          <>
            {searchHistory.length > 0 ? (
              <section className="weather-city-history">
                <div className="weather-city-section-title">
                  <h2>{s.city_search_history}</h2>
                  <button type="button" onClick={() => setState(previous => clearSearchHistory(previous))} aria-label={s.city_search_clear_history}>
                    <IcTrash size={18} />
                  </button>
                </div>
                <div className="weather-city-history-chips">
                  {searchHistory.map(name => (
                    <button type="button" key={name} onClick={() => setQuery(name)}>{name}</button>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="weather-city-recommended">
              <h2>{s.city_search_recommended}</h2>
              <div className="weather-city-grid">
                <button type="button" onClick={() => handleSelectAdded('located')}>
                  {s.city_manager_current_location}
                </button>
                {MAJOR_CITIES.map(city => {
                  const selected = selectedIds.has(city.id);
                  return (
                    <button
                      key={city.id}
                      type="button"
                      className={selected ? 'is-selected' : ''}
                      {...(selected
                        ? { onClick: () => handleSelectAdded(city.id) }
                        : bindTap<HTMLButtonElement>('city.preview.open', { params: { cityId: city.id } }))}
                    >
                      {displayGridCityName(city, s)}
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>

      <label className="weather-city-search-field">
        <IcSearch size={18} />
        <input
          id="act_find_city_key"
          type="text"
          value={query}
          placeholder={s.city_manager_search_placeholder}
          onChange={event => setQuery(event.target.value)}
        />
      </label>
    </div>
  );
};

export default WeatherCitySearchPage;
