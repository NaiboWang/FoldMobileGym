import React, { useContext, useEffect, useRef } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';
import { useAppStrings } from '@/os/useAppStrings';
import { useWeatherGestures } from '../hooks/useWeatherGestures';
import { useWeatherStore } from '../state';
import type { TempUnit } from '../types';
import { getWeatherHomeMenu } from '../utils/homeView';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { IcCloud, IcMenuTemperature, IcMenuInterval, IcMenuFeedback, IcMenuNews, IcMenuSettings, IcMenuChevron, IcNavBack, IcCheck } from '../res/icons';

export function WeatherHomeMenu({ top }: { top: number }) {
  const s = useAppStrings(strings, stringsEn);
  const location = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const activityId = useActivityId();
  const { bindTap, bindBack, back, go } = useWeatherGestures();
  const unit = useWeatherStore(state => state.settings.tempUnit);
  const menu = getWeatherHomeMenu(location.pathname, location.search);
  const listLayout = new URLSearchParams(location.search).get('forecastLayout') === 'list';
  const closed = useRef<string | null>(null), opening = useRef<string | null>(null), mounted = useRef(true);
  const liveLocation = useRef(location); liveLocation.current = location;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { opening.current = null; }, [location.key]);
  const ownsMenu = (expected: 'more' | 'temperature') => {
    const live = (navigator as { location?: typeof location }).location ?? liveLocation.current;
    const os = window.__OS__?.getState();
    const active = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
    return mounted.current && live.key === location.key && getWeatherHomeMenu(live.pathname, live.search) === expected
      && !os?.isLauncherVisible && !os?.isRecentsVisible && active?.activityId === activityId;
  };
  const openTemperature = () => {
    if (!ownsMenu('more') || opening.current === location.key) return;
    opening.current = location.key; go('menu.temperature.open');
  };
  const selectUnit = (value: TempUnit) => {
    if (!ownsMenu('temperature') || closed.current === location.key) return;
    closed.current = location.key;
    useWeatherStore.setState(previous => ({ settings: { ...previous.settings, tempUnit: value } }));
    back();
  };
  if (!menu) return null;
  return <>
    <button type="button" className="weather-menu-backdrop" aria-label={s.cancel} {...bindBack<HTMLButtonElement>()} />
    <section className="weather-home-menu" style={{ top }} data-weather-menu={menu} role="dialog" aria-modal="true"
      aria-label={menu === 'more' ? s.aria_more_settings : s.settings_temp_unit}
      data-scroll-container="menu" data-scroll-direction="vertical">
      {menu === 'more' ? <>
        <button type="button" className="weather-home-menu-item" disabled title={s.menu_unavailable}>
          <IcCloud aria-hidden="true" /><span>{s.menu_desktop_weather}</span>
        </button>
        <button type="button" className="weather-home-menu-item" {...bindTap<HTMLButtonElement>('menu.temperature.open', { onTrigger: openTemperature })}>
          <IcMenuTemperature aria-hidden="true" /><span>{s.settings_temp_unit}<small>{unit === 'fahrenheit' ? s.menu_temperature_fahrenheit : s.menu_temperature_celsius}</small></span><IcMenuChevron aria-hidden="true" />
        </button>
        <button type="button" className="weather-home-menu-item" disabled title={s.menu_unavailable}>
          <IcMenuInterval aria-hidden="true" /><span>{s.menu_update_interval}<small>{s.menu_unavailable}</small></span><IcMenuChevron aria-hidden="true" />
        </button>
        <button type="button" className="weather-home-menu-item" {...bindTap<HTMLButtonElement>('feedback.open')}>
          <IcMenuFeedback aria-hidden="true" /><span>{s.menu_feedback_current}</span>
        </button>
        <button type="button" className="weather-home-menu-item" disabled title={s.menu_unavailable}>
          <IcMenuNews aria-hidden="true" /><span>{s.menu_weather_news}</span>
        </button>
        <button type="button" className="weather-home-menu-item" {...bindTap<HTMLButtonElement>('settings.open')}>
          <IcMenuSettings aria-hidden="true" /><span>{s.menu_settings}</span>
        </button>
      </> : <>
        <header className="weather-home-menu-heading">
          <button type="button" aria-label={s.back} {...bindBack<HTMLButtonElement>()}><IcNavBack aria-hidden="true" /></button>
          <span>{s.settings_temp_unit}</span>
        </header>
        <div role="radiogroup" aria-label={s.settings_temp_unit}>
          <button type="button" role="radio" aria-checked={unit === 'celsius'} className="weather-home-menu-option"
            {...(listLayout
              ? bindTap({ kind: 'action', id: 'menu.tempUnit.list.select.celsius' }, { onTrigger: () => selectUnit('celsius') })
              : bindTap({ kind: 'action', id: 'menu.tempUnit.select.celsius' }, { onTrigger: () => selectUnit('celsius') }))}>
            <span>{s.menu_temperature_celsius}</span>{unit === 'celsius' && <IcCheck aria-hidden="true" />}
          </button>
          <button type="button" role="radio" aria-checked={unit === 'fahrenheit'} className="weather-home-menu-option"
            {...(listLayout
              ? bindTap({ kind: 'action', id: 'menu.tempUnit.list.select.fahrenheit' }, { onTrigger: () => selectUnit('fahrenheit') })
              : bindTap({ kind: 'action', id: 'menu.tempUnit.select.fahrenheit' }, { onTrigger: () => selectUnit('fahrenheit') }))}>
            <span>{s.menu_temperature_fahrenheit}</span>{unit === 'fahrenheit' && <IcCheck aria-hidden="true" />}
          </button>
        </div>
      </>}
    </section>
  </>;
}
