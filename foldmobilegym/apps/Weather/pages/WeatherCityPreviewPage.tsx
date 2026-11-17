import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams, UNSAFE_NavigationContext } from 'react-router-dom';
import { WEATHER_CITY_BY_ID } from '../data';
import { getWeatherBundle } from '../services/weatherService';
import type { WeatherBundle } from '../types';
import {
  upsertSavedCity,
  setSelectedCityId,
  setStoredBundle,
} from '../utils/weatherStore';
import { useWeatherStore } from '../state';
import { colors } from '../res/colors';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useWeatherGestures } from '../hooks/useWeatherGestures';
import WeatherDynamicBackground from '../components/WeatherDynamicBackground';
import { convertTemp } from '../utils/unitConversion';
import { normalizeAqiLevel, getAqiLevelLabel } from '../utils/airQuality';
import { getLocalizedMinutelySummary, getLocalizedWeatherText } from '../utils/localizedText';
import { HourlyForecastChart } from '../components/HourlyForecastChart';
import { DailyForecastShort } from '../components/DailyForecastShort';
import { DetailsGrid } from '../components/DetailsGrid';
import { LifeIndices } from '../components/LifeIndices';
import { WarningCard } from '../components/WarningCard';
import './weather-city-preview-reference.css';
import { getLocalizedWeatherCityName } from '../utils/cityNames';
import { findLibraryHistorical } from '../utils/weatherLibrary';
import { useWeatherMinute } from '../hooks/useWeatherMinute';
import { dailyForDate, toLocalDateKey } from '../utils/dateFormat';

