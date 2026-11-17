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
  await setBilibiliReviewLocale(page,locale,openPilotApp);await openPilotApp(page,'bilibili','/me');
  const app='[data-app-id="bilibili"]',master=`${app} .bili-favorites-master`,detail=`${app} .bili-favorites-detail`;
  await page.waitForSelector(`${app} [data-trigger="favorites.open"]`,{visible:true});await page.click(`${app} [data-trigger="favorites.open"]`);
  await page.waitForFunction(()=>window.__OS__.getAppRoute('bilibili')?.path.startsWith('/favorites'));await page.waitForSelector(master,{visible:true,timeout:5000});
  const dims=await page.evaluate(({app,master,detail})=>{let a=document.querySelector(app).getBoundingClientRect(),m=document.querySelector(master).getBoundingClientRect(),d=document.querySelector(detail).getBoundingClientRect();return {ratio:m.width/a.width,ordered:m.right<=d.left+2,overflow:document.querySelector(app).scrollWidth>document.querySelector(app).clientWidth+2};},{app,master,detail});assert.ok(dims.ratio>.28&&dims.ratio<.43&&dims.ordered&&!dims.overflow);
  assert.equal(await page.$$eval(`${app} [data-scroll-container="main"]`,els=>els.filter(e=>e.checkVisibility()).length),1);
  await page.click(`${detail} [data-trigger="favorites.tab.switch"][data-trigger-params='{"tab":"video"}']`);await page.waitForFunction(()=>new URL(window.__OS__.getAppRoute('bilibili').path,'http://localhost').searchParams.get('tab')==='video');
  assert.equal(await page.$eval(`${app} .bili-favorites-bottom`,e=>getComputedStyle(e).display),'flex');
  await page.evaluate(()=>window.__FOLDAGENT__.setPosture('folded'));await page.waitForFunction(sel=>getComputedStyle(document.querySelector(sel)).display==='none',{timeout:5000},master);
  assert.equal(await page.$eval(`${app} .bili-favorites-bottom`,e=>getComputedStyle(e).display),'none');
  assert.equal(new URL(await page.evaluate(()=>window.__OS__.getAppRoute('bilibili').path),'http://localhost').searchParams.get('tab'),'video');
  await page.evaluate(()=>window.__FOLDAGENT__.setPosture('unfolded'));await page.waitForSelector(master,{visible:true});
  await page.click(`${master} [data-trigger="settings.open"]`);await page.waitForFunction(()=>window.__OS__.getAppRoute('bilibili')?.path==='/settings',{timeout:5000});
  await page.evaluate(()=>window.__OS__.handleBack());await page.waitForSelector(master,{visible:true});assert.equal(new URL(await page.evaluate(()=>window.__OS__.getAppRoute('bilibili').path),'http://localhost').searchParams.get('tab'),'video');
  await page.click(`${detail} [data-trigger="favorites.tab.switch"][data-trigger-params='{"tab":"folders"}']`);
  await page.waitForFunction(()=>new URL(window.__OS__.getAppRoute('bilibili').path,'http://localhost').searchParams.get('tab')==='folders');
  const folderSelector=`${detail} [data-trigger="favFolderDetail.open"]`;await page.waitForSelector(folderSelector,{visible:true});await page.click(folderSelector);
  await page.waitForFunction(()=>window.__OS__.getAppRoute('bilibili')?.path.startsWith('/favorites/folder/'),{timeout:5000});await page.evaluate(()=>window.__OS__.handleBack());await page.waitForSelector(master,{visible:true});
  await page.click(`${app} .bili-favorites-bottom [data-trigger="tab.home"]`);await page.waitForFunction(()=>window.__OS__.getAppRoute('bilibili')?.path.startsWith('/?tab='),{timeout:5000});
  await openPilotApp(page,'bilibili','/me');await page.waitForSelector(`${app} [data-trigger="favorites.open"]`,{visible:true});await page.click(`${app} [data-trigger="favorites.open"]`);await page.waitForSelector(master,{visible:true});
  const biliTask=await page.evaluate(()=>window.__OS__.getState().activeTaskId);await openPilotApp(page,'clock','/alarm');const clockTask=await page.evaluate(()=>window.__OS__.getState().activeTaskId);
  await page.evaluate(({biliTask,clockTask})=>window.__FOLDAGENT__.setMultiWindow('split',biliTask,clockTask,.5),{biliTask,clockTask});
  await page.waitForFunction(sel=>getComputedStyle(document.querySelector(sel)).display==='none',{timeout:5000},master);
  assert.ok((await page.evaluate(()=>window.__OS__.getAppRoute('bilibili').path)).startsWith('/favorites'));
  assert.deepEqual(errors,[]);checks.push({locale,masterDetail:true,tabAndPosture:true,settingsAndBack:true,bottomHome:true,split:true});await context.close();
 }
 console.log(JSON.stringify({passed:true,checks,scope:'local simulated data, no external requests or native parity claim'}));
}finally{await browser.close();}
