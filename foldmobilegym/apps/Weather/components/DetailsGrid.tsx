import React from 'react';
import { Droplets, Eye, Gauge, Leaf, Sunrise, Sun, Thermometer, Wind } from 'lucide-react';
import './weather-details-adaptive.css';
import { WeatherNow, WeatherDaily, AirQuality } from '../types';
import { getAqiLevelDescription, getAqiLevelLabel, normalizeAqiLevel } from '../utils/airQuality';
import { colors } from '../res/colors';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import * as TimeService from '../../../os/TimeService';
import { useWeatherStore } from '../state';
import { useWeatherMinute } from '../hooks/useWeatherMinute';
import { getLocalizedWindDirection } from '../utils/localizedText';
import { convertTemp, formatWind, formatPressure, pressureSuffix } from '../utils/unitConversion';

interface DetailsGridProps {
  weather: WeatherNow;
  today: WeatherDaily | null;
  airQuality?: AirQuality | null;
}

const detailCardClassName = 'backdrop-blur-lg border rounded-[20px] text-white relative overflow-hidden';
const detailCardStyle = { backgroundColor: colors.card_surface_detail, borderColor: colors.card_border };
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const finiteReading = (value: string | undefined): number | null => {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// ── 4. 风向 ─── 罗盘 + 风向指针 ──────────────────────────────
const WindCompass = ({ deg, speed }: { deg: string; speed: string }) => {
  const s = useAppStrings(strings, stringsEn);
  const parsed = finiteReading(deg);
  const rotation = parsed === null ? null : ((parsed % 360) + 360) % 360;
  return <svg viewBox="0 0 100 100" aria-hidden="true">
    {Array.from({ length: 60 }, (_, i) => <line key={i} x1="50" y1="5" x2="50" y2={i % 5 === 0 ? 13 : 10} stroke="rgba(255,255,255,.55)" strokeWidth="1" transform={`rotate(${i * 6} 50 50)`} />)}
    <text x="50" y="19" textAnchor="middle" fill="white" fontSize="9">{s.wind_compass_north}</text>
    <text x="83" y="53" textAnchor="middle" fill="white" fontSize="9">{s.wind_compass_east}</text>
    <text x="50" y="88" textAnchor="middle" fill="white" fontSize="9">{s.wind_compass_south}</text>
    <text x="17" y="53" textAnchor="middle" fill="white" fontSize="9">{s.wind_compass_west}</text>
    {rotation !== null && <g transform={`rotate(${rotation} 50 50)`}>
      <line x1="50" y1="15" x2="50" y2="85" stroke="white" strokeWidth="2" />
      <circle cx="50" cy="15" r="5" fill="white" />
      <path d="M45 78 L50 89 L55 78 Z" fill="white" />
    </g>}
    <circle cx="50" cy="50" r="20" fill="#71809a" />
    <text x="50" y="54" textAnchor="middle" fill="white" fontSize={speed.length > 5 ? 8 : 13}>{speed}</text>
  </svg>;
};

const clockMinutes = (value: string | undefined): number | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const hours = Number(match[1]), minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
};

// Schematic of the daily sun path, based only on the supplied local times.
const SunPath = ({ sunrise, sunset, timestamp }: { sunrise?: string; sunset?: string; timestamp: number }) => {
  const rise = clockMinutes(sunrise), set = clockMinutes(sunset);
  const now = TimeService.fromTimestamp(timestamp);
  const minute = now.getHours() * 60 + now.getMinutes();
  const position = rise !== null && set !== null && set > rise ? clamp01((minute - rise) / (set - rise)) : null;
  const x = position === null ? 0 : 5 + position * 90;
  const y = position === null ? 0 : 27 - 19 * Math.sin(position * Math.PI);
  return <svg data-weather-visual="sun" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true">
    <path d="M 4 27 C 25 27, 28 8, 50 8 S 75 27, 96 27" fill="none" stroke="rgba(255,255,255,.42)" strokeWidth="1.5" />
    {position !== null && <circle cx={x} cy={y} r="2.5" fill="white" />}
  </svg>;
};

