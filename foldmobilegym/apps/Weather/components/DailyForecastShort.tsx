import React, { useMemo } from 'react';
import { useLocale } from '@/os/locale';
import { useAppStrings } from '@/os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { colors } from '../res/colors';
import { useWeatherStore } from '../state';
import { useWeatherMinute } from '../hooks/useWeatherMinute';
import { buildShortForecastDays } from '../utils/shortForecast';
import { parseForecastDate, toLocalDateKey } from '../utils/dateFormat';
import type { WeatherDaily } from '../types';
import { getLocalizedWeatherText } from '../utils/localizedText';
import { convertTemp } from '../utils/unitConversion';
import { getWeatherIcon as getWeatherIconUrl } from '../utils/weatherIcons';
import { isNightForecast } from '../utils/currentForecastIcon';

export interface DailyForecastShortProps {
  daily: WeatherDaily[];
  yesterday?: WeatherDaily | null;
  layout: 'chart' | 'list';
  chartButtonProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
  listButtonProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
  forecastButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}

const chartPoints = (values: number[], baseline: number, amplitude: number) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  return values.map((value, index) => ({
    x: 50 + index * 100,
    y: baseline - ((value - min) / range - .5) * amplitude,
  }));
};

const pointString = (points: Array<{ x: number; y: number }>) => points.map(point => `${point.x},${point.y}`).join(' ');

