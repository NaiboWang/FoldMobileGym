import React from 'react';
import { useLocation } from 'react-router-dom';
import { SettingsHeader } from './SettingsHeader';
import { useSettingsGestures } from '../hooks/useSettingsGestures';
import { useBooleanPreference, useStringPreference } from '../state';
import { useSettingsStrings } from '../res/useSettingsStrings';
import {
  DEFAULT_SETTINGS_INPUT_METHOD,
  getSettingsInputMethodSheet,
  isSettingsInputMethodId,
  type SettingsInputMethodId,
} from '../settingsLanguageInput';

const INPUT_METHOD_SETTING_KEY = 'default_input_method';

type MethodRow = {
  id: 'baidu-honor' | 'sogou' | 'sogou-honor' | 'google-voice';
  title: string;
  summary: string;
};

export const LanguageAndInputPage: React.FC = () => {
  const location = useLocation();
  const { s } = useSettingsStrings();
  const { bindTap, bindBack, go, back } = useSettingsGestures();
  const fromSearch = location.pathname.startsWith('/search/');
  const sheetOpen = getSettingsInputMethodSheet(location.pathname, location.search) !== null;
  const [storedMethod, setStoredMethod] = useStringPreference(INPUT_METHOD_SETTING_KEY, DEFAULT_SETTINGS_INPUT_METHOD);
  const currentMethod: SettingsInputMethodId = isSettingsInputMethodId(storedMethod)
    ? storedMethod
    : DEFAULT_SETTINGS_INPUT_METHOD;
  const [edgeProtection, setEdgeProtection] = useBooleanPreference('keyboard_edge_protection', true);
  const [keyboardRaise, setKeyboardRaise] = useBooleanPreference('keyboard_raise', true);
  const [secureInput, setSecureInput] = useBooleanPreference('secure_input_honor', true);

  const methodLabels: Record<SettingsInputMethodId, string> = {
    sogou: s.sogou_input,
    'sogou-honor': s.sogou_input_honor,
    'baidu-honor': s.baidu_input_honor,
  };
  const rows: MethodRow[] = [
    { id: 'baidu-honor', title: s.baidu_input_honor, summary: s.chinese_china },
    { id: 'sogou', title: s.sogou_input, summary: '' },
    { id: 'sogou-honor', title: s.sogou_input_honor, summary: s.chinese_china },
    { id: 'google-voice', title: s.google_voice_input, summary: s.automatic },
  ];

  const openPage = (pageId: string) => {
    if (fromSearch) go('settings.search.result.open', { pageId });
    else go('page.open', { pageId });
  };
  const choose = (id: SettingsInputMethodId) => {
    setStoredMethod(id);
    back();
  };

  const methodAction = (id: SettingsInputMethodId) => {
    if (fromSearch) {
      if (id === 'sogou') return bindTap<HTMLButtonElement>({ kind: 'action', id: 'settings.search.inputMethod.select.sogou' }, { onTrigger: () => choose(id) });
      if (id === 'sogou-honor') return bindTap<HTMLButtonElement>({ kind: 'action', id: 'settings.search.inputMethod.select.sogouHonor' }, { onTrigger: () => choose(id) });
      return bindTap<HTMLButtonElement>({ kind: 'action', id: 'settings.search.inputMethod.select.baiduHonor' }, { onTrigger: () => choose(id) });
    }
    if (id === 'sogou') return bindTap<HTMLButtonElement>({ kind: 'action', id: 'settings.page.inputMethod.select.sogou' }, { onTrigger: () => choose(id) });
    if (id === 'sogou-honor') return bindTap<HTMLButtonElement>({ kind: 'action', id: 'settings.page.inputMethod.select.sogouHonor' }, { onTrigger: () => choose(id) });
    return bindTap<HTMLButtonElement>({ kind: 'action', id: 'settings.page.inputMethod.select.baiduHonor' }, { onTrigger: () => choose(id) });
  };

  const pageTransition = (pageId: string) => fromSearch
    ? bindTap<HTMLButtonElement>('settings.search.result.open', { params: { pageId }, onTrigger: () => openPage(pageId) })
    : bindTap<HTMLButtonElement>('page.open', { params: { pageId }, onTrigger: () => openPage(pageId) });

  return <>
    <div className="settings-language-input-page" data-settings-language-input inert={sheetOpen || undefined}>
      <SettingsHeader title={s.language_input_title} />
      <div className="settings-language-input-scroll no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical">
        <div className="settings-language-input-links">
          <button type="button" className="settings-language-input-row settings-language-input-default" {...pageTransition('language_and_region_settings')}>
            <span className="settings-language-input-title">{s.language_region}</span>
          </button>
          <button type="button" className="settings-language-input-row settings-language-input-default" {...pageTransition('key_app_language_picker_page')}>
            <span className="settings-language-input-title">{s.app_languages}</span>
          </button>
        </div>

        <div className="settings-language-input-section-label">{s.input_methods}</div>
        <div className="settings-language-input-links">
          <ToggleRow title={s.keyboard_edge_protection} summary={s.keyboard_edge_protection_summary} checked={edgeProtection} onChange={setEdgeProtection} />
          <ToggleRow title={s.keyboard_raise} summary={s.keyboard_raise_summary} checked={keyboardRaise} onChange={setKeyboardRaise} />
          <ToggleRow title={s.secure_input_honor} summary={s.secure_input_summary} checked={secureInput} onChange={setSecureInput} />
        </div>

        <button
          type="button"
          className="settings-language-input-row settings-language-input-default"
          data-settings-default-input
          aria-label={`${s.input_method_default}: ${methodLabels[currentMethod]}`}
          {...(fromSearch
            ? bindTap('settings.search.inputMethod.open', {
                params: { pageId: 'language_and_input' },
                onTrigger: () => go('settings.search.inputMethod.open', { pageId: 'language_and_input' }),
              })
            : bindTap('settings.page.inputMethod.open', {
                params: { pageId: 'language_and_input' },
                onTrigger: () => go('settings.page.inputMethod.open', { pageId: 'language_and_input' }),
              }))}
        >
          <span className="settings-language-input-copy">
            <span className="settings-language-input-title block">{s.input_method_default}</span>
          </span>
        </button>

        <div className="settings-language-input-card">
          {rows.map((row) => <div className="settings-language-input-row" key={row.id}>
            <span className="settings-language-input-check" aria-hidden="true">✓</span>
            <span className="settings-language-input-copy">
              <span className="settings-language-input-title block">{row.title}</span>
              {row.summary && <span className="settings-language-input-summary block">{row.summary}</span>}
            </span>
          </div>)}
        </div>
      </div>
    </div>

    {sheetOpen && <div className="settings-language-input-overlay" data-settings-input-method-dialog role="dialog" aria-modal="true" aria-labelledby="settings-input-method-title">
      <button type="button" className="settings-language-input-scrim" aria-label={s.back} {...bindBack<HTMLButtonElement>()} />
      <div className="settings-language-input-dialog">
        <div id="settings-input-method-title" className="settings-language-input-dialog-title">{s.select_input_method}</div>
        {(['sogou', 'sogou-honor', 'baidu-honor'] as const).map((id) => <button
          type="button"
          key={id}
          className="settings-language-input-dialog-option"
          data-settings-input-method={id}
          aria-checked={currentMethod === id}
          role="radio"
          {...methodAction(id)}
        >{methodLabels[id]}</button>)}
      </div>
    </div>}
  </>;
};

function ToggleRow({ title, summary, checked, onChange }: {
  title: string;
  summary: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return <button type="button" className="settings-language-input-row settings-language-input-default" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
    <span className="settings-language-input-copy">
      <span className="settings-language-input-title block">{title}</span>
      <span className="settings-language-input-summary block">{summary}</span>
    </span>
    <span className={`w-10 h-6 rounded-full p-0.5 flex transition-colors ${checked ? 'bg-app-primary justify-end' : 'bg-gray-300 justify-start'}`} aria-hidden="true">
      <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
    </span>
  </button>;
}
