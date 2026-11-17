import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { openPilotApp } from '../../tools/browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../../tools/browser-automation/browser.mjs';
import { setBilibiliReviewLocale } from './bilibili_review_locale.mjs';
const require=createRequire(new URL('../package.json',import.meta.url));
const catalog=JSON.parse(await readFile(new URL('../apps/Bilibili/data/videos.json',import.meta.url),'utf8'));
const [first,second]=catalog.filter(x=>x.id && x.duration).slice(0,2);
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3217/');
assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
try {
 for(const locale of ['zh-Hans','en']) for(const posture of ['folded','unfolded']){
  const ctx=await browser.createBrowserContext(),page=await ctx.newPage(),errors=[];
  try {
   page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
   page.on('request',r=>{const u=new URL(r.url());if(r.method()!=='GET'||(u.origin!==url.origin&&!['data:','blob:'].includes(u.protocol))||u.pathname==='/api'||u.pathname.startsWith('/api/'))r.abort();else r.continue()});
   await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
   await page.evaluate(p=>window.__FOLDAGENT__.setPosture(p),posture);
   await setBilibiliReviewLocale(page,locale,openPilotApp);await openPilotApp(page,'bilibili','/me');
   const folder={id:'synthetic-preview-queue',title:'Synthetic preview queue',isPublic:false,videoIds:[first.id,'missing-test',first.id,second.id]};
   await page.evaluate(folder=>window.__SIM__.setState({apps:{bilibili:{user:{favoritesFolders:[folder]}}}},{deep:true}),folder);
   await openPilotApp(page,'bilibili','/profile/fav/'+folder.id);
   const app='[data-app-id="bilibili"]';await page.waitForSelector(app+' [data-favorite-entry-id]',{visible:true});
   // A stale click after going Home must not start a background queue.
   if(locale==='zh-Hans' && posture==='folded') {
    const task=await page.evaluate(()=>window.__OS__.getState().activeTaskId);
    await page.evaluate(app=>{const button=[...document.querySelectorAll(app+' button')].find(x=>x.textContent.trim()==='播放全部');window.__OS__.goHome();button.click()},app);
    assert.equal(await page.evaluate(()=>window.__OS__.getAppRoute('bilibili').path),'/profile/fav/'+folder.id);
    await page.evaluate(id=>window.__OS__.launchTaskById(id),task);
    await page.waitForSelector(app+' [data-favorite-entry-id]',{visible:true});
   }
   // The floating bar has the localised play-all label.
   await page.evaluate(({app,locale})=>{const text=locale==='en'?'Play all':'播放全部';const el=[...document.querySelectorAll(app+' button')].find(x=>x.textContent.trim()===text);if(!el||el.disabled)throw Error('play-all unavailable');el.click()},{app,locale});
   await page.waitForSelector(app+' [data-bili-player][data-video-id="'+first.id+'"]',{visible:true});
   async function nearlyEnd(){
    await page.waitForFunction(s=>document.querySelector(s)?.getAttribute('data-playing')==='true',{},app+' [data-bili-player]');
    const el=await page.$(app+' [data-bili-player] [role="slider"]'),box=await el.boundingBox();assert.ok(box);
    await page.mouse.click(box.x+box.width*.998,box.y+box.height/2);
   }
   // A manual seek to the end pauses without incorrectly advancing the queue.
   await page.focus(app+' [data-bili-player] [role="slider"]'); await page.keyboard.press('End');
   await new Promise(resolve=>setTimeout(resolve,400));
   assert.equal(await page.evaluate(()=>window.__OS__.getAppRoute('bilibili').path.split('?')[0]),'/video/'+first.id);
   await page.click(app+' [data-bili-player] .bili-player-play');
   if(locale==='zh-Hans' && posture==='folded') {
    // The next item must not replace an open fullscreen history entry.
    await page.click(app+' [data-trigger="video.player.fullscreen.open"]');
    await page.waitForSelector(app+' [data-bili-player][data-fullscreen="true"]');
    await nearlyEnd(); await new Promise(resolve=>setTimeout(resolve,1500));
    assert.equal(await page.evaluate(()=>window.__OS__.getAppRoute('bilibili').path.split('?')[0]),'/video/'+first.id);
    // Explicit replay cancels a completion deferred by fullscreen.
    await page.click(app+' [data-bili-player] .bili-player-play');
    await page.evaluate(()=>window.__OS__.handleBack());
    await new Promise(resolve=>setTimeout(resolve,400));
    assert.equal(await page.evaluate(()=>window.__OS__.getAppRoute('bilibili').path.split('?')[0]),'/video/'+first.id);
    await nearlyEnd();
   } else await nearlyEnd();
   await page.waitForFunction(s=>{const e=document.querySelector(s+' [data-bili-player] [data-bili-time]');return e && /^00:0[0-4]\//.test(e.textContent)}, {timeout:12000},app);
   if(locale==='zh-Hans' && posture==='folded') {
    const task=await page.evaluate(()=>window.__OS__.getState().activeTaskId);
    await nearlyEnd(); await page.evaluate(()=>window.__OS__.goHome());
    await new Promise(resolve=>setTimeout(resolve,1500));
    assert.equal(await page.evaluate(()=>window.__OS__.getAppRoute('bilibili').path.split('?')[0]),'/video/'+first.id);
    await page.evaluate(id=>window.__OS__.launchTaskById(id),task);
   } else await nearlyEnd();
   await page.waitForSelector(app+' [data-bili-player][data-video-id="'+second.id+'"]',{visible:true,timeout:12000});
   await page.evaluate(()=>window.__OS__.handleBack());
   await page.waitForFunction(id=>window.__OS__.getAppRoute('bilibili').path==='/profile/fav/'+id,{},folder.id);
   assert.deepEqual((await page.evaluate(()=>window.__SIM__.getState().apps.bilibili.user.favoritesFolders))[0].videoIds,folder.videoIds);
   assert.deepEqual(errors,[]);console.log('PASS',locale,posture);
  }finally{await ctx.close()}
 }
}finally{await browser.close()}
