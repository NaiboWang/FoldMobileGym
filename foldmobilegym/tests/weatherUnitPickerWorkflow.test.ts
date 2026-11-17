import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getWeatherUnitPicker, weatherUnitPickerFallback, WEATHER_UNIT_PICKERS } from '../apps/Weather/utils/unitPicker';
import { NAVIGATION_DECLARATION } from '../apps/Weather/navigation.declaration';
describe('Weather settings declared unit workflows',()=>{
 it.each(WEATHER_UNIT_PICKERS)('derives %s from its exact route/query and restores a missing settings parent',picker=>{
  expect(getWeatherUnitPicker('/settings','?picker='+picker)).toBe(picker);expect(getWeatherUnitPicker('/','?picker='+picker)).toBeNull();
  expect(weatherUnitPickerFallback('/settings','?picker='+picker)).toBe('/settings');expect(weatherUnitPickerFallback('/settings','?picker='+picker,{pathname:'/',search:''})).toBe('/settings');
  expect(weatherUnitPickerFallback('/settings','?picker='+picker,{pathname:'/settings',search:''})).toBeNull();
 });
 it.each(['','?picker=unknown','?menu=more'])('does not invent a unit dialog from %s',search=>expect(getWeatherUnitPicker('/settings',search)).toBeNull());
 it('declares genuine empty-query base states, not pseudo-bases containing null dimensions',()=>{
  for(const path of ['/','/settings']){const route=NAVIGATION_DECLARATION.routes.find(route=>route.path===path)!;expect(route.uiStates[0].search).toEqual({});expect(route.uiStates[0].id).toMatch(/\.base$/);}
  expect(NAVIGATION_DECLARATION.routes.find(route=>route.path==='/settings')?.scrollContainers.map(s=>s.name)).toEqual(['main','unitPicker']);
 });
 it('gates the existing three open transitions behind no picker and keeps original action IDs',()=>{
  for(const picker of WEATHER_UNIT_PICKERS)expect(NAVIGATION_DECLARATION.transitions.find(t=>t.id===`settings.picker.${picker}.open`)).toMatchObject({from:{path:'/settings',search:{picker:null}},to:'/settings',mode:'push',search:{picker}});
  const page=readFileSync(new URL('../apps/Weather/pages/WeatherSettingsPage.tsx',import.meta.url),'utf8');
  expect(page).not.toContain('id: opt.actionId');expect(page).not.toContain('transitionId=');expect(page).toContain('data-weather-settings-background inert={!!picker}');expect(page).toContain('closed.current===location.key');
  expect(page).toContain("bindTap('settings.picker.temp.open'");expect(page).toContain("id:'settings.windUnit.select.kn'");expect(page).toContain("id:'settings.pressureUnit.select.inhg'");
  expect(page).not.toContain('fixed inset-0');expect(page).toContain('role="dialog"');
 });
});
