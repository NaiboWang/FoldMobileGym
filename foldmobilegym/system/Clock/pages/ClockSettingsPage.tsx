import React from 'react';
import { BROWSER_ALARM_GRADUAL_SECONDS } from '../../../os/BrowserTimerSound';
import { useAppStrings } from '../../../os/useAppStrings';
import { useClockGestures } from '../hooks/useClockGestures';
import { useAlarmInteractionOwner } from '../hooks/useAlarmInteractionOwner';
import { useClockStore } from '../state';
import { IcNavBack } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function ClockSettingsPage() {
  const s = useAppStrings(strings, stringsEn), { bindTap, bindBack } = useClockGestures();
  const owns = useAlarmInteractionOwner('clock-settings');
  const gradual = useClockStore(state => state.settings?.gradualVolume === true);
  const back = bindBack();
  const toggle = bindTap({ kind: 'action', id: 'clock.settings.gradualVolume.toggle' }, {
    params: { value: !gradual },
    onTrigger: () => useClockStore.getState().updateSettings({ gradualVolume: !gradual }),
  });
  return <main className="h-full min-h-0 flex flex-col bg-app-bg text-app-text pt-10"
    data-clock-settings data-status-bar-foreground="dark">
    <header className="h-14 flex items-center gap-3 px-4 shrink-0">
      <button type="button" className="w-10 h-10 flex items-center justify-center" aria-label={s.clock_settings_back}
        {...back} onClick={event => { if (owns()) back.onClick?.(event); }}><IcNavBack size={24} /></button>
      <h1 className="text-[20px] font-medium">{s.clock_settings_title}</h1>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10" data-scroll-container="main" data-scroll-direction="vertical">
      <div className="clock-settings-content">
        <section className="clock-settings-group mt-5">
          <div className="clock-settings-row" aria-disabled="true">
            <span>{s.clock_settings_upcoming}</span><span className="clock-settings-value">{s.clock_settings_unavailable}</span>
          </div>
          <div className="clock-settings-row" aria-disabled="true">
            <span>{s.clock_settings_tone}</span><span className="clock-settings-value">{s.clock_settings_browser_tone}</span>
          </div>
          <button type="button" role="switch" aria-checked={gradual} className="clock-settings-row w-full text-left"
            {...toggle} onClick={event => {
              if (owns() && (useClockStore.getState().settings?.gradualVolume === true) === gradual) toggle.onClick?.(event);
            }}>
            <span className="min-w-0"><span className="block">{s.clock_settings_gradual}</span><small className="block text-app-text-secondary mt-1">{s.clock_settings_gradual_description}</small></span>
            <span aria-hidden="true" className={`w-11 h-6 rounded-full p-0.5 shrink-0 ml-3 ${gradual ? 'bg-app-primary' : 'bg-app-border'}`}>
              <span className={`block w-5 h-5 rounded-full bg-app-surface shadow-sm ${gradual ? 'translate-x-5' : ''}`} />
            </span>
          </button>
        </section>
        <section className="clock-settings-group mt-5">
          <div className="clock-settings-row" aria-disabled="true">
            <span><span className="block">{s.clock_settings_update}</span><small className="block mt-1">{s.clock_settings_update_unavailable}</small></span>
          </div>
        </section>
        <p className="text-[12px] leading-relaxed text-app-text-secondary px-3 mt-4">{s.clock_settings_gradual_scope.replace('{seconds}', String(BROWSER_ALARM_GRADUAL_SECONDS))}</p>
      </div>
    </div>
  </main>;
}
