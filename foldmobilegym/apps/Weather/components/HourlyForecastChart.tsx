import React, { useMemo } from 'react';
import { Bell, Sunrise, Sunset } from 'lucide-react';
import { WeatherDaily, WeatherHourly, WeatherNow } from '../types';
import { getWeatherIcon as getWeatherIconUrl } from '../utils/weatherIcons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { colors } from '../res/colors';
import { useAppStrings } from '@/os/useAppStrings';
import { useLocale } from '@/os/locale';
import * as TimeService from '../../../os/TimeService';
import { useWeatherStore } from '../state';
import { useWeatherMinute } from '../hooks/useWeatherMinute';
import { convertTemp } from '../utils/unitConversion';
import { getLocalizedWeatherText } from '../utils/localizedText';
import './weather-hourly-reference.css';

interface HourlyForecastChartProps {
  now?: WeatherNow | null;
  daily?: WeatherDaily[];
  hourly: WeatherHourly[];
  minutelySummary?: string;
}

type HourlySlot = {
  kind: 'now' | 'hourly' | 'sunrise' | 'sunset';
  ts: number;
  time: string;
  value: string;
  icon?: string;
  description: string;
  isPast?: boolean;
};

const parseTimestamp = (value: string) => {
  const ts = TimeService.parseToTimestamp(value);
  return Number.isFinite(ts) && ts > 0 ? ts : null;
};

const parseTemperature = (value?: string) => {
  if (!value?.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const parseDailyClockTimestamp = (date: string, time: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time || '');
  if (!date || !match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return parseTimestamp(`${date}T${time}`);
};

export const HourlyForecastChart: React.FC<HourlyForecastChartProps> = ({ now, daily = [], hourly, minutelySummary }) => {
  const s = useAppStrings(strings, stringsEn);
  const locale = useLocale();
  const tempUnit = useWeatherStore(state => state.settings.tempUnit);
  const nowTs = useWeatherMinute();

  const slots = useMemo(() => {
    const nowTemp = parseTemperature(now?.temp);
    const nowSlot: HourlySlot | null = now && nowTemp !== null ? {
      kind: 'now', ts: nowTs, time: s.time_now, value: `${convertTemp(nowTemp, tempUnit)}°`,
      icon: getWeatherIconUrl(now.icon, now.text), description: getLocalizedWeatherText(now.text, s),
    } : null;
    const hours: HourlySlot[] = hourly.flatMap(entry => {
      const ts = parseTimestamp(entry.fxTime), temp = parseTemperature(entry.temp);
      if (ts === null || temp === null) return [];
      const hour = TimeService.fromTimestamp(ts).getHours();
      return [{ kind: 'hourly' as const, ts, time: locale === 'en' ? `${String(hour).padStart(2, '0')}:00` : `${hour}时`,
        value: `${convertTemp(temp, tempUnit)}°`, icon: getWeatherIconUrl(entry.icon, entry.text),
        description: getLocalizedWeatherText(entry.text, s), isPast: !!nowSlot && ts <= nowTs }];
    }).sort((a, b) => a.ts - b.ts);

    // The expanded recording shows one previous hour beside Now. In the folded
    // view CSS hides that one slot, leaving Now at the start of the strip.
    const past = hours.filter(item => item.isPast).slice(-1);
    const future = hours.filter(item => !item.isPast);
    const result: HourlySlot[] = [...past, ...(nowSlot ? [nowSlot] : []), ...future];
    if (!result.length) return [];
    const windowStart = result[0].ts, windowEnd = result[result.length - 1].ts;
    const seen = new Set<string>();
    for (const day of daily) {
      for (const [kind, time, label] of [['sunrise', day.sunrise, s.sunrise_label], ['sunset', day.sunset, s.sunset_label]] as const) {
        const ts = parseDailyClockTimestamp(day.fxDate, time);
        if (ts === null || ts < windowStart || ts > windowEnd || seen.has(`${kind}:${ts}`)) continue;
        seen.add(`${kind}:${ts}`);
        result.push({kind, ts, time, value: label, description: label, isPast: !!nowSlot && ts < nowTs});
      }
    }
    const order: Record<HourlySlot['kind'], number> = {hourly: 0, now: 1, sunrise: 2, sunset: 3};
    return result.sort((a, b) => a.ts - b.ts || order[a.kind] - order[b.kind]);
  }, [daily, hourly, locale, now, nowTs, s, tempUnit]);

  const summary = minutelySummary?.trim();
  if (!slots.length && !summary) return null;
  return <section id="hourly_forecast_stub_inflated_id" className="weather-hourly-reference px-[12px] mb-4 mt-2">
    <div className="weather-hourly-card border backdrop-blur-xl rounded-[24px] text-white overflow-hidden" style={{backgroundColor: colors.chart_section_bg, borderColor: colors.card_border}}>
      <div className="weather-hourly-summary"><Bell size={14} aria-hidden="true" /><span>{summary || s.hourly_forecast_default_title}</span></div>
      {slots.length > 0 && <div className="weather-hourly-scroll no-scrollbar" data-weather-hourly-scroll data-scroll-direction="horizontal" role="region" aria-label={s.hourly_forecast_default_title} tabIndex={0}>
        <div className="weather-hourly-slots">
          {slots.map((item, i) => <div key={`${item.kind}-${item.ts}-${i}`} className={`weather-hourly-slot${item.isPast ? ' is-past' : ''}`} data-weather-hourly-kind={item.kind} data-weather-hourly-ts={item.ts}>
            <span data-weather-hourly-time>{item.time}</span>
            <span className="weather-hourly-icon" data-weather-hourly-icon>
              {item.kind === 'sunrise' ? <Sunrise aria-label={item.description} /> : item.kind === 'sunset' ? <Sunset aria-label={item.description} /> : <img src={item.icon} alt={item.description} />}
            </span>
            <span data-weather-hourly-value>{item.value}</span>
          </div>)}
        </div>
      </div>}
    </div>
  </section>;
};
