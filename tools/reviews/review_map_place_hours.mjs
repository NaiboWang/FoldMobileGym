// Local-only, disposable profiles. Read the existing public history place and its
// schedule; time changes are simulator input, never fixture or judge edits.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {openPilotApp} from '../browser-automation/pilot_app_navigation.mjs';
import {resolveBrowserExecutable} from '../browser-automation/browser.mjs';
fs.mkdirSync(path.resolve(import.meta.dirname, '../../artifacts'), { recursive: true });

const root=path.resolve(import.meta.dirname,'../..');
const require=createRequire(path.join(root,'foldmobilegym/package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3100/');
assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const output=fs.mkdtempSync(path.join(root,'artifacts/map-place-hours-'));
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
const app='[data-app-id="map"]',pane=`${app} .map-place-detail-pane`,scroll=`${pane} [data-scroll-container="placeDetails"]`,card=`${pane} [data-map-hours-card]`;
const errors=[],writes=[],checks=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const data=p=>p.evaluate(()=>{const m=window.__SIM__.getState().apps.map;return{settings:m.settings,saved:m.savedPlaceIds,local:m.localPlaces,user:m.user,navigation:m.navigationStartCount,history:m.searchHistory};});
async function setTime(page,value){await page.evaluate(value=>window.__SIM_TIME__.setSimulatedTime(value,false),value);}
async function status(page,label){await page.waitForFunction(({pane,label})=>document.querySelector(`${pane} [data-map-opening-state]`)?.textContent.includes(label)&&document.querySelector(`${pane} [data-map-hours-card] button`)?.textContent.includes(label),{timeout:6000},{pane,label});}
async function scrollToHours(page, requireOverflow=false){
 await page.$eval(scroll,e=>e.scrollTo(0,0));
 await page.click(`${card} button`);
 assert.equal(await page.$eval(`${card} button`,e=>e.getAttribute('aria-expanded')),'true');
 if(requireOverflow){
  // A finger swipe over the title/content scrolls details, not a permanently
  // captured sheet drag. The explicit grab handle must still resize the sheet.
  await page.$eval(scroll,e=>e.scrollTo(0,0));
  const touchBox=await(await page.$(scroll)).boundingBox();
  const height=await page.$eval(pane,e=>e.clientHeight);
  const client=await page.createCDPSession();
  await client.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  const x=touchBox.x+touchBox.width*.5,y=touchBox.y+touchBox.height*.65;
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let step=1;step<=10;step++){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-step*10}]});await wait(20);}
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await wait(350);assert.ok(await page.$eval(scroll,e=>e.scrollTop>0),'Touch must scroll the entire detail content');
  assert.equal(await page.$eval(pane,e=>e.clientHeight),height,'Content touch must not steal the grab-handle drag');
  await client.detach();
  const handle=await(await page.$(`${pane} > div:first-child`)).boundingBox();
  await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2,Math.max(80,handle.y-220),{steps:16});await page.mouse.up();await wait(400);
  assert.ok(await page.$eval(pane,e=>e.clientHeight)>height,'Explicit handle retains sheet resizing');
 }
 const box=await (await page.$(scroll)).boundingBox();
 await page.mouse.move(box.x+box.width*.8,box.y+Math.max(20,box.height*.7));await page.mouse.wheel({deltaY:650});await wait(250);
 const metrics=await page.$eval(scroll,e=>({overflow:e.scrollHeight>e.clientHeight+1,top:e.scrollTop}));
 if(requireOverflow)assert.ok(metrics.overflow,'Short split must keep the complete detail content scrollable');
 if(metrics.overflow)assert.ok(metrics.top>0,'Actual wheel must scroll overflowing details');
 // Pointer activation must remain reachable after scrolling the whole content.
 await page.click(`${card} button`);await page.click(`${card} button`);
 assert.equal(await page.$eval(`${card} button`,e=>e.getAttribute('aria-expanded')),'true');
 const inside=await page.$eval(`${card} button`,e=>{const r=e.getBoundingClientRect(),a=e.closest('[data-app-id="map"]').getBoundingClientRect();return r.top>=a.top-1&&r.bottom<=a.bottom+1&&r.left>=a.left-1&&r.right<=a.right+1;});assert.ok(inside);
}

