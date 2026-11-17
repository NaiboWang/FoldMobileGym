export type WeatherHomeMenu = 'more' | 'temperature';

export function getWeatherHomeMenu(pathname: string, search: string): WeatherHomeMenu | null {
  if (pathname !== '/') return null;
  const value = new URLSearchParams(search).get('menu');
  return value === 'more' || value === 'temperature' ? value : null;
}

/** Home forecast view is not an overlay, even when its URL has a query. */
export function isWeatherHomeView(pathname: string, search: string): boolean {
  return pathname === '/' && getWeatherHomeMenu(pathname, search) === null;
}

/** Reconstruct an overlay's owning view when entered without a matching parent. */
export function weatherHomeMenuFallback(pathname: string, search: string, previous?: { pathname: string; search: string }): string | null {
  const menu = getWeatherHomeMenu(pathname, search);
  if (!menu) return null;
  const list = new URLSearchParams(search).get('forecastLayout') === 'list';
  const previousList = new URLSearchParams(previous?.search).get('forecastLayout') === 'list';
  const previousMatches = previous && previous.pathname === '/' && previousList === list;
  if (menu === 'temperature') {
    if (previousMatches && getWeatherHomeMenu(previous.pathname, previous.search) === 'more') return null;
    return list ? '/?menu=more&forecastLayout=list' : '/?menu=more';
  }
  if (previousMatches && isWeatherHomeView(previous.pathname, previous.search)) return null;
  return list ? '/?forecastLayout=list' : '/';
}
