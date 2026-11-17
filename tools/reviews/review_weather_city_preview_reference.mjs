import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {openPilotApp} from '../browser-automation/pilot_app_navigation.mjs';
import {resolveBrowserExecutable} from '../browser-automation/browser.mjs';
const root=path.resolve(import.meta.dirname,'../..'),front=existsSync(path.join(root,'foldmobilegym/package.json'))?'foldmobilegym':'mobilegym';
const require=createRequire(path.join(root,front,'package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3414/');
assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname));
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()}),failures=[],checks=[];
try { for(const posture of ['folded','unfolded']) for(const locale of ['zh-Hans','en']) {
 const context=await browser.createBrowserContext(),p=await context.newPage();
 try {
  await p.setRequestInterception(true);p.on('request',r=>{const u=new URL(r.url());if((['localhost','127.0.0.1'].includes(u.hostname)&&['GET','HEAD'].includes(r.method()))||['data:','blob:'].includes(u.protocol))r.continue();else r.abort();});
  await p.setViewport({width:1440,height:1100});await p.goto(url.href,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);
  await p.evaluate(({posture,locale})=>{window.__FOLDAGENT__.setPosture(posture);window.__OS__.locale.setLocale(locale);},{posture,locale});
  const before=await p.evaluate(()=>{const s=window.__SIM__.getState().apps.weather;return {saved:s.savedCities,selected:s.selectedCityId}});
  await openPilotApp(p,'weather','/cities/preview?cityId=nanjing');
  await p.waitForFunction(()=>[...document.querySelectorAll('[data-app-id="weather"] button')].some(e=>['添加','Add'].includes(e.textContent.trim())&&!e.disabled));
  const data=await p.$eval('[data-app-id="weather"]',root=>{
   const hero=root.querySelector('[data-weather-preview-hero]'),hour=root.querySelector('#hourly_forecast_stub_inflated_id'),daily=root.querySelector('.weather-home-daily');
   const rect=el=>el?.getBoundingClientRect().toJSON();return {root:rect(root),hero:rect(hero),hour:rect(hour),daily:rect(daily),layout:daily?.dataset.weatherForecastLayout};
  });
  assert.ok(data.hero&&data.hour&&data.daily,'centered hero, hourly and daily sections must be rendered');
  assert.ok(Math.abs((data.hero.x+data.hero.width/2)-(data.root.x+data.root.width/2))<3);
  assert.ok(data.hour.y<data.daily.y);assert.equal(data.layout,'chart');
  const list=locale==='en'?'List view':'列表';
  await p.click(`[data-app-id="weather"] .weather-home-daily-modes button[aria-label="${list}"]`);
  assert.equal(await p.$eval('[data-app-id="weather"] .weather-home-daily',el=>el.dataset.weatherForecastLayout),'list');
  await p.click('[data-app-id="weather"] .weather-home-daily-more');
  await p.waitForFunction(()=>window.__OS__.getAppRoute('weather')?.path.startsWith('/forecast/daily?'));
  const route=await p.evaluate(()=>window.__OS__.getAppRoute('weather').path);
  assert.ok(route.includes('cityId=nanjing'),`forecast must target previewed city: ${route}`);
  await p.evaluate(()=>window.__OS__.handleBack());
  await p.waitForFunction(()=>window.__OS__.getAppRoute('weather')?.path==='/cities/preview?cityId=nanjing');
  const after=await p.evaluate(()=>{const s=window.__SIM__.getState().apps.weather;return {saved:s.savedCities,selected:s.selectedCityId}});
  assert.deepEqual(after,before,'preview and forecast navigation do not add or select the city');
  await openPilotApp(p,'weather','/cities/preview?cityId=zunyi');
  await p.waitForSelector('[data-app-id="weather"] .weather-city-preview-message[role="status"]',{timeout:15000});
  const failed=await p.$eval('[data-app-id="weather"] .weather-city-preview',el=>({message:el.querySelector('[role="status"]')?.textContent,enabled:!el.querySelectorAll('header button')[1].disabled,hero:!!el.querySelector('[data-weather-preview-hero]')}));
  assert.equal(failed.enabled,false,'cannot add a city whose preview data did not load');
  assert.equal(failed.hero,false,'a different city must not inherit a stale hero');
  assert.ok(failed.message?.trim());
  const failedState=await p.evaluate(()=>{const s=window.__SIM__.getState().apps.weather;return {saved:s.savedCities,selected:s.selectedCityId}});
  assert.deepEqual(failedState,before);
  checks.push({posture,locale});console.log('PASS',posture,locale);
 }catch(error){failures.push({posture,locale,error:String(error)});console.error('FAIL',posture,locale,String(error));}finally{await context.close();}
} }finally{await browser.close();}
console.log(JSON.stringify({passed:!failures.length,checks,failures,scope:'Local synthetic city preview layout and mode toggle; no real weather service or full device parity asserted.'}));if(failures.length)process.exitCode=1;
