export const SETTINGS_INPUT_METHOD_SHEET = 'input-method' as const;

export const SETTINGS_INPUT_METHOD_IDS = [
  'sogou',
  'sogou-honor',
  'baidu-honor',
] as const;

export type SettingsInputMethodId = (typeof SETTINGS_INPUT_METHOD_IDS)[number];

export const DEFAULT_SETTINGS_INPUT_METHOD: SettingsInputMethodId = 'baidu-honor';

export function isSettingsInputMethodId(value: unknown): value is SettingsInputMethodId {
  return typeof value === 'string' && SETTINGS_INPUT_METHOD_IDS.includes(value as SettingsInputMethodId);
}

export function isInputMethodSearchQuery(value: string): boolean {
  const query = value.trim().toLowerCase();
  if (!query) return false;
  return query.includes('输入法') || query.includes('input method') || query.includes('input-method');
}

export function isLanguageInputPath(pathname: string): boolean {
  return pathname === '/page/language_and_input' || pathname === '/search/language_and_input';
}

export function getSettingsInputMethodSheet(pathname: string, search: string): typeof SETTINGS_INPUT_METHOD_SHEET | null {
  if (!isLanguageInputPath(pathname)) return null;
  const params = new URLSearchParams(search);
  return params.get('sheet') === SETTINGS_INPUT_METHOD_SHEET ? SETTINGS_INPUT_METHOD_SHEET : null;
}

export function settingsInputMethodBackFallback(pathname: string, search: string): string | null {
  if (getSettingsInputMethodSheet(pathname, search)) return pathname;
  if (pathname === '/search/language_and_input') return '/search';
  return null;
}