const WeatherCityPreviewPage: React.FC = () => {
  const { bindBack, bindTap, back, go } = useWeatherGestures();
  const s = useAppStrings(strings, stringsEn);
  const todayKey = toLocalDateKey(useWeatherMinute());
  const tempUnit = useWeatherStore((st) => st.settings.tempUnit);
  const [searchParams] = useSearchParams();
  const { navigator } = useContext(UNSAFE_NavigationContext);

  const cityId = searchParams.get('cityId') ?? '';
  const cityDef = useMemo(() => WEATHER_CITY_BY_ID[cityId], [cityId]);

  const [preview, setPreview] = useState<{ cityId: string; bundle: WeatherBundle } | null>(null);
  const bundle = preview?.cityId === cityDef?.id ? preview.bundle : null;
  const now = bundle?.now;
  const hasCurrentWeather = Boolean(now && (
    (typeof now.temp === 'string' && now.temp.trim()) ||
    (typeof now.text === 'string' && now.text.trim())
  ));
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [forecastLayout, setForecastLayout] = useState<'chart' | 'list'>('chart');

  useEffect(() => {
    if (!cityDef) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const lonLat = `${cityDef.lon},${cityDef.lat}`;
        const result = await getWeatherBundle(lonLat, {
          dailysteps: 15,
          hourlysteps: 24,
          alert: true,
          cityId: cityDef.id,
        });
        if (!cancelled) setPreview({ cityId: cityDef.id, bundle: result });
      } catch (error) {
        if (!cancelled) console.error('Failed to fetch preview weather', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cityDef, retryAttempt]);

  useEffect(() => {
    if (!cityDef || !bundle || !hasCurrentWeather) return;
    useWeatherStore.setState((prev) => setStoredBundle(prev, cityDef.id, {
      lonLat: `${cityDef.lon},${cityDef.lat}`,
      bundle,
    }), true);
  }, [bundle, cityDef, hasCurrentWeather]);

  const handleAdd = () => {
    if (!cityDef || !bundle || !hasCurrentWeather || adding) return;
    setAdding(true);

    let state = useWeatherStore.getState();
    state = upsertSavedCity(state, {
      id: cityDef.id,
      name: cityDef.name,
      lon: cityDef.lon,
      lat: cityDef.lat,
    });
    state = setSelectedCityId(state, cityDef.id);
    if (bundle) {
      state = setStoredBundle(state, cityDef.id, {
        lonLat: `${cityDef.lon},${cityDef.lat}`,
        bundle,
      });
    }
    useWeatherStore.setState(state, true);

    const memoryNavigator = navigator as any;
    const depth = typeof memoryNavigator.index === 'number' ? memoryNavigator.index : 0;
    if (depth > 0) {
      back(depth);
    } else {
      go('home.open');
    }
  };

  if (!cityDef) {
    return (
      <div className="w-full h-full bg-app-bg flex items-center justify-center text-white/60">
        {s.unknown_city}
      </div>
    );
  }

  const daily = bundle?.daily ?? [];
  const airQuality = bundle?.airQuality ?? null;
  const day0 = dailyForDate(daily, todayKey);
  const weatherText = getLocalizedWeatherText(now?.text, s);
  const airQualityLevel = normalizeAqiLevel(airQuality?.category ?? '', airQuality?.level);
  const cityName = getLocalizedWeatherCityName(cityDef, s);

  return (
    <div className="weather-city-preview w-full h-full relative overflow-hidden" data-status-bar-foreground="light">
      <WeatherDynamicBackground cityId={cityDef.id} />
      <div className="weather-city-preview-scroll relative z-10 h-full overflow-y-auto no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical">
        <header className="weather-city-preview-header">
          <button type="button" {...bindBack<HTMLButtonElement>()} className="weather-city-preview-action" style={{ backgroundColor: colors.pill_bg_action }}>{s.cancel}</button>
          <div className="weather-city-preview-title">{cityName}</div>
          <button type="button" {...bindTap<HTMLButtonElement>('home.open', { onTrigger: handleAdd })} disabled={adding || loading || !hasCurrentWeather} className="weather-city-preview-action" style={{ backgroundColor: colors.pill_bg_action }}>{s.add}</button>
        </header>
        {loading ? <div className="weather-city-preview-message">{s.loading}</div> : !bundle || !now || !hasCurrentWeather ? (
          <div className="weather-city-preview-message" role="status">
            <div>{s.preview_unavailable}</div>
            <button type="button" className="weather-city-preview-retry" onClick={() => {
              setLoading(true);
              setPreview(null);
              setRetryAttempt(value => value + 1);
            }}>{s.retry}</button>
          </div>
        ) : <>
          <div className="weather-city-preview-hero" data-weather-preview-hero>
            <div className="weather-city-preview-temperature">{now.temp?.trim() ? `${convertTemp(now.temp, tempUnit)}°` : '--'}</div>
            <div className="weather-city-preview-high-low">{day0 && <>{s.temp_high} {convertTemp(day0.tempMax, tempUnit)}° {s.temp_low} {convertTemp(day0.tempMin, tempUnit)}°</>}</div>
            <div className="weather-city-preview-condition">{airQuality && <>{s.air_quality_prefix} {getAqiLevelLabel(airQualityLevel, s)} </>}{weatherText}</div>
          </div>
          <WarningCard warnings={bundle.warnings || []} />
          <HourlyForecastChart now={now} daily={daily} hourly={bundle.hourly || []} minutelySummary={getLocalizedMinutelySummary(bundle.minutely?.summary, s)} />
          <DailyForecastShort daily={daily} yesterday={findLibraryHistorical(`${cityDef.lon},${cityDef.lat}`, cityDef.id)} layout={forecastLayout}
            chartButtonProps={{onClick: () => setForecastLayout('chart')}}
            listButtonProps={{onClick: () => setForecastLayout('list')}}
            forecastButtonProps={bindTap<HTMLButtonElement>('forecast.daily.open', {params: {cityId: cityDef.id}})} />
          <DetailsGrid weather={now} today={day0 ?? null} airQuality={airQuality} />
          <LifeIndices indices={bundle.indices || []} />
        </>}
      </div>
    </div>
  );
};

export default WeatherCityPreviewPage;
