// Exercise failed city preview and recovery using only synthetic simulator data.
import assert from 'node:assert/strict';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const root=path.resolve(import.meta.dirname,'../..'), front=existsSync(path.join(root,'foldmobilegym/package.json'))?'foldmobilegym':'mobilegym';
const require=createRequire(path.join(root,front,'package.json'));
const executablePath=process.env.FOLDAGENT_BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath&&process.env.FOLDAGENT_REVIEW_URL);
const url=new URL(process.env.FOLDAGENT_REVIEW_URL);assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath}), checks=[], failures=[];
try {for(const posture of ['folded','unfolded'])for(const locale of ['zh-Hans','en']) {
 const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];
 try {
  page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));await page.setRequestInterception(true);
  page.on('request',request=>{const target=new URL(request.url());if(request.method()==='GET'&&target.origin===url.origin&&target.pathname!=='/api'&&!target.pathname.startsWith('/api/'))request.continue();else request.abort()});
  await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
  const before=await page.evaluate(async({posture,locale})=>{
   window.__FOLDAGENT__.setPosture(posture);window.__OS__.locale.setLocale(locale);await window.__SIM__.preloadAppStores(['weather']);
   const state=window.__SIM__.getState().apps.weather;window.__OS__.openApp('weather','/cities/preview?cityId=zunyi');
   return JSON.stringify({saved:state.savedCities,selected:state.selectedCityId});
  },{posture,locale});
  const app='[data-app-id="weather"]', status=app+' .weather-city-preview-message[role="status"]';
  await page.waitForSelector(status,{visible:true});
  assert.equal(await page.$eval(app+' .weather-city-preview-header button:last-child',button=>button.disabled),true);
  const retry=status+' button'; assert.ok(await page.$(retry),'Failed preview should offer retry without navigating away');
  await page.click(retry); await page.waitForSelector(status,{visible:true});
  assert.equal(await page.evaluate(()=>{const s=window.__SIM__.getState().apps.weather;return JSON.stringify({saved:s.savedCities,selected:s.selectedCityId})}),before);
  // A malformed local entry without current weather must not enable Add.
  await page.evaluate(()=>{
   const s=window.__SIM__.getState().apps.weather, sample=Object.values(s.weatherLibrary).find(entry=>entry.bundle?.now);
   if(!sample)throw Error('Missing simulated fixture');
   window.__SIM__.setState({apps:{weather:{...s,weatherLibrary:{...s.weatherLibrary,zunyi:{...sample,bundle:{...sample.bundle,now:null}}}}}},{deep:false,reload:false});
  });
  await page.click(retry); await page.waitForSelector(status,{visible:true});
  assert.equal(await page.$eval(app+' .weather-city-preview-header button:last-child',button=>button.disabled),true);
  await page.evaluate(()=>{
   const s=window.__SIM__.getState().apps.weather, sample=Object.entries(s.weatherLibrary).find(([key,entry])=>key!=='zunyi'&&entry.bundle?.now)?.[1];
   if(!sample)throw Error('Missing simulated fixture');
   window.__SIM__.setState({apps:{weather:{...s,weatherLibrary:{...s.weatherLibrary,zunyi:{...sample}}}}},{deep:false,reload:false});
  });
  await page.click(retry); await page.waitForSelector(app+' [data-weather-preview-hero]',{visible:true});
  assert.equal(await page.$eval(app+' .weather-city-preview-header button:last-child',button=>button.disabled),false);
  assert.equal(await page.evaluate(()=>{const s=window.__SIM__.getState().apps.weather;return JSON.stringify({saved:s.savedCities,selected:s.selectedCityId})}),before);
  await page.click(app+' .weather-city-preview-header button:last-child');
  await page.waitForFunction(()=>window.__SIM__.getState().apps.weather.savedCities.some(city=>city.id==='zunyi'));
  assert.equal(await page.evaluate(()=>window.__SIM__.getState().apps.weather.selectedCityId),'zunyi');
  assert.deepEqual(errors,[]); checks.push(`${posture}-${locale}`);console.log('PASS',posture,locale);
 }catch(error){failures.push(`${posture}-${locale}: ${String(error)}`);console.error('FAIL',failures.at(-1));}finally{await context.close()}
}}finally{await browser.close()}
console.log(JSON.stringify({checks,failures}));if(failures.length)process.exitCode=1;
