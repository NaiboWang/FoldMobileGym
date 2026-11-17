export const WEATHER_UNIT_PICKERS = ['temp','wind','pressure'] as const;
export type WeatherUnitPicker = typeof WEATHER_UNIT_PICKERS[number];
export function getWeatherUnitPicker(pathname: string,search: string): WeatherUnitPicker|null {
  if(pathname!=='/settings')return null;
  const value=new URLSearchParams(search).get('picker');
  return WEATHER_UNIT_PICKERS.includes(value as WeatherUnitPicker)?value as WeatherUnitPicker:null;
}
export function weatherUnitPickerFallback(pathname: string,search: string,previous?: {pathname:string;search:string}) {
  if(!getWeatherUnitPicker(pathname,search))return null;
  return previous?.pathname==='/settings'&&!getWeatherUnitPicker(previous.pathname,previous.search)?null:'/settings';
}