try{
 for(const locale of ['zh-Hans','en'])for(const posture of ['unfolded','folded']){
  const ctx=await browser.createBrowserContext(),page=await ctx.newPage();
  try{
   page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(!['GET','HEAD'].includes(r.method())){writes.push(r.method());return r.abort();}return u.protocol.startsWith('http')&&u.host!==url.host?r.abort():r.continue();});
   await page.emulateTimezone('Asia/Shanghai');await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__&&window.__SIM_TIME__);
   await page.evaluate(({locale,posture})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);},{locale,posture});
   await setTime(page,'2026-11-02T11:00:00+08:00');await openPilotApp(page,'map','/search');await page.waitForSelector(`${app} .map-search-suggestions`);
   const history=await page.evaluate(()=>window.__SIM__.getState().apps.map.searchHistory.find(x=>x.kind==='place'));
   const item=await page.$(`${app} .map-search-suggestions ::-p-text(${JSON.stringify(history.text)})`);assert.ok(item);await item.click();
   await page.waitForSelector(pane,{visible:true});await page.waitForFunction(id=>window.__SIM__.getState().apps.map.currentView.poi?.place_id===id,{},history.placeId);
   const before=await data(page),open=locale==='en'?'Open now':'正在营业',closed=locale==='en'?'Closed':'已结束营业';await status(page,open);
   await setTime(page,'2026-11-02T22:00:00+08:00');await status(page,closed);
   assert.ok(await page.$eval(pane,e=>/周二10:00|Tue 10:00/.test(e.textContent)));
   await scrollToHours(page);
   await setTime(page,'2026-11-03T10:00:00+08:00');await status(page,open);assert.equal(await page.$eval(`${card} button`,e=>e.getAttribute('aria-expanded')),'true');
   const other=posture==='folded'?'unfolded':'folded';await page.evaluate(p=>window.__FOLDAGENT__.setPosture(p),other);await wait(450);assert.equal(await page.$eval(`${card} button`,e=>e.getAttribute('aria-expanded')),'true');
   const source=await page.evaluate(()=>window.__OS__.getState().activeTaskId);await page.evaluate(()=>window.__OS__.launchApp('clock'));await page.waitForSelector('[data-app-id="clock"] .clock-app-root',{visible:true});const target=await page.evaluate(()=>window.__OS__.getState().activeTaskId);
   await page.evaluate(({source,target})=>{window.__FOLDAGENT__.setPosture('folded');window.__FOLDAGENT__.setMultiWindow('split',source,target,.55);window.__OS__.launchTaskById(source);},{source,target});await wait(650);
   await page.click(`${card} button`);assert.equal(await page.$eval(`${card} button`,e=>e.getAttribute('aria-expanded')),'false');await scrollToHours(page,true);
   await page.screenshot({path:path.join(output,`${locale}-${posture}-short-split-hours.png`)});
   await setTime(page,'2026-11-03T22:00:00+08:00');await status(page,closed);assert.equal(await page.$eval(`${card} button`,e=>e.getAttribute('aria-expanded')),'true');assert.deepEqual(await data(page),before);
   const contentBox=await(await page.$(scroll)).boundingBox();await page.mouse.move(contentBox.x+8,contentBox.y+contentBox.height*.65);await page.mouse.wheel({deltaY:-2000});await wait(350);
   await page.click(`${pane} [data-action="map.place.save"]`);
   const saved={...before,saved:[...new Set([...(before.saved??[]),history.placeId])]};assert.deepEqual(await data(page),saved);
   await page.$eval(`${pane} [data-action="map.place.save"]`,e=>{e.click();e.click();});assert.deepEqual(await data(page),saved);
   await page.evaluate(()=>window.__OS__.handleBack());await page.waitForSelector(pane,{hidden:true});assert.deepEqual(await data(page),saved);
   checks.push(`${locale}/${posture}: real history detail, frozen-time closing/opening updates without another click, weekly disclosure survives time/posture changes, actual touch, grab-handle, wheel and pointer access in short split, real pointer Save/idempotence and Back; only the explicitly saved ID changes`);
  }catch(e){await page.screenshot({path:path.join(output,`${locale}-${posture}-failure.png`)});throw e;}finally{await ctx.close();}
 }
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,url:url.href,checks,errors,writes,scope:'Weekly hours and details accessibility only; no special/holiday hours, place time-zone inference, live business status or complete native-page certification'},null,2));console.log(JSON.stringify({passed:true,output,checks}));
}catch(e){fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:false,checks,errors,writes,error:String(e.stack)},null,2));console.error(output);throw e;}finally{await browser.close();}
