import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {resolveBrowserExecutable} from '../../tools/browser-automation/browser.mjs';
import {openPilotApp} from '../../tools/browser-automation/pilot_app_navigation.mjs';
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3100/');
assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await puppeteer.launch({headless:true,executablePath:resolveBrowserExecutable()}),app='[data-app-id="clock"]',checks=[];
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(['127.0.0.1','localhost'].includes(u.hostname)||['data:','blob:'].includes(u.protocol))r.continue();else r.abort();});
 await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
 await page.evaluate(()=>window.__FOLDAGENT__.setPosture('unfolded'));await openPilotApp(page,'clock','/alarm');
 const bar=await (await page.$('[data-gesture-bar]')).boundingBox();assert.ok(bar);await page.mouse.move(bar.x+bar.width/2,bar.y+bar.height-4);await page.mouse.down();await page.mouse.move(bar.x+bar.width*.22,bar.y-240,{steps:18});await page.mouse.up();
 const picker='[data-window-picker="split"]';await page.waitForSelector(picker,{visible:true});await page.click(`${picker} [data-launcher-app="calculator"]`);await page.waitForFunction(()=>window.__FOLDAGENT__.getState().multi_window.mode==='split');
 await page.evaluate(()=>window.__FOLDAGENT__.setPosture('folded'));await page.waitForFunction(()=>window.__FOLDAGENT__.getState().multi_window.split_orientation==='stacked');await new Promise(r=>setTimeout(r,500));
 for(const locale of ['zh-Hans','en']){
  await page.evaluate(locale=>window.__OS__.locale.setLocale(locale),locale);await new Promise(r=>setTimeout(r,200));
  const result=await page.evaluate(app=>{
   const add=document.querySelector(`${app} .clock-alarm-add`),card=document.querySelector(`${app} .clock-alarm-card`),more=document.querySelector(`${app} [aria-haspopup="menu"]`),pane=document.querySelector(app);
   const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
   return {add:box(add),card:box(card),more:box(more),pane:box(pane)};
  },app);
  const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  assert.equal(overlap(result.add,result.card),0,`Add must not cover the first alarm: ${JSON.stringify(result)}`);
  assert.equal(overlap(result.add,result.more),0,'Add must not cover More');
  assert.ok(result.add.left>=result.pane.left&&result.add.right<=result.pane.right&&result.add.top>=result.pane.top&&result.add.bottom<=result.pane.bottom);
  await page.click(`${app} .clock-alarm-add`);await page.waitForSelector(`${app} [data-clock-dialog="editor"]`,{visible:true});
  await page.evaluate(()=>window.__OS__.handleBack());await page.waitForSelector(`${app} [data-clock-dialog="editor"]`,{hidden:true});
  checks.push({locale,noFirstCardOverlap:true,noMoreOverlap:true,addOpens:true});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks}));
}finally{await browser.close();}
