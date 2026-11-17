// Disposable browser validation; existing public synthetic fixtures only, no live geocoding.
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
const output=fs.mkdtempSync(path.join(root,'artifacts/map-pin-picker-'));
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
const app='[data-app-id="map"]',bar=`${app} .map-routing-top-bar`;
const confirm=`${app} [data-action="pinPicker.location.confirm"]`;
const checks=[],errors=[],writes=[],onlineLookups=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const state=p=>p.evaluate(()=>window.__SIM__.getState().apps.map);
const route=async p=>(await state(p)).currentView.route;
const center=p=>p.evaluate(()=>{const c=window.__mapInstance.getCenter();return{lat:c.lat(),lng:c.lng()};});
async function enter(page,side){
 const fields=await page.$$(`${bar} button`);await fields[side==='origin'?0:2].click();
 await page.waitForSelector(`${app} input[placeholder]`,{visible:true});
 await page.waitForSelector(`${app} [data-trigger="tab.me"]`,{hidden:true});
 const query=await page.$eval(`${app} input[placeholder]`,e=>e.value);
 if(side==='origin')assert.equal(query,'','The device-location label must not become a literal search query');
 if(query){await page.click(`${app} [data-action="routePicker.query.clear"]`);}
 await page.waitForSelector(`${app} [data-action="routePicker.map.choose"]`,{visible:true});
 await page.click(`${app} [data-action="routePicker.map.choose"]`);
 await page.waitForSelector(confirm,{visible:true});
 await page.waitForSelector(`${app} [data-trigger="tab.me"]`,{hidden:true});
 await page.waitForFunction(()=>!window.__OS__.keyboard.isVisible());
}
async function pointAt(page,point){
 await page.evaluate(p=>window.__mapInstance.panTo(p),point);await wait(450);
 // Use a real pointer drag on the SDK map; keep it close to the recorded fixture point.
 const box=await (await page.$(`${app} .gm-style`)).boundingBox();
 await page.mouse.move(box.x+box.width*.65,box.y+box.height*.55);await page.mouse.down();
 await page.mouse.move(box.x+box.width*.65+6,box.y+box.height*.55+4,{steps:8});await page.mouse.up();await wait(350);
 return center(page);
}
async function expectPoint(page,side,point){
 await page.waitForFunction(({side,point})=>{
  const value=window.__SIM__.getState().apps.map.currentView.route?.[side];
  return value&&Math.abs(value.lat-point.lat)<1e-8&&Math.abs(value.lng-point.lng)<1e-8
   &&value.name===`${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
 },{}, {side,point});
}
async function geometry(page){
 const result=await page.$eval(confirm,e=>{const r=e.getBoundingClientRect(),a=e.closest('[data-app-id="map"]').getBoundingClientRect();return{inside:r.left>=a.left-1&&r.right<=a.right+1&&r.top>=a.top-1&&r.bottom<=a.bottom+1,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e};});
 assert.ok(result.inside&&result.hit,JSON.stringify(result));
}
try{
 for(const locale of ['zh-Hans','en'])for(const posture of ['unfolded','folded']){
  const ctx=await browser.createBrowserContext(),page=await ctx.newPage();page.setDefaultTimeout(20000);
  try{
   page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
   page.on('request',r=>{const u=new URL(r.url());if(!['GET','HEAD'].includes(r.method())){writes.push(r.method());return r.abort();}if(/GeocodeService|PlaceService|places\.googleapis\.com/i.test(u.href))onlineLookups.push(u.pathname);return u.protocol.startsWith('http')&&u.host!==url.host?r.abort():r.continue();});
   await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__&&window.__SIM__);
   await page.evaluate(({locale,posture})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);},{locale,posture});
   await openPilotApp(page,'map','/');await page.click(`${app} button.bg-teal-700`);await page.waitForSelector(`${app} [data-action="routeSetup.history.choose"]`);await page.click(`${app} [data-action="routeSetup.history.choose"]`);
   await page.waitForSelector(`${app} .map-route-detail-pane`,{visible:true});await page.waitForFunction(()=>window.__SIM__.getState().apps.map.currentView.route!==null);
   const before=await state(page),initial=before.currentView.route;
   await enter(page,'destination');await geometry(page);
   // Confirm and same-frame Back must not commit after the pin overlay is dismissed.
   await page.$eval(confirm,e=>{e.click();window.__OS__.handleBack();});await page.waitForSelector(confirm,{hidden:true});await wait(150);assert.deepEqual(await route(page),initial);
   await page.evaluate(()=>window.__OS__.keyboard.hide());await page.evaluate(()=>window.__OS__.handleBack());await page.waitForSelector(`${app} [data-action="routePicker.map.choose"]`,{hidden:true});
   await enter(page,'destination');
   const task=await page.evaluate(()=>window.__OS__.getState().activeTaskId);
   await page.$eval(confirm,e=>{window.__OS__.goHome();e.click();});await wait(100);assert.deepEqual(await route(page),initial);
   await page.evaluate(task=>window.__OS__.launchTaskById(task),task);await page.waitForSelector(confirm,{visible:true});
   await page.$eval(confirm,e=>{window.__OS__.showRecents();e.click();});await wait(100);assert.deepEqual(await route(page),initial);
   await page.evaluate(()=>window.__OS__.handleBack());await page.waitForSelector(confirm,{visible:true});
   const other=posture==='folded'?'unfolded':'folded';await page.evaluate(p=>window.__FOLDAGENT__.setPosture(p),other);await wait(450);await geometry(page);
   const dest=await pointAt(page,initial.destination);await page.screenshot({path:path.join(output,`${locale}-${posture}-destination-picker.png`)});
   await page.click(confirm);await page.waitForSelector(confirm,{hidden:true});await expectPoint(page,'destination',dest);
   const pickedDestination=(await route(page)).destination;assert.deepEqual((await route(page)).origin,initial.origin);
   // Confirm the second endpoint in an actual folded top/bottom split.
   await page.evaluate(()=>window.__OS__.launchApp('clock'));await page.waitForSelector('[data-app-id="clock"] .clock-app-root',{visible:true});
   const secondary=await page.evaluate(()=>window.__OS__.getState().activeTaskId);
   await page.evaluate(({task,secondary})=>{window.__FOLDAGENT__.setPosture('folded');window.__FOLDAGENT__.setMultiWindow('split',task,secondary,.55);window.__OS__.launchTaskById(task);},{task,secondary});await wait(600);
   await enter(page,'origin');await geometry(page);const start=await pointAt(page,initial.origin);await page.click(confirm);await page.waitForSelector(confirm,{hidden:true});await expectPoint(page,'origin',start);
   assert.deepEqual((await route(page)).destination,pickedDestination);
   assert.deepEqual((await state(page)).settings,before.settings);assert.deepEqual((await state(page)).savedPlaceIds,before.savedPlaceIds);assert.equal((await state(page)).navigationStartCount,before.navigationStartCount);
   await page.screenshot({path:path.join(output,`${locale}-${posture}-picked-route.png`)});
   checks.push(`${locale}/${posture}: real field/map entry and pointer pan, keyboard dismissal, same-frame cancellation, Home/Recents guards, posture continuity and real short split, destination then origin confirmation preserving counterpart, no settings/saved-place/navigation-count mutation`);
  }finally{await ctx.close();}
 }
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(onlineLookups,[]);
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,url:url.href,checks,errors,writes,onlineLookups,scope:'Map point-selection functionality only, no claimed native pixel parity or real navigation'},null,2));console.log(JSON.stringify({passed:true,output,checks}));
}catch(e){fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:false,checks,errors,writes,onlineLookups,error:String(e.stack)},null,2));console.error(output);throw e;}finally{await browser.close();}
