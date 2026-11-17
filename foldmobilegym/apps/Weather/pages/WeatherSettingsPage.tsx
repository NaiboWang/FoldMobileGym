import React, { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { IcNavBack, IcCheck, IcChevronsUpDown } from '../res/icons';
import { PreferenceCategory } from '../../../system/Settings/components/PreferenceCategory';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useWeatherGestures } from '../hooks/useWeatherGestures';
import { useWeatherStore } from '../state';
import { useActivityId } from '../../../os/ActivityContext';
import { getWeatherUnitPicker } from '../utils/unitPicker';
import type { WeatherSettings } from '../types';

type PickerOption = { label: string; value: string; tapProps: React.HTMLAttributes<HTMLButtonElement> };
const PickerPopup: React.FC<{ options: PickerOption[]; value: string; title: string }> = ({ options,value,title }) => {
  const { bindBack }=useWeatherGestures();const s=useAppStrings(strings,stringsEn);
  return <div className="absolute inset-0 z-[70] flex items-center justify-center p-6" data-weather-unit-dialog>
    <button className="absolute inset-0 bg-black/30" aria-label={s.cancel} {...bindBack<HTMLButtonElement>()}/>
    <section role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-[320px] max-h-[85%] overflow-y-auto bg-white rounded-2xl shadow-2xl py-2"
      data-scroll-container="unitPicker" data-scroll-direction="vertical">
      <div role="radiogroup" aria-label={title}>
        {options.map(option=><button key={option.value} type="button" role="radio" aria-checked={option.value===value} {...option.tapProps}
          className="w-full px-5 py-3 text-left flex items-center justify-between gap-3 active:bg-gray-50">
          <span className={`text-[15px] leading-snug ${option.value===value?'text-[#007AFF] font-medium':'text-gray-900'}`}>{option.label}</span>
          {option.value===value&&<IcCheck size={18} className="text-[#007AFF] flex-shrink-0"/>}
        </button>)}
      </div>
      <button className="w-full px-5 py-3 text-[15px] text-gray-500" {...bindBack<HTMLButtonElement>()}>{s.cancel}</button>
    </section>
  </div>;
};

function useWeatherSetting<K extends keyof WeatherSettings>(key: K) {
  const value = useWeatherStore((s) => s.settings[key]);
  const set = useCallback((v: WeatherSettings[K]) => {
    useWeatherStore.setState((prev) => ({
      settings: { ...prev.settings, [key]: v },
    }));
  }, [key]);
  return [value, set] as const;
}

const UnitPreferenceItem: React.FC<{
  title:string; options:PickerOption[]; value:string; tapProps:React.HTMLAttributes<HTMLButtonElement>;
}> = ({title,options,value,tapProps}) => <div>
  <button className="w-full text-left flex items-center px-4 py-3.5 active:bg-gray-50 min-h-[52px]" {...tapProps}>
    <div className="flex-1 min-w-0"><div className="text-[15px] text-gray-900 leading-tight">{title}</div></div>
    <div className="flex items-center ml-2 flex-shrink-0 gap-1"><span className="text-[13px] text-gray-400">{options.find(option=>option.value===value)?.label??''}</span><IcChevronsUpDown size={14} className="text-gray-300"/></div>
  </button>
  <div className="h-px bg-gray-100 ml-4 mr-4"/>
</div>;

const WeatherSwitchItem: React.FC<{
  title: string;
  summary?: string;
  settingKey: keyof WeatherSettings;
  showDivider?: boolean;
}> = ({ title, summary, settingKey, showDivider = true }) => {
  const [checked, setChecked] = useWeatherSetting(settingKey);

  return (
    <div>
      <div
        className="flex items-center px-4 py-3.5 active:bg-gray-50 min-h-[52px]"
        onClick={() => setChecked(!checked as WeatherSettings[typeof settingKey])}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[15px] text-gray-900 leading-tight">{title}</div>
          {summary && (
            <div className="text-[12px] text-gray-400 mt-0.5 leading-tight line-clamp-2">
              {summary}
            </div>
          )}
        </div>
        <div className="ml-3 flex-shrink-0">
          <div
            className={`w-[44px] h-[26px] rounded-full flex items-center p-[2px] transition-colors duration-200 ${
              checked ? 'bg-[#34c759] justify-end' : 'bg-gray-300 justify-start'
            }`}
          >
            <div className="w-[22px] h-[22px] bg-white rounded-full shadow-sm" />
          </div>
        </div>
      </div>
      {showDivider && <div className="h-px bg-gray-100 ml-4 mr-4" />}
    </div>
  );
};

