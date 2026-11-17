import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {openPilotApp} from '../browser-automation/pilot_app_navigation.mjs';
import {resolveBrowserExecutable} from '../browser-automation/browser.mjs';
const root=path.resolve(import.meta.dirname,'../..'), front=existsSync(path.join(root,'foldmobilegym/package.json'))?'foldmobilegym':'mobilegym';
const require=createRequire(path.join(root,front,'package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3407/');
assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname));
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()}),checks=[],failures=[];
try { for(const posture of ['folded','unfolded']) for(const locale of ['zh-Hans','en']) {
 const context=await browser.createBrowserContext(),p=await context.newPage();
 try {
  await p.setRequestInterception(true);p.on('request',r=>{const u=new URL(r.url());if((['localhost','127.0.0.1'].includes(u.hostname)&&['GET','HEAD'].includes(r.method()))||['data:','blob:'].includes(u.protocol))r.continue();else r.abort();});
  await p.setViewport({width:1440,height:1100});await p.goto(url.href,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);
  await p.evaluate(({posture,locale})=>{window.__FOLDAGENT__.setPosture(posture);window.__OS__.locale.setLocale(locale);},{posture,locale});
  await openPilotApp(p,'weather','/');await p.waitForSelector('[data-app-id="weather"] .weather-details-grid [data-weather-detail="uv"]');
  const facts=await p.$eval('[data-app-id="weather"] .weather-details-grid',root=>{
   const cards=[...root.querySelectorAll(':scope > [data-weather-detail]')].map(e=>{const r=e.getBoundingClientRect();return {key:e.dataset.weatherDetail,x:r.x,y:r.y,height:r.height,width:r.width,text:e.textContent};});
   cards.sort((a,b)=>Math.abs(a.y-b.y)>2?a.y-b.y:a.x-b.x);
   const uv=root.querySelector('[data-weather-detail="uv"]'),aqi=root.querySelector('[data-weather-detail="aqi"]'),feels=root.querySelector('[data-weather-detail="feels"]');
   return {secondary:['sun','humidity','visibility','pressure'].map(key=>{const el=root.querySelector(`[data-weather-detail="${key}"]`);return {key,height:el?.getBoundingClientRect().height,text:el?.textContent,visual:!!el?.querySelector(`[data-weather-visual="${key}"]`), visualHeight:el?.querySelector(`[data-weather-visual="${key}"]`)?.getBoundingClientRect().height};}), cards,uvBar:!!uv?.querySelector('[data-weather-scale="uv"]'),aqiBar:!!aqi?.querySelector('[data-weather-scale="aqi"]'),actualTemp:!!feels?.querySelector('[data-weather-actual-temp]'), windText:root.querySelector('[data-weather-detail="wind"] .weather-reference-wind svg')?.textContent, feelsText:feels?.textContent, hasMarkers:!!aqi?.querySelector('[data-weather-scale="aqi"] span') && !!uv?.querySelector('[data-weather-scale="uv"] span')};
  });
  assert.deepEqual(facts.cards.slice(0,4).map(c=>c.key),['aqi','uv','feels','wind']);
  assert.ok(facts.cards.slice(0,4).every(c=>c.height>=140));
  assert.equal(facts.uvBar,true);assert.equal(facts.aqiBar,true);assert.equal(facts.actualTemp,true);
  assert.equal(facts.hasMarkers,true); assert.match(facts.feelsText,/\d+°/); assert.match(facts.windText,/\d/);
  if(posture==='folded') { assert.ok(Math.abs(facts.cards[0].y-facts.cards[1].y)<2); assert.ok(facts.cards[1].x>facts.cards[0].x); }
  assert.deepEqual(facts.secondary.map(row=>row.key),['sun','humidity','visibility','pressure']); for(const row of facts.secondary){assert.ok(row.height>=140,`${row.key} height ${row.height}`); assert.equal(row.visual,true,`${row.key} visual missing`); assert.ok(row.text?.trim());} assert.ok(facts.secondary.find(row=>row.key==='visibility').visualHeight<=6,'visibility scale should remain a thin line');
  const raw=Number(facts.secondary.find(row=>row.key==='pressure').text.match(/\d+(?:\.\d+)?/)[0]);
  await openPilotApp(p,'weather','/settings');
  await p.click('[data-app-id="weather"] [data-trigger="settings.picker.pressure.open"]');
  await p.waitForSelector('[data-weather-unit-dialog] [data-action="settings.pressureUnit.select.inhg"]',{visible:true});
  await p.click('[data-weather-unit-dialog] [data-action="settings.pressureUnit.select.inhg"]');
  await p.waitForFunction(()=>window.__OS__.getAppRoute('weather')?.path==='/settings');
  await openPilotApp(p,'weather','/');
  await p.waitForFunction(()=>document.querySelector('[data-weather-detail="pressure"] [data-weather-visual="pressure"]')?.textContent.includes('inHg'));
  const converted=await p.$eval('[data-weather-detail="pressure"] [data-weather-visual="pressure"]',el=>el.textContent);
  assert.ok(converted.includes(String(+(raw*0.02953).toFixed(2))), `pressure conversion: ${raw} -> ${converted}`);
  checks.push({posture,locale});console.log('PASS',posture,locale);
 } catch(error) {failures.push({posture,locale,error:String(error)});console.error('FAIL',posture,locale,String(error));}
 finally {await context.close();}
} } finally {await browser.close();}
console.log(JSON.stringify({passed:!failures.length,checks,failures,scope:'Synthetic local Weather secondary detail card hierarchy and geometry; no live weather or full native parity asserted.'}));
if(failures.length) process.exitCode=1;
