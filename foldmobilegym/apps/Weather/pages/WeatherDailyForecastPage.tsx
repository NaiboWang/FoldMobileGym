import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WEATHER_CITY_BY_ID } from '../data';
import {
  getAirQualityDailyForecast,
  getHistoricalWeatherDay,
  getWeatherBundle,
} from '../services/weatherService';
import type { AirQualityForecastDay } from '../types';
import { useWeatherStore } from '../state';
import { useWeatherMinute } from '../hooks/useWeatherMinute';
import { IcNavBack } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useWeatherGestures } from '../hooks/useWeatherGestures';
import { setHistoricalYesterday, setStoredBundle } from '../utils/weatherStore';
import { parseForecastDate, toLocalDateKey } from '../utils/dateFormat';
import { getWeatherIcon as getWeatherIconUrl } from '../utils/weatherIcons';
import * as TimeService from '../../../os/TimeService';
import { convertTemp, formatWind } from '../utils/unitConversion';
import { getAqiLevelLabel, getAqiLevelSoftColor, normalizeAqiLevel } from '../utils/airQuality';
import { getLocalizedWeatherText } from '../utils/localizedText';
import { getLocalizedLocationName, getLocalizedWeatherCityName } from '../utils/cityNames';
import WeatherDynamicBackground from '../components/WeatherDynamicBackground';

const COLUMN_WIDTH_PX = 72;
const CARD_LEFT_PADDING_PX = 10;
const CARD_RIGHT_PADDING_PX = 10;
const CARD_HEIGHT_PX = 464;
const HIGH_TRACK_TOP_PX = 214;
const HIGH_TRACK_HEIGHT_PX = 34;
const LOW_TRACK_TOP_PX = 302;
const LOW_TRACK_HEIGHT_PX = 24;
const HIGH_TRACK_LABEL_OFFSET_PX = 30;
const LOW_TRACK_LABEL_OFFSET_PX = 10;

type ForecastPoint = {
  x: number;
  y: number;
  label: string;
};

function getDateMeta(
  dateStr: string,
  todayDateKey: string,
  s: typeof strings,
) {
  const date = parseForecastDate(dateStr);
  const today = parseForecastDate(todayDateKey);
  const weekdays = [s.day_sun, s.day_mon, s.day_tue, s.day_wed, s.day_thu, s.day_fri, s.day_sat];
  const dayDiff = date && today ? (date.getTime() - today.getTime()) / 86400000 : null;
  const topLabel =
    dayDiff === -1 ? s.yesterday :
    dayDiff === 0 ? s.today :
    dayDiff === 1 ? s.tomorrow :
    date ? weekdays[date.getUTCDay()] : '--';
  const bottomLabel = date ? `${date.getUTCMonth() + 1}${s.date_month_day}${date.getUTCDate()}${s.date_day_suffix}` : '--';
  return { topLabel, bottomLabel };
}

function buildBandPoints(
  values: number[],
  labels: string[],
  top: number,
  height: number,
): ForecastPoint[] {
  const safeValues = values.map((value) => (Number.isFinite(value) ? value : 0));
  const average = safeValues.reduce((sum, value) => sum + value, 0) / Math.max(safeValues.length, 1);
  const maxDelta = Math.max(...safeValues.map((value) => Math.abs(value - average)), 0);
  const spread = Math.max(...safeValues) - Math.min(...safeValues);
  const centerY = top + height / 2;
  const maxAmplitude = Math.max(0, height / 2 - 2);
  const dynamicAmplitude = maxAmplitude * Math.min(spread / 8, 1);

  return safeValues.map((value, index) => {
    const normalizedOffset = maxDelta > 0 ? (average - value) / maxDelta : 0;
    return {
      x: CARD_LEFT_PADDING_PX + index * COLUMN_WIDTH_PX + COLUMN_WIDTH_PX / 2,
      y: centerY + normalizedOffset * dynamicAmplitude,
      label: labels[index] ?? String(value),
    };
  });
}

function buildPolyline(points: ForecastPoint[], width: number) {
  if (!points.length) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return [
    `0,${first.y}`,
    ...points.map((point) => `${point.x},${point.y}`),
    `${width},${last.y}`,
  ].join(' ');
}

function resolveDisplayWind(dayWindSpeed: string, dayWindScale: string, windUnit: import('../types').WindUnit, suffix: string) {
  return formatWind(dayWindSpeed, dayWindScale, windUnit, suffix) || '--';
}

