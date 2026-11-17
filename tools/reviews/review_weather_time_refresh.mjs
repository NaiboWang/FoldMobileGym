import assert from 'node:assert/strict';import path from 'node:path';import {existsSync} from 'node:fs';import {createRequire} from 'node:module';
import {openPilotApp} from '../browser-automation/pilot_app_navigation.mjs';import {resolveBrowserExecutable} from '../browser-automation/browser.mjs';
const root=path.resolve(import.meta.dirname,'../..'),front=existsSync(path.join(root,'foldmobilegym/package.json'))?'foldmobilegym':'mobilegym',require=createRequire(path.join(root,front,'package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3416/');assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname));
const b=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()}),checks=[],failures=[];
try{for(const posture of ['folded','unfolded'])for(const locale of ['zh-Hans','en'])for(const route of ['/','/cities/preview?cityId=nanjing']){
 const ctx=await b.createBrowserContext(),p=await ctx.newPage();try{
  await p.setRequestInterception(true);p.on('request',r=>{const u=new URL(r.url());if((['localhost','127.0.0.1'].includes(u.hostname)&&['GET','HEAD'].includes(r.method()))||['data:','blob:'].includes(u.protocol))r.continue();else r.abort();});
  await p.setViewport({width:1440,height:1100});await p.goto(url.href,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__&&window.__SIM_TIME__);const base=await p.evaluate(({posture,locale})=>{window.__FOLDAGENT__.setPosture(posture);window.__OS__.locale.setLocale(locale);const d=window.__SIM_TIME__.getDate();d.setHours(10,0,0,0);window.__SIM_TIME__.setSimulatedTime(d.getTime(),false);return d.getTime();},{posture,locale});
  await openPilotApp(p,'weather',route);await p.waitForSelector('[data-app-id="weather"] [data-weather-hourly-kind="now"]');await p.waitForSelector('[data-app-id="weather"] [data-weather-visual="sun"] circle');
  const initial=await p.evaluate(()=>{const root=document.querySelector('[data-app-id="weather"]'),s=window.__SIM__.getState().apps.weather;return {ts:Number(root.querySelector('[data-weather-hourly-kind="now"]').dataset.weatherHourlyTs),sunTitle:root.querySelector('[data-weather-detail="sun"] .weather-reference-title').textContent,sunX:root.querySelector('[data-weather-visual="sun"] circle').getAttribute('cx'),saved:s.savedCities,selected:s.selectedCityId,settings:s.settings}});
  assert.equal(initial.ts,base);
  await p.$eval('[data-app-id="weather"] [data-weather-hourly-scroll]',el=>{el.scrollLeft=220});
  const beforeScroll=await p.$eval('[data-app-id="weather"] [data-weather-hourly-scroll]',el=>el.scrollLeft);assert.ok(beforeScroll>0);
  // Let the simulator's own minute timer fire (not a fabricated broadcast).
  await p.evaluate(ts=>{window.__SIM_TIME__.setSpeed(1);window.__SIM_TIME__.setSimulatedTime(ts,true)},base+3599000);
  await p.waitForFunction(ts=>Number(document.querySelector('[data-app-id="weather"] [data-weather-hourly-kind="now"]')?.dataset.weatherHourlyTs)===ts,{timeout:1500},base+3540000);
  await p.waitForFunction(ts=>Number(document.querySelector('[data-app-id="weather"] [data-weather-hourly-kind="now"]')?.dataset.weatherHourlyTs)===ts,{timeout:4000},base+3600000);
  await p.evaluate(ts=>window.__SIM_TIME__.setSimulatedTime(ts,false),base+3600000);
  assert.ok(await p.$eval('[data-app-id="weather"] [data-weather-hourly-scroll]',el=>el.scrollLeft)>0,'time tick preserves horizontal scroll');
  if(posture==='folded')assert.equal(await p.$eval('[data-app-id="weather"] [data-weather-hourly-kind]:not(.is-past)',el=>el.dataset.weatherHourlyKind),'now');
  const mid=await p.$eval('[data-app-id="weather"] [data-weather-visual="sun"] circle',e=>e.getAttribute('cx'));assert.notEqual(mid,initial.sunX,'sun position advances with simulated time');
  await p.evaluate(ts=>window.__SIM_TIME__.setSimulatedTime(ts,false),base+12*3600000);
  await p.waitForFunction(({locale})=>document.querySelector('[data-app-id="weather"] [data-weather-detail="sun"] .weather-reference-title')?.textContent.includes(locale==='en'?'Sunrise':'日出'),{timeout:3000},{locale});
  const result=await p.evaluate(()=>{const s=window.__SIM__.getState().apps.weather;return {saved:s.savedCities,selected:s.selectedCityId,settings:s.settings,path:window.__OS__.getAppRoute('weather').path}});assert.deepEqual({saved:result.saved,selected:result.selected,settings:result.settings},{saved:initial.saved,selected:initial.selected,settings:initial.settings});assert.equal(result.path,route);
  checks.push({posture,locale,route});console.log('PASS',posture,locale,route);
 }catch(error){failures.push({posture,locale,route,error:String(error)});console.error('FAIL',posture,locale,route,String(error));}finally{await ctx.close();}
}}finally{await b.close()}console.log(JSON.stringify({passed:!failures.length,checks,failures,scope:'Simulated same-day time jumps and passive local Weather display only; no live-forecast freshness claim.'}));if(failures.length)process.exitCode=1;
