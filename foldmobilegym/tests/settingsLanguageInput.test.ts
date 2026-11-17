import { describe, expect, it } from 'vitest';
import { NAVIGATION_DECLARATION } from '../system/Settings/navigation.declaration';
import {
  DEFAULT_SETTINGS_INPUT_METHOD,
  SETTINGS_INPUT_METHOD_IDS,
  getSettingsInputMethodSheet,
  isInputMethodSearchQuery,
  isLanguageInputPath,
  isSettingsInputMethodId,
  settingsInputMethodBackFallback,
} from '../system/Settings/settingsLanguageInput';

describe('Settings language and input navigation contract', () => {
  it('recognizes only the two real language/input detail paths and legal sheet value', () => {
    expect(isLanguageInputPath('/page/language_and_input')).toBe(true);
    expect(isLanguageInputPath('/search/language_and_input')).toBe(true);
    expect(isLanguageInputPath('/page/language_keyboard_settings')).toBe(false);
    expect(getSettingsInputMethodSheet('/page/language_and_input', '?sheet=input-method')).toBe('input-method');
    expect(getSettingsInputMethodSheet('/search/language_and_input', '?sheet=input-method')).toBe('input-method');
    expect(getSettingsInputMethodSheet('/page/language_and_input', '?sheet=other')).toBeNull();
    expect(getSettingsInputMethodSheet('/page/other', '?sheet=input-method')).toBeNull();
  });

  it('rebuilds a cold dialog URL before leaving the detail flow', () => {
    expect(settingsInputMethodBackFallback('/page/language_and_input', '?sheet=input-method')).toBe('/page/language_and_input');
    expect(settingsInputMethodBackFallback('/search/language_and_input', '?sheet=input-method')).toBe('/search/language_and_input');
    expect(settingsInputMethodBackFallback('/search/language_and_input', '')).toBe('/search');
    expect(settingsInputMethodBackFallback('/page/language_and_input', '')).toBeNull();
  });

  it('keeps the default input method inside the selectable allowlist', () => {
    expect(SETTINGS_INPUT_METHOD_IDS).toEqual(['sogou', 'sogou-honor', 'baidu-honor']);
    expect(DEFAULT_SETTINGS_INPUT_METHOD).toBe('baidu-honor');
    for (const id of SETTINGS_INPUT_METHOD_IDS) expect(isSettingsInputMethodId(id)).toBe(true);
    expect(isSettingsInputMethodId('google-voice')).toBe(false);
    expect(isSettingsInputMethodId('')).toBe(false);
  });

  it('activates the native input-method result grouping only for explicit queries', () => {
    expect(isInputMethodSearchQuery('输入法')).toBe(true);
    expect(isInputMethodSearchQuery('荣耀输入法设置')).toBe(true);
    expect(isInputMethodSearchQuery('input method')).toBe(true);
    expect(isInputMethodSearchQuery('Input-Method settings')).toBe(true);
    expect(isInputMethodSearchQuery('keyboard')).toBe(false);
    expect(isInputMethodSearchQuery('')).toBe(false);
  });

  it('declares persistent search detail, both URL sheets, and six source-specific selections', () => {
    const routes = new Map(NAVIGATION_DECLARATION.routes.map(route => [route.path, route]));
    expect(routes.has('/search/:pageId')).toBe(true);
    expect(routes.get('/search/:pageId')?.uiStates.map(state => state.search)).toContainEqual({ sheet: 'input-method' });
    expect(routes.get('/page/:pageId')?.uiStates.map(state => state.search)).toContainEqual({ sheet: 'input-method' });

    const transitionIds = NAVIGATION_DECLARATION.transitions.map(transition => transition.id);
    expect(transitionIds).toEqual(expect.arrayContaining([
      'settings.search.result.open',
      'settings.search.inputMethod.open',
      'settings.page.inputMethod.open',
    ]));

    const actionIds = NAVIGATION_DECLARATION.routes.flatMap(route => route.uiStates)
      .flatMap(state => 'actions' in state && state.actions ? state.actions.map(action => action.id) : []);
    expect(actionIds).toEqual(expect.arrayContaining([
      'settings.search.inputMethod.select.sogou',
      'settings.search.inputMethod.select.sogouHonor',
      'settings.search.inputMethod.select.baiduHonor',
      'settings.page.inputMethod.select.sogou',
      'settings.page.inputMethod.select.sogouHonor',
      'settings.page.inputMethod.select.baiduHonor',
    ]));
  });
});
