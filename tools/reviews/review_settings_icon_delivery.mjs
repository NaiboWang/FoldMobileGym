// Passive native request/DOM observations in disposable local browser contexts.
// No interception, throttling, cache flags, priority injection or timeout changes.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import {openPilotApp} from '../browser-automation/pilot_app_navigation.mjs';import {resolveBrowserExecutable} from '../browser-automation/browser.mjs';import {attachTransportEvidence} from './transport_evidence.mjs';import {waitForVisibleImages,readVisibleImageHealth} from './visible_images.mjs';
fs.mkdirSync(path.resolve(import.meta.dirname, '../../artifacts'), { recursive: true });

const root=path.resolve(import.meta.dirname,'../..'),project=path.join(root,'foldmobilegym'),require=createRequire(path.join(project,'package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3100/');assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&!url.username&&!url.password);
const output=fs.mkdtempSync(path.join(root,'artifacts/settings-icon-delivery-')),browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
const app='[data-app-id="settings"]',checks=[],failures=[],errors=[];
const targets=['ic_portable_wlan_hotspot_settings.png','ic_vpn.png','ic_device_connection.png','com_android_thememanager.png'];
const rows=JSON.parse(fs.readFileSync(path.join(project,'DATA_SNAPSHOT.json'),'utf8')).files,pins=new Map(rows.map(r=>[r.path,r]));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(page){await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);}
async function icons(page){await page.waitForSelector(`${app} img[src*="/components/com.android.settings/"]`,{visible:true});await waitForVisibleImages(page,app);const health=await readVisibleImageHealth(page,app);assert.deepEqual(health.failedImages,[]);return health;}
const business=page=>page.evaluate(()=>{const {_temp,...settings}=window.__SIM__.getState().apps.settings;return settings;});
async function checkInitial(page,trace,name){
 const health=await icons(page);const images=await page.$$eval(`${app} img`,es=>es.map(e=>({src:e.getAttribute('src'),currentSrc:e.currentSrc,priority:e.fetchPriority,attribute:e.getAttribute('fetchpriority'),width:e.width,height:e.height,style:e.getAttribute('style'),complete:e.complete,naturalWidth:e.naturalWidth})));
 const requests=trace.snapshot().events.filter(e=>e.kind==='request'&&e.resourceType==='Image'&&e.url.includes('/components/com.android.settings/'));
 fs.writeFileSync(path.join(output,name+'-initial.json'),JSON.stringify({health,images,requests},null,2));
 assert.ok(requests.length>=targets.length,'Need actual native themed-image requests, not vector fallbacks');
 assert.ok(requests.every(e=>e.initialPriority==='High'),'Foreground control glyphs need the native high hint on their initial requests, not only a later observer change');
 for(const target of targets){const image=images.find(e=>e.src.endsWith('/'+target));assert.ok(image,'Keep original themed PNG '+target);assert.ok(image.complete&&image.naturalWidth>0,'Actually decode '+target);}
 assert.ok(images.every(e=>e.priority==='high'),'Foreground DOM hints agree with Activity ownership');return images;
}
async function run(name,fn){const context=await browser.createBrowserContext(),page=await context.newPage(),trace=await attachTransportEvidence(page,{origin:url.origin});page.on('pageerror',e=>errors.push(e.message));
 try{await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await ready(page);await fn(page,trace);checks.push(name);}catch(e){failures.push({name,error:String(e.stack)});await page.screenshot({path:path.join(output,name+'-failure.png')}).catch(()=>{});}finally{fs.writeFileSync(path.join(output,name+'-transport.json'),JSON.stringify(trace.snapshot(),null,2));await trace.stop();await context.close();}}
