// Focused simulator QA; never accesses the private phone recording or real services.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(root, 'foldmobilegym/package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3100/');
assert.ok(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
const output=fs.mkdtempSync(path.join(root,'artifacts/weather-menu-'));
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
const app='[data-app-id="weather"]', popup=`${app} [data-weather-menu]`, errors=[], writes=[], checks=[];
const route=page=>page.evaluate(()=>window.__OS__.getAppRoute('weather').path);
const data=page=>page.evaluate(()=>{const s=window.__SIM__.getState().apps.weather;return {settings:s.settings,cities:s.savedCities,selected:s.selectedCityId};});
const back=page=>page.evaluate(async()=>{await new Promise(requestAnimationFrame);window.__OS__.handleBack();await new Promise(requestAnimationFrame);});
async function setup(page,locale,posture,entry){
 page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
 page.on('request',q=>{if(!['GET','HEAD'].includes(q.method())){writes.push(q.method());return q.abort();}const u=new URL(q.url());return u.protocol.startsWith('http')&&u.host!==url.host?q.abort():q.continue();});
 await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
 await page.evaluate(({locale,posture})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);},{locale,posture});await openPilotApp(page,'weather',entry);await page.waitForSelector(`${app} .weather-home-daily`);
}
async function menu(page,kind){
 await page.waitForSelector(`${popup}[data-weather-menu="${kind}"]`,{visible:true});
 const bounds=await page.$eval(popup,el=>{const r=el.getBoundingClientRect(),a=el.closest('[data-app-id]').getBoundingClientRect();return {inside:r.left>=a.left&&r.right<=a.right+1&&r.top>=a.top&&r.bottom<=a.bottom+1,overflow:el.scrollWidth>el.clientWidth+1};});
 assert.ok(bounds.inside);assert.equal(bounds.overflow,false);assert.equal(await page.$eval(`${app} [data-scroll-container="main"]`,el=>el.inert),true);
}
const clickUnit=(page,value)=>page.click(`${popup} [data-action$="select.${value}"]`);
try{
 for(const locale of ['zh-Hans','en'])for(const posture of ['folded','unfolded']){
  const layout=posture==='folded'?'chart':'list', suffix=layout==='list'?'?forecastLayout=list':'';
  const context=await browser.createBrowserContext(),page=await context.newPage();
  try{
   await setup(page,locale,posture,'/'+suffix);const original=await data(page);
   await page.click(`${app} [data-trigger="menu.open"]`);await menu(page,'more');
   const rows=await page.$$eval(`${popup} .weather-home-menu-item`,els=>els.map(el=>({title:el.querySelector('span').childNodes[0].textContent.trim(),disabled:el.disabled,tagged:el.hasAttribute('data-trigger')||el.hasAttribute('data-action')})));
   assert.deepEqual(rows.map(r=>r.title),locale==='en'?['Desktop weather','Temperature Unit','Update interval','Report current weather','Weather news','Settings']:['桌面天气','温度单位','更新间隔','反馈当前天气','天气资讯','设置']);
   assert.deepEqual(rows.filter(r=>r.disabled).map(r=>r.tagged),[false,false,false]);
   await page.screenshot({path:path.join(output,`${locale}-${posture}-more.png`)});
   await page.$eval(`${popup} [data-trigger="menu.temperature.open"]`,el=>{el.click();el.click();});await menu(page,'temperature');
   assert.equal(await page.$$eval(`${popup} [role="radio"]`,els=>els.length),2);
   await back(page);await menu(page,'more');assert.deepEqual(await data(page),original);
   await page.click(`${popup} [data-trigger="menu.temperature.open"]`);await menu(page,'temperature');
   await page.$eval(`${popup} [data-action$="select.fahrenheit"]`,el=>{el.click();el.click();});await menu(page,'more');
   assert.deepEqual(await data(page),{...original,settings:{...original.settings,tempUnit:'fahrenheit'}});
   assert.match(await page.$eval(`${popup} [data-trigger="menu.temperature.open"] small`,el=>el.textContent),/°F/);
   await page.click(`${popup} [data-trigger="menu.temperature.open"]`);await menu(page,'temperature');
   const other=posture==='folded'?'unfolded':'folded';await page.evaluate(p=>window.__FOLDAGENT__.setPosture(p),other);await new Promise(r=>setTimeout(r,500));await menu(page,'temperature');
   assert.equal(await page.$eval(`${popup} [data-action$="select.fahrenheit"]`,el=>el.getAttribute('aria-checked')),'true');
   await page.screenshot({path:path.join(output,`${locale}-${other}-temperature.png`)});
   await page.$eval(`${popup} [data-action$="select.celsius"]`,el=>{window.__OS__.showRecents();el.click();});assert.equal((await data(page)).settings.tempUnit,'fahrenheit');await back(page);await menu(page,'temperature');
   // Same-frame cancellation must invalidate the old radio callback before React paints.
   await page.$eval(`${popup} [data-action$="select.celsius"]`,el=>{window.__OS__.handleBack();el.click();});await menu(page,'more');
   assert.equal((await data(page)).settings.tempUnit,'fahrenheit');
   await page.click(`${popup} [data-trigger="settings.open"]`);await page.waitForFunction(()=>window.__OS__.getAppRoute('weather').path==='/settings');
   await back(page);await page.waitForFunction(()=>window.__OS__.getAppRoute('weather').path.startsWith('/?')||window.__OS__.getAppRoute('weather').path==='/');
   assert.equal(new URL(await route(page),url).searchParams.get('forecastLayout'),layout==='list'?'list':null);
   await page.click(`${app} [data-trigger="menu.open"]`);await menu(page,'more');await page.click(`${popup} [data-trigger="feedback.open"]`);await page.waitForFunction(()=>window.__OS__.getAppRoute('weather').path==='/feedback');await back(page);
   await page.click(`${app} [data-trigger="menu.open"]`);await menu(page,'more');await page.click(`${popup} [data-trigger="menu.temperature.open"]`);await menu(page,'temperature');
   await page.$eval(`${popup} [data-action$="select.celsius"]`,el=>{window.__OS__.goHome();el.click();});assert.equal((await data(page)).settings.tempUnit,'fahrenheit');
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM__);await openPilotApp(page,'weather','/');await page.waitForSelector(`${app} .weather-home-daily`);assert.equal((await data(page)).settings.tempUnit,'fahrenheit');
   await page.click(`${app} [data-trigger="menu.open"]`);await menu(page,'more');await page.click(`${popup} [data-trigger="menu.temperature.open"]`);await menu(page,'temperature');await clickUnit(page,'celsius');await menu(page,'more');assert.deepEqual(await data(page),original);
   checks.push(`${locale}/${posture}: six rows, honest unsupported entries, repeated open, exact C/F mutation, duplicate/cancel/Recents/background guards, posture/forecast retention, feedback/settings Back and reload persistence`);
  }finally{await context.close();}
  const cold=await browser.createBrowserContext(),cp=await cold.newPage();
  try{await setup(cp,locale,posture,'/?menu=temperature&forecastLayout=list');const before=await data(cp);await menu(cp,'temperature');await back(cp);await menu(cp,'more');await back(cp);await cp.waitForSelector(popup,{hidden:true});assert.equal(new URL(await route(cp),url).searchParams.get('forecastLayout'),'list');assert.deepEqual(await data(cp),before);checks.push(`${locale}/${posture}: cold submenu → owning more menu → same home view, no mutation`);}finally{await cold.close();}
 }
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);const result={passed:true,url:url.href,checks,errors,writes,scope:'Focused menu and real temperature settings only; unsupported services and unseen native submenu pixels are not certified'};fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,output,checks}));
}catch(e){fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:false,checks,errors,writes,error:String(e.stack)},null,2));console.error(output);throw e;}finally{await browser.close();}