export const DailyForecastShort: React.FC<DailyForecastShortProps> = ({ daily, yesterday, layout, chartButtonProps, listButtonProps, forecastButtonProps }) => {
  const s = useAppStrings(strings, stringsEn);
  const locale = useLocale();
  const tempUnit = useWeatherStore(state => state.settings.tempUnit);
  const now = useWeatherMinute();
  const todayKey = toLocalDateKey(now);

  const days = useMemo(() => buildShortForecastDays(daily ?? [], yesterday), [daily, yesterday]);
  const hasYesterday = !!yesterday && days[0] === yesterday;
  const model = useMemo(() => {
    if (days.length < 3) return null;
    const high = days.map(day => convertTemp(day.tempMax, tempUnit));
    const low = days.map(day => convertTemp(day.tempMin, tempUnit));
    return {
      high,
      low,
      highPoints: chartPoints(high, 132, 22),
      lowPoints: chartPoints(low, 202, 18),
    };
  }, [days, tempUnit]);

  if (!model) return null;

  const dayLabel = (day: WeatherDaily) => {
    if (day.fxDate === todayKey) return s.today;
    const date = parseForecastDate(day.fxDate);
    return date ? [s.day_sun, s.day_mon, s.day_tue, s.day_wed, s.day_thu, s.day_fri, s.day_sat][date.getUTCDay()] : '--';
  };

  const dateLabel = (dateText: string) => {
    const date = parseForecastDate(dateText);
    if (!date) return '--';
    return locale === 'en'
      ? `${date.getUTCMonth() + 1}/${date.getUTCDate()}`
      : `${date.getUTCMonth() + 1}${s.date_month_day}${date.getUTCDate()}${s.date_day_suffix}`;
  };

  const minAll = Math.min(...model.low);
  const maxAll = Math.max(...model.high);
  const range = Math.max(1, maxAll - minAll);

  return (
    <section className="weather-home-daily px-[12px] mb-4" data-weather-forecast-layout={layout}>
      <div
        className="weather-home-daily-card border backdrop-blur-xl rounded-[24px] text-white overflow-hidden"
        style={{ backgroundColor: colors.chart_section_bg, borderColor: colors.card_border }}
      >
        <div className="weather-home-daily-heading">
          <span>{s.recent_forecast_title}</span>
          <div className="weather-home-daily-modes" role="group" aria-label={s.forecast_layout_label}>
            <button type="button" {...(layout === 'list' ? {} : listButtonProps)}
              disabled={layout === 'list'} aria-pressed={layout === 'list'} aria-label={s.forecast_layout_list}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" /></svg>
            </button>
            <button type="button" {...(layout === 'chart' ? {} : chartButtonProps)}
              disabled={layout === 'chart'} aria-pressed={layout === 'chart'} aria-label={s.forecast_layout_chart}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m3 14 5-6 4 3 5-7M3 3v14h14" /></svg>
            </button>
          </div>
        </div>

        <div className="weather-home-daily-chart" role="region" aria-label={s.recent_forecast_title} tabIndex={layout === 'chart' ? 0 : -1} hidden={layout !== 'chart'}>
          <div className="weather-home-daily-chart-content" style={{ '--weather-chart-width': `${Math.max(100, days.length * 20)}%` } as React.CSSProperties}>
            <svg viewBox={`0 0 ${days.length * 100} 250`} preserveAspectRatio="none" aria-hidden="true">
              <polyline points={pointString(hasYesterday ? model.highPoints.slice(1) : model.highPoints)} fill="none" stroke="#f4d05f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={pointString(hasYesterday ? model.lowPoints.slice(1) : model.lowPoints)} fill="none" stroke="#62d5ef" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {hasYesterday && <>
                <line x1={model.highPoints[0].x} y1={model.highPoints[0].y} x2={model.highPoints[1].x} y2={model.highPoints[1].y} stroke="#f4d05f" strokeWidth="3" strokeDasharray="2 5" opacity=".35" />
                <line x1={model.lowPoints[0].x} y1={model.lowPoints[0].y} x2={model.lowPoints[1].x} y2={model.lowPoints[1].y} stroke="#62d5ef" strokeWidth="3" strokeDasharray="2 5" opacity=".35" />
              </>}
              {model.highPoints.map((point, index) => <circle key={`h-${index}`} cx={point.x} cy={point.y} r="3" fill="#f4d05f" opacity={hasYesterday && index === 0 ? .35 : 1} />)}
              {model.lowPoints.map((point, index) => <circle key={`l-${index}`} cx={point.x} cy={point.y} r="3" fill="#62d5ef" opacity={hasYesterday && index === 0 ? .35 : 1} />)}
            </svg>
            <div className="weather-home-daily-columns" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
              {days.map((day, index) => {
                const isNight = isNightForecast(day, todayKey, now);
                const icon = isNight ? day.iconNight : day.iconDay;
                const weatherText = isNight ? (day.textNight || day.textDay) : day.textDay;
                const dayText = getLocalizedWeatherText(weatherText, s);
                return (
                  <div className="weather-home-daily-column" key={day.fxDate} data-weather-day-date={day.fxDate} data-weather-day-past={day.fxDate < todayKey ? "true" : undefined}>
                    <strong>{dayLabel(day)}</strong>
                    <small>{dateLabel(day.fxDate)}</small>
                    <span>{dayText}</span>
                    <img src={getWeatherIconUrl(icon, weatherText, isNight)} alt={dayText} />
                    <b className="is-high" data-weather-high-date={day.fxDate} style={{ top: model.highPoints[index].y - 24 }}>{model.high[index]}°</b>
                    <b className="is-low" style={{ top: model.lowPoints[index].y + 8 }}>{model.low[index]}°</b>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="weather-home-daily-list" hidden={layout !== 'list'}>
          {days.map((day, index) => {
            const isNight = isNightForecast(day, todayKey, now);
            const icon = isNight ? day.iconNight : day.iconDay;
            const weatherText = isNight ? (day.textNight || day.textDay) : day.textDay;
            const dayText = getLocalizedWeatherText(weatherText, s);
            const left = ((model.low[index] - minAll) / range) * 100;
            const width = Math.max(8, ((model.high[index] - model.low[index]) / range) * 100);
            return (
              <div className="weather-home-daily-row" key={day.fxDate} data-weather-day-date={day.fxDate} data-weather-day-past={day.fxDate < todayKey ? "true" : undefined}>
                <strong>{dayLabel(day)}</strong>
                <span>{dayText}</span>
                <img src={getWeatherIconUrl(icon, weatherText, isNight)} alt={dayText} />
                <b>{model.low[index]}°</b>
                <span className="weather-home-daily-range"><i style={{ left: `${left}%`, width: `${width}%` }} /></span>
                <b data-weather-high-date={day.fxDate}>{model.high[index]}°</b>
              </div>
            );
          })}
        </div>

        <button type="button" {...forecastButtonProps} className="weather-home-daily-more">
          {s.view_15day_forecast}
        </button>
      </div>
    </section>
  );
};