try{
 for(const locale of ['zh-Hans','en'])for(const posture of ['folded','unfolded'])await run(locale+'-'+posture,async(page,trace)=>{
  await page.evaluate(({locale,posture})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);},{locale,posture});await openPilotApp(page,'settings','/');await page.evaluate(async()=>window.__SIM__.waitForData?.(['settings']));
  const images=await checkInitial(page,trace,locale+'-'+posture),before=await business(page);await page.evaluate(app=>window.__originalSettingsImages=[...document.querySelectorAll(app+' img')],app);
  await openPilotApp(page,'clock','/world');await page.waitForFunction(app=>[...document.querySelectorAll(app+' img')].every(e=>e.fetchPriority==='auto'),{},app);
  await openPilotApp(page,'settings','/');await page.waitForFunction(app=>[...document.querySelectorAll(app+' img')].every(e=>e.fetchPriority==='high'),{},app);
  assert.equal(await page.evaluate(app=>{const now=[...document.querySelectorAll(app+' img')];return now.length===window.__originalSettingsImages.length&&now.every((e,i)=>e===window.__originalSettingsImages[i]);},app),true,'Do not replace img nodes to restart their requests');
  assert.deepEqual(await page.$$eval(`${app} img`,es=>es.map(e=>({src:e.getAttribute('src'),style:e.getAttribute('style'),width:e.width,height:e.height}))),images.map(({src,style,width,height})=>({src,style,width,height})));
  await page.evaluate(()=>window.__OS__.goHome());await page.waitForFunction(app=>[...document.querySelectorAll(app+' img')].every(e=>e.fetchPriority==='auto'),{},app);assert.deepEqual(await business(page),before);
 });
 await run('real-split-foreground-owner',async(page,trace)=>{
  await page.evaluate(()=>window.__FOLDAGENT__.setPosture('unfolded'));await openPilotApp(page,'clock','/world');const bar=await(await page.$('[data-gesture-bar]')).boundingBox();await page.mouse.move(bar.x+bar.width/2,bar.y+bar.height-4);await page.mouse.down();await page.mouse.move(bar.x+bar.width*.22,bar.y-240,{steps:12});await page.mouse.up();const picker='[data-window-picker="split"]';await page.waitForSelector(picker,{visible:true});await page.click(`${picker} [data-launcher-app="settings"]`);await page.waitForFunction(()=>window.__FOLDAGENT__.getState().multi_window.mode==='split');await checkInitial(page,trace,'split');
  await page.evaluate(()=>window.__FOLDAGENT__.setPosture('folded'));await icons(page);const clock='[data-app-id="clock"] [data-trigger="tab.stopwatch"]';await page.waitForSelector(clock,{visible:true});await page.click(clock);await page.waitForFunction(app=>[...document.querySelectorAll(app+' img')].every(e=>e.fetchPriority==='auto'),{},app);await page.screenshot({path:path.join(output,'split-background-settings.png')});
 });
 // Byte checks run after native initial-priority observations, never to warm an acceptance run.
 if(!failures.length){const context=await browser.createBrowserContext(),page=await context.newPage();await page.goto(url.href,{waitUntil:'domcontentloaded'});await ready(page);await openPilotApp(page,'settings','/');await icons(page);const sources=await page.$$eval(`${app} img`,es=>es.map(e=>e.currentSrc||e.src));const hashes=[];
  for(const name of targets){const src=sources.find(s=>s.endsWith('/'+name));assert.ok(src);const relative=new URL(src).pathname.replace(/^\/cdn\//,'');const source=fs.readFileSync(path.join(project,'mobilegym-data',relative));const pinned=pins.get(relative);const response=await fetch(src);const bytes=Buffer.from(await response.arrayBuffer());const sha=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^image\/png/);assert.ok(bytes.equals(source));assert.equal(sha,pinned.sha256);hashes.push({path:relative,bytes:bytes.length,sha256:sha});}
  fs.writeFileSync(path.join(output,'pinned-media.json'),JSON.stringify(hashes,null,2));await context.close();}
}finally{await browser.close();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({checks,failures,errors,passed:!failures.length&&!errors.length,scope:'Passive initial native hint, ownership, original pixels and state invariants; not historical-timeout root-cause or native visual certification'},null,2));}
console.log(JSON.stringify({output,checks,failures,errors}));assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