const PressureGauge = ({ value, display, unit }: { value: string; display: string; unit: string }) => {
  const raw = finiteReading(value);
  const position = raw === null ? null : clamp01((raw - 960) / 106);
  return <svg data-weather-visual="pressure" viewBox="0 0 100 100" aria-hidden="true">
    {Array.from({length: 49}, (_, i) => <line key={i} x1="50" y1="8" x2="50" y2={i % 4 === 0 ? 15 : 12} stroke="rgba(255,255,255,.55)" strokeWidth="1" transform={`rotate(${-135 + i * 270 / 48} 50 50)`} />)}
    {position !== null && <line x1="50" y1="6" x2="50" y2="17" stroke="white" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${-135 + position * 270} 50 50)`} />}
    <text x="50" y="50" textAnchor="middle" fill="white" fontSize="20">{display}</text>
    <text x="50" y="63" textAnchor="middle" fill="rgba(255,255,255,.8)" fontSize="9">{unit}</text>
  </svg>;
};

const DetailScale = ({ kind, value, max }: { kind: 'aqi' | 'uv'; value: string; max: number }) => {
  const number = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(number) && number >= 0;
  return <div className={`weather-detail-scale weather-detail-scale--${kind}`} data-weather-scale={kind} aria-hidden="true">
    {valid && <span style={{ left: `${clamp01(number / max) * 100}%` }} />}
  </div>;
};

// ── 主组件 ──────────────────────────────────────────────────────
export const DetailsGrid: React.FC<DetailsGridProps> = ({ weather, today, airQuality }) => {
  const s = useAppStrings(strings, stringsEn);
  const { tempUnit, windUnit, pressureUnit } = useWeatherStore((st) => st.settings);
  const timestamp = useWeatherMinute();
  if (!weather) return null;
  const humidityRaw = finiteReading(weather.humidity);
  const humidity = humidityRaw !== null && humidityRaw >= 0 && humidityRaw <= 100 ? humidityRaw : null;
  const visibility = finiteReading(weather.vis);
  const pressureRaw = finiteReading(weather.pressure);
  const pressure = pressureRaw !== null && pressureRaw > 0 ? pressureRaw : null;
  const windDirection = getLocalizedWindDirection(weather.windDir, s);
  const windValue = formatWind(weather.windSpeed, weather.windScale, windUnit, s.wind_scale_suffix);
  const aqiLevel = airQuality ? normalizeAqiLevel(airQuality.category, airQuality.level) : null;
  const actualTemp = weather.temp.trim() && Number.isFinite(Number(weather.temp)) ? convertTemp(weather.temp, tempUnit) : null;
  const feelsTemp = weather.feelsLike.trim() && Number.isFinite(Number(weather.feelsLike)) ? convertTemp(weather.feelsLike, tempUnit) : null;
  const feelsDifference = actualTemp === null || feelsTemp === null ? NaN : Number(weather.feelsLike) - Number(weather.temp);
  const feelsDescription = !Number.isFinite(feelsDifference) ? '' : Math.abs(feelsDifference) < 2
    ? s.details_feels_similar : feelsDifference > 0 ? s.details_feels_warmer : s.details_feels_cooler;

  // UV 类别
  const uvCategory = (() => {
    const uv = Number(today?.uvIndex);
    if (!today?.uvIndex?.trim() || !Number.isFinite(uv) || uv < 0) return '--';
    if (uv <= 2) return s.uv_very_weak;
    if (uv <= 4) return s.uv_weak;
    if (uv <= 6) return s.uv_moderate;
    if (uv <= 9) return s.uv_strong;
    return s.uv_very_strong;
  })();

  // When one or both readings are missing, never invent a sunrise or sunset time.
  const riseMinutes = clockMinutes(today?.sunrise), setMinutes = clockMinutes(today?.sunset);
  const now = TimeService.fromTimestamp(timestamp);
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const showSunrise = riseMinutes !== null && (setMinutes === null || currentMinute < riseMinutes || currentMinute >= setMinutes);
  const sunCard = {
    title: showSunrise ? s.sunrise_label : s.sunset_label,
    time: showSunrise ? today?.sunrise : setMinutes !== null ? today?.sunset : undefined,
  };

  return (
    <div className="weather-details-container">
    <div className="weather-details-grid grid gap-2 px-[11px] mb-4">
      {airQuality && <div data-weather-detail="aqi" className={`${detailCardClassName} weather-reference-card`} style={detailCardStyle}>
        <div className="weather-reference-title"><Leaf size={14} aria-hidden="true" />{s.details_air_quality}</div>
        <div className="weather-reference-value">{getAqiLevelLabel(aqiLevel, s)}</div>
        <div className="weather-reference-number">{airQuality.aqi || '--'}</div>
        <DetailScale kind="aqi" value={airQuality.aqi} max={300} />
        <div className="weather-reference-description">{getAqiLevelDescription(aqiLevel, s)}</div>
      </div>}
      <div data-weather-detail="uv" className={`${detailCardClassName} weather-reference-card`} style={detailCardStyle}>
        <div className="weather-reference-title"><Sun size={14} aria-hidden="true" />{s.uv_label}</div>
        <div className="weather-reference-value">{uvCategory}</div>
        <div className="weather-reference-number">{today?.uvIndex?.trim() || '--'}</div>
        <DetailScale kind="uv" value={today?.uvIndex ?? ''} max={12} />
        <div className="weather-reference-description">{s.details_uv_scale}</div>
      </div>

      <div data-weather-detail="humidity" className={`${detailCardClassName} weather-reference-card`} style={detailCardStyle}>
        <div className="weather-reference-title"><Droplets size={14} aria-hidden="true" />{s.humidity_label}</div>
        <div className="weather-reference-value weather-reference-temp" data-weather-visual="humidity">{humidity === null ? '--' : `${humidity}%`}</div>
        <div className="weather-reference-description weather-reference-description--bottom">{humidity === null ? '' : humidity < 40 ? s.humidity_dry : humidity <= 70 ? s.humidity_comfortable : s.humidity_humid}</div>
      </div>

      <div data-weather-detail="feels" className={`${detailCardClassName} weather-reference-card`} style={detailCardStyle}>
        <div className="weather-reference-title"><Thermometer size={14} aria-hidden="true" />{s.feels_like_label}</div>
        <div className="weather-reference-value weather-reference-temp">{feelsTemp === null ? '--' : `${feelsTemp}°`}</div>
        <div className="weather-reference-number" data-weather-actual-temp>{s.details_actual_temp}: {actualTemp === null ? '--' : `${actualTemp}°`}</div>
        <div className="weather-reference-description weather-reference-description--bottom">{feelsDescription}</div>
      </div>

      <div data-weather-detail="wind" className={`${detailCardClassName} weather-reference-card`} style={detailCardStyle}>
        <div className="weather-reference-title"><Wind size={14} aria-hidden="true" />{s.details_wind}</div>
        <div className="weather-reference-wind"><WindCompass deg={weather.wind360} speed={windValue} /></div>
        <div className="weather-reference-description">{windDirection}</div>
      </div>

      <div data-weather-detail="sun" className={`${detailCardClassName} weather-reference-card`} style={detailCardStyle}>
        <div className="weather-reference-title"><Sunrise size={14} aria-hidden="true" />{sunCard.title}</div>
        <div className="weather-reference-value weather-reference-temp">{sunCard.time || '--'}</div>
        <div className="weather-reference-sun"><SunPath sunrise={today?.sunrise} sunset={today?.sunset} timestamp={timestamp} /></div>
      </div>
      {visibility !== null && visibility >= 0 && <div data-weather-detail="visibility" className={`${detailCardClassName} weather-reference-card`} style={detailCardStyle}>
        <div className="weather-reference-title"><Eye size={14} aria-hidden="true" />{s.details_visibility}</div>
        <div className="weather-reference-value weather-reference-temp">{weather.vis} <span className="weather-visibility-unit">{s.details_kilometers}</span></div>
        <div className="weather-visibility-labels"><span>{s.details_low}</span><span>{s.details_high}</span></div>
        <div className="weather-visibility-scale" data-weather-visual="visibility"><span style={{left: `${clamp01(visibility / 10) * 100}%`}} /></div>
      </div>}
      <div data-weather-detail="pressure" className={`${detailCardClassName} weather-reference-card`} style={detailCardStyle}>
        <div className="weather-reference-title"><Gauge size={14} aria-hidden="true" />{s.pressure_label}</div>
        <div className="weather-reference-pressure"><PressureGauge value={weather.pressure} display={pressure === null ? '--' : formatPressure(weather.pressure, pressureUnit)} unit={pressureSuffix(pressureUnit)} /></div>
      </div>
    </div>
    </div>
  );
};
