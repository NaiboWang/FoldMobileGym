// Local synthetic screenshots; never capture personal reference footage or existing browser profiles.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const require=createRequire(path.join(root,'foldmobilegym/package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3218/');
assert.ok(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const origin=url.origin;
const area=path.resolve(root,'artifacts');
const output=path.resolve(process.env.FOLDAGENT_SHOWCASE_OUTPUT || path.join(area,'readme-showcase-notes-weather'));
assert.equal(fs.realpathSync(area),area,'Artifacts directory must not traverse links');
assert.equal(path.dirname(output),area,'Output must be a direct artifacts child');
assert.ok(!fs.existsSync(output),'Refusing to overwrite prior captures');
fs.mkdirSync(output,{recursive:true});
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
try {
 const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.setRequestInterception(true);
 page.on('request',request=>{
   const u=new URL(request.url());
   if(request.method()==='GET'&&u.origin===origin&&u.pathname!=='/api'&&!u.pathname.startsWith('/api/')) request.continue();
   else request.abort();
 });
 await page.setViewport({width:1440,height:1100,deviceScaleFactor:1});
 await page.goto(url.href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
 await page.evaluate(()=>{window.__SIM__.resetState();window.__OS__.locale.setLocale('zh-Hans');window.__FOLDAGENT__.setPosture('unfolded');});
 await openPilotApp(page,'notes','/note/new');
 const app='[data-app-id="notes"]',title=app+' [data-benchmark-field="notes-title"]',body=app+' [data-benchmark-field="notes-content"]';
 await page.waitForSelector(title,{visible:true});
 await page.click(title);await page.type(title,'Foldable research notes');
 await page.click(body);await page.type(body,'A synthetic demonstration note.\n\n1. Start a task on the wide screen.\n2. Fold the display and continue.\n3. Check that the draft is retained.');
 await page.evaluate(()=>window.__OS__.keyboard.hide());
 for(const posture of ['unfolded','folded']) {
   await page.evaluate(value=>window.__FOLDAGENT__.setPosture(value),posture);
   await new Promise(resolve=>setTimeout(resolve,700));
   assert.equal(await page.$eval(title,e=>e.value),'Foldable research notes');
   assert.ok((await page.$eval(body,e=>e.value)).includes('synthetic demonstration'));
   const clip=await page.$eval('#root',node=>{const r=node.getBoundingClientRect(),p=12;return{x:Math.floor(r.x-p),y:Math.floor(r.y-p),width:Math.ceil(r.width+2*p),height:Math.ceil(r.height+2*p)}});
   assert.ok(clip.x>=0&&clip.y>=0&&clip.x+clip.width<=1440&&clip.y+clip.height<=1100);
   await page.screenshot({path:path.join(output,`notes-editor-${posture}.png`),clip});
 }
 await openPilotApp(page,'weather','/');
 await page.waitForSelector('[data-app-id="weather"] .weather-home-daily-chart',{visible:true});
 for(const posture of ['unfolded','folded']) {
   await page.evaluate(value=>window.__FOLDAGENT__.setPosture(value),posture);
   await new Promise(resolve=>setTimeout(resolve,700));
   const chart='[data-app-id="weather"] .weather-home-daily-chart';
   await page.$eval(chart,el=>el.scrollIntoView({block:'center'}));
   await new Promise(resolve=>setTimeout(resolve,300));
   const clip=await page.$eval('#root',node=>{const r=node.getBoundingClientRect(),p=12;return{x:Math.floor(r.x-p),y:Math.floor(r.y-p),width:Math.ceil(r.width+2*p),height:Math.ceil(r.height+2*p)}});
   assert.ok(clip.x>=0&&clip.y>=0&&clip.x+clip.width<=1440&&clip.y+clip.height<=1100);
   await page.screenshot({path:path.join(output,`weather-forecast-${posture}.png`),clip});
 }
 assert.deepEqual(errors,[]);
 await context.close();console.log(JSON.stringify({passed:true,output}));
} finally {await browser.close();}
