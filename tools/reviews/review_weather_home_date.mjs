import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {existsSync} from 'node:fs';
const root=path.resolve(import.meta.dirname,'../..'),front=existsSync(path.join(root,'foldmobilegym/package.json'))?'foldmobilegym':'mobilegym';
const require=createRequire(path.join(root,front,'package.json'));
const executablePath=process.env.FOLDAGENT_BROWSER_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath && existsSync(executablePath));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3422/');
assert.ok(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath}), results=[],failures=[];
try { for(const posture of ['folded','unfolded']) for (const locale of ['zh-Hans','en']) {
 const context=await browser.createBrowserContext(), page=await context.newPage(), errors=[];
 try {
  page.on('pageerror',e=>errors.push(e.message)); await page.setRequestInterception(true);
  page.on('request',r=>{const u=new URL(r.url());if((['localhost','127.0.0.1'].includes(u.hostname)&&['GET','HEAD'].includes(r.method()))||['data:','blob:'].includes(u.protocol))r.continue();else r.abort()});
  await page.setViewport({width:1440,height:1100}); await page.goto(url.href,{waitUntil:'domcontentloaded'}); await page.waitForFunction(()=>window.__OS__&&window.__SIM_TIME__&&window.__SIM__&&window.__FOLDAGENT__);
  const base=await page.evaluate(async ({posture,locale})=>{
   window.__FOLDAGENT__.setPosture(posture); window.__OS__.locale.setLocale(locale);const d=window.__SIM_TIME__.getDate();d.setHours(10,0,0,0);window.__SIM_TIME__.setSimulatedTime(d.getTime(),false);
   await window.__SIM__.preloadAppStores(['weather']);const state=window.__SIM__.getState().apps.weather;
   const weatherLibrary=Object.fromEntries(Object.entries(state.weatherLibrary).map(([key,entry])=>[key,{...entry,bundle:entry.bundle?{...entry.bundle,daily:entry.bundle.daily.map((day,i)=>({...day,tempMax:String(21+i),tempMin:String(11+i),uvIndex:String(1+i)}))}:entry.bundle}]));
   window.__SIM__.setState({apps:{weather:{...state,selectedCityId:'beijing',bundlesByCityId:{},weatherLibrary}}},{deep:false,reload:false});return d.getTime();
  },{posture,locale});
  await page.evaluate(async()=>{window.__OS__.openApp('weather','/');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
  const hero='[data-app-id="weather"] #tv_weather_desc2'; await page.waitForFunction(sel=>document.querySelector(sel)?.textContent.includes('21°'),{},hero);
  const uv='[data-app-id="weather"] .weather-home-card-stack:nth-child(2) [data-weather-detail="uv"] .weather-reference-number';
  await page.waitForFunction(sel=>document.querySelector(sel)?.textContent==='1',{},uv);
  await page.evaluate(ts=>window.__SIM_TIME__.setSimulatedTime(ts,false),base+86400000);
  await page.waitForFunction(sel=>document.querySelector(sel)?.textContent.includes('22°'),{timeout:3000},hero);
  assert.equal(await page.$eval(uv,el=>el.textContent),'2');
  await page.evaluate(ts=>window.__SIM_TIME__.setSimulatedTime(ts,false),base+86400000*30);
  await page.waitForFunction(sel=>!document.querySelector(sel)?.textContent.includes('21°')&&!document.querySelector(sel)?.textContent.includes('22°'),{timeout:3000},hero);
  assert.equal(await page.$eval(uv,el=>el.textContent),'--');
  const open = async route => {
   await page.evaluate(async route => {window.__OS__.openApp('weather',route);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))},route);
   await page.waitForFunction(route=>window.__OS__.getAppRoute('weather')?.path===route,{},route);
  };
  await page.evaluate(ts=>window.__SIM_TIME__.setSimulatedTime(ts,false),base);
  await open('/cities');
  const manager='[data-app-id="weather"] .weather-city-card:nth-child(2) .weather-city-card-range';
  await page.waitForFunction(sel=>document.querySelector(sel)?.textContent.includes('11° / 21°'),{},manager);
  await page.evaluate(ts=>window.__SIM_TIME__.setSimulatedTime(ts,false),base+86400000);
  await page.waitForFunction(sel=>document.querySelector(sel)?.textContent.includes('12° / 22°'),{timeout:3000},manager);
  await page.evaluate(ts=>window.__SIM_TIME__.setSimulatedTime(ts,false),base+86400000*30);
  await page.waitForFunction(sel=>document.querySelector(sel)?.textContent.includes('--° / --°'),{timeout:3000},manager);
  await page.evaluate(ts=>window.__SIM_TIME__.setSimulatedTime(ts,false),base);
  await open('/cities/preview?cityId=beijing');
  const preview='[data-app-id="weather"] .weather-city-preview-high-low';
  await page.waitForFunction(sel=>document.querySelector(sel)?.textContent.includes('21°'),{},preview);
  await page.evaluate(ts=>window.__SIM_TIME__.setSimulatedTime(ts,false),base+86400000);
  await page.waitForFunction(sel=>document.querySelector(sel)?.textContent.includes('22°'),{timeout:3000},preview);
  await page.evaluate(ts=>window.__SIM_TIME__.setSimulatedTime(ts,false),base+86400000*30);
  await page.waitForFunction(sel=>document.querySelector(sel)?.textContent==='',{timeout:3000},preview);
  assert.deepEqual(errors,[]); results.push({posture,locale});console.log('PASS',posture,locale);
 }catch(e){failures.push({posture,locale,error:String(e)});console.log('FAIL',posture,locale,String(e))}finally{await context.close()}
}}finally{await browser.close()}
console.log(JSON.stringify({passed:!failures.length,results,failures}));if(failures.length)process.exitCode=1;