function buildAirForecastMap(days: AirQualityForecastDay[]) {
  return new Map(
    days
      .map((day) => {
        const startTs = TimeService.parseToTimestamp(day.forecastStartTime);
        if (!startTs) return null;
        return [toLocalDateKey(startTs), day] as const;
      })
      .filter((item): item is readonly [string, AirQualityForecastDay] => item !== null),
  );
}

function normalizeAirQualityCategory(category: string, level?: string) {
  const raw = category.trim();
  if (raw.includes('优')) return '优';
  if (raw.includes('良')) return '良';
  if (raw.includes('轻')) return '轻度';
  if (raw.includes('中')) return '中度';
  if (raw.includes('严重')) return '重度';
  if (raw.includes('重')) return '重度';

  switch (level) {
    case '1':
      return '优';
    case '2':
      return '良';
    case '3':
      return '轻度';
    case '4':
      return '中度';
    case '5':
    case '6':
      return '重度';
    default:
      return '--';
  }
}

function resolveAirQualityColor(category: string) {
  if (category === '优') return '#b9e6c9';
  if (category === '良') return '#e8c77a';
  if (category === '轻度') return '#f0a86b';
  if (category === '中度') return '#ea8a8a';
  if (category === '重度') return '#c37ce6';
  return '#c6d0db';
}