const lightThemeOverrides: React.CSSProperties = {
  '--app-surface': '#ffffff',
  '--app-text': '#1c1c1e',
  '--app-text-muted': '#8e8e93',
  '--app-primary': '#34c759',
  '--app-border': '#e5e7eb',
} as React.CSSProperties;

const WeatherSettingsPage: React.FC = () => {
  const { bindTap, bindBack, go, back } = useWeatherGestures();
  const s = useAppStrings(strings, stringsEn);

  const activityId=useActivityId();
  const location=useLocation(),picker=getWeatherUnitPicker(location.pathname,location.search);
  const settings=useWeatherStore(state=>state.settings),closed=useRef<string|null>(null),opening=useRef<string|null>(null);
  const liveLocation=useRef(location);liveLocation.current=location;
  const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{opening.current=null;},[location.key]);
  const openOnce=(open:()=>void)=>{if(opening.current===location.key)return;opening.current=location.key;open();};
  const selectUnit=(key:'tempUnit'|'windUnit'|'pressureUnit',value:WeatherSettings[typeof key])=>{
    const expected=key==='tempUnit'?'temp':key==='windUnit'?'wind':'pressure';
    const state=window.__OS__?.getState(),top=state?.tasks.find(task=>task.taskId===state.activeTaskId)?.stack.at(-1);
    if(!mounted.current || liveLocation.current.key!==location.key || top?.activityId!==activityId || picker!==expected || closed.current===location.key)return;
    closed.current=location.key;
    useWeatherStore.setState(previous=>({settings:{...previous.settings,[key]:value}}));back();
  };
  const tempOptions:PickerOption[]=[
    {label:s.settings_temp_unit_celsius,value:'celsius',tapProps:bindTap({kind:'action',id:'settings.tempUnit.select.celsius'},{onTrigger:()=>selectUnit('tempUnit','celsius')})},
    {label:s.settings_temp_unit_fahrenheit,value:'fahrenheit',tapProps:bindTap({kind:'action',id:'settings.tempUnit.select.fahrenheit'},{onTrigger:()=>selectUnit('tempUnit','fahrenheit')})},
  ];
  const windOptions:PickerOption[]=[
    {label:s.settings_wind_unit_beaufort,value:'beaufort',tapProps:bindTap({kind:'action',id:'settings.windUnit.select.beaufort'},{onTrigger:()=>selectUnit('windUnit','beaufort')})},
    {label:s.settings_wind_unit_kmh,value:'kmh',tapProps:bindTap({kind:'action',id:'settings.windUnit.select.kmh'},{onTrigger:()=>selectUnit('windUnit','kmh')})},
    {label:s.settings_wind_unit_ms,value:'ms',tapProps:bindTap({kind:'action',id:'settings.windUnit.select.ms'},{onTrigger:()=>selectUnit('windUnit','ms')})},
    {label:s.settings_wind_unit_mph,value:'mph',tapProps:bindTap({kind:'action',id:'settings.windUnit.select.mph'},{onTrigger:()=>selectUnit('windUnit','mph')})},
    {label:s.settings_wind_unit_kn,value:'kn',tapProps:bindTap({kind:'action',id:'settings.windUnit.select.kn'},{onTrigger:()=>selectUnit('windUnit','kn')})},
  ];
  const pressureOptions:PickerOption[]=[
    {label:s.settings_pressure_unit_hpa,value:'hpa',tapProps:bindTap({kind:'action',id:'settings.pressureUnit.select.hpa'},{onTrigger:()=>selectUnit('pressureUnit','hpa')})},
    {label:s.settings_pressure_unit_mmhg,value:'mmhg',tapProps:bindTap({kind:'action',id:'settings.pressureUnit.select.mmhg'},{onTrigger:()=>selectUnit('pressureUnit','mmhg')})},
    {label:s.settings_pressure_unit_inhg,value:'inhg',tapProps:bindTap({kind:'action',id:'settings.pressureUnit.select.inhg'},{onTrigger:()=>selectUnit('pressureUnit','inhg')})},
  ];
  const active=picker==='temp'?{options:tempOptions,value:settings.tempUnit,title:s.settings_temp_unit}:picker==='wind'?{options:windOptions,value:settings.windUnit,title:s.settings_wind_unit}:picker==='pressure'?{options:pressureOptions,value:settings.pressureUnit,title:s.settings_pressure_unit}:null;

  return (
    <div
      data-weather-settings className="relative flex flex-col h-full min-h-0 bg-[#f4f4f4] dark:bg-black text-black dark:text-white pt-10"
      data-status-bar-foreground="dark"
      style={lightThemeOverrides}
    >
      <div className="flex flex-col flex-1 min-h-0" data-weather-settings-background inert={!!picker} aria-hidden={picker?true:undefined}>
      <div className="flex items-center px-4 py-3">
        <button
          {...bindBack<HTMLButtonElement>()}
          className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
        >
          <IcNavBack size={24} />
        </button>
        <h1 className="ml-2 text-xl font-medium">{s.settings_title}</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-8" data-scroll-container={picker ? undefined : 'main'} data-scroll-direction="vertical">
        <PreferenceCategory title={s.settings_category_alerts}>
          <WeatherSwitchItem
            settingKey="morningEveningAlert"
            title={s.settings_morning_evening_alert}
            summary={s.settings_morning_evening_alert_summary}
          />
          <WeatherSwitchItem
            settingKey="warningAlert"
            title={s.settings_warning_alert}
            summary={s.settings_warning_alert_summary}
          />
          <WeatherSwitchItem
            settingKey="abnormalWeatherAlert"
            title={s.settings_abnormal_weather_alert}
            summary={s.settings_abnormal_weather_alert_summary}
          />
          <WeatherSwitchItem
            settingKey="nightDnd"
            title={s.settings_night_dnd}
            summary={s.settings_night_dnd_summary}
          />
        </PreferenceCategory>

        <PreferenceCategory title={s.settings_category_units}>
          <UnitPreferenceItem title={s.settings_temp_unit} options={tempOptions} value={settings.tempUnit}
            tapProps={bindTap('settings.picker.temp.open',{onTrigger:()=>openOnce(()=>go('settings.picker.temp.open'))})} />
          <UnitPreferenceItem title={s.settings_wind_unit} options={windOptions} value={settings.windUnit}
            tapProps={bindTap('settings.picker.wind.open',{onTrigger:()=>openOnce(()=>go('settings.picker.wind.open'))})} />
          <UnitPreferenceItem title={s.settings_pressure_unit} options={pressureOptions} value={settings.pressureUnit}
            tapProps={bindTap('settings.picker.pressure.open',{onTrigger:()=>openOnce(()=>go('settings.picker.pressure.open'))})} />
        </PreferenceCategory>

        <PreferenceCategory title={s.settings_category_other}>
          <WeatherSwitchItem
            settingKey="nightAutoUpdate"
            title={s.settings_night_auto_update}
            summary={s.settings_night_auto_update_summary}
          />
        </PreferenceCategory>

        <PreferenceCategory title={s.settings_category_about}>
          <PreferenceItemNav title={s.settings_user_experience} />
          <PreferenceItemNav title={s.settings_feedback} />
          <PreferenceItemNav
            title={s.settings_privacy_policy}
            itemProps={bindTap<HTMLDivElement>('privacy.open')}
          />
          <WeatherSwitchItem
            settingKey="revokeConsent"
            title={s.settings_revoke_consent}
            summary={s.settings_revoke_consent_summary}
          />
        </PreferenceCategory>

        <PreferenceCategory>
          <PreferenceItemNav
            title={s.settings_privacy_settings}
            itemProps={bindTap<HTMLDivElement>('privacy.open')}
            showDivider={false}
          />
        </PreferenceCategory>
      </div>
      </div>
      {active&&<PickerPopup {...active}/>}

    </div>
  );
};

const PreferenceItemNav: React.FC<{
  title: string;
  showDivider?: boolean;
  itemProps?: React.HTMLAttributes<HTMLDivElement>;
}> = ({ title, showDivider = true, itemProps }) => {
  return (
    <div>
      <div
        className="flex items-center px-4 py-3.5 active:bg-gray-50 min-h-[52px]"
        {...itemProps}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[15px] text-gray-900 leading-tight">{title}</div>
        </div>
        <div className="flex items-center ml-2 flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
      {showDivider && <div className="h-px bg-gray-100 ml-4 mr-4" />}
    </div>
  );
};

export default WeatherSettingsPage;
