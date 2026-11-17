// Synthetic local Bilibili queue in a real split window; no private media.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { openPilotApp } from '../../tools/browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../../tools/browser-automation/browser.mjs';
import { setBilibiliReviewLocale } from './bilibili_review_locale.mjs';
const require=createRequire(new URL('../package.json',import.meta.url));
const [first,second]=JSON.parse(await readFile(new URL('../apps/Bilibili/data/videos.json',import.meta.url),'utf8')).filter(x=>x.id && x.duration).slice(0,2);
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3217/');
assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
try {
 for(const locale of ['zh-Hans','en']) for(const posture of ['folded','unfolded']) {
  const ctx=await browser.createBrowserContext(),page=await ctx.newPage(),errors=[];
  try {
   page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
   page.on('request',r=>{const u=new URL(r.url());if(r.method()!=='GET'||(u.origin!==url.origin&&!['data:','blob:'].includes(u.protocol))||u.pathname==='/api'||u.pathname.startsWith('/api/'))r.abort();else r.continue()});
   await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
   await page.evaluate(p=>window.__FOLDAGENT__.setPosture(p),posture);
   await openPilotApp(page,'calculator','/');const calculatorTask=await page.evaluate(()=>window.__OS__.getState().activeTaskId);
   await setBilibiliReviewLocale(page,locale,openPilotApp);await openPilotApp(page,'bilibili','/me');
   const folder={id:'synthetic-split-preview',title:'Synthetic split preview',isPublic:false,videoIds:[first.id,second.id]};
   await page.evaluate(folder=>window.__SIM__.setState({apps:{bilibili:{user:{favoritesFolders:[folder]}}}},{deep:true}),folder);
   await openPilotApp(page,'bilibili','/profile/fav/'+folder.id);
   const app='[data-app-id="bilibili"]';await page.waitForSelector(app+' [data-favorite-entry-id]',{visible:true});
   await page.evaluate(({app,locale})=>{const label=locale==='en'?'Play all':'播放全部';const button=[...document.querySelectorAll(app+' button')].find(x=>x.textContent.trim()===label);if(!button||button.disabled)throw Error('Play-all unavailable');button.click()},{app,locale});
   await page.waitForSelector(app+' [data-bili-player][data-video-id="'+first.id+'"]',{visible:true});
   const biliTask=await page.evaluate(()=>window.__OS__.getState().activeTaskId);
   await page.evaluate(({biliTask,calculatorTask})=>window.__FOLDAGENT__.setMultiWindow('split',biliTask,calculatorTask,.5),{biliTask,calculatorTask});
   await page.waitForFunction(s=>document.querySelector(s)?.checkVisibility(),{},app+' [data-bili-player]');
   const slider=await page.$(app+' [data-bili-player] [role="slider"]'),box=await slider.boundingBox();assert.ok(box);
   await page.mouse.click(box.x+box.width*.985,box.y+box.height/2);
   await page.evaluate(id=>window.__OS__.launchTaskById(id),calculatorTask);
   assert.equal(await page.evaluate(()=>window.__OS__.getState().activeTaskId),calculatorTask);
   await page.waitForFunction(s=>document.querySelector(s)?.checkVisibility(),{},app+' [data-bili-player]');
   try { await page.waitForSelector(app+' [data-bili-player][data-video-id="'+second.id+'"]',{visible:true,timeout:10000}); }
   catch (error) { console.error('DIAGNOSTIC',await page.evaluate(s=>({os:window.__OS__.getState().activeTaskId,multi:window.__FOLDAGENT__.getState().multi_window,player:document.querySelector(s+' [data-bili-player]')?.outerHTML.slice(0,400),time:document.querySelector(s+' [data-bili-time]')?.textContent}),app));throw error; }
   assert.equal(await page.evaluate(()=>window.__OS__.getState().activeTaskId),calculatorTask,'Queue must not steal split focus');
   if(locale==='zh-Hans' && posture==='folded') {
    // A hidden Activity cannot advance, then a window-change wakes it once visible.
    await page.evaluate(({biliTask})=>{window.__FOLDAGENT__.setMultiWindow('fullscreen');window.__OS__.launchTaskById(biliTask)},{biliTask});
    await page.evaluate(()=>window.__OS__.handleBack());
    await page.waitForFunction(id=>window.__OS__.getAppRoute('bilibili').path==='/profile/fav/'+id,{},folder.id);
    await page.evaluate(s=>[...document.querySelectorAll(s+' button')].find(x=>x.textContent.trim()==='播放全部').click(),app);
    await page.waitForSelector(app+' [data-bili-player][data-video-id="'+first.id+'"]',{visible:true});
    const bar=await page.$(app+' [data-bili-player] [role="slider"]'),r=await bar.boundingBox();assert.ok(r);
    await page.mouse.click(r.x+r.width*.985,r.y+r.height/2);
    await page.evaluate(id=>window.__OS__.launchTaskById(id),calculatorTask);
    await new Promise(resolve=>setTimeout(resolve,4000));
    assert.equal(await page.evaluate(()=>window.__OS__.getAppRoute('bilibili').path.split('?')[0]),'/video/'+first.id,'A hidden task must not advance');
    await page.evaluate(({biliTask,calculatorTask})=>window.__FOLDAGENT__.setMultiWindow('split',biliTask,calculatorTask,.5),{biliTask,calculatorTask});
    await page.waitForSelector(app+' [data-bili-player][data-video-id="'+second.id+'"]',{visible:true,timeout:10000});
    assert.equal(await page.evaluate(()=>window.__OS__.getState().activeTaskId),calculatorTask);
   }
   assert.deepEqual((await page.evaluate(()=>window.__SIM__.getState().apps.bilibili.user.favoritesFolders))[0].videoIds,folder.videoIds);
   assert.deepEqual(errors,[]);console.log('PASS',locale,posture);
  }finally{await ctx.close()}
 }
}finally{await browser.close()}
