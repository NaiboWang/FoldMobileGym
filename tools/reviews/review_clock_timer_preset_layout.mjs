import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root=path.resolve(import.meta.dirname,'../..');
const front=['foldmobilegym','mobilegym'].find(name=>fs.existsSync(path.join(root,name,'package.json')));
const require=createRequire(path.join(root,front,'package.json'));
const release=fs.existsSync(new URL('../browser-automation/pilot_app_navigation.mjs',import.meta.url));
const {openPilotApp}=await import(release?'../browser-automation/pilot_app_navigation.mjs':'../../foldmobilegym/tools/pilot_app_navigation.mjs');
const executablePath=process.env.FOLDAGENT_BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(fs.existsSync);
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3432/');
assert.ok(executablePath&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname));
const browser=await require('puppeteer').launch({headless:true,executablePath});const checks=[],errors=[];
try{for(const posture of ['folded','unfolded']){const context=await browser.createBrowserContext(),page=await context.newPage();try{
 page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);await openPilotApp(page,'clock','/timer');await page.evaluate(p=>window.__FOLDAGENT__.setPosture(p),posture);await new Promise(r=>setTimeout(r,500));
 const data=await page.evaluate(()=>{const app=document.querySelector('[data-app-id=clock]'),presets=[...app.querySelectorAll('[data-action="timer.preset.select.duration"]')],box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),text:e.textContent.trim(),labelOverflow:e.scrollWidth>e.clientWidth+1}};return{app:box(app),presets:presets.map(box),start:box(app.querySelector('[data-action="timer.run.start"]')),reset:box(app.querySelector('[data-action="timer.setup.reset"]')),bell:box(app.querySelector('[data-action="timer.setup.bell"]')),tab:box(app.querySelector('.clock-tabbar'))};});
 assert.equal(data.presets.length,6);for(const p of data.presets){assert.ok(p.hit&&!p.labelOverflow&&p.w>0&&p.h>0,'Preset must be visible, readable and hittable');assert.ok(Math.abs(p.w-p.h)<2,'Preset must be circular');}
 for(const control of [data.start,data.reset,data.bell])assert.ok(control.hit&&control.bottom<=data.tab.y+1,'Timer controls must not be occluded by the tab bar');
 if(posture==='unfolded'){const span=data.presets[2].right-data.presets[0].x;assert.ok(span/data.app.w<.5,`Unfolded preset group must stay centered and compact: ${span/data.app.w}`);assert.ok(Math.abs((data.presets[0].x+data.presets[2].right)/2-(data.app.x+data.app.w/2))<3,'Preset group must be centered');assert.ok(data.presets[0].w/data.app.w>.09,'Expanded presets must remain legible');}
 const handles=await page.$$('[data-action="timer.preset.select.duration"]');assert.equal(await handles[2].evaluate(e=>e.dataset.actionParams),'{"seconds":600}');await handles[2].click();assert.equal(await handles[2].evaluate(e=>e.getAttribute('aria-pressed')),'true');checks.push({posture,groupWidth:data.presets[2].right-data.presets[0].x,appWidth:data.app.w});console.log('PASS',posture);
 }finally{await context.close();}}assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks,errors}));}finally{await browser.close()}
