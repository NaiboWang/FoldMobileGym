import React from 'react';
import { IcNavBack, IcNavForward } from '../res/icons';
import { useFileManagerGestures } from '../hooks/useFileManagerGestures';
import { useFileManagerStore } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';

type SettingKey = 'useMobileData' | 'showHiddenFiles' | 'showSystemHiddenFiles' | 'autoCollectDocuments';

export const SettingsPage: React.FC = () => {
  const { bindBack } = useFileManagerGestures();
  const s = useAppStrings(strings, stringsEn);
  const settings = useFileManagerStore(state => state.settings);
  const toggleSetting = useFileManagerStore(state => state.toggleSetting);

  const toggleRows: Array<{ key: SettingKey; title: string; detail?: string; action: string }> = [
    { key: 'useMobileData', title: s.settings_mobile_data, detail: s.settings_mobile_data_detail, action: 'file.settings.mobileData.toggle' },
    { key: 'showHiddenFiles', title: s.settings_hidden_files, detail: s.settings_hidden_files_detail, action: 'file.settings.hidden.toggle' },
    { key: 'showSystemHiddenFiles', title: s.settings_system_hidden, detail: s.settings_system_hidden_detail, action: 'file.settings.systemHidden.toggle' },
    { key: 'autoCollectDocuments', title: s.settings_auto_collect, detail: s.settings_auto_collect_detail, action: 'file.settings.autoCollect.toggle' },
  ];

  return (
    <div className="fm-settings-page h-full overflow-y-auto" data-scroll-container="main" data-scroll-direction="vertical">
      <header>
        <button type="button" {...bindBack()} aria-label={s.search_back}><IcNavBack size={28} /></button>
        <h1>{s.directory_settings}</h1>
      </header>
      <section className="fm-settings-card">
        <button type="button" className="fm-settings-row" disabled>
          <span><strong>{s.settings_sync}</strong></span>
          <span className="fm-settings-value">{s.settings_enabled}<IcNavForward size={18} /></span>
        </button>
        <ToggleRow row={toggleRows[0]} checked={settings.useMobileData} onToggle={() => toggleSetting('useMobileData')} />
      </section>
      <section className="fm-settings-card">
        <button type="button" className="fm-settings-row" disabled>
          <span><strong>{s.settings_small_images}</strong><small>{s.settings_small_images_detail}</small></span>
          <span className="fm-settings-value">{s.settings_no_filter}<IcNavForward size={18} /></span>
        </button>
        <ToggleRow row={toggleRows[1]} checked={settings.showHiddenFiles} onToggle={() => toggleSetting('showHiddenFiles')} />
        <ToggleRow row={toggleRows[2]} checked={settings.showSystemHiddenFiles} onToggle={() => toggleSetting('showSystemHiddenFiles')} />
        <ToggleRow row={toggleRows[3]} checked={settings.autoCollectDocuments} onToggle={() => toggleSetting('autoCollectDocuments')} />
        <button type="button" className="fm-settings-row" disabled>
          <span><strong>{s.settings_clear_cache}</strong><small>{s.settings_clear_cache_detail}</small></span>
          <IcNavForward size={18} />
        </button>
      </section>
      <section className="fm-settings-card fm-settings-links">
        <button type="button" disabled><strong>{s.settings_extended}</strong><IcNavForward size={18} /></button>
        <button type="button" disabled><strong>{s.settings_about}</strong><IcNavForward size={18} /></button>
      </section>
      <p className="fm-settings-footnote">{s.settings_cloud_notice}</p>
    </div>
  );
};

const ToggleRow: React.FC<{
  row: { key: SettingKey; title: string; detail?: string; action: string };
  checked: boolean;
  onToggle: () => void;
}> = ({ row, checked, onToggle }) => (
  <button
    type="button"
    className="fm-settings-row"
    onClick={onToggle}
    data-action={row.action}
    data-action-type="toggle"
    aria-pressed={checked}
  >
    <span><strong>{row.title}</strong>{row.detail ? <small>{row.detail}</small> : null}</span>
    <span className={`fm-settings-switch ${checked ? 'is-on' : ''}`} aria-hidden="true"><i /></span>
  </button>
);

export default SettingsPage;
