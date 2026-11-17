import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {existsSync} from 'node:fs';
const root=path.resolve(import.meta.dirname,'../..'),front=existsSync(path.join(root,'foldmobilegym/package.json'))?'foldmobilegym':'mobilegym';
const require=createRequire(path.join(root,front,'package.json'));
const executablePath=process.env.FOLDAGENT_BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath&&existsSync(executablePath));const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3422/');assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath}),results=[],failures=[];
try{for(const posture of ['folded','unfolded'])for(const locale of ['zh-Hans','en']){
 const ctx=await browser.createBrowserContext(),page=await ctx.newPage(),errors=[];
 try{
  page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if((['localhost','127.0.0.1'].includes(u.hostname)&&['GET','HEAD'].includes(r.method()))||['data:','blob:'].includes(u.protocol))r.continue();else r.abort()});
  await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM_TIME__&&window.__SIM__&&window.__FOLDAGENT__);
  const base=await page.evaluate(async({posture,locale})=>{window.__FOLDAGENT__.setPosture(posture);window.__OS__.locale.setLocale(locale);const d=window.__SIM_TIME__.getDate();d.setHours(12,0,0,0);window.__SIM_TIME__.setSimulatedTime(d.getTime(),false);await window.__SIM__.preloadAppStores(['weather']);const state=window.__SIM__.getState().apps.weather;const weatherLibrary=Object.fromEntries(Object.entries(state.weatherLibrary).map(([k,e])=>[k,{...e,bundle:e.bundle?{...e.bundle,daily:e.bundle.daily.map(day=>({...day,sunrise:'06:00',sunset:'18:00',iconDay:'100',iconNight:'150',textDay:'晴',textNight:'晴'}))}:e.bundle}]));window.__SIM__.setState({apps:{weather:{...state,selectedCityId:'beijing',bundlesByCityId:{},weatherLibrary}}},{deep:false,reload:false});return d.getTime()},{posture,locale});
  await page.evaluate(async()=>{window.__OS__.openApp('weather','/');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
  const today=await page.evaluate(ts=>{const d=new Date(ts);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`},base);
  const chart=`[data-app-id="weather"] .weather-home-daily-column[data-weather-day-date="${today}"] img`,row=`[data-app-id="weather"] .weather-home-daily-row[data-weather-day-date="${today}"] img`;
  await page.waitForSelector(chart);const icon=async()=>page.$eval(chart,el=>el.getAttribute('src'));const dayIcon=await icon();assert.ok(dayIcon.includes('icon_sunny.')&&!dayIcon.includes('_night'),dayIcon);
  await page.evaluate(ts=>window.__SIM_TIME__.setSimulatedTime(ts,false),base+10*3600000);await page.waitForFunction(sel=>document.querySelector(sel)?.getAttribute('src')?.includes('icon_sunny_night'),{},chart);
  await page.click('[data-app-id="weather"] [data-trigger="forecast.layout.list"]');assert.ok((await page.$eval(row,el=>el.getAttribute('src'))).includes('icon_sunny_night'));
  await page.evaluate(ts=>window.__SIM_TIME__.setSimulatedTime(ts,false),base);await page.waitForFunction(sel=>{const src=document.querySelector(sel)?.getAttribute('src');return src?.includes('icon_sunny.')&&!src.includes('_night')},{},row);
  assert.deepEqual(errors,[]);results.push({posture,locale});console.log('PASS',posture,locale);
 }catch(e){failures.push({posture,locale,error:String(e)});console.error('FAIL',posture,locale,String(e))}finally{await ctx.close()}
}}finally{await browser.close()}console.log(JSON.stringify({passed:!failures.length,results,failures,scope:'Synthetic solar times and icons; no live weather or complete native parity claim.'}));if(failures.length)process.exitCode=1;
