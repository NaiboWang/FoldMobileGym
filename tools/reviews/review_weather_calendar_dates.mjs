import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {existsSync} from 'node:fs';
const root=path.resolve(import.meta.dirname,'../..'),front=existsSync(path.join(root,'foldmobilegym/package.json'))?'foldmobilegym':'mobilegym';
const require=createRequire(path.join(root,front,'package.json'));
const executablePath=process.env.FOLDAGENT_BROWSER_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath&&existsSync(executablePath));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3422/');assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath}),results=[],failures=[];
try {for(const zone of ['America/Los_Angeles','Asia/Shanghai'])for(const posture of ['folded','unfolded'])for(const locale of ['zh-Hans','en']) {
 const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];
 try{
  page.on('pageerror',e=>errors.push(e.message));await page.emulateTimezone(zone);await page.setRequestInterception(true);
  page.on('request',r=>{const u=new URL(r.url());if((['localhost','127.0.0.1'].includes(u.hostname)&&['GET','HEAD'].includes(r.method()))||['data:','blob:'].includes(u.protocol))r.continue();else r.abort()});
  await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM_TIME__&&window.__SIM__&&window.__FOLDAGENT__);
  await page.evaluate(async({posture,locale})=>{window.__FOLDAGENT__.setPosture(posture);window.__OS__.locale.setLocale(locale);window.__SIM_TIME__.setSimulatedTime(new Date(2026,9,13,12).getTime(),false);await window.__SIM__.preloadAppStores(['weather']);const state=window.__SIM__.getState().apps.weather;window.__SIM__.setState({apps:{weather:{...state,selectedCityId:'beijing',bundlesByCityId:{}}}},{deep:false,reload:false})},{posture,locale});
  const open=async route=>{await page.evaluate(async route=>{window.__OS__.openApp('weather',route);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))},route);await page.waitForFunction(route=>window.__OS__.getAppRoute('weather')?.path===route,{},route)};
  await open('/');const short='[data-app-id="weather"] .weather-home-daily-column[data-weather-day-date="2026-10-14"]';await page.waitForSelector(short);
  const text=await page.$eval(short,el=>({day:el.querySelector('strong')?.textContent,date:el.querySelector('small')?.textContent}));assert.deepEqual(text,locale==='en'?{day:'Wed',date:'10/14'}:{day:'周三',date:'10月14日'});
  await open('/forecast/daily?cityId=beijing');const detail='[data-app-id="weather"] [data-weather-forecast-date="2026-10-15"]';await page.waitForSelector(detail);
  const detailText=await page.$eval(detail,el=>({day:el.children[0]?.textContent,date:el.children[1]?.textContent}));assert.deepEqual(detailText,locale==='en'?{day:'Thu',date:'10/15'}:{day:'周四',date:'10月15日'});
  assert.deepEqual(errors,[]);results.push({zone,posture,locale});console.log('PASS',zone,posture,locale);
 }catch(e){failures.push({zone,posture,locale,error:String(e)});console.error('FAIL',zone,posture,locale,String(e))}finally{await context.close()}
}}finally{await browser.close()}
console.log(JSON.stringify({passed:!failures.length,results,failures}));if(failures.length)process.exitCode=1;
