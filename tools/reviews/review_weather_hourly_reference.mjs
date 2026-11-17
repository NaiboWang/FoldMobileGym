import assert from 'node:assert/strict';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {openPilotApp} from '../browser-automation/pilot_app_navigation.mjs';
import {resolveBrowserExecutable} from '../browser-automation/browser.mjs';
const root=path.resolve(import.meta.dirname,'../..'),front=existsSync(path.join(root,'foldmobilegym/package.json'))?'foldmobilegym':'mobilegym',require=createRequire(path.join(root,front,'package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3415/');assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname));
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()}),checks=[],failures=[];
try{for(const posture of ['folded','unfolded'])for(const locale of ['zh-Hans','en'])for(const route of ['/','/cities/preview?cityId=nanjing']){
 const ctx=await browser.createBrowserContext(),p=await ctx.newPage();try{
  await p.setRequestInterception(true);p.on('request',r=>{const u=new URL(r.url());if((['localhost','127.0.0.1'].includes(u.hostname)&&['GET','HEAD'].includes(r.method()))||['data:','blob:'].includes(u.protocol))r.continue();else r.abort();});
  await p.setViewport({width:1440,height:1100});await p.goto(url.href,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);await p.evaluate(({posture,locale})=>{window.__FOLDAGENT__.setPosture(posture);window.__OS__.locale.setLocale(locale);},{posture,locale});await openPilotApp(p,'weather',route);
  await p.waitForSelector('[data-app-id="weather"] #hourly_forecast_stub_inflated_id');
  const facts=await p.$eval('[data-app-id="weather"] #hourly_forecast_stub_inflated_id',root=>{const scroll=root.querySelector('[data-weather-hourly-scroll]'),items=[...root.querySelectorAll('[data-weather-hourly-kind]')].filter(e=>getComputedStyle(e).display!=='none').map(e=>({kind:e.dataset.weatherHourlyKind,ts:Number(e.dataset.weatherHourlyTs),time:e.querySelector('[data-weather-hourly-time]')?.textContent,icon:!!e.querySelector('[data-weather-hourly-icon]'),sunIcon:!!e.querySelector('[data-weather-hourly-icon] svg'),value:e.querySelector('[data-weather-hourly-value]')?.textContent}));return {items,scrollWidth:scroll?.scrollWidth,clientWidth:scroll?.clientWidth,chart:!!root.querySelector('[data-weather-hourly-curve]')}});
  assert.ok(facts.items.length>3,'visible hourly forecast slots');assert.equal(facts.chart,false);assert.ok(facts.scrollWidth>facts.clientWidth,'horizontal scroll remains available');
  const now=facts.items.find(e=>e.kind==='now');assert.ok(now?.icon&&now.time&&/^-?\d+°$/.test(now.value));assert.equal(now.time,locale==='en'?'Now':'现在');assert.ok(facts.items.every(e=>e.time&&e.icon&&e.value));assert.ok(facts.items.every((e,i,a)=>i===0||a[i-1].ts<=e.ts));
  if(posture==='folded')assert.equal(facts.items[0].kind,'now');
  const events=facts.items.filter(e=>e.kind==='sunrise'||e.kind==='sunset');assert.ok(events.length>0,'daily sun event is placed within forecast');assert.ok(events.every(event=>event.sunIcon),'sun events use their own icons');
  await p.$eval('[data-app-id="weather"] [data-weather-hourly-scroll]',el=>{el.scrollLeft=el.scrollWidth});assert.ok(await p.$eval('[data-app-id="weather"] [data-weather-hourly-scroll]',el=>el.scrollLeft)>0);
  const celsius=Number.parseInt(now.value,10);
  await openPilotApp(p,'weather','/settings');await p.click('[data-app-id="weather"] [data-trigger="settings.picker.temp.open"]');
  await p.waitForSelector('[data-weather-unit-dialog] [data-action="settings.tempUnit.select.fahrenheit"]',{visible:true});
  await p.click('[data-weather-unit-dialog] [data-action="settings.tempUnit.select.fahrenheit"]');
  await p.waitForFunction(()=>window.__OS__.getAppRoute('weather')?.path==='/settings');await openPilotApp(p,'weather',route);
  await p.waitForSelector('[data-app-id="weather"] [data-weather-hourly-kind="now"] [data-weather-hourly-value]');
  const fahrenheit=await p.$eval('[data-app-id="weather"] [data-weather-hourly-kind="now"] [data-weather-hourly-value]',el=>el.textContent);
  assert.equal(fahrenheit,`${Math.round(celsius*9/5+32)}°`,'hourly forecast honors selected unit');
  checks.push({posture,locale,route});console.log('PASS',posture,locale,route);
 }catch(error){failures.push({posture,locale,route,error:String(error)});console.error('FAIL',posture,locale,route,String(error));}finally{await ctx.close();}
}}finally{await browser.close();}console.log(JSON.stringify({passed:!failures.length,checks,failures,scope:'Local synthetic hourly presentation and horizontal scrolling, not real forecasts or complete device parity.'}));if(failures.length)process.exitCode=1;
