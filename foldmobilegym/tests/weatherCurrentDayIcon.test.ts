import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import type { WeatherDaily } from '../apps/Weather/types';
import { getWeatherIcon } from '../apps/Weather/utils/weatherIcons';
const clock = vi.hoisted(() => ({hour: 12}));
vi.mock('../apps/Weather/state', () => ({useWeatherStore:(selector:(state:unknown)=>unknown)=>selector({settings:{tempUnit:'celsius'}})}));
vi.mock('../apps/Weather/hooks/useWeatherMinute', () => ({useWeatherMinute:()=>new Date(2026,9,13,clock.hour,0).getTime()}));
vi.mock('@/os/locale', () => ({useLocale:()=> 'zh-Hans'}));
import { DailyForecastShort } from '../apps/Weather/components/DailyForecastShort';
const day = (fxDate:string) => ({fxDate,tempMax:'25',tempMin:'18',textDay:'晴',textNight:'晴',iconDay:'100',iconNight:'150',sunrise:'06:00',sunset:'18:00'} as WeatherDaily);
const daily=['2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17'].map(day);
function iconFor(fxDate:string, data=daily) {
 const html=renderToStaticMarkup(React.createElement(DailyForecastShort,{daily:data,yesterday:day('2026-10-12'),layout:'chart',chartButtonProps:{},listButtonProps:{}}));
 const chunks=html.split(`data-weather-day-date="${fxDate}"`).slice(1);
 return chunks.map(chunk=>chunk.match(/<img[^>]*src="([^"]+)"/)?.[1]);
}
describe('weather recent forecast current-day icon',()=>{
 it('uses supplied nighttime icon for today at night in both chart and list',()=>{clock.hour=22;expect(iconFor('2026-10-13')).toEqual([getWeatherIcon('150','晴'),getWeatherIcon('150','晴')]);});
 it('keeps past and future dates on their daytime forecast even at night',()=>{clock.hour=22;expect(iconFor('2026-10-12')).toEqual([getWeatherIcon('100','晴'),getWeatherIcon('100','晴')]);expect(iconFor('2026-10-14')).toEqual([getWeatherIcon('100','晴'),getWeatherIcon('100','晴')]);});
 it('uses the day icon in daylight and the night icon from sunset',()=>{clock.hour=12;expect(iconFor('2026-10-13')[0]).toBe(getWeatherIcon('100','晴'));clock.hour=18;expect(iconFor('2026-10-13')[0]).toBe(getWeatherIcon('150','晴'));});
 it('uses the supplied night icon before sunrise and returns to the day icon at sunrise',()=>{clock.hour=5;expect(iconFor('2026-10-13')[0]).toBe(getWeatherIcon('150','晴'));clock.hour=6;expect(iconFor('2026-10-13')[0]).toBe(getWeatherIcon('100','晴'));});
 it('does not invent solar times or a missing night icon',()=>{clock.hour=22;for(const patch of [{sunrise:'',sunset:''},{sunrise:'25:00'},{sunrise:'20:00',sunset:'06:00'},{iconNight:''}]) {const data=daily.map(d=>({...d,...patch}));expect(iconFor('2026-10-13',data)[0]).toBe(getWeatherIcon('100','晴'));}});
});
