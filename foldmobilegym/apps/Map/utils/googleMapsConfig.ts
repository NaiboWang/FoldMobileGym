export const OFFLINE_GOOGLE_MAPS_API_KEY = 'AIzaSyOfflineMapCacheOnly00000000000000';

const PLACEHOLDER_KEYS = new Set(['YOUR_API_KEY_HERE', OFFLINE_GOOGLE_MAPS_API_KEY, '']);

export function getGoogleMapsApiKey(): string {
  const raw = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '';
  const key = raw.trim();
  return PLACEHOLDER_KEYS.has(key) ? '' : key;
}

export function hasGoogleMapsApiKey(): boolean {
  return getGoogleMapsApiKey().length > 0;
}

/** The supplied offline SDK cache contains zh_cn modules only. App chrome
 * remains independently localized; do not request missing online SDK modules. */
export function resolveGoogleMapsSdkLocale(locale: 'zh-Hans' | 'en', hasRealKey: boolean): 'zh-Hans' | 'en' {
  return hasRealKey ? locale : 'zh-Hans';
}
