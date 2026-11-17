import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { existsSync } from 'node:fs';
const browserCandidates = [process.env.FOLDAGENT_BROWSER_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const executablePath = process.env.FOLDAGENT_BROWSER_PATH ? (existsSync(process.env.FOLDAGENT_BROWSER_PATH) ? process.env.FOLDAGENT_BROWSER_PATH : null) : browserCandidates.find(existsSync);
assert.ok(executablePath, 'Set FOLDAGENT_BROWSER_PATH to an installed Chromium browser');
async function openPilotApp(page, appId, route) {
  await page.evaluate(async ({appId,route}) => {window.__OS__.openApp(appId,route);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},{appId,route});
  await page.waitForFunction(({appId,route})=>window.__OS__.getState().activeAppId===appId&&window.__OS__.getAppRoute(appId)?.path===route,{}, {appId,route});
  await page.waitForSelector(`[data-app-id="${appId}"]`,{visible:true});
}
const root=path.resolve(import.meta.dirname,'../..'),front=existsSync(path.join(root,'foldmobilegym/package.json'))?'foldmobilegym':'mobilegym';
const require=createRequire(path.join(root,front,'package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3422/');
assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const b=await require('puppeteer').launch({headless:true,executablePath}),checks=[],failures=[];
try { for(const posture of ['folded','unfolded']) for(const locale of ['zh-Hans','en']) {
 const ctx=await b.createBrowserContext(),p=await ctx.newPage();
 try {
  await p.setRequestInterception(true);p.on('request',r=>{const u=new URL(r.url());if((['localhost','127.0.0.1'].includes(u.hostname)&&['GET','HEAD'].includes(r.method()))||['data:','blob:'].includes(u.protocol))r.continue();else r.abort();});
  await p.setViewport({width:1440,height:1100});await p.goto(url.href,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__OS__&&window.__SIM_TIME__&&window.__FOLDAGENT__);
  const base=await p.evaluate(({posture,locale})=>{window.__FOLDAGENT__.setPosture(posture);window.__OS__.locale.setLocale(locale);const d=window.__SIM_TIME__.getDate();d.setHours(10,0,0,0);window.__SIM_TIME__.setSimulatedTime(d.getTime(),false);return d.getTime()},{posture,locale});
  await p.evaluate(async()=>{await window.__SIM__.preloadAppStores(['weather']);const state=window.__SIM__.getState().apps.weather;const weatherLibrary=Object.fromEntries(Object.entries(state.weatherLibrary).map(([k,v])=>[k,{...v,airQualityForecast:[]}]));window.__SIM__.setState({apps:{weather:{...state,bundlesByCityId:{},weatherLibrary}}},{deep:false,reload:false});});
  await openPilotApp(p,'weather','/forecast/daily?cityId=beijing');
  const selector='[data-app-id="weather"] [data-scroll-container="forecast"] .relative.shrink-0.flex.flex-col';
  await p.waitForSelector(selector);const before=await p.$$eval(selector,els=>els.map(el=>el.children[0]?.textContent));const today=locale==='en'?'Today':'今天',tomorrow=locale==='en'?'Tomorrow':'明天';
  const todayIndex=before.indexOf(today);assert.ok(todayIndex>=0&&before[todayIndex+1]===tomorrow,'fixture must include today and tomorrow');
  const todayAir=await p.$$eval(selector,(els,i)=>els[i].querySelector('[data-weather-forecast-aqi]')?.textContent,todayIndex);assert.notEqual(todayAir,'--','fixture should have current air quality');
  await p.evaluate(ts=>window.__SIM_TIME__.setSimulatedTime(ts,false),base+86400000);
  await p.waitForFunction(({selector,today,index})=>document.querySelectorAll(selector)[index+1]?.children[0]?.textContent===today,{timeout:3000},{selector,today,index:todayIndex});
  const nextAir=await p.$$eval(selector,(els,i)=>els[i+1].querySelector('[data-weather-forecast-aqi]')?.textContent,todayIndex);assert.equal(nextAir,'--','stale current observation must not be assigned to the new day');
  const after=await p.$$eval(selector,els=>els.map(el=>el.children[0]?.textContent));assert.notEqual(after[todayIndex],today);assert.equal(after[todayIndex+1],today);assert.equal(await p.evaluate(()=>window.__OS__.getAppRoute('weather').path),'/forecast/daily?cityId=beijing');checks.push({posture,locale});console.log('PASS',posture,locale);
 } catch(error){failures.push({posture,locale,error:String(error)});console.error('FAIL',posture,locale,String(error))} finally{await ctx.close()}
}} finally{await b.close()}
console.log(JSON.stringify({passed:!failures.length,checks,failures,scope:'Simulated calendar-date label changes; no live weather freshness claim'}));if(failures.length)process.exitCode=1;
