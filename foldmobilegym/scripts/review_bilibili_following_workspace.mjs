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
 for(const locale of ['zh-Hans','en']){
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(r.method()!=='GET'||(u.origin!==url.origin&&!['data:','blob:'].includes(u.protocol)))r.abort();else r.continue();});
  await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);
  await page.evaluate(locale=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture('unfolded');},locale);
  await setBilibiliReviewLocale(page,locale,openPilotApp);
  await openPilotApp(page,'bilibili','/following?tab=all');
  const app='[data-app-id="bilibili"]',rail=`${app} [data-bili-following-rail]`,main=`${app} .bili-following-main`;
  await page.waitForSelector(rail,{visible:true,timeout:5000});await page.waitForSelector(`${rail} [data-trigger="user.open"]`,{visible:true});
  const geometry=await page.evaluate(({app,rail,main})=>{const host=document.querySelector(app).getBoundingClientRect(),r=document.querySelector(rail).getBoundingClientRect(),m=document.querySelector(main).getBoundingClientRect();return {ratio:r.width/host.width,ordered:r.right<=m.left+2,overflow:document.querySelector(app).scrollWidth>document.querySelector(app).clientWidth+2};},{app,rail,main});
  assert.ok(geometry.ratio>.20&&geometry.ratio<.34&&geometry.ordered&&!geometry.overflow);
  await page.waitForFunction(sel=>{const e=document.querySelector(sel);return e&&e.scrollHeight>e.clientHeight+100;},{timeout:5000},main);
  const offsets=await page.evaluate(({main,rail})=>{const m=document.querySelector(main),r=document.querySelector(rail);m.scrollTop=180;return {main:m.scrollTop,rail:r.scrollTop};},{main,rail});assert.ok(offsets.main>0);assert.equal(offsets.rail,0);
  const mid=await page.$eval(`${rail} [data-trigger="user.open"]`,e=>String(JSON.parse(e.dataset.triggerParams).mid));await page.click(`${rail} [data-trigger="user.open"]`);
  await page.waitForFunction(mid=>window.__OS__.getAppRoute('bilibili')?.path.startsWith(`/user/${mid}`),{timeout:5000},mid);
  await page.evaluate(()=>window.__OS__.handleBack());await page.waitForSelector(rail,{visible:true});
  await page.evaluate(()=>window.__FOLDAGENT__.setPosture('folded'));await page.waitForFunction(sel=>getComputedStyle(document.querySelector(sel)).display==='none',{timeout:5000},rail);
  assert.ok((await page.evaluate(()=>window.__OS__.getAppRoute('bilibili')?.path)).startsWith('/following'));
  await page.waitForFunction(sel=>getComputedStyle(document.querySelector(sel)).display!=='none',{timeout:5000},`${app} .bili-following-compact-visits`);
  await page.evaluate(()=>window.__FOLDAGENT__.setPosture('unfolded'));await page.waitForSelector(rail,{visible:true});
  await page.click(`${app} [data-trigger="following.tab.switch"][data-trigger-params='{"tab":"video"}']`);
  await page.waitForFunction(()=>new URL(window.__OS__.getAppRoute('bilibili').path,'http://localhost').searchParams.get('tab')==='video');
  await page.waitForSelector(rail,{visible:true});
  const biliTask=await page.evaluate(()=>window.__OS__.getState().activeTaskId);await openPilotApp(page,'clock','/alarm');const clockTask=await page.evaluate(()=>window.__OS__.getState().activeTaskId);
  await page.evaluate(({biliTask,clockTask})=>window.__FOLDAGENT__.setMultiWindow('split',biliTask,clockTask,.5),{biliTask,clockTask});
  await page.waitForFunction(sel=>getComputedStyle(document.querySelector(sel)).display==='none',{timeout:5000},rail);
  assert.equal(new URL(await page.evaluate(()=>window.__OS__.getAppRoute('bilibili').path),'http://localhost').searchParams.get('tab'),'video');
  assert.deepEqual(errors,[]);checks.push({locale,expandedRail:true,creatorNavigation:true,postureContinuity:true,tabAndSplit:true});await context.close();
 }
 console.log(JSON.stringify({passed:true,checks,scope:'isolated local simulated data; no real service or exact native behavior claim'}));
}finally{await browser.close();}
