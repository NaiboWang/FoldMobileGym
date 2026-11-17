import {setBilibiliReviewLocale} from './bilibili_review_locale.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {openPilotApp} from '../../tools/browser-automation/pilot_app_navigation.mjs';
import {resolveBrowserExecutable} from '../../tools/browser-automation/browser.mjs';
const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'foldmobilegym/package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3100/');assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname));
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()}),checks=[];
try{
 for(const locale of ['zh-Hans','en'])for(const posture of ['folded','unfolded']){
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(r.method()!=='GET'||(u.origin!==url.origin&&!['data:','blob:'].includes(u.protocol)))r.abort();else r.continue();});
  await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
  await page.evaluate(({locale,posture})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);},{locale,posture});
  await setBilibiliReviewLocale(page,locale,openPilotApp);
  await openPilotApp(page,'bilibili','/me');const initial=await page.evaluate(()=>window.__SIM__.getState().apps.bilibili.user.favoritesFolders);assert.ok(initial.length>1);
  const selected=initial[1];
  for(const prefix of ['/favorites/folder/','/profile/fav/']){
   await openPilotApp(page,'bilibili',prefix+'missing-identity-check');
   const missing='[data-app-id="bilibili"] [data-bili-missing-folder]';await page.waitForSelector(missing,{visible:true,timeout:5000});
   assert.match(await page.$eval(missing,e=>e.innerText),locale==='en'?/not available/i:/不可用/);
   assert.equal(await page.$$eval('[data-app-id="bilibili"] [data-trigger="video.open"]',els=>els.filter(e=>e.checkVisibility()).length),0);
   await page.click(`${missing} button`);await page.waitForFunction(()=>!window.__OS__.getAppRoute('bilibili')?.path.includes('missing-identity-check'),{timeout:5000});
   await openPilotApp(page,'bilibili',prefix+encodeURIComponent(selected.id));await page.waitForFunction(title=>[...document.querySelectorAll('[data-app-id="bilibili"] h1')].some(e=>e.checkVisibility()&&e.textContent===title),{timeout:5000},selected.title);
   assert.equal(await page.$$eval(missing,els=>els.filter(e=>e.checkVisibility()).length),0);
  }
  assert.deepEqual(await page.evaluate(()=>window.__SIM__.getState().apps.bilibili.user.favoritesFolders),initial);assert.deepEqual(errors,[]);checks.push({locale,posture,missingGuard:true,validIdentity:true,stateUnchanged:true});await context.close();
 }
 console.log(JSON.stringify({passed:true,checks,scope:'local simulated folder identity; no reference content or external service'}));
}finally{await browser.close();}