const WeatherDailyForecastPage: React.FC = () => {
  const { bindBack } = useWeatherGestures();
  const s = useAppStrings(strings, stringsEn);
  const [searchParams] = useSearchParams();
  const weatherState = useWeatherStore();
  const { tempUnit, windUnit } = weatherState.settings;
  const [failedCityId, setFailedCityId] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [airForecast, setAirForecast] = useState<{
    cityId: string;
    lonLat: string;
    days: AirQualityForecastDay[];
  } | null>(null);

  const activeCityId = searchParams.get('cityId') ?? weatherState.selectedCityId;
  const storedEntry = weatherState.bundlesByCityId[activeCityId];
  const cityDef = activeCityId === 'located' ? null : WEATHER_CITY_BY_ID[activeCityId];
  const namedCity = weatherState.savedCities.find(city => city.id === activeCityId) ?? cityDef;
  const cityName = namedCity ? getLocalizedWeatherCityName(namedCity, s)
    : getLocalizedLocationName(storedEntry?.locationName, s);
  const bundle = storedEntry?.bundle ?? null;
  const historicalYesterday = storedEntry?.historicalYesterday;
  const lonLat = storedEntry?.lonLat ?? (cityDef ? `${cityDef.lon},${cityDef.lat}` : null);

  useEffect(() => {
    if (bundle || activeCityId === 'located' || !cityDef) return;

    let cancelled = false;
    setFailedCityId(null);

    (async () => {
      try {
        const result = await getWeatherBundle(`${cityDef.lon},${cityDef.lat}`, {
          dailysteps: 15,
          hourlysteps: 24,
          alert: true,
          cityId: cityDef.id,
        });
        if (cancelled) return;
        useWeatherStore.setState((prev) => setStoredBundle(prev, cityDef.id, {
          lonLat: `${cityDef.lon},${cityDef.lat}`,
          bundle: result,
        }), true);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch daily forecast page bundle', error);
          setFailedCityId(activeCityId);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCityId, bundle, cityDef, retryAttempt]);

  useEffect(() => {
    if (!lonLat) return;

    let cancelled = false;
    (async () => {
      try {
        const result = await getAirQualityDailyForecast(lonLat, activeCityId);
        if (!cancelled) setAirForecast({ cityId: activeCityId, lonLat, days: result });
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch daily air quality forecast', error);
          setAirForecast({ cityId: activeCityId, lonLat, days: [] });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCityId, lonLat]);

  useEffect(() => {
    if (!lonLat || !storedEntry || historicalYesterday !== undefined) return;

    let cancelled = false;
    const yesterday = TimeService.getDate();
    yesterday.setHours(12, 0, 0, 0);
    yesterday.setDate(yesterday.getDate() - 1);

    (async () => {
      try {
        const result = await getHistoricalWeatherDay(lonLat, yesterday, activeCityId);
        if (cancelled) return;
        useWeatherStore.setState((prev) => setHistoricalYesterday(prev, activeCityId, result), true);
      } catch (error) {
        console.error('Failed to fetch yesterday historical weather', error);
        if (cancelled) return;
        useWeatherStore.setState((prev) => setHistoricalYesterday(prev, activeCityId, null), true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCityId, historicalYesterday, lonLat, storedEntry]);

  const days = useMemo(() => {
    const forecastDays = bundle?.daily ?? [];
    if (!forecastDays.length) return [];
    return historicalYesterday ? [historicalYesterday, ...forecastDays] : forecastDays;
  }, [bundle, historicalYesterday]);
  const airForecastByDate = useMemo(() => {
    if (!lonLat || airForecast?.cityId !== activeCityId || airForecast.lonLat !== lonLat) {
      return new Map<string, AirQualityForecastDay>();
    }
    return buildAirForecastMap(airForecast.days);
  }, [activeCityId, airForecast, lonLat]);
  const todayDateKey = toLocalDateKey(useWeatherMinute());
  const observationTime = bundle?.airQuality?.pubTime ? TimeService.parseToTimestamp(bundle.airQuality.pubTime) : 0;
  const observationDateKey = observationTime > 0 ? toLocalDateKey(observationTime) : null;

  const chart = useMemo(() => {
    if (!days.length) {
      return {
        width: CARD_LEFT_PADDING_PX + CARD_RIGHT_PADDING_PX,
        highPoints: [] as ForecastPoint[],
        lowPoints: [] as ForecastPoint[],
        highPolyline: '',
        lowPolyline: '',
      };
    }

    const maxValues = days.map((day) => convertTemp(day.tempMax, tempUnit));
    const minValues = days.map((day) => convertTemp(day.tempMin, tempUnit));
    const highPoints = buildBandPoints(maxValues, maxValues.map(String), HIGH_TRACK_TOP_PX, HIGH_TRACK_HEIGHT_PX);
    const lowPoints = buildBandPoints(minValues, minValues.map(String), LOW_TRACK_TOP_PX, LOW_TRACK_HEIGHT_PX);

    return {
      width: CARD_LEFT_PADDING_PX + CARD_RIGHT_PADDING_PX + days.length * COLUMN_WIDTH_PX,
      highPoints,
      lowPoints,
      highPolyline: buildPolyline(highPoints, CARD_LEFT_PADDING_PX + CARD_RIGHT_PADDING_PX + days.length * COLUMN_WIDTH_PX),
      lowPolyline: buildPolyline(lowPoints, CARD_LEFT_PADDING_PX + CARD_RIGHT_PADDING_PX + days.length * COLUMN_WIDTH_PX),
    };
  }, [days, tempUnit]);

  const hasFetchError = !bundle && failedCityId === activeCityId;
  const isLoading = !bundle && activeCityId !== 'located' && !!cityDef && !hasFetchError;

  return (
    <div
      className="relative flex flex-col h-full overflow-hidden bg-[#12182b] text-white pt-10"
      data-status-bar-foreground="light"
      data-navigation-bar-foreground="light"
    >
      <WeatherDynamicBackground cityId={activeCityId} />
      <div className="absolute inset-0 z-[1] pointer-events-none bg-[linear-gradient(180deg,rgba(5,10,27,0.12),rgba(8,13,33,0.42)_48%,rgba(6,10,25,0.62))]" />

      <div className="relative z-10 flex items-center px-5 py-3">
        <button
          type="button"
          {...bindBack<HTMLButtonElement>()}
          className="p-2 -ml-2 rounded-full border-0 bg-black/15 text-white backdrop-blur-md active:bg-white/15 transition-colors"
        >
          <IcNavBack size={24} />
        </button>
      </div>

      <div
        className="relative z-10 flex-1 overflow-y-auto px-5 pb-6"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        <div className="px-1 pt-1 pb-5 text-center">
          <h1 className="text-[24px] leading-none font-medium tracking-tight">{s.daily_forecast_title}</h1>
          <p className="mt-2 text-[14px] text-white/72">{cityName} · {tempUnit === 'fahrenheit' ? '°F' : '°C'} · {s.temp_high} / {s.temp_low}</p>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-white/55">{s.loading}</div>
        ) : hasFetchError ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4 text-white/70" role="status">
            <span>{s.preview_unavailable}</span>
            <button type="button" className="rounded-full bg-white/15 px-5 py-2 text-white" onClick={() => {
              setFailedCityId(null);
              setRetryAttempt(value => value + 1);
            }}>{s.retry}</button>
          </div>
        ) : !days.length ? (
          <div className="h-64 flex items-center justify-center text-white/55">{cityDef || activeCityId === 'located' ? s.preview_unavailable : s.unknown_city}</div>
        ) : (
          <div className="rounded-[26px] border border-white/10 bg-[#30384f]/62 shadow-[0_18px_48px_rgba(0,0,0,0.2)] backdrop-blur-xl overflow-hidden">
            <div
              className="overflow-x-auto no-scrollbar"
              data-scroll-container="forecast"
              data-scroll-direction="horizontal"
              // Keep vertical drags available to the enclosing page in short split panes.
              style={{ touchAction: 'pan-x pan-y' }}
            >
              <div
                className="relative"
                style={{ width: `${chart.width}px`, minHeight: `${CARD_HEIGHT_PX}px` }}
              >
                <svg
                  className="absolute inset-0 pointer-events-none"
                  width={chart.width}
                  height={CARD_HEIGHT_PX}
                  viewBox={`0 0 ${chart.width} ${CARD_HEIGHT_PX}`}
                  fill="none"
                  aria-hidden="true"
                >
                  <polyline
                    points={chart.highPolyline}
                    stroke="#f4d05f"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={chart.lowPolyline}
                    stroke="#62d5ef"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {chart.highPoints.map((point, index) => (
                    <circle key={`high-${index}`} cx={point.x} cy={point.y} r="2.5" fill="#f4d05f" />
                  ))}
                  {chart.lowPoints.map((point, index) => (
                    <circle key={`low-${index}`} cx={point.x} cy={point.y} r="2.5" fill="#62d5ef" />
                  ))}
                </svg>

                {chart.highPoints.map((point, index) => (
                  <div
                    key={`high-label-${index}`}
                    data-weather-high-date={days[index].fxDate}
                    className="absolute z-10 text-[17px] font-medium text-white -translate-x-1/2"
                    style={{ left: `${point.x}px`, top: `${point.y - HIGH_TRACK_LABEL_OFFSET_PX}px` }}
                  >
                    {point.label}°
                  </div>
                ))}

                {chart.lowPoints.map((point, index) => (
                  <div
                    key={`low-label-${index}`}
                    data-weather-low-date={days[index].fxDate}
                    className="absolute z-10 text-[17px] font-medium text-white/82 -translate-x-1/2"
                    style={{ left: `${point.x}px`, top: `${point.y + LOW_TRACK_LABEL_OFFSET_PX}px` }}
                  >
                    {point.label}°
                  </div>
                ))}

                <div
                  className="flex"
                  style={{
                    paddingLeft: `${CARD_LEFT_PADDING_PX}px`,
                    paddingRight: `${CARD_RIGHT_PADDING_PX}px`,
                  }}
                >
                  {days.map((day, index) => {
                    const meta = getDateMeta(day.fxDate, todayDateKey, s);
                    const isTodayColumn = day.fxDate === todayDateKey;
                    const dayAirQuality = airForecastByDate.get(day.fxDate);
                    const airLevel = dayAirQuality
                      ? normalizeAqiLevel(dayAirQuality.category, dayAirQuality.level)
                      : day.fxDate === todayDateKey && observationDateKey === todayDateKey
                        ? normalizeAqiLevel(bundle?.airQuality?.category || '', bundle?.airQuality?.level)
                        : null;
                    const dayText = getLocalizedWeatherText(day.textDay, s);
                    const nightText = getLocalizedWeatherText(day.textNight, s);
                    return (
                      <div
                        key={day.fxDate}
                        data-weather-forecast-date={day.fxDate}
                        className="relative shrink-0 flex flex-col items-center pt-8"
                        style={{
                          width: `${COLUMN_WIDTH_PX}px`,
                          backgroundColor: isTodayColumn ? 'rgba(255,255,255,0.08)' : 'transparent',
                          borderRadius: isTodayColumn ? '20px' : '0',
                        }}
                      >
                        <div className={`text-[17px] leading-none ${isTodayColumn ? 'font-semibold text-white' : 'font-medium text-white/82'}`}>
                          {meta.topLabel}
                        </div>
                        <div className="mt-2 text-[15px] leading-none text-white/45">{meta.bottomLabel}</div>

                        <img
                          src={getWeatherIconUrl(day.iconDay, day.textDay)}
                          alt={dayText}
                          className="mt-7 h-8 w-8 object-contain"
                        />
                        <div className="mt-6 text-[14px] leading-none text-white/82">{dayText}</div>

                        <div className="h-[176px]" />

                        <div className="text-[15px] leading-none text-white/55">{nightText}</div>
                        <img
                          src={getWeatherIconUrl(day.iconNight, day.textNight, true)}
                          alt={nightText}
                          className="mt-3 h-7 w-7 object-contain opacity-85"
                        />

                        <div
                          className="mt-4 text-[14px] leading-none"
                          data-weather-forecast-aqi
                          style={{ color: getAqiLevelSoftColor(airLevel) }}
                        >
                          {getAqiLevelLabel(airLevel, s)}
                        </div>
                        <div className="mt-2 text-[14px] leading-none text-white/42">
                          {resolveDisplayWind(day.windSpeedDay, day.windScaleDay, windUnit, s.wind_scale_suffix)}
                        </div>
                        <div className="h-4 shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherDailyForecastPage;
