import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { strings } from '../apps/Weather/res/strings';
import type { WeatherNow } from '../apps/Weather/types';
vi.mock('../os/useAppStrings', () => ({ useAppStrings: () => strings }));
vi.mock('../apps/Weather/hooks/useWeatherMinute', () => ({ useWeatherMinute: () => 0 }));
vi.mock('../apps/Weather/state', () => ({ useWeatherStore: (selector: (s: unknown) => unknown) => selector({settings: {tempUnit: 'celsius', windUnit: 'kmh', pressureUnit: 'hpa'}}) }));
import { DetailsGrid } from '../apps/Weather/components/DetailsGrid';
const weather: WeatherNow = {obsTime:'',temp:'',feelsLike:'',icon:'',text:'',wind360:'',windDir:'',windScale:'',windSpeed:'',humidity:'',precip:'',pressure:'',vis:'',cloud:'',dew:''};
const render = (wind360: string) => renderToStaticMarkup(React.createElement(DetailsGrid, {weather:{...weather,wind360},today:null}));
describe('wind compass missing data', () => {
 it.each(['', '  ', '--', 'not-a-number'])('does not display a north-pointing needle for %j', value => {
  expect(render(value)).not.toContain('<g transform="rotate(');
 });
 it.each([['0','0'],['90','90'],['360','0']])('keeps the observed angle %s', (value, angle) => {
  expect(render(value)).toContain(`<g transform="rotate(${angle} 50 50)">`);
 });
});
